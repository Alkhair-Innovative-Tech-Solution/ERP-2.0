"""
User models for authentication and profiles
"""
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
import uuid


class User(AbstractUser):
    """Custom User model extending AbstractUser"""
    ROLE_CHOICES = [
        ('STUDENT', 'Student'),
        ('TEACHER', 'Teacher'),
        ('ADMIN', 'Admin'),
        ('COORDINATOR', 'Coordinator'),
        ('ACCOUNT_OFFICER', 'Account Officer'),
    ]
    
    userId = models.UUIDField(default=uuid.uuid4, unique=True, db_column='userId')
    profile_picture = models.ImageField(upload_to='profiles/', null=True, blank=True)
    cover_photo = models.ImageField(upload_to='covers/', null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='STUDENT')
    
    class Meta:
        db_table = 'profiles_user'
        verbose_name = 'User'
        verbose_name_plural = 'Users'
    
    def __str__(self):
        return self.username
    
    def save(self, *args, **kwargs):
        """Override save to set role for superusers"""
        if self.is_superuser and self.role != 'ADMIN':
            self.role = 'ADMIN'
        super().save(*args, **kwargs)
    
    @classmethod
    def create_superuser(cls, username, email=None, password=None, **extra_fields):
        """Override create_superuser to set role='ADMIN'"""
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'ADMIN')  # Set role to ADMIN for superusers
        
        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')
        
        return cls.create_user(username, email, password, **extra_fields)


class UserProfile(models.Model):
    """Extended user profile information"""
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='user_profile'
    )
    bio = models.TextField(default='', blank=True)
    headline = models.CharField(max_length=255, default='', blank=True)
    location = models.CharField(max_length=100, default='', blank=True)
    is_private = models.BooleanField(default=False)
    joined_date = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'profiles_userprofile'
        verbose_name = 'User Profile'
        verbose_name_plural = 'User Profiles'
    
    def __str__(self):
        return f"{self.user.username}'s Profile"


class StudentProfile(models.Model):
    """Student-specific profile information"""
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='student_profile'
    )
    user_profile = models.OneToOneField(
        UserProfile,
        on_delete=models.CASCADE,
        related_name='student_profile',
        null=True,
        blank=True
    )
    enrollment_date = models.DateTimeField(auto_now_add=True)
    student_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    grade_level = models.CharField(max_length=50, default='', blank=True)
    is_active = models.BooleanField(default=True)
    last_activity = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'profiles_studentprofile'
        verbose_name = 'Student Profile'
        verbose_name_plural = 'Student Profiles'
    
    def save(self, *args, **kwargs):
        """Override save to auto-generate student_id if not provided"""
        # Check if student_id is None or empty string
        if not self.student_id or (isinstance(self.student_id, str) and self.student_id.strip() == ''):
            # Get the highest existing student_id
            query = StudentProfile.objects.filter(
                student_id__isnull=False
            ).exclude(
                student_id=''
            )
            
            # Exclude current record if it's an update (pk exists)
            if self.pk:
                query = query.exclude(pk=self.pk)
            
            last_student = query.order_by('-student_id').first()
            
            if last_student and last_student.student_id:
                try:
                    # Extract numeric part and increment
                    last_number = int(last_student.student_id)
                    next_number = last_number + 1
                except (ValueError, TypeError):
                    # If parsing fails, start from 1
                    next_number = 1
            else:
                # No existing student_id found, start from 1
                next_number = 1
            
            # Format as 4-digit string with leading zeros (0001, 0002, etc.)
            self.student_id = f"{next_number:04d}"
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.user.username}'s Student Profile"


class TeacherProfile(models.Model):
    """Teacher-specific profile information"""
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='teacher_profile'
    )
    user_profile = models.OneToOneField(
        UserProfile,
        on_delete=models.CASCADE,
        related_name='teacher_profile',
        null=True,
        blank=True
    )
    joined_date = models.DateTimeField(auto_now_add=True)
    teacher_id = models.CharField(max_length=50, unique=True, null=True, blank=True)
    department = models.CharField(max_length=100, default='', blank=True)
    designation = models.CharField(max_length=100, default='', blank=True)
    qualifications = models.TextField(default='', blank=True)
    specialization = models.CharField(max_length=255, default='', blank=True)
    experience_years = models.IntegerField(default=0)
    bio = models.TextField(default='', blank=True)
    website = models.URLField(default='', blank=True)
    linkedin = models.URLField(default='', blank=True)
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    can_create_courses = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'profiles_teacherprofile'
        verbose_name = 'Teacher Profile'
        verbose_name_plural = 'Teacher Profiles'
    
    def save(self, *args, **kwargs):
        """Override save to auto-generate teacher_id if not provided"""
        # Check if teacher_id is None or empty string
        if not self.teacher_id or (isinstance(self.teacher_id, str) and self.teacher_id.strip() == ''):
            # Get the highest existing teacher_id
            query = TeacherProfile.objects.filter(
                teacher_id__isnull=False
            ).exclude(
                teacher_id=''
            )
            
            # Exclude current record if it's an update (pk exists)
            if self.pk:
                query = query.exclude(pk=self.pk)
            
            last_teacher = query.order_by('-teacher_id').first()
            
            if last_teacher and last_teacher.teacher_id:
                try:
                    # Extract numeric part and increment
                    last_number = int(last_teacher.teacher_id)
                    next_number = last_number + 1
                except (ValueError, TypeError):
                    # If parsing fails, start from 1
                    next_number = 1
            else:
                # No existing teacher_id found, start from 1
                next_number = 1
            
            # Format as 4-digit string with leading zeros (0001, 0002, etc.)
            self.teacher_id = f"{next_number:04d}"
        
        super().save(*args, **kwargs)
    
    def __str__(self):
        return f"{self.user.username}'s Teacher Profile"

