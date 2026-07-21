"""
Business logic layer for courses app
Separates business logic from views
"""
import os
import requests
from django.db import transaction
from django.core.exceptions import ValidationError
from django.utils import timezone
from .models import Course, CourseEnrollment, Assignment, ScheduledClass
from .exceptions import ValidationError as CourseValidationError, ConflictError, NotFoundError
import logging

logger = logging.getLogger(__name__)


class CourseService:
    """Service for course-related business logic"""
    
    @staticmethod
    def enroll_student(course_id: str, student_id: int) -> CourseEnrollment:
        """
        Enroll a student in a course with validation
        
        Args:
            course_id: Course UUID
            student_id: Student ID (integer)
            
        Returns:
            Created CourseEnrollment instance
            
        Raises:
            NotFoundError: If course not found
            ConflictError: If student already enrolled
            CourseValidationError: If validation fails
        """
        # Get course
        try:
            course = Course.objects.get(id=course_id)
        except Course.DoesNotExist:
            raise NotFoundError(f'Course with ID {course_id} not found.')
        
        # Check if already enrolled
        existing_enrollment = CourseEnrollment.objects.filter(
            course_id=course_id,
            student_id=student_id,
            is_active=True,
            completion_status='IN_PROGRESS'
        ).first()
        
        if existing_enrollment:
            raise ConflictError(
                f'Student is already enrolled in "{course.title}" ({course.course_code}).'
            )
        
        # Create enrollment
        try:
            with transaction.atomic():
                enrollment = CourseEnrollment.objects.create(
                    course=course,
                    student_id=student_id,
                    is_active=True,
                    completion_status='IN_PROGRESS'
                )
                logger.info(
                    f"Enrolled student {student_id} in course {course.course_code} "
                    f"(ID: {enrollment.id})"
                )
                return enrollment
        except Exception as e:
            logger.error(f"Error enrolling student: {e}", exc_info=True)
            raise CourseValidationError(f'Failed to enroll student: {str(e)}')
    
    @staticmethod
    def get_student_enrollments(student_id: int, active_only: bool = True) -> list:
        """
        Get all enrollments for a student
        
        Args:
            student_id: Student ID
            active_only: If True, only return active enrollments
            
        Returns:
            List of CourseEnrollment instances
        """
        queryset = CourseEnrollment.objects.filter(student_id=student_id)
        
        if active_only:
            queryset = queryset.filter(is_active=True, completion_status='IN_PROGRESS')
        
        return list(queryset.select_related('course'))
    
    @staticmethod
    def get_teacher_courses(teacher_id: int) -> list:
        """
        Get all courses taught by a teacher
        
        Args:
            teacher_id: Teacher ID (can be string or int)
            
        Returns:
            List of Course instances
        """
        try:
            # Try integer comparison first
            teacher_id_int = int(teacher_id)
            courses = Course.objects.extra(
                where=["CAST(instructor_id AS INTEGER) = %s"],
                params=[teacher_id_int]
            )
        except (ValueError, TypeError):
            # Fallback to string comparison
            courses = Course.objects.filter(instructor_id=str(teacher_id))
        
        return list(courses)


class EnrollmentService:
    """Service for enrollment-related business logic"""
    
    @staticmethod
    def complete_enrollment(enrollment_id: str) -> CourseEnrollment:
        """
        Mark an enrollment as completed and trigger certificate generation
        
        Args:
            enrollment_id: Enrollment UUID
            
        Returns:
            Updated CourseEnrollment instance
            
        Raises:
            NotFoundError: If enrollment not found
        """
        try:
            enrollment = CourseEnrollment.objects.get(id=enrollment_id)
        except CourseEnrollment.DoesNotExist:
            raise NotFoundError(f'Enrollment with ID {enrollment_id} not found.')
        
        # Update enrollment status
        enrollment.completion_status = 'COMPLETED'
        enrollment.is_active = False
        enrollment.completed_at = timezone.now()
        enrollment.save()
        
        logger.info(f"Marked enrollment {enrollment_id} as completed")
        
        # Trigger certificate generation via webhook
        try:
            certification_service_url = os.getenv(
                'CERTIFICATION_SERVICE_URL',
                'http://certification-service:8004'
            )
            webhook_url = f"{certification_service_url}/api/v1/certifications/webhook/completion/"
            
            payload = {
                'student_id': enrollment.student_id,
                'course_id': str(enrollment.course.id),
                'enrollment_id': str(enrollment.id),
                'grade': float(enrollment.progress),  # Use progress as grade
            }
            
            response = requests.post(
                webhook_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code in [200, 201]:
                logger.info(
                    f"Certificate generation triggered for enrollment {enrollment_id}, "
                    f"student {enrollment.student_id}, course {enrollment.course.course_code}"
                )
            else:
                logger.warning(
                    f"Certificate generation webhook returned {response.status_code}: "
                    f"{response.text}"
                )
        except Exception as e:
            # Don't fail enrollment completion if certificate generation fails
            logger.error(
                f"Failed to trigger certificate generation for enrollment {enrollment_id}: {e}",
                exc_info=True
            )
        
        return enrollment
    
    @staticmethod
    def drop_enrollment(enrollment_id: str) -> CourseEnrollment:
        """
        Drop an enrollment (mark as dropped)
        
        Args:
            enrollment_id: Enrollment UUID
            
        Returns:
            Updated CourseEnrollment instance
            
        Raises:
            NotFoundError: If enrollment not found
        """
        try:
            enrollment = CourseEnrollment.objects.get(id=enrollment_id)
        except CourseEnrollment.DoesNotExist:
            raise NotFoundError(f'Enrollment with ID {enrollment_id} not found.')
        
        enrollment.completion_status = 'DROPPED'
        enrollment.is_active = False
        enrollment.save()
        
        logger.info(f"Marked enrollment {enrollment_id} as dropped")
        return enrollment


