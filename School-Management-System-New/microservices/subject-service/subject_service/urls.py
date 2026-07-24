from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse
from django.conf import settings
from django.views.static import serve


def health(request):
    return JsonResponse({"service": "subject-service", "status": "ok"})


urlpatterns = [
    path("health/", health),
    path("subject-admin/", admin.site.urls),
    path("api/", include("subjects.urls")),
    path("api/", include("assignments.urls")),
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]
