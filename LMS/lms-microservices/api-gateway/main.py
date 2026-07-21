"""
FastAPI API Gateway for LMS Microservices
Routes requests to appropriate services
"""
import os
import jwt
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.responses import Response, StreamingResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import httpx
import logging


from contextlib import asynccontextmanager
from middleware.rate_limiter import RateLimitMiddleware

# HTTP client with timeout
# We will initialize this in the lifespan
client = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global client
    logger.info(f"Starting API Gateway...")
    logger.info(f"AUTH_SERVICE_URL: {AUTH_SERVICE_URL}")
    logger.info(f"COURSE_SERVICE_URL: {COURSE_SERVICE_URL}")
    logger.info(f"ADMISSION_SERVICE_URL: {ADMISSION_SERVICE_URL}")
    
    # Disable trust_env and set a standard User-Agent to avoid being flagged by local security
    client = httpx.AsyncClient(
        timeout=30.0, 
        trust_env=False,
        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    )
    yield
    await client.aclose()

app = FastAPI(title="LMS API Gateway", version="1.0.0", lifespan=lifespan)

# CORS middleware
origins = [
    "https://ait.iak.ngo",
    "https://lms.iak.ngo",
    "http://localhost:3000",
    "http://localhost:3001",
]

# Use environment variable to control logging level
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
logging.basicConfig(level=getattr(logging, LOG_LEVEL))
logger = logging.getLogger(__name__)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(CORSMiddleware,
    allow_origins=origins if os.getenv("DEBUG") != "True" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"]
)

# Service URLs from environment
AUTH_SERVICE_URL = os.getenv("AUTH_SERVICE_URL", "http://auth-service:8001")
COURSE_SERVICE_URL = os.getenv("COURSE_SERVICE_URL", "http://course-service:8002")
NOTIFICATION_SERVICE_URL = os.getenv("NOTIFICATION_SERVICE_URL", "http://notification-service:8003")
CERTIFICATION_SERVICE_URL = os.getenv("CERTIFICATION_SERVICE_URL", "http://certification-service:8004")
ADMISSION_SERVICE_URL = os.getenv("ADMISSION_SERVICE_URL", "http://admission-service:8003")
CONTENT_SERVICE_URL = os.getenv("CONTENT_SERVICE_URL", "http://content-service:8005")
ORGS_SERVICE_URL = os.getenv("ORGS_SERVICE_URL", "http://org-service:8007")
FEE_SERVICE_URL = os.getenv("FEE_SERVICE_URL", "http://fee-service:8008")

# JWT Secret for decoding tokens
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "your-secret-key-change-in-production")


def extract_org_from_token(auth_header: str) -> dict:
    """Extract org_id, campus_id, user_id, user_role from JWT token."""
    result = {"org_id": None, "campus_id": None, "user_id": None, "user_role": None}
    if not auth_header or not auth_header.startswith("Bearer "):
        return result
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=["HS256"])
        result["org_id"] = payload.get("org_id")
        result["campus_id"] = payload.get("campus_id")
        result["user_id"] = payload.get("user_id") or payload.get("id")
        result["user_role"] = payload.get("role")
    except Exception as e:
        logger.warning(f"JWT decode failed: {e}")
    return result


