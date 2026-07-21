"""
API views for courses
"""
import sys
import os
import jwt
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from django.conf import settings
from django.db import models
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import Course, CourseEnrollment, Assignment, ScheduledClass, Announcement, AssignmentSubmission, Attendance, StudentAttendance
from .serializers import (
    CourseSerializer, CourseEnrollmentSerializer,
    AssignmentSerializer, ScheduledClassSerializer, AnnouncementSerializer,
    AssignmentSubmissionSerializer, AttendanceSerializer, StudentAttendanceSerializer,
    AttendanceMarkingSerializer
)


@method_decorator(csrf_exempt, name='dispatch')
class CourseViewSet(viewsets.ModelViewSet):
    """ViewSet for Course model"""
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [AllowAny]  # Allow public access to all course endpoints
    
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context
    
    def get_queryset(self):
        queryset = Course.objects.all()
        instructor_id = self.request.query_params.get('instructor_id')
        category = self.request.query_params.get('category')
        level = self.request.query_params.get('level')
        
        if instructor_id:
            try:
                # Database has instructor_id as integer, but model has CharField
                # Convert to integer for filtering since DB stores as integer
                instructor_id_int = int(instructor_id)
                # Filter using integer since database column is integer
                queryset = queryset.extra(where=["CAST(instructor_id AS INTEGER) = %s"], params=[instructor_id_int])
                print(f"Filtering courses by instructor_id: {instructor_id} (as integer: {instructor_id_int})", file=sys.stderr, flush=True)
            except (ValueError, TypeError) as e:
                # If conversion fails, try string comparison
                queryset = queryset.filter(instructor_id=str(instructor_id))
                print(f"Filtering courses by instructor_id: {instructor_id} (as string)", file=sys.stderr, flush=True)
            except Exception as e:
                print(f"Error filtering by instructor_id: {e}", file=sys.stderr, flush=True)
        if category:
            queryset = queryset.filter(category=category)
        if level:
            queryset = queryset.filter(level=level)
        
        return queryset


