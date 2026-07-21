"""
URL configuration for core project.
"""
from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static
from ninja import NinjaAPI
from authentication.api import router as auth_router
from permissions.api import router as permissions_router
from employees.api import router as employees_router
from audit.api import router as audit_router
from permissions.rbac_api import router as rbac_router

# Initialize Ninja API
api = NinjaAPI(
    title="Auth Service API",
    version="1.0.0",
    description="Unified Authentication Service for ERP System"
)

# Register routers
api.add_router("/auth", auth_router)
api.add_router("/permissions", permissions_router)
api.add_router("/employees", employees_router)  # Employees at /api/employees
api.add_router("/audit", audit_router)          # Audit logs at /api/audit
api.add_router("/permissions/rbac", rbac_router)  # RBAC management at /api/permissions/rbac

urlpatterns = [
    path('auth-admin/', admin.site.urls),
    path('api/', api.urls),  # All API endpoints under /api/
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

