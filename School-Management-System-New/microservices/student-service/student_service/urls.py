from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from django.db import connection
from django.utils import timezone
import json, os


def health(request):
    return JsonResponse({"service": "student-service", "status": "ok"})


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
    username = (body.get("username") or "").strip()

    if not email and not username:
        return JsonResponse({"success": False, "error": "email or username required"}, status=400)

    now = timezone.now()
    deleted = {}
    with connection.cursor() as cur:
        if email:
            cur.execute(
                "UPDATE students_student SET is_deleted=true, deleted_at=%s WHERE email=%s AND is_deleted=false",
                [now, email],
            )
            deleted["by_email"] = cur.rowcount

        # student_id in student model == username from auth (e.g. KHI-001)
        if username and not deleted.get("by_email"):
            cur.execute(
                "UPDATE students_student SET is_deleted=true, deleted_at=%s WHERE student_id=%s AND is_deleted=false",
                [now, username],
            )
            deleted["by_student_id"] = cur.rowcount

    return JsonResponse({"success": True, "deleted": deleted})


urlpatterns = [
    path("health/", health),
    path("api/internal/delete-user/", internal_delete_user),
    path("student-admin/", admin.site.urls),
    path("api/", include("students.urls")),
    path("api/behaviour/", include("behaviour.urls")),
]
