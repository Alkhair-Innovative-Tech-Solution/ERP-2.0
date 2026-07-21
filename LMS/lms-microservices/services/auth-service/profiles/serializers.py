"""
Serializers for user profiles
"""
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import UserProfile, StudentProfile, TeacherProfile

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """Serializer for User model"""
    class Meta:
        model = User
        fields = [
            'id', 'userId', 'username', 'email', 'first_name', 'last_name',
            'role', 'is_staff', 'is_active', 'date_joined',
            'profile_picture', 'cover_photo', 'features_access'
        ]
        read_only_fields = ['id', 'userId', 'date_joined']


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for UserProfile model"""
    user = UserSerializer(read_only=True)
    
    class Meta:
        model = UserProfile
        fields = [
            'id', 'user', 'bio', 'headline', 'location',
            'is_private', 'joined_date'
        ]
        read_only_fields = ['id', 'joined_date']


class StudentProfileSerializer(serializers.ModelSerializer):
    """Serializer for StudentProfile model"""
    user = UserSerializer(read_only=True)
    user_profile = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = StudentProfile
        fields = [
            'id', 'user', 'user_profile', 'enrollment_date',
            'student_id', 'grade_level', 'is_active', 'last_activity'
        ]
        read_only_fields = ['id', 'enrollment_date', 'last_activity']


class TeacherProfileSerializer(serializers.ModelSerializer):
    """Serializer for TeacherProfile model"""
    user = UserSerializer(read_only=True)
    user_profile = UserProfileSerializer(read_only=True)
    
    class Meta:
        model = TeacherProfile
        fields = [
            'id', 'user', 'user_profile', 'joined_date', 'teacher_id',
            'department', 'designation', 'qualifications', 'specialization',
            'experience_years', 'bio', 'website', 'linkedin',
            'is_verified', 'is_active', 'can_create_courses'
        ]
        read_only_fields = ['id', 'joined_date']