async def proxy_request(
    service_url: str,
    path: str,
    method: str,
    request: Request,
    require_auth: bool = True
):
    """
    Proxy request to a microservice
    
    Args:
        service_url: Base URL of the target service
        path: Request path
        method: HTTP method
        request: FastAPI request object
        require_auth: Whether authentication is required
    """
    # We just forward the request with headers
    try:
        # ðŸ›¡ï¸ Defensive CORS handling for preflights
        if method == "OPTIONS":
            return Response(
                status_code=200,
                headers={
                    "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
                    "Access-Control-Allow-Methods": "*",
                    "Access-Control-Allow-Headers": "*",
                    "Access-Control-Allow-Credentials": "true",
                }
            )
        
        # Get request body if present
        body = None
        if method in ["POST", "PUT", "PATCH"]:
            body = await request.body()
        
        # Get headers (exclude host and connection)
        headers = dict(request.headers)
        original_host = headers.pop("host", None)
        headers.pop("connection", None)
        headers.pop("content-length", None)  # Let httpx calculate
        
        # Forward headers for backend security verification
        if original_host:
            headers["X-Forwarded-Host"] = original_host
        
        # Forward the protocol (important for Django CSRF/Origin checks)
        # Use existing X-Forwarded-Proto if present, otherwise fallback to local scheme
        incoming_proto = headers.get("x-forwarded-proto") or headers.get("X-Forwarded-Proto")
        if not incoming_proto:
            headers["X-Forwarded-Proto"] = request.url.scheme
        else:
            headers["X-Forwarded-Proto"] = incoming_proto
        
        # ðŸ”¹ Multi-Tenancy: Extract org_id from JWT and inject into headers
        auth_header = headers.get("authorization", "")
        org_info = extract_org_from_token(auth_header)
        if org_info["org_id"]:
            headers["X-Org-Id"] = org_info["org_id"]
        if org_info["campus_id"]:
            headers["X-Campus-Id"] = org_info["campus_id"]
        if org_info["user_id"]:
            headers["X-User-Id"] = str(org_info["user_id"])
        if org_info["user_role"]:
            headers["X-User-Role"] = org_info["user_role"]
        
        # Build target URL
        # Path might already include query params, so we need to handle that
        path_without_query = path.split('?')[0] if '?' in path else path
        query_string = path.split('?')[1] if '?' in path else None
        
        target_url = f"{service_url.rstrip('/')}/{path_without_query.lstrip('/')}"
        
        # Add query parameters (from path or request)
        if query_string:
            target_url += f"?{query_string}"
        elif request.url.query:
            target_url += f"?{request.url.query}"
        
        logger.info(f"ðŸš€ Proxying {method} {path} -> {target_url}")
        
        try:
            # Make request
            response = await client.request(
                method=method,
                url=target_url,
                content=body if body else None,
                headers=headers,
                follow_redirects=True
            )
            
            logger.info(f"âœ… Response from {target_url}: {response.status_code}")
            
            # Return response
            res_headers = dict(response.headers)
            res_headers["X-Debug-Gateway"] = "Container-V1"
            # Remove content-length from response headers as we are returning a new Response object
            res_headers.pop("content-length", None)
            
            return Response(
                content=response.content,
                status_code=response.status_code,
                headers=res_headers,
                media_type=response.headers.get("content-type")
            )
        except Exception as e:
            logger.error(f"âŒ Error during httpx request to {target_url}: {e}")
            raise
    except httpx.TimeoutException:
        logger.error(f"âŒ› Timeout connecting to {service_url}")
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Service timeout"
        )
    except httpx.ConnectError:
        logger.error(f"ðŸ”Œ Connection error to {service_url}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service unavailable"
        )
    except Exception as e:
        logger.error(f"ðŸ’¥ Error proxying request: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Gateway error: {str(e)}"
        )


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "api-gateway"}


