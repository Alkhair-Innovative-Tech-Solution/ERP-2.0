from django.contrib import admin
from django.urls import path
from django.http import JsonResponse
from courses.api import course_api

from django.conf import settings
from django.conf.urls.static import static

# Placeholder for future wiring
def health_check(request):
    return JsonResponse({'status': 'healthy'})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health_check, name='health'),
    path('api/courses/', course_api.urls),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
