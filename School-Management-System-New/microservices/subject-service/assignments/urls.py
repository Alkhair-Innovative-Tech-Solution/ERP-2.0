from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import AssignmentViewSet, MySubmissionsView

router = DefaultRouter()
router.register(r'assignments', AssignmentViewSet, basename='assignment')

urlpatterns = [
    path('', include(router.urls)),
    path('my-submissions/', MySubmissionsView.as_view(), name='my-submissions'),
]
