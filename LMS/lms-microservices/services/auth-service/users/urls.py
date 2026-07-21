from django.urls import path
from .views import StudentIdentityCardView, StudentPhotoUploadView

urlpatterns = [
    path('identity-card/', StudentIdentityCardView.as_view(), name='student-identity-card'),
    path('upload-photo/', StudentPhotoUploadView.as_view(), name='student-photo-upload'),
]
