from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.conf import settings
from django.conf.urls.static import static


def health(request):
    return JsonResponse({"service": "content-service", "status": "ok"})


urlpatterns = [
    path("health/", health),
    path("content-admin/", admin.site.urls),
    path("api/content/", include("content.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
