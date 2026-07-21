"""
Rate Limiting middleware for API Gateway.
Uses Redis for distributed rate limiting with sliding window.
"""
import os
import time
import logging
from typing import Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Rate limits per role per endpoint group (requests per minute)
RATE_LIMITS = {
    "anonymous": {"auth": 10, "read": 5, "write": 0, "admin": 0},
    "STUDENT": {"auth": 30, "read": 100, "write": 20, "admin": 0},
    "TEACHER": {"auth": 30, "read": 100, "write": 50, "admin": 0},
    "COORDINATOR": {"auth": 30, "read": 100, "write": 50, "admin": 30},
    "ACCOUNT_OFFICER": {"auth": 30, "read": 100, "write": 50, "admin": 30},
    "ADMIN": {"auth": 30, "read": 200, "write": 100, "admin": 100},
    "LEAD": {"auth": 30, "read": 100, "write": 30, "admin": 0},
}

# Endpoint group classification
AUTH_PATHS = ("/api/auth/", "/api/v1/auth/")
ADMIN_PATHS = ("/api/orgs/", "/api/auth/users/", "/api/auth/admin/")
READ_METHODS = {"GET", "HEAD", "OPTIONS"}


def get_endpoint_group(path: str, method: str) -> str:
    """Classify endpoint into a group for rate limiting."""
    if any(path.startswith(p) for p in AUTH_PATHS):
        return "auth"
    if any(path.startswith(p) for p in ADMIN_PATHS):
        return "admin"
    if method in READ_METHODS:
        return "read"
    return "write"


def get_rate_limit(role: str, group: str) -> int:
    """Get the rate limit for a role and endpoint group."""
    role_limits = RATE_LIMITS.get(role.upper(), RATE_LIMITS["STUDENT"])
    return role_limits.get(group, 60)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware using Redis sliding window."""

    def __init__(self, app, redis_url: Optional[str] = None):
        super().__init__(app)
        self.redis_url = redis_url or os.environ.get("REDIS_URL", "redis://redis:6379/0")
        self._redis = None

    async def get_redis(self):
        """Lazy-initialize Redis connection."""
        if self._redis is None:
            try:
                import redis.asyncio as aioredis
                self._redis = aioredis.from_url(
                    self.redis_url,
                    decode_responses=True,
                    socket_connect_timeout=2,
                )
            except Exception as e:
                logger.warning(f"Redis unavailable for rate limiting: {e}")
                return None
        return self._redis

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path in ("/health", "/"):
            return await call_next(request)

        # Extract user info from headers (injected by API Gateway proxy logic)
        user_id = request.headers.get("X-User-Id", "")
        user_role = request.headers.get("X-User-Role", "STUDENT")
        client_ip = request.client.host if request.client else "unknown"

        # Determine identifier and role
        identifier = user_id if user_id else f"ip:{client_ip}"
        role = (user_role or "STUDENT").upper()
        if not user_id:
            role = "anonymous"

        # Classify endpoint
        group = get_endpoint_group(request.url.path, request.method)
        limit = get_rate_limit(role, group)

        # No limit configured (0) or unlimited
        if limit <= 0:
            return await call_next(request)

        # Check rate limit via Redis
        redis = await self.get_redis()
        if redis is None:
            # Redis unavailable - allow request (fail open)
            return await call_next(request)

        try:
            current_minute = int(time.time() // 60)
            key = f"ratelimit:{identifier}:{group}:{current_minute}"

            # Atomic increment with TTL
            pipe = redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, 120)  # 2 minute TTL for safety
            results = await pipe.execute()
            current_count = results[0]

            remaining = max(0, limit - current_count)
            reset_time = (current_minute + 1) * 60

            if current_count > limit:
                retry_after = reset_time - int(time.time())
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": "Rate limit exceeded",
                        "retry_after": max(1, retry_after),
                        "limit": limit,
                        "window": "1 minute",
                    },
                    headers={
                        "X-RateLimit-Limit": str(limit),
                        "X-RateLimit-Remaining": "0",
                        "X-RateLimit-Reset": str(reset_time),
                        "Retry-After": str(max(1, retry_after)),
                    },
                )

            response = await call_next(request)

            # Add rate limit headers to successful responses
            response.headers["X-RateLimit-Limit"] = str(limit)
            response.headers["X-RateLimit-Remaining"] = str(remaining)
            response.headers["X-RateLimit-Reset"] = str(reset_time)

            return response

        except Exception as e:
            logger.error(f"Rate limit check failed: {e}")
            # Fail open - allow request
            return await call_next(request)
