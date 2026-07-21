"""
Pytest configuration and shared fixtures for course-service tests
"""
import pytest
from courses.models import Course, CourseEnrollment, Assignment, ScheduledClass


@pytest.fixture
def test_course(db):
    """Create a test course"""
    return Course.objects.create(
        course_code='CS101',
        title='Introduction to Computer Science',
        description='Basic CS course',
        category='tech',
        level='BEGINNER',
        duration=40,
        duration_unit='hours',
        instructor_id='1',
        is_published=True
    )


@pytest.fixture
def test_enrollment(db, test_course):
    """Create a test enrollment"""
    return CourseEnrollment.objects.create(
        course=test_course,
        student_id=1,
        is_active=True,
        completion_status='IN_PROGRESS'
    )


@pytest.fixture
def api_client():
    """Create a DRF API client"""
    from rest_framework.test import APIClient
    return APIClient()


