from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from .serializers import StudentIdentityCardSerializer, StudentPhotoUploadSerializer
from PIL import Image as PILImage
import os
from django.conf import settings
from .models import Student
from django.contrib.auth import get_user_model, login, authenticate
from django.shortcuts import render, redirect
from django.core.cache import cache
from django.contrib import messages

User = get_user_model()

def custom_login_view(request):
    if request.method == 'POST':
        email = request.POST.get('email', '').lower().strip()
        password = request.POST.get('password')
        
        lockout_key = f"lockout_{email}"
        attempts_key = f"attempts_{email}"

        if cache.get(lockout_key):
            messages.error(request, "Too many failed attempts. Please wait 5 minutes.")
            return render(request, 'users/login.html')

        user = authenticate(request, email=email, password=password)
        if user is not None:
            cache.delete(attempts_key)
            cache.delete(lockout_key)
            login(request, user)
            return redirect('home')
        else:
            attempts = cache.get(attempts_key, 0) + 1
            cache.set(attempts_key, attempts, timeout=600)
            
            if attempts >= 5:
                cache.set(lockout_key, True, timeout=300)
                messages.error(request, "Too many failed attempts. Please wait 5 minutes.")
            else:
                messages.error(request, f"Invalid email or password. Attempt {attempts}/5")
            
    return render(request, 'users/login.html')

class StudentIdentityCardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            student = Student.objects.get(user=request.user)
            serializer = StudentIdentityCardSerializer(student, context={'request': request})
            return Response(serializer.data)
        except Student.DoesNotExist:
            return Response({"error": "Student profile not found"}, status=404)

class StudentPhotoUploadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = StudentPhotoUploadSerializer(data=request.data)
        if serializer.is_valid():
            photo = serializer.validated_data['photo']
            try:
                student = Student.objects.get(user=request.user)
            except Student.DoesNotExist:
                return Response({"error": "Student profile not found"}, status=404)

            # Process photo with Pillow
            img = PILImage.open(photo)
            # Remove Alpha channel if it exists (for JPEG saving)
            if img.mode in ("RGBA", "P"):
                img = img.convert("RGB")
            
            # Resize
            img.thumbnail((500, 500))
            
            # Save path inside media
            relative_folder = 'student_photos'
            folder_path = os.path.join(settings.MEDIA_ROOT, relative_folder)
            if not os.path.exists(folder_path):
                os.makedirs(folder_path, exist_ok=True)
            
            # Dynamic filename based on student_id
            filename = f"{student.student_id or 'unknown'}_{student.id.hex[:8]}.jpg"
            relative_file_path = os.path.join(relative_folder, filename).replace('\\', '/')
            full_save_path = os.path.join(settings.MEDIA_ROOT, relative_file_path)
            
            # Save as JPEG
            img.save(full_save_path, 'JPEG', quality=90)
            
            # Update Student model
            student.image = relative_file_path
            student.save()
            
            photo_url = request.build_absolute_uri(student.image.url)
            return Response({"photo_url": photo_url})
        
        return Response(serializer.errors, status=400)
