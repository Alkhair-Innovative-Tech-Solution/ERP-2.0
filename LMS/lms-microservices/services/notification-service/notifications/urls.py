from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import NotificationBroadcastViewSet, NotificationDeliveryViewSet

router = DefaultRouter()
router.register(r'broadcasts', NotificationBroadcastViewSet, basename='broadcast')
router.register(r'deliveries', NotificationDeliveryViewSet, basename='delivery')

urlpatterns = [
    path('', include(router.urls)),
]
