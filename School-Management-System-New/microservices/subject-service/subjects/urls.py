from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SubjectViewSet, SubjectTeacherAssignmentViewSet

router = DefaultRouter()
router.register(r'subjects', SubjectViewSet, basename='subject')
router.register(r'subject-teacher-assignments', SubjectTeacherAssignmentViewSet, basename='subject-teacher-assignment')

urlpatterns = [
    path('', include(router.urls)),
]
