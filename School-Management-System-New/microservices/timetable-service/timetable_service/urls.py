import os
from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST


def health(request):
    return JsonResponse({"service": "timetable-service", "status": "ok"})


@csrf_exempt
@require_POST
def internal_sync_teachers(request):
    secret = os.getenv("INTERNAL_SERVICE_SECRET", "")
    if not secret or request.headers.get("X-Internal-Secret") != secret:
        return JsonResponse({"success": False, "error": "Forbidden"}, status=403)
    try:
        from timetable.management.commands.sync_master_data import sync_users, sync_teachers
        sync_users()
        n = sync_teachers()
        return JsonResponse({"success": True, "synced": n})
    except Exception as e:
        return JsonResponse({"success": False, "error": str(e)}, status=500)


urlpatterns = [
    path("health/", health),
    path("api/internal/sync-teachers/", internal_sync_teachers),
    path("timetable-admin/", admin.site.urls),
    path("api/timetable/", include("timetable.urls")),
    path("api/transfers/", include("transfers.urls")),
]
