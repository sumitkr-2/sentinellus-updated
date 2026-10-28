"""Small worker service with health and controllable latency for load-balancer demos."""
import os
import time
import asyncio
from fastapi import FastAPI, HTTPException, Query

app = FastAPI(title="Sentinellus Worker")
NAME = os.getenv("WORKER_NAME", os.getenv("HOSTNAME", "worker"))
STARTED = time.time()

@app.get("/")
def root():
    return {"worker": NAME, "status": "healthy", "uptime_seconds": round(time.time() - STARTED, 2)}

@app.get("/work")
async def work(delay_ms: int = Query(default=0, ge=0, le=2000)):
    # Deliberate bounded delay makes concurrent routing observable without unbounded CPU stress.
    if delay_ms:
        await asyncio.sleep(delay_ms / 1000)
    return {"worker": NAME, "status": "healthy", "uptime_seconds": round(time.time() - STARTED, 2), "simulated_work_ms": delay_ms}

@app.get("/health")
def health():
    return {"worker": NAME, "status": "healthy"}
