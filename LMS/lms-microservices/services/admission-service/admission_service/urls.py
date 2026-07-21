from django.contrib import admin
from django.urls import path, include, re_path
from django.http import JsonResponse

def health_check(request):
    return JsonResponse({'status': 'healthy'})

urlpatterns = [
    path('admin/', admin.site.urls),
    path('health/', health_check, name='health'),
    
    # Standard Microservice API path (flexible slash)
    path('api/tests/', include('tests.urls')),
    path('api/admission/', include('tests.urls')),
    path('api/test/', include('tests.urls')),
]
