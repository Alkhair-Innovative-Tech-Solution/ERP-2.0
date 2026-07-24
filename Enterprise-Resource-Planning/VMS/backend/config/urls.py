from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from visitors.views import VmsLoginView, VmsTokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/login/', VmsLoginView.as_view(), name='token_obtain_pair'),
    path('api/auth/refresh/', VmsTokenRefreshView.as_view(), name='token_refresh'),
    path('api/', include('visitors.urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
