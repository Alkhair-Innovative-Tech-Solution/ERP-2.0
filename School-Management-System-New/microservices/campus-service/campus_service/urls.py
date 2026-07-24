from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
import os


def health(request):
    return JsonResponse({"service": "campus-service", "status": "ok"})


def internal_sync_org(request):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    secret = request.headers.get('X-Internal-Secret', '')
    if not secret or secret != os.environ.get('INTERNAL_SERVICE_SECRET', ''):
        return JsonResponse({'error': 'Forbidden'}, status=403)
    import json
    data = json.loads(request.body)
    org_id = data.get('id')
    if not org_id:
        return JsonResponse({'error': 'id required'}, status=400)
    try:
        from users.models import Organization
        org, created = Organization.all_objects.get_or_create(
            id=org_id,
            defaults={
                'name': data.get('name', f'Org-{org_id}'),
                'max_users': data.get('max_users', 50),
                'max_students': data.get('max_students', 1000),
                'max_campuses': data.get('max_campuses', 3),
                'is_active': data.get('is_active', True),
            }
        )
        if not created:
            update_fields = []
            for field in ('name', 'max_users', 'max_students', 'max_campuses', 'is_active'):
                if field in data:
                    setattr(org, field, data[field])
                    update_fields.append(field)
            if update_fields:
                org.save(update_fields=update_fields)
        return JsonResponse({'id': org.id, 'created': created})
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


urlpatterns = [
    path("health/", health),
    path("campus-admin/", admin.site.urls),
    path("api/internal/sync-org/", internal_sync_org),
    path("api/", include("campus.urls")),
    path("api/", include("classes.urls")),
]
