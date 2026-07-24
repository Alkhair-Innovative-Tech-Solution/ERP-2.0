from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ModuleViewSet, LessonViewSet, ContentItemViewSet, StudentProgressView

router = DefaultRouter()
router.register(r'modules', ModuleViewSet, basename='module')
router.register(r'lessons', LessonViewSet, basename='lesson')
router.register(r'items', ContentItemViewSet, basename='content-item')

urlpatterns = [
    path('', include(router.urls)),
    path('progress/', StudentProgressView.as_view(), name='student-progress'),
]