# Auth Service Routes
@app.api_route("/api/auth/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
@app.api_route("/api/v1/auth/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def auth_service_proxy(path: str, request: Request):
    """Proxy requests to auth service"""
    # Path already includes the full path after /api/auth/, so forward to /api/auth/{path}
    # For example: if request is /api/auth/login/, then path = "login/"
    # We need to forward to /api/auth/login/
    logger.info(f"Auth proxy: received path='{path}', full_url='{request.url}', method='{request.method}'")
    return await proxy_request(AUTH_SERVICE_URL, f"/api/auth/{path}", request.method, request, require_auth=False)


# Student related routes (also in Auth Service)
@app.api_route("/api/student/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
@app.api_route("/api/v1/student/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def student_service_proxy(path: str, request: Request):
    """Proxy student requests to auth service"""
    logger.info(f"Student proxy: received path='{path}', method='{request.method}'")
    return await proxy_request(AUTH_SERVICE_URL, f"/api/student/{path}", request.method, request)


# Course Service Routes
@app.api_route("/api/courses/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
@app.api_route("/api/v1/courses/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def course_service_proxy(path: str, request: Request):
    """Proxy requests to course service"""
    # Path already includes the full path after /api/courses/, so forward to /api/courses/{path}
    return await proxy_request(COURSE_SERVICE_URL, f"/api/courses/{path}", request.method, request)


# Media Files Route - Strategic Routing
@app.api_route("/media/{path:path}", methods=["GET"])
async def media_proxy(path: str, request: Request):
    """
    Proxy media file requests strategically.
    If path starts with 'content/', route to content-service.
    Otherwise default to course-service.
    """
    if path.startswith("content/"):
        logger.info(f"Media proxy: forwarding /media/{path} to content service")
        return await proxy_request(CONTENT_SERVICE_URL, f"/media/{path}", request.method, request, require_auth=False)
    
    logger.info(f"Media proxy: forwarding /media/{path} to course service")
    return await proxy_request(COURSE_SERVICE_URL, f"/media/{path}", request.method, request, require_auth=False)



# Certification Service Routes
@app.api_route("/api/certifications/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
@app.api_route("/api/v1/certifications/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def certification_service_proxy(path: str, request: Request):
    """Proxy requests to certification service"""
    # Public endpoints (no auth required):
    # - GET /api/certifications/verify/ (verification endpoint)
    # - GET /api/certifications/verify/{code}/ (verification with code)
    # - POST /api/certifications/webhook/completion/ (webhook from course-service)
    
    normalized_path = path.strip('/')
    is_public = (
        normalized_path.startswith('verify') or
        normalized_path.startswith('webhook/completion')
    )
    
    require_auth = not is_public
    # Path already includes the full path after /api/certifications/
    # For example: if request is /api/certifications/certifications/?student_id=116
    # Then path = "certifications/?student_id=116"
    # We need to forward to /api/certifications/certifications/?student_id=116
    logger.info(f"Certification proxy: received path='{path}', full_url='{request.url}', method='{request.method}'")
    return await proxy_request(CERTIFICATION_SERVICE_URL, f"/api/certifications/{path}", request.method, request, require_auth=require_auth)


# Notification Service Routes
@app.api_route("/api/notifications/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
@app.api_route("/api/v1/notifications/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def notification_service_proxy(path: str, request: Request):
    """Proxy requests to notification service"""
    # Path already includes the full path after /api/notifications/, so forward to /api/notifications/{path}
    return await proxy_request(NOTIFICATION_SERVICE_URL, f"/api/notifications/{path}", request.method, request)


@app.api_route("/api/tests/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
@app.api_route("/api/v1/tests/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def admission_service_proxy(path: str, request: Request):
    """Proxy requests to admission service"""
    # Admission service uses "tests" app
    return await proxy_request(ADMISSION_SERVICE_URL, f"/api/tests/{path}", request.method, request)

@app.api_route("/api/admission/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
@app.api_route("/api/v1/admission/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def admission_flow_proxy(path: str, request: Request):
    """Proxy admission flow requests (public)"""
    return await proxy_request(ADMISSION_SERVICE_URL, f"/api/admission/{path}", request.method, request, require_auth=False)

@app.api_route("/api/content/", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
@app.api_route("/api/content/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
@app.api_route("/api/v1/content/", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
@app.api_route("/api/v1/content/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def content_service_proxy(request: Request, path: str = ""):
    """Proxy requests to content service"""
    return await proxy_request(CONTENT_SERVICE_URL, f"/api/content/{path}", request.method, request)

@app.on_event("shutdown")
async def shutdown():
    """Cleanup on shutdown"""
    await client.aclose()


# â”€â”€â”€ Org Service Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@app.api_route("/api/orgs/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
@app.api_route("/api/v1/orgs/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def orgs_service_proxy(path: str, request: Request):
    """Proxy requests to org service"""
    logger.info(f"Orgs proxy: received path='{path}', method='{request.method}'")
    return await proxy_request(ORGS_SERVICE_URL, f"/api/orgs/{path}", request.method, request)


# â”€â”€â”€ Fee Service Routes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@app.api_route("/api/fees/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
@app.api_route("/api/v1/fees/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def fee_service_proxy(path: str, request: Request):
    """Proxy requests to fee service"""
    logger.info(f"Fee proxy: received path='{path}', method='{request.method}'")
    return await proxy_request(FEE_SERVICE_URL, f"/api/fees/{path}", request.method, request)



