# Sentinellus v2.3 — Self-Healing Infrastructure, Adaptive Load Balancing & Autoscaling

Sentinellus is a local Docker-based infrastructure demo with a FastAPI control plane, Redis-backed rate limiting, a React dashboard, and containerized workers.

## Implemented behavior

- **Least-loaded request routing:** `/api/proxy` selects a running worker using in-flight request count first, then observed average latency, recent request rate, and worker name as deterministic tie-breakers. Requests reserve a worker atomically and release the reservation in a `finally` block.
- **Circuit breaker and active health checks:** repeated proxy failures open a per-worker circuit; a background supervisor probes each running worker HTTP `/health` endpoint and unhealthy workers are excluded from routing until health recovers and cooldown expires.
- **Live request metrics:** proxy traffic is counted from actual completed/failed proxy attempts. The API reports global requests/sec over a rolling 10-second window, average observed latency, total requests, failed requests, and per-worker in-flight requests, request rate, latency, and request totals.
- **Self-healing:** a background supervisor detects and restarts stopped labelled workers even when the dashboard is not open.
- **Automatic horizontal scaling:** a background autoscaler evaluates worker CPU and measured aggregate proxy request rate. It scales up above configurable thresholds, and scales down only autoscaler-created workers after multiple consecutive low-load checks. Scale actions have cooldowns and respect configured limits. Manual controls remain available.
- **Redis-backed rate limiting:** rolling-window limit shared across backend processes when Redis is available; in-memory fallback for local development.
- **Persistent event log:** SQLite stores event history in the mounted `/data` volume.
- **Chaos mode:** opt-in and disabled by default. Use only in a controlled local demo.
- **Repeatable concurrent load test:** `scripts/load_test.py` generates concurrent traffic and reports throughput, latency percentiles, errors, and worker distribution. `/api/proxy?delay_ms=250` adds bounded artificial latency to make concurrent routing observable.
- **Security improvement:** state-changing management routes use POST rather than GET. Optional bearer-token validation can be enabled with `SENTINELLUS_API_TOKEN` in the backend environment.

## Run with Docker Compose

From the repository root, with Docker Desktop running:

```bash
docker compose up --build
```

Open:

- Dashboard: http://localhost:3000
- API docs: http://localhost:8000/docs
- API health: http://localhost:8000/health

Use **Route Test Request** in the dashboard to send traffic through the load balancer. Repeated requests should show the selected worker and measured latency. To demonstrate distribution, open multiple browser tabs or use a terminal:

```bash
for i in $(seq 1 30); do curl -s http://localhost:8000/api/proxy; echo; done
```

For a repeatable concurrent load test (after the stack is running):

```bash
python3 scripts/load_test.py --requests 200 --concurrency 20
```

The default test adds 250 ms of bounded worker delay to expose in-flight load balancing. To test faster responses, pass `--url http://localhost:8000/api/proxy`. The report gives measured values; do not copy performance claims into a resume without running the test on your machine.

To test recovery, terminate one worker from the dashboard and watch the event log and node state. The orchestrator attempts to restart stopped worker containers. Test in a local development environment only.

## Run backend without Docker

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Without Docker, API docs, rate limiting, and the local empty-cluster state can be tested. Real worker routing, container telemetry, scaling, and recovery require Docker.

## Configuration

- `RATE_LIMIT_REQUESTS=100`
- `RATE_LIMIT_WINDOW_SECONDS=60`
- `REDIS_URL=redis://redis:6379/0`
- `MIN_WORKERS=1`
- `MAX_WORKERS=12`
- `WORKER_COOLDOWN_SECONDS=10`
- `CIRCUIT_BREAKER_FAILURE_THRESHOLD=2`
- `AUTOSCALING_ENABLED=true`
- `AUTOSCALER_INTERVAL_SECONDS=10`
- `AUTOSCALER_COOLDOWN_SECONDS=30`
- `HEALTH_PROBE_INTERVAL_SECONDS=5`
- `SCALE_UP_CPU_PERCENT=75`
- `SCALE_UP_TOTAL_RPS=20`
- `SCALE_DOWN_CPU_PERCENT=25`
- `SCALE_DOWN_TOTAL_RPS=3`
- `SCALE_DOWN_CONSECUTIVE_CHECKS=3`
- `CHAOS_MODE=false`
- `SENTINELLUS_API_TOKEN` (optional; if set, management endpoints require `Authorization: Bearer <token>`)
- `CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000`

## Known limitations — be honest in demos/interviews

- The load balancer is **least-connections with observed-latency tie-breaking**, not a production-grade proxy such as Envoy or HAProxy. In-flight counts are process-local; run one backend process for this demo.
- Request/latency metrics cover traffic routed through `/api/proxy`, not arbitrary traffic to worker containers.
- CPU metrics depend on Docker stats sampling and may be coarse for short-lived bursts; tune thresholds for your machine. The initial three Compose workers are baseline capacity; automatic scale-down only removes containers created by the autoscaler.
- The UI stress toggle only changes a mode flag; it does not generate artificial load. Use a separate load generator for a real traffic test.
- The autoscaler is intentionally conservative and heuristic-based; it is a learning/demo implementation, not a replacement for Kubernetes HPA or a production control plane. It currently runs in a single backend process and should not be replicated without distributed coordination.
- The backend mounts the Docker socket, which grants powerful control over Docker on the host. Do not expose this development service to an untrusted network.
- If you configure `SENTINELLUS_API_TOKEN`, the current dashboard does not automatically attach it; use the API docs/curl with a bearer token or add a frontend token input before enabling it for dashboard controls.
# sentinellus-updated
