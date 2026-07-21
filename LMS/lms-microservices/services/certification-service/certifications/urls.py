from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CertificationViewSet, verify_certificate, webhook_course_completion

router = DefaultRouter()
router.register(r'certifications', CertificationViewSet, basename='certification')

urlpatterns = [
    path('', include(router.urls)),
    path('verify/', verify_certificate, name='verify_certificate_query'),
    path('verify/<str:verification_code>/', verify_certificate, name='verify_certificate_path'),
    path('webhook/completion/', webhook_course_completion, name='webhook_completion'),
]
