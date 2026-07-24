from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.conf import settings
from django.conf.urls.static import static


def health(request):
    return JsonResponse({"service": "org-service", "status": "ok"})


urlpatterns = [
    path("health/", health),
    path("org-admin/", admin.site.urls),
    path("api/", include("users.urls")),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
