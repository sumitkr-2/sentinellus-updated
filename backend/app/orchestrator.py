"""Docker-backed cluster orchestration with a safe local-development fallback."""
import os
import random
import threading
import time
import sqlite3
from datetime import datetime
from pathlib import Path

try:
    import docker
    from docker.errors import DockerException, NotFound
except ImportError:  # permits API/rate-limiter work without Docker installed
    docker = None
    DockerException = Exception
    NotFound = Exception

DB_PATH = os.getenv("SENTINELLUS_DB", str(Path(__file__).resolve().parent.parent / "sentinellus.db"))


class ClusterManager:
    def __init__(self):
        self.client = None
        self.docker_available = False
        if docker is not None:
            try:
                self.client = docker.from_env(timeout=2)
                self.client.ping()
                self.docker_available = True
            except Exception:
                self.client = None
        self.event_log = []
        self.chaos_mode = os.getenv("CHAOS_MODE", "false").lower() == "true"
        self.stress_mode = False
        self._lb_index = 0
        self._worker_requests = {}
        self._in_flight = {}
        self._unhealthy_until = {}
        self._worker_failures = {}
        self._worker_health = {}
        self._low_load_cycles = 0
        self._last_scale_action = 0.0
        self._traffic_times = []
        self._total_requests = 0
        self._failed_requests = 0
        self._last_metrics_time = time.monotonic()
        self._lock = threading.RLock()
        self._init_db()
        self.add_log("System", "Orchestrator online. Docker: " + ("connected" if self.docker_available else "offline/local mode"))

    def _init_db(self):
        Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT NOT NULL, source TEXT NOT NULL, msg TEXT NOT NULL)")

    def add_log(self, source, message):
        event = {"time": datetime.now().strftime("%H:%M:%S"), "source": str(source), "msg": str(message)}
        with self._lock:
            self.event_log.insert(0, event)
            self.event_log = self.event_log[:100]
            try:
                with sqlite3.connect(DB_PATH, timeout=2) as conn:
                    conn.execute("INSERT INTO events(ts, source, msg) VALUES (?, ?, ?)", (datetime.now().isoformat(timespec="seconds"), event["source"], event["msg"]))
            except sqlite3.Error:
                pass

    def get_events(self, limit=100):
        with sqlite3.connect(DB_PATH) as conn:
            rows = conn.execute("SELECT ts, source, msg FROM events ORDER BY id DESC LIMIT ?", (max(1, min(int(limit), 500)),)).fetchall()
        return [{"time": row[0].split("T")[-1], "source": row[1], "msg": row[2]} for row in rows]

    def _workers(self, all=True):
        if not self.docker_available:
            return []
        return self.client.containers.list(all=all, filters={"label": "sentinellus.role=worker"})

    def spawn_node(self):
        if not self.docker_available:
            self.add_log("AutoScaler", "Cannot scale: Docker daemon is unavailable")
            return False
        try:
            existing = self._workers(all=True)
            if len(existing) >= int(os.getenv("MAX_WORKERS", "12")):
                self.add_log("AutoScaler", "Scale-up blocked: MAX_WORKERS reached")
                return False
            name = f"sentinellus-worker-{int(time.time())}-{random.randint(1000,9999)}"
            image = os.getenv("WORKER_IMAGE", "sentinellus-worker:latest")
            self.client.containers.run(image, command=["uvicorn", "app.worker:app", "--host", "0.0.0.0", "--port", "9000"], detach=True, name=name, labels={"sentinellus.role": "worker", "sentinellus.managed": "autoscaler"}, network=os.getenv("DOCKER_NETWORK", "sentinellus_default"), mem_limit="512m", environment={"WORKER_NAME": name})
            self.add_log("AutoScaler", f"Provisioned worker: {name}")
            return True
        except Exception as exc:
            self.add_log("Error", f"Provisioning failed: {exc}")
            return False

    def remove_node(self):
        if not self.docker_available:
            self.add_log("AutoScaler", "Cannot scale down: Docker daemon is unavailable")
            return False
        try:
            candidates = [c for c in self._workers(all=True) if c.status == "running"]
            if len(candidates) <= int(os.getenv("MIN_WORKERS", "1")):
                self.add_log("AutoScaler", "Scale-down blocked: MIN_WORKERS reached")
                return False
            target = sorted(candidates, key=lambda c: c.attrs.get("Created", ""), reverse=True)[0]
            target.stop(timeout=5)
            target.remove()
            self.add_log("AutoScaler", f"Decommissioned worker: {target.name}")
            return True
        except Exception as exc:
            self.add_log("Error", f"Decommission failed: {exc}")
            return False

    def kill_node(self, container_id):
        if not self.docker_available:
            self.add_log("Error", "Cannot kill node: Docker daemon is unavailable")
            return False
        try:
            c = self.client.containers.get(container_id)
            if c.labels.get("sentinellus.role") != "worker":
                return False
            c.kill()
            self.add_log("Admin", f"Manual termination: {c.name}")
            return True
        except Exception as exc:
            self.add_log("Error", f"Kill failed: {exc}")
            return False

    @staticmethod
    def _container_stats(c):
        try:
            stats = c.stats(stream=False)
            cpu = stats.get("cpu_stats", {})
            prev = stats.get("precpu_stats", {})
            cpu_delta = cpu.get("cpu_usage", {}).get("total_usage", 0) - prev.get("cpu_usage", {}).get("total_usage", 0)
            sys_delta = cpu.get("system_cpu_usage", 0) - prev.get("system_cpu_usage", 0)
            cpus = cpu.get("online_cpus") or len(cpu.get("cpu_usage", {}).get("percpu_usage", []) or [1])
            cpu_percent = max(0, min(100, round(cpu_delta / sys_delta * cpus * 100, 1))) if sys_delta > 0 and cpu_delta >= 0 else 0
            mem = stats.get("memory_stats", {})
            usage = mem.get("usage", 0)
            cache = mem.get("stats", {}).get("cache", 0)
            memory_mb = round(max(0, usage - cache) / (1024 * 1024), 1)
            limit_mb = round(mem.get("limit", 0) / (1024 * 1024), 1)
            return cpu_percent, memory_mb, limit_mb
        except Exception:
            return 0, 0, 0

    def get_system_health(self):
        now = time.monotonic()
        elapsed = max(0.1, now - self._last_metrics_time)
        nodes = []
        if self.docker_available:
            try:
                containers = self._workers(all=True)
            except Exception as exc:
                self.add_log("Error", f"Unable to read worker containers: {exc}")
                containers = []
            running = [c for c in containers if c.status == "running"]
            # Chaos Monkey is opt-in and preserves the configured minimum capacity.
            if self.chaos_mode and len(running) > max(3, int(os.getenv("MIN_WORKERS", "1"))) and random.random() < 0.05:
                victim = random.choice(running)
                try:
                    victim.kill()
                    self.add_log("ChaosEngine", f"Chaos Monkey terminated {victim.name}")
                    running = [c for c in running if c.id != victim.id]
                except Exception as exc:
                    self.add_log("ChaosEngine", f"Chaos action failed: {exc}")
            for c in containers:
                try:
                    c.reload()
                except Exception:
                    pass
                alive = c.status == "running"
                cpu, memory, memory_limit = self._container_stats(c) if alive else (0, 0, 0)
                status = "CRITICAL" if not alive else ("OVERLOADED" if cpu >= 90 else "WARNING" if cpu >= 75 else "HEALTHY")
                metrics = self._worker_metrics(c.name)
                with self._lock:
                    inflight = self._in_flight.get(c.name, 0)
                    cooldown = self._unhealthy_until.get(c.name, 0) > time.monotonic()
                    probe_ok = self._worker_health.get(c.name, True)
                if alive and (cooldown or not probe_ok):
                    status = "CRITICAL"
                nodes.append({
                    "id": c.short_id, "name": c.name, "status": status,
                    "error": "CIRCUIT_OPEN" if cooldown else ("HEALTH_PROBE_FAILED" if alive and not probe_ok else ("NONE" if alive else "CONTAINER_STOPPED")),
                    "cpu": cpu, "memory": memory, "memory_limit": memory_limit,
                    "requests_per_sec": metrics["rps"], "latency": metrics["latency_ms"],
                    "in_flight": inflight, "total_requests": metrics["total_requests"],
                    "failed_requests": metrics["failed_requests"],
                })
            active = len(running)
            health_score = max(0, 100 - (len(containers) - active) * 20 - sum(1 for n in nodes if n["status"] == "OVERLOADED") * 5)
            mode = "docker"
        else:
            # Honest empty state for local API development; no fabricated container metrics.
            nodes = []
            active = 0
            health_score = 0
            mode = "local-no-docker"
        self._last_metrics_time = now
        events = self.get_events(100)
        traffic, avg_latency, total_requests, failed_requests = self._global_metrics()
        return {
            "nodes": nodes, "events": events, "total_traffic": traffic,
            "avg_latency": avg_latency, "total_requests": total_requests,
            "failed_requests": failed_requests, "health_score": health_score,
            "stress_mode": self.stress_mode, "chaos_mode": self.chaos_mode,
            "load_balancing_algorithm": "least-connections-with-latency-tiebreak",
            "mode": mode, "docker_available": self.docker_available,
            "active_nodes": active, "autoscaling_enabled": os.getenv("AUTOSCALING_ENABLED", "true").lower() == "true",
            "timestamp": datetime.now().isoformat(timespec="seconds")
        }

    def heal_node(self, container_id):
        if not self.docker_available:
            return False
        try:
            c = self.client.containers.get(container_id)
            if c.labels.get("sentinellus.role") != "worker":
                return False
            c.restart(timeout=5)
            self.add_log("Orchestrator", f"Recovery protocol restored {c.name}")
            return True
        except Exception as exc:
            self.add_log("Error", f"Recovery failed for {container_id}: {exc}")
            return False

    def recover_stopped_workers(self):
        """Restart stopped labelled workers without depending on an open dashboard socket."""
        if not self.docker_available:
            return 0
        recovered = 0
        try:
            for container in self._workers(all=True):
                try:
                    container.reload()
                    if container.status != "running":
                        if self.heal_node(container.short_id):
                            recovered += 1
                except Exception as exc:
                    self.add_log("SelfHealing", f"Could not inspect {getattr(container, 'name', 'worker')}: {type(exc).__name__}")
        except Exception as exc:
            self.add_log("SelfHealing", f"Worker reconciliation failed: {type(exc).__name__}")
        return recovered

    def record_request(self, worker_name, latency_ms, success=True):
        now = time.monotonic()
        with self._lock:
            item = self._worker_requests.setdefault(worker_name, {
                "times": [], "latencies": [], "total_requests": 0, "failed_requests": 0
            })
            item["times"].append(now)
            item["latencies"].append((now, max(0, float(latency_ms))))
            item["total_requests"] += 1
            if not success:
                item["failed_requests"] += 1
                self._failed_requests += 1
            self._total_requests += 1
            self._traffic_times.append(now)
            self._traffic_times = [t for t in self._traffic_times if now - t <= 10]
            item["times"] = [t for t in item["times"] if now - t <= 10]
            item["latencies"] = [(t, v) for t, v in item["latencies"] if now - t <= 60]

    def _worker_metrics(self, worker_name):
        now = time.monotonic()
        with self._lock:
            item = self._worker_requests.get(worker_name, {
                "times": [], "latencies": [], "total_requests": 0, "failed_requests": 0
            })
            recent = [t for t in item["times"] if now - t <= 10]
            latencies = [v for t, v in item["latencies"] if now - t <= 60]
            return {
                "rps": round(len(recent) / 10, 2),
                "latency_ms": round(sum(latencies) / len(latencies), 2) if latencies else 0,
                "total_requests": item["total_requests"],
                "failed_requests": item["failed_requests"],
            }

    def _global_metrics(self):
        now = time.monotonic()
        with self._lock:
            self._traffic_times = [t for t in self._traffic_times if now - t <= 10]
            latencies = [
                latency for item in self._worker_requests.values()
                for ts, latency in item["latencies"] if now - ts <= 60
            ]
            return (
                round(len(self._traffic_times) / 10, 2),
                round(sum(latencies) / len(latencies), 2) if latencies else 0,
                self._total_requests,
                self._failed_requests,
            )

    def acquire_worker(self):
        """Atomically choose and reserve the least-loaded eligible worker."""
        if not self.docker_available:
            return None
        now = time.monotonic()
        try:
            candidates = self._workers(all=False)
            eligible = []
            for container in candidates:
                try:
                    container.reload()
                    if container.status != "running":
                        continue
                    with self._lock:
                        if self._unhealthy_until.get(container.name, 0) > now:
                            continue
                        if self._worker_health.get(container.name) is False:
                            continue
                        metrics = self._worker_metrics(container.name)
                        inflight = self._in_flight.get(container.name, 0)
                    # In-flight requests dominate; latency breaks ties.
                    eligible.append((inflight, metrics["latency_ms"], metrics["rps"], container.name, container))
                except Exception:
                    continue
            if not eligible:
                return None
            eligible.sort(key=lambda item: (item[0], item[1], item[2], item[3]))
            with self._lock:
                # Re-check and reserve under the lock so concurrent callers do not
                # all select the same worker based on a stale in-flight count.
                eligible.sort(key=lambda item: (
                    self._in_flight.get(item[3], 0), item[1], item[2], item[3]
                ))
                selected = eligible[0][4]
                self._in_flight[selected.name] = self._in_flight.get(selected.name, 0) + 1
            return selected
        except Exception as exc:
            self.add_log("LoadBalancer", f"Worker discovery failed: {type(exc).__name__}")
            return None

    def release_worker(self, worker_name):
        with self._lock:
            current = self._in_flight.get(worker_name, 0)
            if current <= 1:
                self._in_flight.pop(worker_name, None)
            else:
                self._in_flight[worker_name] = current - 1

    def mark_worker_unhealthy(self, worker_name, reason="request failed"):
        """Open a simple circuit after consecutive failures; supervisor health probes can close it."""
        threshold = max(1, int(os.getenv("CIRCUIT_BREAKER_FAILURE_THRESHOLD", "2")))
        cooldown = max(1, int(os.getenv("WORKER_COOLDOWN_SECONDS", "10")))
        with self._lock:
            failures = self._worker_failures.get(worker_name, 0) + 1
            self._worker_failures[worker_name] = failures
            if failures >= threshold:
                self._unhealthy_until[worker_name] = time.monotonic() + cooldown
                self.add_log("CircuitBreaker", f"OPEN: {worker_name} excluded for {cooldown}s after {failures} consecutive failures ({reason})")

    def worker_names_for_probe(self):
        if not self.docker_available:
            return []
        try:
            return [c.name for c in self._workers(all=False) if c.status == "running"]
        except Exception:
            return []

    def record_health_probe(self, worker_name, healthy, detail=""):
        with self._lock:
            was_healthy = self._worker_health.get(worker_name, True)
            self._worker_health[worker_name] = bool(healthy)
            if healthy:
                self._worker_failures[worker_name] = 0
                # A successful probe only closes the breaker after cooldown has elapsed.
                if self._unhealthy_until.get(worker_name, 0) <= time.monotonic():
                    self._unhealthy_until.pop(worker_name, None)
            if not healthy:
                self._worker_failures[worker_name] = self._worker_failures.get(worker_name, 0) + 1
        if not healthy and was_healthy:
            self.add_log("HealthProbe", f"Worker {worker_name} failed HTTP health check {detail}".strip())
        elif healthy and not was_healthy:
            self.add_log("HealthProbe", f"Worker {worker_name} health check recovered")

    def autoscale_tick(self):
        """Apply conservative CPU/RPS-based scaling with cooldown and hysteresis."""
        if not self.docker_available or os.getenv("AUTOSCALING_ENABLED", "true").lower() != "true":
            return {"action": "disabled-or-no-docker"}
        now = time.monotonic()
        cooldown = max(10, int(os.getenv("AUTOSCALER_COOLDOWN_SECONDS", "30")))
        if now - self._last_scale_action < cooldown:
            return {"action": "cooldown"}
        try:
            workers = [c for c in self._workers(all=False) if c.status == "running"]
            if not workers:
                self.spawn_node()
                self._last_scale_action = now
                return {"action": "scale-up", "reason": "no-running-workers"}
            cpu_values = [self._container_stats(c)[0] for c in workers]
            total_rps = sum(self._worker_metrics(c.name)["rps"] for c in workers)
            avg_cpu = sum(cpu_values) / len(cpu_values)
            max_cpu = max(cpu_values)
            scale_up_cpu = float(os.getenv("SCALE_UP_CPU_PERCENT", "75"))
            scale_down_cpu = float(os.getenv("SCALE_DOWN_CPU_PERCENT", "25"))
            scale_up_rps = float(os.getenv("SCALE_UP_TOTAL_RPS", "20"))
            scale_down_rps = float(os.getenv("SCALE_DOWN_TOTAL_RPS", "3"))
            max_workers = max(1, int(os.getenv("MAX_WORKERS", "12")))
            min_workers = max(1, int(os.getenv("MIN_WORKERS", "1")))
            if len(workers) < max_workers and (max_cpu >= scale_up_cpu or total_rps >= scale_up_rps):
                if self.spawn_node():
                    self._last_scale_action = now
                    self._low_load_cycles = 0
                    self.add_log("AutoScaler", f"Scale-up: workers={len(workers)} avg_cpu={avg_cpu:.1f}% max_cpu={max_cpu:.1f}% total_rps={total_rps:.2f}")
                    return {"action": "scale-up", "workers_before": len(workers), "avg_cpu": avg_cpu, "total_rps": total_rps}
            if avg_cpu <= scale_down_cpu and total_rps <= scale_down_rps:
                self._low_load_cycles += 1
            else:
                self._low_load_cycles = 0
            # Require several consecutive low-load checks and remove only autoscaler-created workers.
            required_cycles = max(2, int(os.getenv("SCALE_DOWN_CONSECUTIVE_CHECKS", "3")))
            autoscaled = []
            for c in workers:
                try:
                    c.reload()
                    if c.labels.get("sentinellus.managed") == "autoscaler":
                        autoscaled.append(c)
                except Exception:
                    continue
            if len(workers) > min_workers and autoscaled and self._low_load_cycles >= required_cycles:
                target = sorted(autoscaled, key=lambda c: c.attrs.get("Created", ""), reverse=True)[0]
                target.stop(timeout=5)
                target.remove()
                self._last_scale_action = now
                self._low_load_cycles = 0
                self.add_log("AutoScaler", f"Scale-down: removed {target.name}; avg_cpu={avg_cpu:.1f}% total_rps={total_rps:.2f}")
                return {"action": "scale-down", "removed": target.name, "avg_cpu": avg_cpu, "total_rps": total_rps}
            return {"action": "hold", "workers": len(workers), "avg_cpu": round(avg_cpu, 1), "max_cpu": round(max_cpu, 1), "total_rps": total_rps, "low_load_cycles": self._low_load_cycles}
        except Exception as exc:
            self.add_log("AutoScaler", f"Scaling check failed: {type(exc).__name__}: {exc}")
            return {"action": "error", "error": type(exc).__name__}

    def next_worker(self):
        """Compatibility alias for least-loaded selection; callers should reserve/release explicitly."""
        return self.acquire_worker()

    def set_stress_mode(self, enabled):
        self.stress_mode = bool(enabled)
        self.add_log("StressTest", f"Stress mode {'enabled' if enabled else 'disabled'} (traffic is generated by the load-test script, not this flag)")
        return self.stress_mode

    def set_chaos_mode(self, enabled):
        self.chaos_mode = bool(enabled)
        self.add_log("ChaosEngine", f"Chaos mode {'enabled' if enabled else 'disabled'}")
        return self.chaos_mode
