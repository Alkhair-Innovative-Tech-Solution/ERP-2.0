from django.contrib import admin
from django.urls import path
from ninja_extra import NinjaExtraAPI
from fees.api import router as fees_router

api = NinjaExtraAPI(title="Fee Service API", version="1.0.0")
api.add_router("/fees", fees_router)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", api.urls),
    path("health/", lambda request: __import__('django.http', fromlist=['JsonResponse']).JsonResponse({"status": "healthy", "service": "fee-service"})),
]
