"""Shared Redis-backed rate limiting with an in-memory fallback for local demos."""

import os
import time
import uuid
from collections import defaultdict, deque
from typing import Deque, DefaultDict

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

try:
    from redis.asyncio import Redis
except ImportError:  # Redis is optional when running locally without the dependency.
    Redis = None


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Limit requests per client IP using a fixed rolling time window.

    Defaults: 100 requests per 60 seconds. Redis is used when available so
    multiple backend workers share a limit; otherwise a process-local fallback
    keeps development usable.
    """

    def __init__(self, app, requests: int = 100, window_seconds: int = 60):
        super().__init__(app)
        self.limit = max(1, int(os.getenv("RATE_LIMIT_REQUESTS", requests)))
        self.window = max(1, int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", window_seconds)))
        self.redis_url = os.getenv("REDIS_URL", "redis://redis:6379/0")
        self.redis = Redis.from_url(self.redis_url, decode_responses=True) if Redis else None
        self.local_hits: DefaultDict[str, Deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Don't count browser preflight requests or the live telemetry socket.
        if request.method == "OPTIONS" or request.url.path == "/ws":
            return await call_next(request)

        client_ip = request.client.host if request.client else "unknown"
        key = f"sentinellus:rate:{client_ip}"
        allowed, remaining, reset_after = await self._check_limit(key)

        if not allowed:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Rate limit exceeded. Please try again later.",
                    "limit": self.limit,
                    "window_seconds": self.window,
                    "retry_after_seconds": reset_after,
                },
                headers={
                    "Retry-After": str(reset_after),
                    "X-RateLimit-Limit": str(self.limit),
                    "X-RateLimit-Remaining": "0",
                },
            )

        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(self.limit)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response

    async def _check_limit(self, key: str):
        now = time.time()
        if self.redis is not None:
            try:
                # One atomic operation: remove expired hits, add this hit, and
                # return the count and oldest hit timestamp.
                script = """
                local key = KEYS[1]
                local now = tonumber(ARGV[1])
                local cutoff = now - tonumber(ARGV[2])
                redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
                local count = redis.call('ZCARD', key)
                local allowed = 0
                if count < tonumber(ARGV[4]) then
                  redis.call('ZADD', key, now, ARGV[3])
                  redis.call('EXPIRE', key, tonumber(ARGV[2]))
                  count = count + 1
                  allowed = 1
                end
                local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
                return {count, oldest[2] or now, allowed}
                """
                result = await self.redis.eval(script, 1, key, now, self.window, f"{now}:{uuid.uuid4().hex}", self.limit)
                count, oldest, allowed = int(result[0]), float(result[1]), int(result[2])
                retry_after = max(1, int(oldest + self.window - now))
                return allowed == 1, max(0, self.limit - count), retry_after
            except Exception:
                # Redis being unavailable must not take down the API.
                pass

        hits = self.local_hits[key]
        cutoff = now - self.window
        while hits and hits[0] <= cutoff:
            hits.popleft()
        allowed = len(hits) < self.limit
        if allowed:
            hits.append(now)
        retry_after = max(1, int(hits[0] + self.window - now)) if hits else self.window
        return allowed, max(0, self.limit - len(hits)), retry_after