@method_decorator(csrf_exempt, name='dispatch')
class CourseEnrollmentViewSet(viewsets.ModelViewSet):
    """ViewSet for CourseEnrollment model"""
    queryset = CourseEnrollment.objects.all()
    serializer_class = CourseEnrollmentSerializer
    permission_classes = [AllowAny]  # Allow any - we handle auth in create method
    
    def get_queryset(self):
        queryset = CourseEnrollment.objects.all()
        student_id = self.request.query_params.get('student_id')
        if student_id:
            try:
                # Convert to integer to match database type
                student_id = int(student_id)
                queryset = queryset.filter(student_id=student_id)
            except (ValueError, TypeError):
                # If conversion fails, return empty queryset
                print(f"Invalid student_id format: {student_id}", file=sys.stderr, flush=True)
                queryset = queryset.none()
        
        course_id = self.request.query_params.get('course_id')
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        
        # Filter by instructor_id (for teachers to see their students)
        instructor_id = self.request.query_params.get('instructor_id')
        if instructor_id:
            try:
                instructor_id_int = int(instructor_id)
                # Get courses taught by this instructor
                courses = Course.objects.extra(
                    where=["CAST(instructor_id AS INTEGER) = %s"],
                    params=[instructor_id_int]
                )
                queryset = queryset.filter(course__in=courses)
                print(f"Filtering enrollments by instructor_id: {instructor_id} (found {courses.count()} courses)", file=sys.stderr, flush=True)
            except (ValueError, TypeError) as e:
                print(f"Error filtering by instructor_id: {e}", file=sys.stderr, flush=True)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """Override create to get student_id from JWT token and validate enrollment"""
        # Get student_id from JWT token (passed by API Gateway)
        # The API Gateway should include user info in headers or we extract from token
        auth_header = request.headers.get('Authorization', '')
        student_id = None
        
        # Try to get student_id from request data first (if provided)
        student_id = request.data.get('student_id')
        
        # If not provided, try to extract from JWT token
        if not student_id and auth_header:
            try:
                token = auth_header.replace('Bearer ', '').strip()
                # Use the same secret key as API Gateway
                secret_key = settings.JWT_SECRET_KEY
                payload = jwt.decode(token, secret_key, algorithms=['HS256'])
                student_id = payload.get('user_id') or payload.get('id')
            except Exception as e:
                print(f"Error decoding token: {e}", file=sys.stderr, flush=True)
        
        if not student_id:
            return Response(
                {'error': 'Student ID is required. Please provide student_id or ensure you are authenticated.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Convert student_id to integer (database expects integer)
        try:
            student_id = int(student_id)
        except (ValueError, TypeError):
            return Response(
                {'error': f'Invalid student_id format: {student_id}. Expected integer.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if student already has an active enrollment
        existing_enrollment = CourseEnrollment.objects.filter(
            student_id=student_id,
            is_active=True,
            completion_status='IN_PROGRESS'
        ).first()
        
        if existing_enrollment:
            return Response(
                {
                    'error': f'You are already enrolled in "{existing_enrollment.course.title}" ({existing_enrollment.course.course_code}). '
                             f'Please complete or drop that course before enrolling in a new one.',
                    'existing_enrollment': CourseEnrollmentSerializer(existing_enrollment).data
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create mutable copy of request data
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        data['student_id'] = student_id
        
        # Handle course_id if course is provided as ID
        if 'course' in data:
            if isinstance(data['course'], str):
                data['course_id'] = data.pop('course')
            elif isinstance(data['course'], dict) and 'id' in data['course']:
                data['course_id'] = data['course']['id']
                data.pop('course', None)
        
        # Create serializer with modified data
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)


@method_decorator(csrf_exempt, name='dispatch')
class AssignmentViewSet(viewsets.ModelViewSet):
    """ViewSet for Assignment model"""
    queryset = Assignment.objects.all()
    serializer_class = AssignmentSerializer
    
    def get_queryset(self):
        queryset = Assignment.objects.all()
        course_id = self.request.query_params.get('course_id')
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        return queryset


@method_decorator(csrf_exempt, name='dispatch')
class ScheduledClassViewSet(viewsets.ModelViewSet):
    """ViewSet for ScheduledClass model"""
    queryset = ScheduledClass.objects.all()
    serializer_class = ScheduledClassSerializer
    
    def get_queryset(self):
        queryset = ScheduledClass.objects.all()
        course_id = self.request.query_params.get('course_id')
        instructor_id = self.request.query_params.get('instructor_id')
        
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        
        if instructor_id:
            try:
                # instructor_id can be integer in database, try both string and int
                instructor_id_str = str(instructor_id)
                instructor_id_int = int(instructor_id)
                queryset = queryset.filter(
                    models.Q(instructor_id=instructor_id_str) | 
                    models.Q(instructor_id=instructor_id_int)
                )
                print(f"Filtering scheduled classes by instructor_id: {instructor_id}", file=sys.stderr, flush=True)
            except (ValueError, TypeError) as e:
                # If conversion fails, just use string comparison
                queryset = queryset.filter(instructor_id=str(instructor_id))
                print(f"Filtering scheduled classes by instructor_id (string only): {instructor_id}", file=sys.stderr, flush=True)
        
        return queryset


@method_decorator(csrf_exempt, name='dispatch')
class AnnouncementViewSet(viewsets.ModelViewSet):
    """ViewSet for Announcement model"""
    queryset = Announcement.objects.all()
    serializer_class = AnnouncementSerializer
    
    def get_queryset(self):
        queryset = Announcement.objects.all()
        course_id = self.request.query_params.get('course_id')
        if course_id:
            queryset = queryset.filter(course_id=course_id)
        return queryset


@method_decorator(csrf_exempt, name='dispatch')
class AssignmentSubmissionViewSet(viewsets.ModelViewSet):
    """ViewSet for AssignmentSubmission model"""
    queryset = AssignmentSubmission.objects.all()
    serializer_class = AssignmentSubmissionSerializer
    permission_classes = [AllowAny]  # We handle auth in methods
    
    def get_queryset(self):
        queryset = AssignmentSubmission.objects.all()
        
        # Filter by student_id if provided
        student_id = self.request.query_params.get('student_id')
        if student_id:
            try:
                student_id = int(student_id)
                queryset = queryset.filter(student_id=student_id)
            except (ValueError, TypeError):
                queryset = queryset.none()
        
        # Filter by assignment_id if provided
        assignment_id = self.request.query_params.get('assignment_id')
        if assignment_id:
            queryset = queryset.filter(assignment_id=assignment_id)
        
        return queryset
    
    def create(self, request, *args, **kwargs):
        """Override create to get student_id from JWT token"""
        auth_header = request.headers.get('Authorization', '')
        student_id = None
        
        # Try to get student_id from request data first
        student_id_from_data = request.data.get('student_id')
        if student_id_from_data:
            try:
                student_id = int(student_id_from_data)
            except ValueError:
                return Response(
                    {'error': 'Invalid student_id format. Must be an integer.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # If not provided, try to extract from JWT token
        if not student_id and auth_header:
            try:
                token = auth_header.replace('Bearer ', '').strip()
                secret_key = settings.JWT_SECRET_KEY
                payload = jwt.decode(token, secret_key, algorithms=['HS256'])
                student_id = int(payload.get('user_id') or payload.get('id'))
            except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, ValueError) as e:
                print(f"Error decoding token: {e}", file=sys.stderr, flush=True)
                return Response(
                    {'error': 'Invalid or expired authentication token.'},
                    status=status.HTTP_401_UNAUTHORIZED
                )
            except Exception as e:
                print(f"Unexpected error during token decoding: {e}", file=sys.stderr, flush=True)
                return Response(
                    {'error': 'Authentication failed due to an unexpected error.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        
        if not student_id:
            return Response(
                {'error': 'Student ID is required. Please provide student_id or ensure you are authenticated.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if submission already exists
        assignment_id = request.data.get('assignment') or request.data.get('assignment_id')
        if assignment_id:
            existing_submission = AssignmentSubmission.objects.filter(
                assignment_id=assignment_id,
                student_id=student_id
            ).first()
            
            if existing_submission:
                return Response(
                    {
                        'error': 'You have already submitted this assignment.',
                        'existing_submission': AssignmentSubmissionSerializer(existing_submission, context={'request': request}).data
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Handle file upload
        submission_file_url = ''  # Default to empty string (database requires NOT NULL)
        if 'submitted_file' in request.FILES:
            uploaded_file = request.FILES['submitted_file']
            # Save file and get URL
            from django.core.files.storage import default_storage
            from datetime import datetime
            
            # Generate unique filename
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"assignments/submissions/{timestamp}_{uploaded_file.name}"
            file_path = default_storage.save(filename, uploaded_file)
            submission_file_url = default_storage.url(file_path)
        
        # Create mutable copy of request data
        data = request.data.copy() if hasattr(request.data, 'copy') else dict(request.data)
        data['student_id'] = student_id
        data['submission_file_url'] = submission_file_url  # Always set, even if empty
        
        # Ensure submission_text is provided (database requires NOT NULL)
        if 'submission_text' not in data or not data.get('submission_text'):
            data['submission_text'] = ''  # Default to empty string if not provided
        
        # Ensure feedback is provided (database requires NOT NULL)
        if 'feedback' not in data or data.get('feedback') is None:
            data['feedback'] = ''  # Default to empty string if not provided
        
        # Handle assignment_id - frontend sends 'assignment' as string (ID) or dict
        if 'assignment' in data:
            if isinstance(data['assignment'], str):
                # If it's already a string (ID), use it directly
                data['assignment_id'] = data['assignment']
                data.pop('assignment', None)
            elif isinstance(data['assignment'], dict) and 'id' in data['assignment']:
                # If it's a dict, extract the ID
                data['assignment_id'] = data['assignment']['id']
                data.pop('assignment', None)
        
        # Ensure assignment_id is set (required field)
        if 'assignment_id' not in data or not data.get('assignment_id'):
            return Response(
                {'error': 'Assignment ID is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
    
    @action(detail=True, methods=['post'])
    def grade(self, request, pk=None):
        """Grade a submission (teacher only)"""
        submission = self.get_object()
        grade = request.data.get('grade')  # Keep 'grade' in API for backward compatibility
        feedback = request.data.get('feedback', '')
        graded_by_id = request.data.get('graded_by_id')
        
        if grade is None:
            return Response(
                {'error': 'Grade is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            grade = int(grade)
            if grade < 0 or grade > submission.assignment.total_marks:
                return Response(
                    {'error': f'Grade must be between 0 and {submission.assignment.total_marks}.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        except (ValueError, TypeError):
            return Response(
                {'error': 'Invalid grade format. Must be an integer.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        submission.marks_obtained = grade  # Store in marks_obtained field
        submission.feedback = feedback
        submission.status = 'GRADED'
        if graded_by_id:
            submission.graded_by_id = int(graded_by_id)
        from django.utils import timezone
        submission.graded_at = timezone.now()
        submission.save()
        
        serializer = self.get_serializer(submission)
        return Response(serializer.data)


# Attendance Views
from rest_framework.decorators import api_view
from django.shortcuts import get_object_or_404
from django.db import transaction
from datetime import date, timedelta, datetime
from calendar import day_name


@csrf_exempt
@api_view(['GET'])
def get_attendance(request):
    """
    Get attendance records
    Query params: scheduled_class_id, date (optional), instructor_id (optional)
    """
    scheduled_class_id = request.query_params.get('scheduled_class_id')
    attendance_date = request.query_params.get('date')
    instructor_id = request.query_params.get('instructor_id')
    
    queryset = Attendance.objects.all()
    
    # Filter by scheduled_class_id
    if scheduled_class_id:
        try:
            queryset = queryset.filter(scheduled_class_id=scheduled_class_id)
        except Exception as e:
            return Response(
                {'error': f'Invalid scheduled_class_id: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # Filter by date
    if attendance_date:
        try:
            date_obj = datetime.strptime(attendance_date, '%Y-%m-%d').date()
            queryset = queryset.filter(date=date_obj)
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD.'},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    # Filter by instructor_id (show only teacher's classes)
    if instructor_id:
        try:
            instructor_id_int = int(instructor_id)
            # Filter scheduled classes by instructor_id
            scheduled_classes = ScheduledClass.objects.extra(
                where=["CAST(instructor_id AS INTEGER) = %s"],
                params=[instructor_id_int]
            )
            queryset = queryset.filter(scheduled_class__in=scheduled_classes)
        except (ValueError, TypeError):
            # Try string comparison
            scheduled_classes = ScheduledClass.objects.filter(instructor_id=str(instructor_id))
            queryset = queryset.filter(scheduled_class__in=scheduled_classes)
    
    serializer = AttendanceSerializer(queryset, many=True, context={'request': request})
    return Response(serializer.data)


@csrf_exempt
@api_view(['POST'])
def mark_attendance(request):
    """
    Mark attendance for a scheduled class
    """
    serializer = AttendanceMarkingSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    data = serializer.validated_data
    scheduled_class_id = data['scheduled_class_id']
    attendance_date = data['date']
    student_attendance_data = data['student_attendance']
    
    # Get scheduled class
    scheduled_class = get_object_or_404(ScheduledClass, id=scheduled_class_id)
    
    # Validate instructor (if instructor_id provided in request)
    instructor_id = request.data.get('instructor_id') or request.query_params.get('instructor_id')
    if instructor_id:
        try:
            instructor_id_int = int(instructor_id)
            scheduled_instructor_int = int(scheduled_class.instructor_id) if scheduled_class.instructor_id else None
            if scheduled_instructor_int != instructor_id_int:
                # Try string comparison
                if str(scheduled_class.instructor_id) != str(instructor_id):
                    return Response(
                        {'error': 'You do not have permission to mark attendance for this class.'},
                        status=status.HTTP_403_FORBIDDEN
                    )
        except (ValueError, TypeError):
            if str(scheduled_class.instructor_id) != str(instructor_id):
                return Response(
                    {'error': 'You do not have permission to mark attendance for this class.'},
                    status=status.HTTP_403_FORBIDDEN
                )
    
    # Use instructor_id from scheduled_class or request
    marked_by = instructor_id or scheduled_class.instructor_id or 'unknown'
    
    with transaction.atomic():
        # Create or get attendance record
        attendance, created = Attendance.objects.get_or_create(
            scheduled_class=scheduled_class,
            date=attendance_date,
            defaults={
                'marked_by': str(marked_by)
            }
        )
        
        if not created:
            # Update marked_by if different
            attendance.marked_by = str(marked_by)
            attendance.save()
        
        # Clear existing student attendance records
        attendance.student_attendances.all().delete()
        
        # Create new student attendance records
        for student_data in student_attendance_data:
            StudentAttendance.objects.create(
                attendance=attendance,
                student_id=int(student_data['student_id']),
                status=student_data['status'],
                remarks=student_data.get('remarks', '')
            )
        
        # Update attendance counts
        attendance.update_counts()
    
    serializer = AttendanceSerializer(attendance, context={'request': request})
    return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


@csrf_exempt
@api_view(['GET'])
def get_suggested_dates(request, scheduled_class_id):
    """
    Get suggested dates for marking attendance based on scheduled class days
    Returns dates for current and next month that match the scheduled days
    """
    scheduled_class = get_object_or_404(ScheduledClass, id=scheduled_class_id)
    
    if not scheduled_class.days or not isinstance(scheduled_class.days, list) or len(scheduled_class.days) == 0:
        return Response(
            {'error': 'Scheduled class has no days configured.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Map day names to weekday numbers (Monday=0, Sunday=6)
    day_name_to_weekday = {
        'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3,
        'Friday': 4, 'Saturday': 5, 'Sunday': 6
    }
    
    scheduled_weekdays = [day_name_to_weekday.get(day, None) for day in scheduled_class.days]
    scheduled_weekdays = [w for w in scheduled_weekdays if w is not None]
    
    if not scheduled_weekdays:
        return Response(
            {'error': 'Invalid day names in scheduled class.'},
            status=status.HTTP_400_BAD_REQUEST
        )
    
    # Get current date and calculate dates for current and next month
    today = date.today()
    start_date = today.replace(day=1)  # First day of current month
    # End date: last day of next month
    if start_date.month == 12:
        end_date = start_date.replace(year=start_date.year + 1, month=1, day=1) + timedelta(days=32)
        end_date = end_date.replace(day=1) - timedelta(days=1)
    else:
        end_date = start_date.replace(month=start_date.month + 2, day=1) - timedelta(days=1)
    
    # Generate suggested dates
    suggested_dates = []
    current_date = start_date
    
    while current_date <= end_date:
        if current_date.weekday() in scheduled_weekdays:
            # Check if attendance already marked for this date
            attendance_exists = Attendance.objects.filter(
                scheduled_class=scheduled_class,
                date=current_date
            ).exists()
            
            suggested_dates.append({
                'date': current_date.isoformat(),
                'day_name': day_name[current_date.weekday()],
                'already_marked': attendance_exists
            })
        
        current_date += timedelta(days=1)
    
    return Response({
        'scheduled_class_id': str(scheduled_class_id),
        'scheduled_days': scheduled_class.days,
        'suggested_dates': suggested_dates
    })


@csrf_exempt
@api_view(['GET'])
def get_scheduled_class_students(request, scheduled_class_id):
    """
    Get all enrolled students for a scheduled class
    """
    scheduled_class = get_object_or_404(ScheduledClass, id=scheduled_class_id)
    
    # Get all active enrollments for this scheduled class
    enrollments = CourseEnrollment.objects.filter(
        scheduled_class=scheduled_class,
        is_active=True,
        completion_status='IN_PROGRESS'
    )
    
    students = []
    for enrollment in enrollments:
        students.append({
            'student_id': enrollment.student_id,
            'student_name': f"Student {enrollment.student_id}",  # Can be enhanced to fetch from auth-service
            'enrolled_at': enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None
        })
    
    return Response({
        'scheduled_class_id': str(scheduled_class_id),
        'class_name': scheduled_class.class_name,
        'course_code': scheduled_class.course.course_code if scheduled_class.course else None,
        'students': students,
        'total_students': len(students)
    })

