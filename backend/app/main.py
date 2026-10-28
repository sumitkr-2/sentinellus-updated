import asyncio
import os
import time
from typing import Optional
from contextlib import suppress

import httpx
from fastapi import FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from .orchestrator import ClusterManager
from .rate_limiter import RateLimitMiddleware

app = FastAPI(title="Sentinellus API", version="2.2.0")
manager = ClusterManager()
API_TOKEN = os.getenv("SENTINELLUS_API_TOKEN", "")

app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv(
        "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",") if origin.strip()],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


def require_token(authorization: Optional[str]):
    if API_TOKEN and authorization != f"Bearer {API_TOKEN}":
        raise HTTPException(status_code=401, detail="Missing or invalid bearer token")


async def _supervisor_loop():
    """Continuously probe worker HTTP health and evaluate autoscaling policy."""
    last_scale_check = 0.0
    async with httpx.AsyncClient(timeout=httpx.Timeout(1.5)) as client:
        while True:
            for worker_name in manager.worker_names_for_probe():
                healthy = False
                detail = ""
                try:
                    response = await client.get(f"http://{worker_name}:9000/health")
                    healthy = response.status_code == 200 and response.json().get("status") == "healthy"
                    if not healthy:
                        detail = f"(HTTP {response.status_code})"
                except (httpx.HTTPError, ValueError) as exc:
                    detail = f"({type(exc).__name__})"
                manager.record_health_probe(worker_name, healthy, detail)
            manager.recover_stopped_workers()
            now = time.monotonic()
            if now - last_scale_check >= max(5, int(os.getenv("AUTOSCALER_INTERVAL_SECONDS", "10"))):
                manager.autoscale_tick()
                last_scale_check = now
            await asyncio.sleep(max(2, int(os.getenv("HEALTH_PROBE_INTERVAL_SECONDS", "5"))))


@app.on_event("startup")
async def start_supervisor():
    app.state.supervisor_task = asyncio.create_task(_supervisor_loop())


@app.on_event("shutdown")
async def stop_supervisor():
    task = getattr(app.state, "supervisor_task", None)
    if task:
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task


@app.get("/health")
async def health():
    return {"status": "ok", "docker_available": manager.docker_available}


@app.get("/api/health")
async def system_health():
    return manager.get_system_health()


@app.get("/api/autoscaler")
async def autoscaler_status():
    state = manager.get_system_health()
    return {"enabled": state["autoscaling_enabled"], "mode": state["mode"], "active_nodes": state["active_nodes"], "min_workers": int(os.getenv("MIN_WORKERS", "1")), "max_workers": int(os.getenv("MAX_WORKERS", "12")), "scale_up_cpu_percent": float(os.getenv("SCALE_UP_CPU_PERCENT", "75")), "scale_up_total_rps": float(os.getenv("SCALE_UP_TOTAL_RPS", "20")), "scale_down_cpu_percent": float(os.getenv("SCALE_DOWN_CPU_PERCENT", "25")), "scale_down_total_rps": float(os.getenv("SCALE_DOWN_TOTAL_RPS", "3"))}


@app.get("/api/events")
async def events(limit: int = 100):
    return {"events": manager.get_events(limit)}


@app.post("/api/kill/{node_id}")
async def kill_node(node_id: str, authorization: Optional[str] = Header(default=None)):
    require_token(authorization)
    if not manager.kill_node(node_id):
        raise HTTPException(status_code=503, detail="Node could not be killed; check Docker and worker ID")
    return {"status": "killed", "node_id": node_id}


@app.post("/api/spawn")
async def spawn_node(authorization: Optional[str] = Header(default=None)):
    require_token(authorization)
    success = manager.spawn_node()
    if not success:
        raise HTTPException(status_code=503, detail="Worker could not be provisioned; check Docker, image and scaling limits")
    return {"status": "spawned"}


@app.post("/api/remove")
async def remove_node(authorization: Optional[str] = Header(default=None)):
    require_token(authorization)
    if not manager.remove_node():
        raise HTTPException(status_code=503, detail="Worker could not be removed; check Docker and MIN_WORKERS")
    return {"status": "removed"}


@app.post("/api/stress/{enabled}")
async def stress_mode(enabled: str, authorization: Optional[str] = Header(default=None)):
    require_token(authorization)
    normalized = enabled.lower()
    if normalized not in {"true", "false", "1", "0", "on", "off"}:
        raise HTTPException(status_code=400, detail="Use true or false")
    active = normalized in {"true", "1", "on"}
    manager.set_stress_mode(active)
    return {"stress_mode": active, "note": "Dashboard mode flag only; it does not generate CPU load."}


@app.post("/api/chaos/{enabled}")
async def chaos_mode(enabled: str, authorization: Optional[str] = Header(default=None)):
    require_token(authorization)
    normalized = enabled.lower()
    if normalized not in {"true", "false", "1", "0", "on", "off"}:
        raise HTTPException(status_code=400, detail="Use true or false")
    active = normalized in {"true", "1", "on"}
    manager.set_chaos_mode(active)
    return {"chaos_mode": active}


@app.get("/api/proxy")
async def load_balanced_request(delay_ms: int = 0):
    """Proxy through least-loaded healthy worker; optional bounded delay enables safe demos."""
    if delay_ms < 0 or delay_ms > 2000:
        raise HTTPException(status_code=400, detail="delay_ms must be between 0 and 2000")
    worker = manager.acquire_worker()
    if worker is None:
        raise HTTPException(status_code=503, detail="No eligible workers available")
    started = time.perf_counter()
    succeeded = False
    try:
        timeout = httpx.Timeout(connect=1.0, read=5.0, write=2.0, pool=1.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.get(f"http://{worker.name}:9000/work", params={"delay_ms": delay_ms})
            response.raise_for_status()
            try:
                payload = response.json()
            except ValueError:
                payload = {"body": response.text[:500]}
        latency_ms = (time.perf_counter() - started) * 1000
        manager.record_request(worker.name, latency_ms, success=True)
        succeeded = True
        return {
            "algorithm": "least-connections-with-latency-tiebreak",
            "routed_to": worker.name,
            "latency_ms": round(latency_ms, 2),
            "worker_response": payload,
            "delay_ms": delay_ms,
        }
    except (httpx.HTTPError, ValueError) as exc:
        latency_ms = (time.perf_counter() - started) * 1000
        manager.record_request(worker.name, latency_ms, success=False)
        manager.mark_worker_unhealthy(worker.name, str(exc))
        manager.add_log("LoadBalancer", f"Worker {worker.name} failed; circuit opened briefly: {type(exc).__name__}")
        raise HTTPException(status_code=502, detail=f"Worker {worker.name} failed; retry the request") from exc
    finally:
        manager.release_worker(worker.name)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            system_state = manager.get_system_health()
            for node in system_state["nodes"]:
                if node["status"] == "CRITICAL":
                    manager.heal_node(node["id"])
            await websocket.send_json(system_state)
            await asyncio.sleep(1)
    except (WebSocketDisconnect, RuntimeError):
        pass
    except Exception as exc:
        manager.add_log("WebSocket", f"Telemetry connection ended: {type(exc).__name__}")
