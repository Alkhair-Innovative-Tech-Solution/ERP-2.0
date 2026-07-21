from django.contrib import admin
from django.urls import path
from django.http import JsonResponse
from django.conf import settings
from django.conf.urls.static import static
from content.api import content_api

def health_check(request):
    return JsonResponse({'status': 'healthy', 'service': 'content-service'})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health_check, name='health'),
    path('api/content/', content_api.urls),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
