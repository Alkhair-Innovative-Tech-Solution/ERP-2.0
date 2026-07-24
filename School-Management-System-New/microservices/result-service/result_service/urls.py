import os
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST


def health(request):
    return JsonResponse({"service": "result-service", "status": "ok"})


@csrf_exempt
@require_POST
def internal_sync_students(request):
    secret = os.getenv("INTERNAL_SERVICE_SECRET", "")
    if not secret or request.headers.get("X-Internal-Secret") != secret:
        return JsonResponse({"success": False, "error": "Forbidden"}, status=403)
    from result.management.commands.sync_master_data import (
        sync_levels, sync_grades, sync_classrooms,
        sync_staff_users, sync_teachers, sync_coordinators,
        sync_teacher_coordinator_assignments,
        sync_student_users, sync_students
    )
    sync_levels()
    sync_grades()
    nc = sync_classrooms()
    sync_staff_users()
    nt = sync_teachers()
    nco = sync_coordinators()
    na = sync_teacher_coordinator_assignments()
    sync_student_users()
    ns = sync_students()
    return JsonResponse({"success": True, "classrooms": nc, "teachers": nt, "coordinators": nco, "assignments": na, "students": ns})


urlpatterns = [
    path("health/", health),
    path("result-admin/", admin.site.urls),
    path("api/internal/sync-students/", internal_sync_students),
    path("api/result/", include("result.urls")),
    path("api/results/", include("result.urls")),
]
