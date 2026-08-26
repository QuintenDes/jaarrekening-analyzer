"""Simple in-memory sliding-window rate limit (single uvicorn process)."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from typing import Callable

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

# Paths that accept heavy / abuse-prone POST bodies.
LIMITED_PATHS = frozenset(
    {"/api/analyze", "/api/analyze/jobs", "/api/ratios/parse", "/api/ratios/compute"}
)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Limit POST requests per client IP on selected API paths."""

    def __init__(
        self,
        app,
        *,
        max_requests: int = 10,
        window_seconds: float = 60.0,
        paths: frozenset[str] = LIMITED_PATHS,
    ) -> None:
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.paths = paths
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def _client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # First hop is the original client (Cloudflare / Caddy).
            return forwarded.split(",")[0].strip() or "unknown"
        if request.client and request.client.host:
            return request.client.host
        return "unknown"

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method == "POST" and request.url.path in self.paths:
            ip = self._client_ip(request)
            now = time.monotonic()
            window = self._hits[ip]
            cutoff = now - self.window_seconds
            while window and window[0] < cutoff:
                window.popleft()
            if len(window) >= self.max_requests:
                retry = max(1, int(self.window_seconds - (now - window[0])))
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Te veel verzoeken. Probeer later opnieuw.",
                    },
                    headers={"Retry-After": str(retry)},
                )
            window.append(now)

        return await call_next(request)
