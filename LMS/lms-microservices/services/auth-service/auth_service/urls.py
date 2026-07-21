from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse
from users.api import user_api

def health_check(request):
    return JsonResponse({'status': 'healthy'})

from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health_check, name='health'),
    path('api/auth/', user_api.urls),
    path('api/student/', include('users.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
