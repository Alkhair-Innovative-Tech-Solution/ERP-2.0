import logging
import uuid
import requests
import os
from .models import Course, CourseRegistrationHistory, ContentCompletion
from django.shortcuts import get_object_or_404

logger = logging.getLogger(__name__)

class CourseService:
    @staticmethod
    def sync_student_profile_to_auth(student_id: uuid.UUID, course_id: uuid.UUID, scheduled_class_id: uuid.UUID = None):
        """
        Syncs student course/batch details back to Auth Service.
        """
        AUTH_URL = os.environ.get("AUTH_SERVICE_URL", "http://auth-service:8001")
        try:
            course = Course.objects.get(id=course_id)
            from .models import ScheduledClass
            sc = ScheduledClass.objects.filter(id=scheduled_class_id).first() if scheduled_class_id else None
            
            payload = {
                "level": course.name,
                "specialization": course.name,
                "batch": sc.section if sc else "",
                "course_code": course.course_code
            }
            # We use a PATCH to the user update endpoint
            requests.patch(f"{AUTH_URL}/api/auth/users/{student_id}/", json=payload, timeout=5)
        except Exception as e:
            logger.error(f"Failed to sync student profile to auth: {str(e)}")

    @staticmethod
    def check_class_capacity(scheduled_class_id: uuid.UUID) -> tuple:
        """
        Checks if the scheduled class has available seats.
        Returns (is_full: bool, message: str or None).
        Also updates strength_status and course admission_status if full.
        """
        if not scheduled_class_id:
            return False, None
        from .models import ScheduledClass, Room
        sc = ScheduledClass.objects.filter(id=scheduled_class_id).select_related('room').first()
        if not sc or not sc.room:
            return False, None
        capacity = sc.room.capacity
        enrolled_count = CourseRegistrationHistory.objects.filter(
            scheduled_class_id=scheduled_class_id,
            status='enrolled'
        ).count()
        if enrolled_count >= capacity:
            # Auto-update - mark class full
            updated = ScheduledClass.objects.filter(id=scheduled_class_id).update(
                strength_status='full'
            )
            if updated and sc.course_id:
                Course.objects.filter(id=sc.course_id, admission_status='open').update(
                    admission_status='closed'
                )
            return True, f"Class capacity reached ({capacity}). Enrollment closed."
        return False, None

    @staticmethod
    def enroll_student(student_id: uuid.UUID, course_id: uuid.UUID, scheduled_class_id: uuid.UUID = None, branch_id: str = None):
        """
        Enrolls a student in a course session.
        """
        if CourseRegistrationHistory.objects.filter(student_id=student_id, course_id=course_id).exists():
            return None, "Student is already enrolled in this course."

        # Check class capacity before enrolling
        if scheduled_class_id:
            is_full, msg = CourseService.check_class_capacity(scheduled_class_id)
            if is_full:
                return None, msg

        # Resolve branch from param or scheduled class
        branch = None
        if branch_id:
            from .models import Branch
            try:
                branch = Branch.objects.get(id=branch_id)
            except Branch.DoesNotExist:
                logger.warning(f"branch_id {branch_id} not found for enrollment of student {student_id}; falling back to scheduled class branch")
        if not branch and scheduled_class_id:
            from .models import ScheduledClass
            sc = ScheduledClass.objects.filter(id=scheduled_class_id).select_related('branch').first()
            if sc and sc.branch:
                branch = sc.branch
        if not branch:
            logger.warning(f"No branch resolved for enrollment of student {student_id} in course {course_id}")

        enrollment = CourseRegistrationHistory.objects.create(
            student_id=student_id,
            course_id=course_id,
            scheduled_class_id=scheduled_class_id,
            branch=branch,
            status="enrolled"
        )

        # Re-check capacity after enrollment (may have just filled the last seat)
        if scheduled_class_id:
            CourseService.check_class_capacity(scheduled_class_id)

        # Sync back to Auth Service
        CourseService.sync_student_profile_to_auth(student_id, course_id, scheduled_class_id)

        return enrollment, None

    @staticmethod
    def transfer_student(student_id: uuid.UUID, from_course_id: uuid.UUID, to_course_id: uuid.UUID, to_scheduled_class_id: uuid.UUID = None):
        """
        Transfers a student from one course/section to another.
        """
        from .models import StudentDeposit, CourseRegistrationHistory

        # Check target class capacity before transfer
        if to_scheduled_class_id:
            is_full, msg = CourseService.check_class_capacity(to_scheduled_class_id)
            if is_full:
                return None, msg

        # 1. Update old registrations to 'transferred'
        CourseRegistrationHistory.objects.filter(
            student_id=student_id, 
            course_id=from_course_id,
            status='enrolled'
        ).update(status='transferred')

        # 2. Resolve branch from target scheduled class
        from .models import ScheduledClass
        branch = None
        if to_scheduled_class_id:
            sc = ScheduledClass.objects.filter(id=to_scheduled_class_id).select_related('branch').first()
            if sc and sc.branch:
                branch = sc.branch

        # 3. Create new registration
        new_enrollment = CourseRegistrationHistory.objects.create(
            student_id=student_id,
            course_id=to_course_id,
            scheduled_class_id=to_scheduled_class_id,
            branch=branch,
            status='enrolled'
        )

        # 4. Shift StudentDeposit to the new course
        StudentDeposit.objects.filter(
            student_id=student_id,
            course_id=from_course_id
        ).update(course_id=to_course_id)

        # Sync back to Auth Service
        CourseService.sync_student_profile_to_auth(student_id, to_course_id, to_scheduled_class_id)

        return new_enrollment, None

    @staticmethod
    def _check_time_conflict(queryset, days, start_time, end_time, exclude_id=None):
        """Check if any scheduled class in queryset has overlapping days/time.
        Optionally exclude a specific class ID (for updates)."""
        for existing in queryset:
            if exclude_id and str(existing.id) == str(exclude_id):
                continue
            if any(day in existing.days for day in days):
                if start_time < existing.end_time and end_time > existing.start_time:
                    return existing
        return None

    @staticmethod
    def create_scheduled_class(data: dict):
        """
        Creates a scheduled class (Section) with conflict checks.
        """
        from .models import ScheduledClass, Course, Room
        
        # 1. Check Teacher Conflict
        instructor_classes = ScheduledClass.objects.filter(instructor_id=data['instructor_id'], active=True)
        conflict = CourseService._check_time_conflict(instructor_classes, data['days'], data['start_time'], data['end_time'])
        if conflict:
            return None, f"Teacher Conflict: This teacher already has a class on these days/time ({conflict.course.name})"

        # 2. Check Room Conflict
        room_classes = ScheduledClass.objects.filter(room_id=data['room_id'], active=True)
        conflict = CourseService._check_time_conflict(room_classes, data['days'], data['start_time'], data['end_time'])
        if conflict:
            return None, f"Room Conflict: This room is already occupied on these days/time"

        # 3. Resolve campus_id and branch_id
        campus_id = data.get('campus_id')
        branch_id = data.get('branch_id')
        
        # If campus_id not provided, try to get from room
        if not campus_id:
            room = Room.objects.filter(id=data['room_id']).first()
            if room and room.campus_id:
                campus_id = str(room.campus_id)
        
        # If branch_id not provided, try to get from room (backward compatibility)
        if not branch_id:
            room = Room.objects.filter(id=data['room_id']).first()
            if room and room.branch_id:
                branch_id = str(room.branch_id)

        # 4. Create
        course = get_object_or_404(Course, id=data['course_id'])
        room = get_object_or_404(Room, id=data['room_id'])
        
        # 🔹 Multi-Tenancy: Get org_id from middleware context
        org_id = data.get('organization_id')
        if not org_id:
            from common.organization import get_current_org_id
            org_id = get_current_org_id()
        
        sc = ScheduledClass.objects.create(
            course=course,
            instructor_id=data['instructor_id'],
            room=room,
            start_time=data['start_time'],
            end_time=data['end_time'],
            days=data['days'],
            section=data.get('section'),
            lab_room=data.get('lab_room'),
            strength_status=data.get('strength_status', 'seats_available'),
            whatsapp_group_link_boys=data.get('whatsapp_group_link_boys'),
            whatsapp_group_link_girls=data.get('whatsapp_group_link_girls'),
            admission_open_date=data.get('admission_open_date'),
            course_start_date=data.get('course_start_date'),
            course_end_date=data.get('course_end_date'),
            active=data.get('active', True),
            organization_id=org_id,
            campus_id=campus_id,
        )
        
        # Backward compatibility: set branch if provided
        if branch_id:
            from .models import Branch
            try:
                sc.branch = Branch.objects.get(id=branch_id)
                sc.save(update_fields=['branch'])
            except Branch.DoesNotExist:
                pass
        
        # Update Course details
        if data.get('admission_open_date'):
            course.admission_open_date = data.get('admission_open_date')
            course.admission_status = 'open'
        if data.get('course_start_date'):
            course.course_start_date = data.get('course_start_date')
        if data.get('course_end_date'):
            course.course_end_date = data.get('course_end_date')
        
        course.save()

        return sc, None

class ProgressService:
    @staticmethod
    def complete_content(student_id: uuid.UUID, course_id: uuid.UUID, content_id: uuid.UUID):
        completion, created = ContentCompletion.objects.get_or_create(
            student_id=student_id,
            content_id=content_id,
            defaults={'course_id': course_id}
        )
        return completion, created
