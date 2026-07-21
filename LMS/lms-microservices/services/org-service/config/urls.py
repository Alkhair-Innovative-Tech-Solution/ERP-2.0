import os
from django.contrib import admin
from django.urls import path
from ninja import NinjaAPI
from ninja_extra import NinjaExtraAPI
from orgs.api import router as orgs_router

api = NinjaExtraAPI(title="Org Service API", version="1.0.0")
api.add_router("/orgs", orgs_router)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
    path("health/", lambda request: __import__('django.http', fromlist=['JsonResponse']).JsonResponse({"status": "healthy", "service": "org-service"})),
]
