"""
Pytest configuration and shared fixtures for auth-service tests
"""
import pytest
from django.contrib.auth import get_user_model
from profiles.models import StudentProfile, TeacherProfile, CoordinatorProfile, AdminProfile

User = get_user_model()


@pytest.fixture
def test_user(db):
    """Create a test user"""
    return User.objects.create_user(
        username='testuser',
        email='test@example.com',
        password='testpass123',
        first_name='Test',
        last_name='User'
    )


@pytest.fixture
def test_student_profile(db):
    """Create a test student profile"""
    return StudentProfile.objects.create(
        username='student1',
        email='student1@example.com',
        password='testpass123',
        first_name='Student',
        last_name='One'
    )


@pytest.fixture
def test_teacher_profile(db):
    """Create a test teacher profile"""
    return TeacherProfile.objects.create(
        username='teacher1',
        email='teacher1@example.com',
        password='testpass123',
        first_name='Teacher',
        last_name='One',
        department='Computer Science',
        designation='Professor'
    )


@pytest.fixture
def api_client():
    """Create a DRF API client"""
    from rest_framework.test import APIClient
    return APIClient()


@pytest.fixture
def authenticated_client(api_client, test_user):
    """Create an authenticated API client"""
    api_client.force_authenticate(user=test_user)
    return api_client


