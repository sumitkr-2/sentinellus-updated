#!/usr/bin/env python3
"""Concurrent load test for Sentinellus. Uses only the Python standard library."""
import argparse
import concurrent.futures
import json
import statistics
import time
import urllib.error
import urllib.request
from collections import Counter


def send_one(url, timeout):
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            body = response.read().decode("utf-8", errors="replace")
            elapsed = (time.perf_counter() - start) * 1000
            data = json.loads(body)
            return {"ok": 200 <= response.status < 400, "status": response.status,
                    "latency_ms": elapsed, "worker": data.get("routed_to", "unknown")}
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        return {"ok": False, "status": "error", "latency_ms": (time.perf_counter() - start) * 1000,
                "worker": "none", "error": str(exc)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:8000/api/proxy?delay_ms=250")
    parser.add_argument("-n", "--requests", type=int, default=100)
    parser.add_argument("-c", "--concurrency", type=int, default=20)
    parser.add_argument("--timeout", type=float, default=8)
    args = parser.parse_args()
    if args.requests < 1 or args.concurrency < 1:
        parser.error("requests and concurrency must be positive")

    start = time.perf_counter()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.concurrency) as pool:
        results = list(pool.map(lambda _: send_one(args.url, args.timeout), range(args.requests)))
    duration = time.perf_counter() - start
    successes = [r for r in results if r["ok"]]
    latencies = [r["latency_ms"] for r in results]
    workers = Counter(r["worker"] for r in successes)
    print("\nSentinellus load-test results")
    print(f"Requests: {args.requests} | Concurrency: {args.concurrency} | Duration: {duration:.2f}s")
    print(f"Success: {len(successes)} | Failed: {len(results) - len(successes)} | Throughput: {len(results) / max(duration, 0.001):.2f} req/s")
    print(f"Latency ms: avg={statistics.mean(latencies):.2f}, p50={statistics.median(latencies):.2f}, p95={sorted(latencies)[min(len(latencies)-1, int(len(latencies)*0.95))]:.2f}, max={max(latencies):.2f}")
    print("Requests routed by worker:")
    for name, count in sorted(workers.items()):
        print(f"  {name}: {count}")
    if not successes:
        raise SystemExit("No successful requests; check that Docker Compose is running and /api/proxy is reachable.")


if __name__ == "__main__":
    main()
