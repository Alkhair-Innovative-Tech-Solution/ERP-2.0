from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
import os


def health(request):
    return JsonResponse({"service": "attendance-service", "status": "ok"})


@csrf_exempt
@require_POST
def internal_sync_students(request):
    """Trigger a re-sync of students from student-service DB into this service's DB."""
    secret = os.getenv("INTERNAL_SERVICE_SECRET", "")
    if not secret or request.headers.get("X-Internal-Secret") != secret:
        return JsonResponse({"success": False, "error": "Forbidden"}, status=403)

    try:
        from attendance.management.commands.sync_master_data import sync_students
        n = sync_students()
        return JsonResponse({"success": True, "synced": n})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)


urlpatterns = [
    path("health/", health),
    path("api/internal/sync-students/", internal_sync_students),
    path("attendance-admin/", admin.site.urls),
    path("api/attendance/", include("attendance.urls")),
    # ADMS biometric device endpoints (ZKTeco-protocol) — device pushes directly here
    path("iclock/cdata", include("attendance.urls_adms")),
    path("iclock/getrequest", include("attendance.urls_adms")),
    path("iclock/registry", include("attendance.urls_adms")),
    path("iclock/push", include("attendance.urls_adms")),
]
