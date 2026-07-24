from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.views.static import serve
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.db import connection
from django.utils import timezone
import json, os


def health(request):
    return JsonResponse({"service": "staff-service", "status": "ok"})


@csrf_exempt
@require_POST
def internal_delete_user(request):
    secret = os.getenv("INTERNAL_SERVICE_SECRET", "")
    if not secret or request.headers.get("X-Internal-Secret") != secret:
        return JsonResponse({"success": False, "error": "Forbidden"}, status=403)

    try:
        body = json.loads(request.body)
    except Exception:
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    email = (body.get("email") or "").strip()
    if not email:
        return JsonResponse({"success": False, "error": "email required"}, status=400)

    now = timezone.now()
    deleted = {}
    with connection.cursor() as cur:
        for table in ("teachers_teacher", "coordinator_coordinator", "principals_principal"):
            cur.execute(
                f"UPDATE {table} SET is_deleted=true, deleted_at=%s WHERE email=%s AND is_deleted=false",
                [now, email],
            )
            deleted[table] = cur.rowcount

    return JsonResponse({"success": True, "deleted": deleted})


urlpatterns = [
    path("health/", health),
    path("api/internal/delete-user/", internal_delete_user),
    path("staff-admin/", admin.site.urls),
    path("api/", include("teachers.urls")),
    path("api/", include("coordinator.urls")),
    path("api/", include("principals.urls")),
    # Serve staff profile photos (principals/teachers/coordinators). The gateway
    # proxies /media/<role>/ here; Django serves the file from MEDIA_ROOT.
    re_path(r"^media/(?P<path>.*)$", serve, {"document_root": settings.MEDIA_ROOT}),
]
