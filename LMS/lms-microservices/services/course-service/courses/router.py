from ninja_extra import Router
from ninja import File, Form, UploadedFile
from pydantic import BaseModel
from django.shortcuts import get_object_or_404
from django.utils import timezone
from typing import List, Optional, Dict, Any
from datetime import date, datetime, time
import uuid
import os
import requests
from .models import Course, Specialization, ScheduledClass, CourseRegistrationHistory, Assignment, Submission, Attendance, Room, ContentCompletion, CourseRating, StudentDeposit, AdminActionLog, Branch, AttendanceContactLog, StudentWarning
import logging
from .schemas import (
    CourseSchema, CourseCreateSchema, CourseUpdateSchema,
    SpecializationSchema, SpecializationCreateSchema, SpecializationUpdateSchema,
    BranchSchema,
    EnrollmentSchema, EnrollmentCreateSchema, AttendanceSchema,
    AssignmentSchema, AssignmentCreateSchema, SubmissionSchema, SubmissionCreateSchema,
    GradeSubmissionSchema, BulkAttendanceCreateSchema,
    RoomSchema, RoomCreateSchema, ScheduledClassSchema, ScheduledClassCreateSchema,
    ContentCompletionSchema, ContentCompletionCreateSchema, CourseProgressSchema, AssignmentStatsSchema,
    ScheduledClassUpdateSchema, EnrollmentTransferSchema, EnrollmentUpdateSchema, ReEnrollmentSchema, StudentDepositSchema, StudentDepositCreateSchema, StudentDepositProcessReturnSchema,
    PaginatedEnrollmentResponseSchema,
    CoordinatorAttendanceResponseSchema, CoordinatorAttendanceContactSchema,
    CoordinatorAttendanceStatsSchema, CoordinatorDashboardStatsSchema,
    SectionSummarySchema, SectionStudentSchema,
    StudentWarningSchema, StudentWarningCreateSchema, StudentWarningResolveSchema,
    TeacherCourseAttendanceResponse, TeacherCourseAttendanceSchema, TeacherAttendanceClassSchema,
)
from django.db.models import Avg, Count, Q
from django.utils import timezone
from shared.common.authentication import roles_required, JWTAuthentication
from ninja.errors import HttpError
from .services import CourseService

course_router = Router()

# BRANCH ENDPOINTS
@course_router.get("/branches/", response=List[BranchSchema])
def list_branches(request):
    return Branch.objects.filter(is_active=True)

# COURSE ENDPOINTS
@course_router.get("/courses/", response=List[CourseSchema])
def list_courses(request, specialization_id: str = None, instructor_id: str = None, branch_id: str = None, archived: bool = False, search: str = None):
    queryset = Course.objects.filter(is_deleted=archived)
    
    # ðŸ”¹ Multi-Tenancy: Filter by organization_id
    from common.organization import get_current_org_id
    org_id = get_current_org_id()
    if not org_id:
        org_id = request.headers.get('X-Org-Id')
    if org_id:
        queryset = queryset.filter(organization_id=org_id)
    
    if specialization_id: queryset = queryset.filter(specialization_id=specialization_id)
    if instructor_id: queryset = queryset.filter(scheduled_classes__instructor_id=instructor_id)
    if branch_id: queryset = queryset.filter(branches__id=branch_id)
    if search: queryset = queryset.filter(name__icontains=search)
    
    # Dynamic Update Status before returning
    courses = list(queryset.distinct())
    today = timezone.now().date()
    for course in courses:
        course.update_admission_status()
        # Annotate sessions from active scheduled classes with open admissions
        all_sessions = list(course.scheduled_classes.filter(active=True).select_related('room', 'branch')[:5])
        open_sessions = [
            s for s in all_sessions
            if (not s.admission_open_date or s.admission_open_date <= today)
            and (not s.course_start_date or s.course_start_date > today)
            and (s.strength_status != 'full')
        ]
        course.sessions = open_sessions
        course.sessions_count = len(open_sessions)
    
    return courses

@course_router.get("/courses/{course_id}/", response=CourseSchema)
def get_course_rest(request, course_id: str):
    course = get_object_or_404(Course, id=course_id)
    course.update_admission_status()
    # Include all active scheduled classes as sessions with open admissions
    today = timezone.now().date()
    all_sessions = list(course.scheduled_classes.filter(active=True).select_related('room', 'branch'))
    open_sessions = [
        s for s in all_sessions
        if (not s.admission_open_date or s.admission_open_date <= today)
        and (not s.course_start_date or s.course_start_date > today)
        and (s.strength_status != 'full')
    ]
    course.sessions = open_sessions
    course.sessions_count = len(open_sessions)
    return course

@course_router.post("/courses/", response=CourseSchema, auth=JWTAuthentication())
def create_course(request, data: CourseCreateSchema = Form(...), image: UploadedFile = File(None)):
    payload = data.dict(exclude_unset=True)
    spec_id = payload.pop('specialization')
    
    # ðŸ”¹ Multi-Tenancy: Get org_id from request body, headers, or middleware context
    org_id = payload.pop('organization_id', None)
    if not org_id:
        org_id = request.headers.get('X-Org-Id')
    if not org_id:
        from common.organization import get_current_org_id
        org_id = get_current_org_id()
    
    course = Course.objects.create(specialization_id=spec_id, organization_id=org_id, **payload)
    if image:
        course.image = image
        course.save()
    return course

@course_router.patch("/courses/{course_id}/", response=CourseSchema, auth=JWTAuthentication())
def update_course(request, course_id: str, data: CourseUpdateSchema = Form(...), image: UploadedFile = File(None)):
    course = get_object_or_404(Course, id=course_id)
    payload = data.dict(exclude_unset=True)
    if 'specialization' in payload: 
        course.specialization_id = payload.pop('specialization')
    for attr, value in payload.items(): 
        setattr(course, attr, value)
    
    if image:
        course.image = image
    
    course.save()
    return course

@course_router.delete("/courses/{course_id}/", auth=JWTAuthentication())
def delete_course(request, course_id: str):
    course = get_object_or_404(Course, id=course_id)
    course.is_deleted = True
    course.deleted_at = timezone.now()
    course.save()
    
    AdminActionLog.objects.create(
        admin_user_id=request.auth.get('user_id') if request.auth else uuid.uuid4(),
        admin_name="Admin",
        action_type="DELETE",
        model_name="Course",
        object_id=str(course.id)
    )
    return {"message": "Course archived"}

@course_router.post("/courses/{course_id}/restore/", auth=JWTAuthentication())
def restore_course(request, course_id: str):
    course = get_object_or_404(Course, id=course_id)
    course.is_deleted = False
    course.deleted_at = None
    course.save()
    
    AdminActionLog.objects.create(
        admin_user_id=request.auth.get('user_id') if request.auth else uuid.uuid4(),
        admin_name="Admin",
        action_type="RESTORE",
        model_name="Course",
        object_id=str(course.id)
    )
    return {"message": "Course restored"}

# SPECIALIZATION ENDPOINTS
@course_router.get("/specialization/all", response=List[SpecializationSchema])
def list_specializations(request, archived: bool = False):
    # ðŸ”¹ Multi-Tenancy: Filter by organization_id
    from common.organization import get_current_org_id
    org_id = get_current_org_id()
    
    queryset = Specialization.objects.filter(is_deleted=archived)
    if org_id:
        queryset = queryset.filter(organization_id=org_id)
    
    return queryset

@course_router.post("/specialization", response=SpecializationSchema, auth=JWTAuthentication())
def create_specialization(request, data: SpecializationCreateSchema):
    # ðŸ”¹ Multi-Tenancy: Get org_id from request body, headers, or middleware context
    org_id = data.organization_id
    if not org_id:
        # Try headers directly (API Gateway injects X-Org-Id)
        org_id = request.headers.get('X-Org-Id')
    if not org_id:
        # Try middleware context
        from common.organization import get_current_org_id
        org_id = get_current_org_id()
    
    spec_data = data.dict()
    if org_id:
        spec_data['organization_id'] = org_id
    
    print(f"[create_specialization] org_id={org_id}")
    
    return Specialization.objects.create(**spec_data)

@course_router.patch("/specialization/{spec_id}/", response=SpecializationSchema, auth=JWTAuthentication())
def update_specialization(request, spec_id: uuid.UUID, data: SpecializationUpdateSchema):
    spec = get_object_or_404(Specialization, id=spec_id)
    for attr, value in data.dict(exclude_unset=True).items(): setattr(spec, attr, value)
    spec.save(); return spec

@course_router.delete("/specialization/{spec_id}/", auth=JWTAuthentication())
def delete_specialization(request, spec_id: uuid.UUID):
    spec = get_object_or_404(Specialization, id=spec_id)
    spec.is_deleted = True; spec.deleted_at = timezone.now(); spec.save()
    return {"message": "Specialization archived"}

@course_router.post("/specialization/{spec_id}/restore/", auth=JWTAuthentication())
def restore_specialization(request, spec_id: uuid.UUID):
    spec = get_object_or_404(Specialization, id=spec_id)
    spec.is_deleted = False; spec.deleted_at = None; spec.save()
    return {"message": "Specialization restored"}

# ENROLLMENT ENDPOINTS
@course_router.get("/enrollments/", response=PaginatedEnrollmentResponseSchema)
def list_enrollments(request, student_id: str = None, course_id: str = None, instructor_id: str = None, scheduled_class_id: str = None, branch_id: str = None, status: str = None, class_status: str = None, search: str = None, page: int = 1, limit: int = 20):
    queryset = CourseRegistrationHistory.objects.select_related('course', 'scheduled_class').all().order_by('-registration_date')
    
    # ðŸ”¹ Multi-Tenancy: Filter by organization_id
    from common.organization import get_current_org_id
    org_id = get_current_org_id()
    if not org_id:
        org_id = request.headers.get('X-Org-Id')
    if org_id:
        queryset = queryset.filter(organization_id=org_id)
    
    if student_id: queryset = queryset.filter(student_id=student_id)
    if course_id: queryset = queryset.filter(course_id=course_id)
    if scheduled_class_id: queryset = queryset.filter(scheduled_class_id=scheduled_class_id)
    if instructor_id: queryset = queryset.filter(scheduled_class__instructor_id=instructor_id)
    if branch_id: queryset = queryset.filter(branch_id=branch_id)
    if status and status != 'ALL': queryset = queryset.filter(status__iexact=status)
    if class_status and class_status != 'ALL': queryset = queryset.filter(scheduled_class__status=class_status)
    
    if search:
        # Search by roll number or student_id (if valid UUID)
        search_query = Q(roll_number__icontains=search)
        try:
            search_uuid = uuid.UUID(search)
            search_query |= Q(student_id=search_uuid)
        except ValueError:
            pass
        queryset = queryset.filter(search_query)
    
    total = queryset.count()
    pages = (total + limit - 1) // limit
    offset = (page - 1) * limit
    
    items = queryset[offset:offset + limit]
    
    return {
        "items": list(items),
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages
    }

@course_router.get("/admin/force-sync/{email}/")
def force_sync_student(request, email: str):
    """
    Emergency endpoint to sync a student's enrollment if the RabbitMQ event was missed.
    Usage: GET /api/courses/admin/force-sync/user@example.com/
    """
    logger = logging.getLogger(__name__)
    AUTH_URL = os.environ.get("AUTH_SERVICE_URL", "http://auth-service:8001")
    
    logger.info(f"ðŸ› ï¸ Attempting manual force-sync for email: {email}")
    
    try:
        # 1. Fetch receipt data from Auth Service
        # We search through the admin receipt list to find the matching email
        resp = requests.get(f"{AUTH_URL}/api/auth/admin/receipt-codes/", timeout=5)
        if resp.status_code != 200:
            return {"status": "error", "message": f"Could not reach Auth Service: {resp.status_code}"}
            
        receipts = resp.json()
        target = next((r for r in receipts if email.lower() in r['student_email'].lower()), None)
        
        if not target:
            return {"status": "error", "message": f"No receipt found for email containing '{email}'"}
            
        # We need the user's UUID (lms_user_id)
        # Note: If the admin list doesn't have it, we'll try to get it from the student-status endpoint
        student_email = target['student_email']
        course_id = target.get('course_id')
        
        # Look up the ID from the verification status 
        status_resp = requests.get(f"{AUTH_URL}/api/auth/students/receipt-status/", params={"email": student_email}, timeout=5)
        status_data = status_resp.json()
        
        # We might need to look into the lms-microservices/services/auth-service/users/router.py 
        # to ensure it returns the user_id in some way.
        # But if the user just registered, we can assume the enrolment should be created.
        
        # IMPORTANT: If we don't have the student_id string, we have to find it.
        student_id = status_data.get('lms_user_id')
        course = get_object_or_404(Course, id=course_id)
        
        if not student_id:
             return {"status": "error", "message": f"Student {student_email} has not created an LMS account yet (lms_user_id missing)."}
        
        # 3. Create Enrollment record locally
        # First, ensure student is only in one section of this course
        CourseRegistrationHistory.objects.filter(
            student_id=student_id, 
            course=course
        ).delete()
        
        scheduled_class = ScheduledClass.objects.filter(course=course, active=True).select_related('branch').first()
        
        enrollment = CourseRegistrationHistory.objects.create(
            student_id=student_id,
            course=course,
            scheduled_class=scheduled_class,
            branch=scheduled_class.branch if scheduled_class else None,
            status='enrolled'
        )
        
        return {
            "status": "success", 
            "message": f"Successfully enrolled student {student_email} in {course.name}",
            "details": {
                "student_id": student_id,
                "course": course.name,
                "section": scheduled_class.section if scheduled_class else "None"
            }
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

@course_router.post("/enrollments/", response=EnrollmentSchema, auth=JWTAuthentication())
@roles_required(["ADMIN", "COORDINATOR"])
def create_enrollment(request, data: EnrollmentCreateSchema):
    enrollment, error = CourseService.enroll_student(student_id=data.student_id, course_id=data.course_id, scheduled_class_id=data.scheduled_class_id, branch_id=data.branch_id)
    if error: raise HttpError(400, error)
    return enrollment

@course_router.post("/enrollments/transfer/", response=EnrollmentSchema, auth=JWTAuthentication())
@roles_required(["ADMIN", "COORDINATOR"])
def transfer_enrollment(request, data: EnrollmentTransferSchema):
    enrollment, error = CourseService.transfer_student(
        student_id=data.student_id,
        from_course_id=data.old_course_id,
        to_course_id=data.new_course_id,
        to_scheduled_class_id=data.new_scheduled_class_id
    )
    if error: raise HttpError(400, error)
    return enrollment

@course_router.post("/enrollments/re-enroll/", response=EnrollmentSchema, auth=JWTAuthentication())
@roles_required(["ADMIN", "COORDINATOR"])
def re_enroll_alumni(request, data: ReEnrollmentSchema):
    """
    Re-enroll an alumni in a new course.
    - Checks if student has a paid deposit (transfers it to new course)
    - Prevents re-enrollment in the same completed course
    - Creates new enrollment with roll number
    """
    from .models import StudentDeposit, Course
    
    # 1. Check if student has a paid deposit for ANY course (not returned)
    existing_deposit = StudentDeposit.objects.filter(
        student_id=data.student_id,
        is_returned=False,
        is_deleted=False
    ).first()
    
    if not existing_deposit:
        raise HttpError(400, "No paid deposit found. Student must pay deposit first.")
    
    # 2. Check if student already completed this course
    completed = CourseRegistrationHistory.objects.filter(
        student_id=data.student_id,
        course_id=data.course_id,
        status__in=['completed', 'graduated']
    ).exists()
    
    if completed:
        raise HttpError(400, "Student has already completed this course. Cannot re-enroll.")
    
    # 3. Check if student already enrolled in this course
    enrolled = CourseRegistrationHistory.objects.filter(
        student_id=data.student_id,
        course_id=data.course_id,
        status='enrolled'
    ).exists()
    
    if enrolled:
        raise HttpError(400, "Student is already enrolled in this course.")
    
    # 4. Transfer deposit to new course
    old_course_id = existing_deposit.course_id
    StudentDeposit.objects.filter(
        student_id=data.student_id
    ).exclude(course_id=data.course_id).update(course_id=data.course_id)
    
    # 5. Create new enrollment
    enrollment, error = CourseService.enroll_student(
        student_id=data.student_id,
        course_id=data.course_id,
        scheduled_class_id=data.scheduled_class_id
    )
    
    if error:
        # Rollback deposit transfer on error
        StudentDeposit.objects.filter(student_id=data.student_id).update(course_id=old_course_id)
        raise HttpError(400, error)
    
    return enrollment

@course_router.patch("/enrollments/{enrollment_id}/", response=EnrollmentSchema, auth=JWTAuthentication())
@roles_required(["ADMIN", "COORDINATOR"])
def update_enrollment(request, enrollment_id: uuid.UUID, data: EnrollmentUpdateSchema):
    enrollment = get_object_or_404(CourseRegistrationHistory, id=enrollment_id)
    old_status = enrollment.status
    if data.status:
        enrollment.status = data.status
    if data.roll_number:
        enrollment.roll_number = data.roll_number
    if data.scheduled_class_id:
        enrollment.scheduled_class_id = data.scheduled_class_id
    if data.branch_id:
        from .models import Branch
        try:
            enrollment.branch = Branch.objects.get(id=data.branch_id)
        except Branch.DoesNotExist:
            pass
    enrollment.save()
    
    # Trigger certificate generation when enrollment is marked as completed/graduated
    if data.status and data.status.lower() in ('completed', 'graduated') and old_status.lower() not in ('completed', 'graduated'):
        try:
            cert_svc = os.environ.get('CERTIFICATION_SERVICE_URL', 'http://certification-service:8004')
            webhook_url = f"{cert_svc}/api/certifications/webhook/completion/"
            requests.post(webhook_url, json={
                'student_id': str(enrollment.student_id),
                'course_id': str(enrollment.course_id),
                'enrollment_id': str(enrollment.id),
                'grade': getattr(enrollment, 'grade', None),
                'percentile': getattr(enrollment, 'percentile', None),
            }, timeout=10)
            logger.info(f"Certificate generation triggered for enrollment {enrollment_id}")
        except Exception as e:
            logger.warning(f"Failed to trigger certificate generation: {e}")
    
    return enrollment

# SCHEDULED CLASS ENDPOINTS
@course_router.get("/scheduled-classes/", response=List[ScheduledClassSchema])
def list_scheduled_classes(request, course_id: uuid.UUID = None, instructor_id: uuid.UUID = None, room_id: uuid.UUID = None, branch_id: str = None, status: str = None, active: bool = None):
    queryset = ScheduledClass.objects.all()
    
    # ðŸ”¹ Multi-Tenancy: Filter by organization_id
    from common.organization import get_current_org_id
    org_id = get_current_org_id()
    if not org_id:
        org_id = request.headers.get('X-Org-Id')
    if org_id:
        queryset = queryset.filter(organization_id=org_id)
    
    if course_id: queryset = queryset.filter(course_id=course_id)
    if instructor_id: queryset = queryset.filter(instructor_id=instructor_id)
    if room_id: queryset = queryset.filter(room_id=room_id)
    if branch_id: queryset = queryset.filter(branch_id=branch_id)
    if status: queryset = queryset.filter(status=status)
    if active is not None: queryset = queryset.filter(active=active)
    return [ScheduledClassSchema.from_orm(sc) for sc in queryset]

@course_router.post("/scheduled-classes/", response=ScheduledClassSchema, auth=JWTAuthentication())
def create_scheduled_class(request, data: ScheduledClassCreateSchema):
    sc, error = CourseService.create_scheduled_class(data.dict())
    if error: raise HttpError(400, error)
    return sc

@course_router.patch('/scheduled-classes/{class_id}/', response=ScheduledClassSchema, auth=JWTAuthentication())
def update_scheduled_class(request, class_id: uuid.UUID, data: ScheduledClassUpdateSchema):
    sc = get_object_or_404(ScheduledClass, id=class_id)
    payload = data.dict(exclude_unset=True)
    
    # Resolve branch from room if not explicitly provided
    if 'branch_id' in payload:
        branch_id = payload.pop('branch_id')
        if branch_id:
            from .models import Branch
            try:
                sc.branch = Branch.objects.get(id=branch_id)
            except Branch.DoesNotExist:
                pass
        else:
            sc.branch = None
    elif 'room_id' in payload:
        room_obj = Room.objects.filter(id=payload['room_id']).first()
        if room_obj and room_obj.branch:
            sc.branch = room_obj.branch
    
    if 'room_id' in payload:
        sc.room_id = payload.pop('room_id')
    
    # Conflict checks when time/days/instructor change
    days = payload.get('days', sc.days)
    start_time = payload.get('start_time', sc.start_time)
    end_time = payload.get('end_time', sc.end_time)
    instructor_id = payload.get('instructor_id', sc.instructor_id)
    room_id = sc.room_id
    
    if instructor_id:
        instructor_classes = ScheduledClass.objects.filter(instructor_id=instructor_id, active=True)
        conflict = CourseService._check_time_conflict(instructor_classes, days, start_time, end_time, exclude_id=class_id)
        if conflict:
            raise HttpError(400, f"Teacher Conflict: This teacher already has a class on these days/time ({conflict.course.name})")
    
    room_classes = ScheduledClass.objects.filter(room_id=room_id, active=True)
    conflict = CourseService._check_time_conflict(room_classes, days, start_time, end_time, exclude_id=class_id)
    if conflict:
        raise HttpError(400, f"Room Conflict: This room is already occupied on these days/time")
    
    for a, v in payload.items():
        setattr(sc, a, v)
    sc.save()
    return sc

@course_router.get("/scheduled-classes/{class_id}/", response=ScheduledClassSchema)
def get_scheduled_class(request, class_id: uuid.UUID):
    return get_object_or_404(ScheduledClass, id=class_id)

@course_router.get("/scheduled-classes/{class_id}/whatsapp-link/", auth=JWTAuthentication())
def get_class_whatsapp_link(request, class_id: uuid.UUID):
    """Returns the appropriate WhatsApp group link based on the requesting user's gender."""
    sc = get_object_or_404(ScheduledClass, id=class_id)
    curr_user = request.auth if hasattr(request, 'auth') and request.auth else None
    gender = getattr(curr_user, 'gender', None) if curr_user else None
    if gender and gender.lower() in ('male', 'm'):
        link = sc.whatsapp_group_link_boys or sc.whatsapp_group_link_girls or ''
    elif gender and gender.lower() in ('female', 'f'):
        link = sc.whatsapp_group_link_girls or sc.whatsapp_group_link_boys or ''
    else:
        link = sc.whatsapp_group_link_boys or sc.whatsapp_group_link_girls or ''
    return {'link': link}

@course_router.delete("/scheduled-classes/{class_id}/", auth=JWTAuthentication())
def delete_scheduled_class(request, class_id: uuid.UUID):
    get_object_or_404(ScheduledClass, id=class_id).delete()
    return {"message": "Deleted"}

# SESSION PICKER FOR REGISTRATION
class SessionSchema(BaseModel):
    id: uuid.UUID
    section: Optional[str] = None
    days: List[str]
    start_time: str
    end_time: str
    room: str
    teacher_name: Optional[str] = None
    label: str
    admission_open_date: Optional[date] = None
    course_start_date: Optional[date] = None
    seats_available: int = 0
    active: bool = True
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None

@course_router.get("/courses/{course_id}/sessions/", response=List[SessionSchema])
def list_course_sessions(request, course_id: uuid.UUID):
    sessions = ScheduledClass.objects.filter(course_id=course_id, active=True).select_related("room")
    res = []
    for sc in sessions:
        day_map = {"MON": "Mon", "TUE": "Tue", "WED": "Wed", "THU": "Thu", "FRI": "Fri", "SAT": "Sat", "SUN": "Sun"}
        days_str = " ".join(day_map.get(d, d) for d in sc.days)
        def fmt(t): return t.strftime("%I:%M %p") if t else ""
        teacher = sc.teacher_name or "TBA"
        room_name = sc.room.name if sc.room else "Unassigned"
        label = f"Sec {sc.section or ''} â€” {days_str} {fmt(sc.start_time)}â€“{fmt(sc.end_time)} | {teacher} | {room_name}"
        
        seats = 0
        if sc.room:
            seats = max(0, sc.room.capacity - sc.total_students)
            
        res.append(SessionSchema(
            id=sc.id, 
            section=sc.section, 
            days=sc.days, 
            start_time=str(sc.start_time), 
            end_time=str(sc.end_time), 
            room=sc.room.name if sc.room else "Unassigned", 
            teacher_name=sc.teacher_name or "TBA",
            label=label, 
            admission_open_date=sc.admission_open_date, 
            course_start_date=sc.course_start_date, 
            seats_available=seats,
            active=sc.active,
            branch_id=str(sc.branch.id) if sc.branch else None,
            branch_name=sc.branch.name if sc.branch else None
        ))
    return res

# OTHER ENDPOINTS (ROOMS, DEPOSITS, ATTENDANCE)
@course_router.get("/rooms/", response=List[RoomSchema])
def list_rooms(request):
    # ðŸ”¹ Multi-Tenancy: Filter by organization_id
    from common.organization import get_current_org_id
    org_id = get_current_org_id()
    if not org_id:
        org_id = request.headers.get('X-Org-Id')
    
    queryset = Room.objects.all()
    if org_id:
        queryset = queryset.filter(organization_id=org_id)
    return queryset

@course_router.post("/rooms/", response=RoomSchema, auth=JWTAuthentication())
def create_room(request, data: RoomCreateSchema):
    # ðŸ”¹ Multi-Tenancy: Get org_id from middleware context
    org_id = data.organization_id
    if not org_id:
        from common.organization import get_current_org_id
        org_id = get_current_org_id()
    
    payload = data.dict()
    branch_id = payload.pop('branch_id', None)
    campus_id = payload.pop('campus_id', None)
    
    if org_id:
        payload['organization_id'] = org_id
    if campus_id:
        payload['campus_id'] = campus_id
    
    room = Room.objects.create(**payload)
    
    # Backward compatibility: set branch from campus if not provided
    if not branch_id and campus_id:
        # You could auto-set branch here if needed
        pass
    elif branch_id:
        from .models import Branch
        try:
            room.branch = Branch.objects.get(id=branch_id)
            room.save(update_fields=['branch'])
        except Branch.DoesNotExist:
            pass
    
    return room

@course_router.get("/deposits/", response=List[StudentDepositSchema], auth=JWTAuthentication())
def list_deposits(request, student_id: uuid.UUID = None, archived: bool = False):
    qs = StudentDeposit.objects.filter(is_deleted=archived).order_by('-created_at')
    if student_id: qs = qs.filter(student_id=student_id)
    return list(qs)

@course_router.post("/deposits/", response=StudentDepositSchema, auth=JWTAuthentication())
def create_deposit(request, data: StudentDepositCreateSchema):
    return StudentDeposit.objects.create(**data.dict())

@course_router.patch("/deposits/{deposit_id}/", response=StudentDepositSchema, auth=JWTAuthentication())
def update_deposit(request, deposit_id: uuid.UUID, data: Dict[str, Any]):
    dep = get_object_or_404(StudentDeposit, id=deposit_id)
    for attr, value in data.items(): setattr(dep, attr, value)
    dep.save()
    
    AdminActionLog.objects.create(
        admin_user_id=request.auth.get('user_id') if request.auth else uuid.uuid4(),
        admin_name="Admin",
        action_type="UPDATE",
        model_name="StudentDeposit",
        object_id=str(dep.id),
        details={"changes": data}
    )
    return dep

@course_router.delete("/deposits/{deposit_id}/", auth=JWTAuthentication())
def delete_deposit(request, deposit_id: uuid.UUID):
    dep = get_object_or_404(StudentDeposit, id=deposit_id)
    dep.is_deleted = True; dep.deleted_at = timezone.now(); dep.save()
    
    AdminActionLog.objects.create(
        admin_user_id=request.auth.get('user_id') if request.auth else uuid.uuid4(),
        admin_name="Admin",
        action_type="DELETE",
        model_name="StudentDeposit",
        object_id=str(dep.id)
    )
    return {"message": "Deposit archived"}

@course_router.post("/deposits/{deposit_id}/restore/", auth=JWTAuthentication())
def restore_deposit(request, deposit_id: uuid.UUID):
    dep = get_object_or_404(StudentDeposit, id=deposit_id)
    dep.is_deleted = False; dep.deleted_at = None; dep.save()
    
    AdminActionLog.objects.create(
        admin_user_id=request.auth.get('user_id') if request.auth else uuid.uuid4(),
        admin_name="Admin",
        action_type="RESTORE",
        model_name="StudentDeposit",
        object_id=str(dep.id)
    )
    return {"message": "Deposit restored"}

@course_router.patch("/deposits/{deposit_id}/process-return/", response=StudentDepositSchema, auth=JWTAuthentication())
def process_deposit_return(request, deposit_id: uuid.UUID, data: StudentDepositProcessReturnSchema):
    dep = get_object_or_404(StudentDeposit, id=deposit_id)
    if dep.is_returned:
        raise HttpError(400, "Deposit already returned")
        
    dep.is_returned = True
    dep.amount_returned = dep.calculate_refund()
    dep.returned_at = timezone.now()
    dep.remarks = f"{dep.remarks}\n[Refund Processed] {data.remarks}" if dep.remarks else data.remarks
    dep.save()
    
    # Log action
    AdminActionLog.objects.create(
        admin_user_id=request.auth.id,
        admin_name=request.auth.email,
        action_type="PROCESS_RETURN",
        model_name="StudentDeposit",
        object_id=str(dep.id),
        details={"refund_amount": dep.amount_returned, "remarks": data.remarks}
    )
    
    return dep

@course_router.get("/attendance/", response=List[AttendanceSchema])
def list_attendance(request, course_id: uuid.UUID = None, date: date = None, student_id: uuid.UUID = None, scheduled_class_id: uuid.UUID = None):
    queryset = Attendance.objects.all()
    if course_id: queryset = queryset.filter(course_id=course_id)
    if date: queryset = queryset.filter(date=date)
    if student_id: queryset = queryset.filter(student_id=student_id)
    if scheduled_class_id: queryset = queryset.filter(scheduled_class_id=scheduled_class_id)
    return list(queryset)

@course_router.get("/attendance/scheduled-class/{class_id}/students/", response=List[EnrollmentSchema])
def list_scheduled_class_students(request, class_id: uuid.UUID):
    enrollments = CourseRegistrationHistory.objects.filter(
        scheduled_class_id=class_id, 
        status='enrolled'
    ).select_related('course', 'scheduled_class')
    return list(enrollments)

@course_router.get("/attendance/scheduled-class/{class_id}/suggested-dates/")
def get_suggested_dates(request, class_id: uuid.UUID):
    # This logic can be expanded to return actual schedule dates
    # For now, it returns unique dates from existing attendance
    dates = Attendance.objects.filter(scheduled_class_id=class_id).values_list('date', flat=True).distinct().order_by('-date')
    return list(dates)

@course_router.post("/attendance/bulk/")
def mark_bulk_attendance(request, data: BulkAttendanceCreateSchema):
    from datetime import date as dt_date
    today = dt_date.today()
    if data.date != today:
        raise HttpError(400, f"Mark only allowed for today ({today}), got {data.date}")

    if data.scheduled_class_id:
        try:
            sc = ScheduledClass.objects.get(id=data.scheduled_class_id)
        except ScheduledClass.DoesNotExist:
            raise HttpError(404, "Scheduled class not found")

        weekday_map = {'MON': 0, 'TUE': 1, 'WED': 2, 'THU': 3, 'FRI': 4, 'SAT': 5, 'SUN': 6}
        day_names = {v: k for k, v in weekday_map.items()}
        day_num = data.date.weekday()
        day_name = day_names.get(day_num)
        if day_name and sc.days and day_name not in sc.days:
            raise HttpError(400, f"Class is not scheduled on {data.date.strftime('%A')}")

        if sc.course_start_date and data.date < sc.course_start_date:
            raise HttpError(400, f"Date is before course start ({sc.course_start_date})")
        if sc.course_end_date and data.date > sc.course_end_date:
            raise HttpError(400, f"Date is after course end ({sc.course_end_date})")

    for record in data.records:
        Attendance.objects.update_or_create(
            course_id=data.course_id,
            scheduled_class_id=data.scheduled_class_id,
            student_id=record['student_id'],
            date=data.date,
            defaults={
                'status': record['status'],
                'remarks': record.get('remarks', '')
            }
        )
    return {"message": "Attendance marked successfully"}

@course_router.get("/attendance/stats/{student_id}/")
def get_student_attendance_stats(request, student_id: uuid.UUID):
    # 1. Overall stats
    all_records = Attendance.objects.filter(student_id=student_id)
    total_all = all_records.count()
    
    present_all = all_records.filter(status='PRESENT').count()
    late_all = all_records.filter(status='LATE').count()
    absent_all = all_records.filter(status='ABSENT').count()
    excused_all = all_records.filter(status='EXCUSED').count()
    
    # Present includes Late for percentage calculation
    effective_present = present_all + late_all
    overall_perc = round((effective_present / total_all * 100), 2) if total_all > 0 else 0
    
    # 2. Course-wise stats
    enrollments = CourseRegistrationHistory.objects.filter(student_id=student_id, status='enrolled').select_related('course')
    courses_stats = []
    for e in enrollments:
        course_records = all_records.filter(course=e.course)
        total_c = course_records.count()
        present_c = course_records.filter(status='PRESENT').count()
        late_c = course_records.filter(status='LATE').count()
        absent_c = course_records.filter(status='ABSENT').count()
        
        perc_c = round(((present_c + late_c) / total_c * 100), 2) if total_c > 0 else 0
        
        courses_stats.append({
            "course_id": e.course.id,
            "course_name": e.course.name,
            "total_classes": total_c,
            "present": present_c + late_c,
            "absent": absent_c,
            "percentage": perc_c
        })

    return {
        "overall": {
            "total_classes": total_all,
            "present": effective_present,
            "absent": absent_all,
            "late": late_all,
            "excused": excused_all,
            "percentage": overall_perc
        },
        "courses": courses_stats
    }

# ASSIGNMENT ENDPOINTS
@course_router.get("/assignments/", response=List[AssignmentSchema])
def list_assignments(request, course_id: uuid.UUID = None, instructor_id: uuid.UUID = None, scheduled_class_id: uuid.UUID = None, pending_only: bool = False):
    queryset = Assignment.objects.all()
    if course_id: queryset = queryset.filter(course_id=course_id)
    if instructor_id: queryset = queryset.filter(course__scheduled_classes__instructor_id=instructor_id)
    if scheduled_class_id: queryset = queryset.filter(scheduled_class_id=scheduled_class_id)
    
    if pending_only:
        queryset = queryset.filter(submissions__status__in=['SUBMITTED', 'LATE']).distinct()
        
    return list(queryset.distinct().order_by('-created_at'))

@course_router.get("/assignments/{assignment_id}/", response=AssignmentSchema)
def get_assignment(request, assignment_id: uuid.UUID):
    return get_object_or_404(Assignment, id=assignment_id)

@course_router.post("/assignments/", response=AssignmentSchema, auth=JWTAuthentication())
def create_assignment(request, data: AssignmentCreateSchema = Form(...), attachment: UploadedFile = File(None)):
    payload = data.dict()
    assignment = Assignment.objects.create(**payload)
    if attachment:
        assignment.attachment = attachment
        assignment.save()
    return assignment

# SUBMISSION ENDPOINTS
@course_router.get("/submissions/", response=List[SubmissionSchema], auth=JWTAuthentication())
def list_submissions(request, assignment_id: uuid.UUID = None, student_id: uuid.UUID = None):
    queryset = Submission.objects.all()
    if assignment_id: queryset = queryset.filter(assignment_id=assignment_id)
    if student_id: queryset = queryset.filter(student_id=student_id)
    return list(queryset)

@course_router.get("/submissions/ungraded-count/")
def get_ungraded_count(request, instructor_id: uuid.UUID):
    count = Submission.objects.filter(
        assignment__course__scheduled_classes__instructor_id=instructor_id,
        status__in=['SUBMITTED', 'LATE']
    ).distinct().count()
    return {"count": count}

@course_router.get("/assignments/{assignment_id}/stats/", response=AssignmentStatsSchema)
def get_assignment_stats(request, assignment_id: uuid.UUID):
    assignment = get_object_or_404(Assignment, id=assignment_id)
    submissions = Submission.objects.filter(assignment=assignment)
    
    total = submissions.count()
    pending = submissions.filter(status__in=['SUBMITTED', 'LATE']).count()
    graded = submissions.filter(status='GRADED').count()
    
    return {
        "total": total,
        "pending": pending,
        "graded": graded,
        "average_grade": submissions.filter(status='GRADED').aggregate(Avg('grade'))['grade__avg'] or 0
    }

@course_router.post("/submissions/", response=SubmissionSchema, auth=JWTAuthentication())
def create_submission(request, data: SubmissionCreateSchema = Form(...), submitted_file: UploadedFile = File(None)):
    submission_data = data.dict()
    if submitted_file:
        submission_data['submitted_file'] = submitted_file
    return Submission.objects.create(**submission_data)

@course_router.post("/submissions/{submission_id}/grade/", response=SubmissionSchema, auth=JWTAuthentication())
def grade_submission(request, submission_id: uuid.UUID, data: GradeSubmissionSchema):
    submission = get_object_or_404(Submission, id=submission_id)
    submission.grade = data.grade
    submission.feedback = data.feedback
    submission.graded_by_id = data.graded_by_id
    submission.status = 'GRADED'
    submission.graded_at = timezone.now()
    submission.save()
    return submission


# -----------------------------------------------------------
# ?? FEE MANAGEMENT ENDPOINTS
# -----------------------------------------------------------

from .models import FeeStructure, StudentFeeRecord, FeePaymentTransaction

class FeeStructureSchema(BaseModel):
    id: str
    course_id: str
    course_name: str
    scheduled_class_id: Optional[str] = None
    section_label: Optional[str] = None
    scope: str
    monthly_maintenance_fee: int
    one_time_fee: int
    payment_plan: str
    due_day_of_month: int
    require_deposit_paid: bool
    is_active: bool
    effective_from: str
    effective_to: Optional[str] = None
    remarks: Optional[str] = None

class FeeStructureCreateSchema(BaseModel):
    course_id: str
    scheduled_class_id: Optional[str] = None
    scope: str = 'course'
    monthly_maintenance_fee: int = 0
    one_time_fee: int = 0
    payment_plan: str = 'monthly'
    due_day_of_month: int = 10
    require_deposit_paid: bool = True
    effective_from: str
    effective_to: Optional[str] = None
    remarks: Optional[str] = None
    # ðŸ”¹ Multi-Tenancy
    organization_id: Optional[str] = None

class FeeStructureUpdateSchema(BaseModel):
    scheduled_class_id: Optional[str] = None
    scope: Optional[str] = None
    monthly_maintenance_fee: Optional[int] = None
    one_time_fee: Optional[int] = None
    payment_plan: Optional[str] = None
    due_day_of_month: Optional[int] = None
    require_deposit_paid: Optional[bool] = None
    is_active: Optional[bool] = None
    effective_from: Optional[str] = None
    effective_to: Optional[str] = None
    remarks: Optional[str] = None

class StudentFeeRecordSchema(BaseModel):
    id: str
    student_id: str
    student_name: Optional[str] = None
    student_email: Optional[str] = None
    course_id: str
    course_name: str
    scheduled_class_id: Optional[str] = None
    section_label: Optional[str] = None
    fee_structure_id: Optional[str] = None
    fee_type: str = 'monthly'
    fee_month: str
    amount_due: int
    amount_paid: int
    outstanding_balance: int
    original_amount: Optional[int] = None
    discount_amount: int = 0
    due_date: str
    payment_status: str
    paid_date: Optional[str] = None
    collected_by_name: Optional[str] = None
    remarks: Optional[str] = None
    receipt_number: Optional[str] = None

class StudentMyFeeRecordSchema(StudentFeeRecordSchema):
    transactions: List[dict] = []

class StudentMyFeesSummarySchema(BaseModel):
    total_due: int = 0
    total_paid: int = 0
    total_pending: int = 0
    total_overdue: int = 0
    total_waived: int = 0
    overdue_count: int = 0
    pending_count: int = 0
    paid_count: int = 0
    collection_rate: float = 0.0

class StudentMyFeesResponseSchema(BaseModel):
    summary: StudentMyFeesSummarySchema
    records: List[StudentMyFeeRecordSchema]

class FeePaymentSchema(BaseModel):
    amount: int
    payment_method: str = 'cash'
    transaction_reference: Optional[str] = None
    received_by_id: Optional[str] = None
    received_by_name: Optional[str] = None
    remarks: Optional[str] = None

class FullPaymentSchema(BaseModel):
    student_id: str
    course_id: str
    scheduled_class_id: Optional[str] = None
    payment_method: str = 'cash'
    transaction_reference: Optional[str] = None
    received_by_id: Optional[str] = None
    received_by_name: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[int] = None
    remarks: Optional[str] = None

class StudentLookupResponseSchema(BaseModel):
    id: str
    full_name: str
    email: str
    phone: Optional[str] = None
    student_id: Optional[str] = None
    cnic: Optional[str] = None
    enrollments: List[dict] = []
    pending_fees: List[StudentFeeRecordSchema] = []

class TodaySummarySchema(BaseModel):
    scheduled_class_id: str
    course_name: str
    section: Optional[str] = None
    branch_name: Optional[str] = None
    total_enrolled: int = 0
    paid_today: int = 0
    pending_count: int = 0
    total_collected: int = 0
    students: List[dict] = []

class ReceiptDataSchema(BaseModel):
    receipt_number: str
    student_name: str
    student_id: Optional[str] = None
    cnic: Optional[str] = None
    course_name: str
    section_label: Optional[str] = None
    fee_type: str
    fee_month: str
    amount_due: int
    amount_paid: int
    discount_amount: int = 0
    original_amount: Optional[int] = None
    payment_status: str
    paid_date: Optional[str] = None
    collected_by_name: Optional[str] = None
    transactions: List[dict] = []

class FeeAnalyticsSchema(BaseModel):
    total_collected: int
    total_outstanding: int
    total_overdue: int
    total_pending: int
    total_waived: int
    collection_rate: float
    overdue_count: int
    paid_count: int
    pending_count: int
    monthly_trend: list


# FEE STRUCTURE ENDPOINTS
@course_router.get("/fee-structures/", response=List[FeeStructureSchema], auth=JWTAuthentication())
def list_fee_structures(request, course_id: Optional[str] = None, is_active: Optional[bool] = None):
    qs = FeeStructure.objects.select_related('course').all()
    if course_id:
        qs = qs.filter(course_id=uuid.UUID(course_id))
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    result = []
    for fs in qs:
        section_label = None
        if fs.scheduled_class:
            section_label = f"Sec {fs.scheduled_class.section}"
        result.append({
            'id': str(fs.id),
            'course_id': str(fs.course_id),
            'course_name': fs.course.name,
            'scheduled_class_id': str(fs.scheduled_class_id) if fs.scheduled_class else None,
            'section_label': section_label,
            'scope': fs.scope,
            'monthly_maintenance_fee': fs.monthly_maintenance_fee,
            'one_time_fee': fs.one_time_fee,
            'payment_plan': fs.payment_plan,
            'due_day_of_month': fs.due_day_of_month,
            'require_deposit_paid': fs.require_deposit_paid,
            'is_active': fs.is_active,
            'effective_from': fs.effective_from.isoformat(),
            'effective_to': fs.effective_to.isoformat() if fs.effective_to else None,
            'remarks': fs.remarks,
        })
    return result

@course_router.post("/fee-structures/", response=FeeStructureSchema, auth=JWTAuthentication())
def create_fee_structure(request, data: FeeStructureCreateSchema):
    from courses.models import Course, ScheduledClass
    course = get_object_or_404(Course, id=uuid.UUID(data.course_id))
    sc = None
    if data.scheduled_class_id:
        sc = get_object_or_404(ScheduledClass, id=uuid.UUID(data.scheduled_class_id))
    # ðŸ”¹ Multi-Tenancy: Get org_id from request body or middleware context
    org_id = data.organization_id
    if not org_id:
        from common.organization import get_current_org_id
        org_id = get_current_org_id()
    
    fs = FeeStructure.objects.create(
        course=course,
        scheduled_class=sc,
        scope=data.scope,
        monthly_maintenance_fee=data.monthly_maintenance_fee,
        one_time_fee=data.one_time_fee,
        payment_plan=data.payment_plan,
        due_day_of_month=data.due_day_of_month,
        require_deposit_paid=data.require_deposit_paid,
        effective_from=data.effective_from,
        effective_to=data.effective_to,
        remarks=data.remarks,
        organization_id=org_id,
    )
    return {
        'id': str(fs.id), 'course_id': str(fs.course_id), 'course_name': fs.course.name,
        'scheduled_class_id': str(fs.scheduled_class_id) if fs.scheduled_class else None,
        'section_label': f"Sec {fs.scheduled_class.section}" if fs.scheduled_class else None,
        'scope': fs.scope, 'monthly_maintenance_fee': fs.monthly_maintenance_fee,
        'one_time_fee': fs.one_time_fee, 'payment_plan': fs.payment_plan,
        'due_day_of_month': fs.due_day_of_month, 'require_deposit_paid': fs.require_deposit_paid,
        'is_active': fs.is_active, 'effective_from': fs.effective_from.isoformat(),
        'effective_to': fs.effective_to.isoformat() if fs.effective_to else None,
        'remarks': fs.remarks,
    }

@course_router.put("/fee-structures/{fee_id}/", response=FeeStructureSchema, auth=JWTAuthentication())
def update_fee_structure(request, fee_id: str, data: FeeStructureUpdateSchema):
    fs = get_object_or_404(FeeStructure, id=uuid.UUID(fee_id))
    for field, value in data.dict(exclude_unset=True).items():
        if field == 'scheduled_class_id':
            if value:
                fs.scheduled_class = get_object_or_404(ScheduledClass, id=uuid.UUID(value))
            else:
                fs.scheduled_class = None
        else:
            setattr(fs, field, value)
    fs.save()
    return {
        'id': str(fs.id), 'course_id': str(fs.course_id), 'course_name': fs.course.name,
        'scheduled_class_id': str(fs.scheduled_class_id) if fs.scheduled_class else None,
        'section_label': f"Sec {fs.scheduled_class.section}" if fs.scheduled_class else None,
        'scope': fs.scope, 'monthly_maintenance_fee': fs.monthly_maintenance_fee,
        'one_time_fee': fs.one_time_fee, 'payment_plan': fs.payment_plan,
        'due_day_of_month': fs.due_day_of_month, 'require_deposit_paid': fs.require_deposit_paid,
        'is_active': fs.is_active, 'effective_from': fs.effective_from.isoformat(),
        'effective_to': fs.effective_to.isoformat() if fs.effective_to else None,
        'remarks': fs.remarks,
    }

@course_router.delete("/fee-structures/{fee_id}/", response=dict, auth=JWTAuthentication())
def delete_fee_structure(request, fee_id: str):
    fs = get_object_or_404(FeeStructure, id=uuid.UUID(fee_id))
    fs.is_active = False
    fs.save()
    return {"message": "Fee structure deactivated"}


# PUBLIC FEE INFO (no auth)
class CourseFeeInfoSchema(BaseModel):
    monthly_maintenance_fee: int = 0
    one_time_fee: int = 0
    payment_plan: str = 'monthly'
    deposit_amount: int = 3000
    bag_fee: int = 800
    id_card_fee: int = 200
    certificate_fee: int = 200


@course_router.get("/courses/{course_id}/fee-info/", response=CourseFeeInfoSchema)
def get_course_fee_info(request, course_id: str):
    fs = FeeStructure.objects.filter(
        course_id=uuid.UUID(course_id),
        is_active=True,
        scope='course'
    ).first()
    return {
        "monthly_maintenance_fee": fs.monthly_maintenance_fee if fs else 0,
        "one_time_fee": fs.one_time_fee if fs else 0,
        "payment_plan": fs.payment_plan if fs else 'monthly',
        "deposit_amount": 3000,
        "bag_fee": 800,
        "id_card_fee": 200,
        "certificate_fee": 200,
    }


# FEE RECORD ENDPOINTS
@course_router.get("/fee-records/", auth=JWTAuthentication())
def list_fee_records(request, student_id: Optional[str] = None, course_id: Optional[str] = None,
                     payment_status: Optional[str] = None, branch_id: Optional[str] = None,
                     fee_month: Optional[str] = None, search: Optional[str] = None,
                     page: int = 1, limit: int = 50):
    from django.db.models import Sum, Count, Q
    qs = StudentFeeRecord.objects.select_related('course').all()
    
    if student_id:
        qs = qs.filter(student_id=uuid.UUID(student_id))
    if course_id:
        qs = qs.filter(course_id=uuid.UUID(course_id))
    if payment_status:
        statuses = payment_status.split(',')
        qs = qs.filter(payment_status__in=statuses)
    if fee_month:
        qs = qs.filter(fee_month=fee_month)
    if search:
        qs = qs.filter(Q(remarks__icontains=search) | Q(collected_by_name__icontains=search))
    
    qs = qs.order_by('-fee_month', 'payment_status')
    total = qs.count()
    start = (page - 1) * limit
    end = start + limit
    records = list(qs[start:end])
    
    # Enrich with student names via auth-service
    student_ids = list(set(r.student_id for r in records))
    student_map = {}
    if student_ids:
        try:
            auth_svc = os.environ.get('AUTH_SERVICE_URL', 'http://auth-service:8001')
            ids_payload = {"user_ids": [str(sid) for sid in student_ids]}
            resp = requests.post(f"{auth_svc}/api/auth/users/by-ids/", json=ids_payload, timeout=5)
            if resp.status_code == 200:
                for u in resp.json():
                    student_map[u['id']] = u.get('full_name', u.get('email', ''))
        except:
            pass
    
    result = []
    for r in records:
        sclass = r.scheduled_class
        result.append({
            'id': str(r.id), 'student_id': str(r.student_id),
            'student_name': student_map.get(str(r.student_id), ''),
            'student_email': '', 'course_id': str(r.course_id),
            'course_name': r.course.name,
            'scheduled_class_id': str(r.scheduled_class_id) if r.scheduled_class else None,
            'section_label': f"Sec {sclass.section}" if sclass else None,
            'fee_structure_id': str(r.fee_structure_id) if r.fee_structure else None,
            'fee_type': r.fee_type, 'fee_month': r.fee_month.isoformat(),
            'amount_due': r.amount_due, 'amount_paid': r.amount_paid,
            'outstanding_balance': r.outstanding_balance,
            'original_amount': r.original_amount, 'discount_amount': r.discount_amount,
            'due_date': r.due_date.isoformat(), 'payment_status': r.payment_status,
            'paid_date': r.paid_date.isoformat() if r.paid_date else None,
            'collected_by_name': r.collected_by_name, 'remarks': r.remarks,
            'receipt_number': r.receipt_number,
        })
    
    return {"items": result, "total": total, "page": page, "pages": (total + limit - 1) // limit if limit > 0 else 1}

@course_router.get("/fee-records/my-fees/", response=StudentMyFeesResponseSchema, auth=JWTAuthentication())
def my_fees(request):
    """Returns the current student's fee records with summary stats."""
    curr_user = request.auth if hasattr(request, 'auth') and request.auth else None
    student_id = getattr(curr_user, 'id', None) or getattr(curr_user, 'pk', None)
    if not student_id:
        raise HttpError(401, "Authentication required")
    if isinstance(student_id, str):
        student_id = uuid.UUID(student_id)

    records = StudentFeeRecord.objects.filter(student_id=student_id).select_related('course', 'scheduled_class').order_by('-fee_month', 'course__name')

    total_due = 0
    total_paid = 0
    total_pending = 0
    total_overdue = 0
    total_waived = 0
    overdue_count = 0
    pending_count = 0
    paid_count = 0

    result = []
    for r in records:
        amount_due = r.amount_due
        amount_paid = r.amount_paid
        status = r.payment_status
        sclass = r.scheduled_class
        txns = list(r.transactions.all().values('amount', 'payment_method', 'transaction_reference', 'received_at', 'remarks'))
        for t in txns:
            if t.get('received_at'):
                t['received_at'] = t['received_at'].isoformat()

        total_due += amount_due
        total_paid += amount_paid

        if status == 'paid':
            paid_count += 1
        elif status == 'pending':
            total_pending += amount_due
            pending_count += 1
        elif status == 'overdue':
            total_overdue += amount_due
            overdue_count += 1
        elif status == 'waived':
            total_waived += amount_due

        result.append({
            'id': str(r.id), 'student_id': str(r.student_id),
            'student_name': '', 'student_email': '',
            'course_id': str(r.course_id), 'course_name': r.course.name,
            'scheduled_class_id': str(r.scheduled_class_id) if r.scheduled_class else None,
            'section_label': f"Sec {sclass.section}" if sclass else None,
            'fee_structure_id': str(r.fee_structure_id) if r.fee_structure else None,
            'fee_type': r.fee_type, 'fee_month': r.fee_month.isoformat(),
            'amount_due': amount_due, 'amount_paid': amount_paid,
            'outstanding_balance': r.outstanding_balance,
            'original_amount': r.original_amount, 'discount_amount': r.discount_amount,
            'due_date': r.due_date.isoformat() if r.due_date else '',
            'payment_status': status,
            'paid_date': r.paid_date.isoformat() if r.paid_date else None,
            'collected_by_name': r.collected_by_name, 'remarks': r.remarks,
            'receipt_number': r.receipt_number,
            'transactions': txns,
        })

    total_pending_owe = total_pending + total_overdue
    collection_rate = round((total_paid / (total_due - total_waived) * 100), 1) if (total_due - total_waived) > 0 else 0.0

    return {
        'summary': {
            'total_due': total_due,
            'total_paid': total_paid,
            'total_pending': total_pending_owe,
            'total_overdue': total_overdue,
            'total_waived': total_waived,
            'overdue_count': overdue_count,
            'pending_count': pending_count,
            'paid_count': paid_count,
            'collection_rate': collection_rate,
        },
        'records': result,
    }

@course_router.post("/fee-records/{record_id}/pay/", response=StudentFeeRecordSchema, auth=JWTAuthentication())
def record_fee_payment(request, record_id: str, data: FeePaymentSchema):
    record = get_object_or_404(StudentFeeRecord, id=uuid.UUID(record_id))
    if record.payment_status == 'paid':
        raise HttpError(400, "Fee already fully paid")
    
    # Create transaction
    txn = FeePaymentTransaction.objects.create(
        fee_record=record,
        student_id=record.student_id,
        amount=data.amount,
        payment_method=data.payment_method,
        transaction_reference=data.transaction_reference,
        received_by_id=uuid.UUID(data.received_by_id) if data.received_by_id else None,
        received_by_name=data.received_by_name,
        remarks=data.remarks,
    )
    
    # Update record
    record.amount_paid += data.amount
    if data.received_by_name:
        record.collected_by_name = data.received_by_name
    if data.received_by_id:
        record.collected_by_id = uuid.UUID(data.received_by_id)
    record.save()  # auto-updates status & sets paid_date if fully paid
    
    sclass = record.scheduled_class
    return {
        'id': str(record.id), 'student_id': str(record.student_id),
        'student_name': '', 'student_email': '', 'course_id': str(record.course_id),
        'course_name': record.course.name,
        'scheduled_class_id': str(record.scheduled_class_id) if record.scheduled_class else None,
        'section_label': f"Sec {sclass.section}" if sclass else None,
        'fee_structure_id': str(record.fee_structure_id) if record.fee_structure else None,
        'fee_type': record.fee_type, 'fee_month': record.fee_month.isoformat(),
        'amount_due': record.amount_due, 'amount_paid': record.amount_paid,
        'outstanding_balance': record.outstanding_balance,
        'original_amount': record.original_amount, 'discount_amount': record.discount_amount,
        'due_date': record.due_date.isoformat(), 'payment_status': record.payment_status,
        'paid_date': record.paid_date.isoformat() if record.paid_date else None,
        'collected_by_name': record.collected_by_name, 'remarks': record.remarks,
        'receipt_number': record.receipt_number,
    }

@course_router.post("/fee-records/{record_id}/waive/", response=StudentFeeRecordSchema, auth=JWTAuthentication())
def waive_fee_record(request, record_id: str):
    record = get_object_or_404(StudentFeeRecord, id=uuid.UUID(record_id))
    record.payment_status = 'waived'
    record.outstanding_balance = 0
    record.amount_paid = record.amount_due
    record.save()
    sclass = record.scheduled_class
    return {
        'id': str(record.id), 'student_id': str(record.student_id),
        'student_name': '', 'student_email': '', 'course_id': str(record.course_id),
        'course_name': record.course.name,
        'scheduled_class_id': str(record.scheduled_class_id) if record.scheduled_class else None,
        'section_label': f"Sec {sclass.section}" if sclass else None,
        'fee_structure_id': str(record.fee_structure_id) if record.fee_structure else None,
        'fee_type': record.fee_type, 'fee_month': record.fee_month.isoformat(),
        'amount_due': record.amount_due, 'amount_paid': record.amount_paid,
        'outstanding_balance': record.outstanding_balance,
        'original_amount': record.original_amount, 'discount_amount': record.discount_amount,
        'due_date': record.due_date.isoformat(), 'payment_status': record.payment_status,
        'paid_date': record.paid_date.isoformat() if record.paid_date else None,
        'collected_by_name': record.collected_by_name, 'remarks': record.remarks,
        'receipt_number': record.receipt_number,
    }


# FEE ANALYTICS ENDPOINT
@course_router.get("/fee-analytics/", response=FeeAnalyticsSchema, auth=JWTAuthentication())
def get_fee_analytics(request, branch_id: Optional[str] = None):
    from django.db.models import Sum, Count, Q
    from datetime import timedelta
    
    qs = StudentFeeRecord.objects.all()
    
    total_collected = qs.filter(payment_status='paid').aggregate(total=Sum('amount_paid'))['total'] or 0
    total_outstanding = qs.filter(payment_status__in=['pending', 'partial', 'overdue']).aggregate(total=Sum('outstanding_balance'))['total'] or 0
    total_overdue = qs.filter(payment_status='overdue').aggregate(total=Sum('outstanding_balance'))['total'] or 0
    total_pending = qs.filter(payment_status='pending').aggregate(total=Sum('outstanding_balance'))['total'] or 0
    total_waived = qs.filter(payment_status='waived').aggregate(total=Sum('amount_due'))['total'] or 0
    
    overdue_count = qs.filter(payment_status='overdue').count()
    paid_count = qs.filter(payment_status='paid').count()
    pending_count = qs.filter(payment_status='pending').count()
    
    total_all = total_collected + total_outstanding
    collection_rate = round((total_collected / total_all * 100), 1) if total_all > 0 else 0
    
    # Monthly trend (last 6 months)
    from datetime import datetime
    today = timezone.now().date()
    monthly_trend = []
    for i in range(5, -1, -1):
        month_start = today.replace(day=1)
        for _ in range(i):
            month_start = (month_start - timedelta(days=1)).replace(day=1)
        month_end = (month_start + timedelta(days=31)).replace(day=1) - timedelta(days=1)
        
        month_qs = qs.filter(fee_month__gte=month_start, fee_month__lte=month_end)
        collected = month_qs.filter(payment_status='paid').aggregate(total=Sum('amount_paid'))['total'] or 0
        outstanding = month_qs.filter(payment_status__in=['pending', 'partial', 'overdue']).aggregate(total=Sum('outstanding_balance'))['total'] or 0
        
        monthly_trend.append({
            'month': month_start.strftime('%b %Y'),
            'collected': collected,
            'outstanding': outstanding,
        })
    
    return {
        'total_collected': total_collected, 'total_outstanding': total_outstanding,
        'total_overdue': total_overdue, 'total_pending': total_pending,
        'total_waived': total_waived, 'collection_rate': collection_rate,
        'overdue_count': overdue_count, 'paid_count': paid_count,
        'pending_count': pending_count, 'monthly_trend': monthly_trend,
    }


# STUDENT LOOKUP FOR FEE COLLECTION
@course_router.get("/fee-records/lookup/", auth=JWTAuthentication())
def lookup_student_by_id(request, student_id: str):
    """Look up a student by their human-readable student_id (from ID card) and return their pending fees."""
    auth_svc = os.environ.get('AUTH_SERVICE_URL', 'http://auth-service:8001')
    resp = requests.get(f"{auth_svc}/api/auth/students/lookup/", params={"student_id": student_id}, timeout=5)
    if resp.status_code != 200:
        raise HttpError(404, "Student not found")
    data = resp.json()
    student_uuid = data.get('id')
    if not student_uuid:
        raise HttpError(404, "Student ID not found")
    
    # Get enrollments from course service
    enrollments = CourseRegistrationHistory.objects.filter(
        student_id=uuid.UUID(student_uuid),
        status='enrolled'
    ).select_related('course', 'scheduled_class', 'branch')
    
    enrollment_list = []
    for e in enrollments:
        enrollment_list.append({
            'enrollment_id': str(e.id),
            'course_id': str(e.course_id),
            'course_name': e.course.name,
            'course_duration': e.course.duration,
            'scheduled_class_id': str(e.scheduled_class_id) if e.scheduled_class else None,
            'section_label': f"Sec {e.scheduled_class.section}" if e.scheduled_class else None,
            'branch_name': e.branch.name if e.branch else None,
            'roll_number': e.roll_number,
            'status': e.status,
        })
    
    # Get pending/partial fee records
    fee_records = StudentFeeRecord.objects.filter(
        student_id=uuid.UUID(student_uuid)
    ).select_related('course', 'scheduled_class').order_by('-fee_month')
    
    pending_list = []
    for r in fee_records:
        sclass = r.scheduled_class
        pending_list.append({
            'id': str(r.id), 'student_id': str(r.student_id),
            'student_name': data.get('full_name', ''),
            'course_id': str(r.course_id), 'course_name': r.course.name,
            'scheduled_class_id': str(r.scheduled_class_id) if r.scheduled_class else None,
            'section_label': f"Sec {sclass.section}" if sclass else None,
            'fee_type': r.fee_type, 'fee_month': r.fee_month.isoformat(),
            'amount_due': r.amount_due, 'amount_paid': r.amount_paid,
            'outstanding_balance': r.outstanding_balance,
            'original_amount': r.original_amount, 'discount_amount': r.discount_amount,
            'due_date': r.due_date.isoformat(), 'payment_status': r.payment_status,
            'paid_date': r.paid_date.isoformat() if r.paid_date else None,
            'collected_by_name': r.collected_by_name, 'remarks': r.remarks,
            'receipt_number': r.receipt_number,
        })
    
    return {
        'id': student_uuid,
        'full_name': data.get('full_name', ''),
        'email': data.get('email', ''),
        'phone': data.get('phone', ''),
        'student_id': data.get('student_id', ''),
        'cnic': data.get('cnic', ''),
        'enrollments': enrollment_list,
        'pending_fees': pending_list,
    }


# FULL COURSE PAYMENT
@course_router.post("/fee-records/full-pay/", auth=JWTAuthentication())
def record_full_course_payment(request, data: FullPaymentSchema):
    """Record a full course payment (covers all months at once) with optional discount."""
    from datetime import timedelta
    
    student_uuid = uuid.UUID(data.student_id)
    course = get_object_or_404(Course, id=uuid.UUID(data.course_id))
    
    # Find active fee structure
    fs = FeeStructure.objects.filter(
        course=course,
        is_active=True
    ).first()
    if not fs:
        raise HttpError(400, "No active fee structure found for this course")
    
    monthly_fee = fs.monthly_maintenance_fee
    duration = course.duration or fs.course.duration
    total_amount = monthly_fee * duration
    
    # Apply discount if provided
    discount_amount = 0
    original_amount = total_amount
    if data.discount_type and data.discount_value and data.discount_value > 0:
        if data.discount_type == 'percent':
            discount_amount = int(total_amount * data.discount_value / 100)
        elif data.discount_type == 'flat':
            discount_amount = min(data.discount_value, total_amount)
        total_amount = total_amount - discount_amount
    
    if data.amount is not None and data.amount != total_amount:
        # If a specific amount is provided, use that but keep discount info
        total_amount = data.amount
    
    # Create a full fee record
    sc = None
    if data.scheduled_class_id:
        sc = get_object_or_404(ScheduledClass, id=uuid.UUID(data.scheduled_class_id))
    elif course.scheduled_classes.filter(active=True).first():
        sc = course.scheduled_classes.filter(active=True).first()
    
    fee_record = StudentFeeRecord.objects.create(
        student_id=student_uuid,
        course=course,
        scheduled_class=sc,
        fee_structure=fs,
        fee_type='full',
        fee_month=timezone.now().date().replace(day=1),
        amount_due=total_amount,
        amount_paid=0,
        outstanding_balance=total_amount,
        original_amount=original_amount if discount_amount > 0 else None,
        discount_amount=discount_amount,
        due_date=timezone.now().date() + timedelta(days=7),
        payment_status='pending',
        collected_by_id=uuid.UUID(data.received_by_id) if data.received_by_id else None,
        collected_by_name=data.received_by_name,
        remarks=data.remarks,
    )
    
    # Create payment transaction
    FeePaymentTransaction.objects.create(
        fee_record=fee_record,
        student_id=student_uuid,
        amount=total_amount,
        payment_method=data.payment_method,
        transaction_reference=data.transaction_reference,
        received_by_id=uuid.UUID(data.received_by_id) if data.received_by_id else None,
        received_by_name=data.received_by_name,
        remarks=data.remarks,
    )
    
    # Update record as paid
    fee_record.amount_paid = total_amount
    fee_record.save()
    
    return {
        'id': str(fee_record.id), 'student_id': str(fee_record.student_id),
        'student_name': '', 'student_email': '', 'course_id': str(fee_record.course_id),
        'course_name': fee_record.course.name,
        'scheduled_class_id': str(fee_record.scheduled_class_id) if fee_record.scheduled_class else None,
        'section_label': f"Sec {fee_record.scheduled_class.section}" if fee_record.scheduled_class else None,
        'fee_structure_id': str(fee_record.fee_structure_id) if fee_record.fee_structure else None,
        'fee_type': fee_record.fee_type, 'fee_month': fee_record.fee_month.isoformat(),
        'amount_due': fee_record.amount_due, 'amount_paid': fee_record.amount_paid,
        'outstanding_balance': fee_record.outstanding_balance,
        'original_amount': fee_record.original_amount, 'discount_amount': fee_record.discount_amount,
        'due_date': fee_record.due_date.isoformat(), 'payment_status': fee_record.payment_status,
        'paid_date': fee_record.paid_date.isoformat() if fee_record.paid_date else None,
        'collected_by_name': fee_record.collected_by_name, 'remarks': fee_record.remarks,
        'receipt_number': fee_record.receipt_number,
    }


# TODAY'S COLLECTION SUMMARY
@course_router.get("/fee-records/today-summary/", auth=JWTAuthentication())
def get_today_collection_summary(request, branch_id: Optional[str] = None):
    """Returns today's collection summary grouped by scheduled class."""
    today = timezone.now().date()
    
    # Get all active scheduled classes
    classes = ScheduledClass.objects.filter(active=True).select_related('course', 'branch').order_by('course__name', 'section')
    if branch_id:
        classes = classes.filter(branch_id=uuid.UUID(branch_id))
    
    result = []
    for sc in classes:
        total_enrolled = CourseRegistrationHistory.objects.filter(
            scheduled_class=sc, status='enrolled'
        ).count()
        
        if total_enrolled == 0:
            continue
        
        # Fee records for this class that were paid today
        paid_today_records = StudentFeeRecord.objects.filter(
            scheduled_class=sc,
            paid_date=today,
            payment_status='paid'
        )
        paid_today = paid_today_records.count()
        total_collected = paid_today_records.aggregate(Sum('amount_paid'))['amount_paid__sum'] or 0
        
        # Pending records
        pending_count = StudentFeeRecord.objects.filter(
            scheduled_class=sc,
            payment_status__in=['pending', 'partial', 'overdue'],
            fee_month__lte=today
        ).count()
        
        # Students who paid today
        student_ids = list(paid_today_records.values_list('student_id', flat=True).distinct())
        
        # Fetch student names
        student_list = []
        if student_ids:
            try:
                auth_svc = os.environ.get('AUTH_SERVICE_URL', 'http://auth-service:8001')
                resp = requests.post(f"{auth_svc}/api/auth/users/by-ids/", json={"user_ids": [str(s) for s in student_ids]}, timeout=5)
                if resp.status_code == 200:
                    for u in resp.json():
                        student_list.append({'id': u['id'], 'name': u.get('full_name', '')})
            except:
                pass
        
        result.append({
            'scheduled_class_id': str(sc.id),
            'course_name': sc.course.name,
            'section': sc.section,
            'branch_name': sc.branch.name if sc.branch else None,
            'total_enrolled': total_enrolled,
            'paid_today': paid_today,
            'pending_count': pending_count,
            'total_collected': total_collected,
            'students': student_list,
        })
    
    return result


# RECEIPT DATA
@course_router.get("/fee-records/{record_id}/receipt/", auth=JWTAuthentication())
def get_fee_receipt(request, record_id: str):
    """Returns full receipt data for a paid fee record."""
    record = get_object_or_404(StudentFeeRecord, id=uuid.UUID(record_id))
    
    if record.payment_status not in ('paid', 'waived'):
        raise HttpError(400, "Receipt is only available for paid or waived records")
    
    # Get student name from auth service
    student_name = ''
    student_id_str = ''
    cnic_str = ''
    try:
        auth_svc = os.environ.get('AUTH_SERVICE_URL', 'http://auth-service:8001')
        resp = requests.get(f"{auth_svc}/api/auth/users/{record.student_id}/", timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            student_name = data.get('full_name', '')
            student_id_str = data.get('student_id', '')
            cnic_str = data.get('cnic', '')
    except:
        pass
    
    txns = list(record.transactions.all().values(
        'amount', 'payment_method', 'transaction_reference', 'received_at', 'received_by_name', 'remarks'
    ))
    for t in txns:
        if t.get('received_at'):
            t['received_at'] = t['received_at'].isoformat()
    
    sclass = record.scheduled_class
    
    return {
        'receipt_number': record.receipt_number or '',
        'student_name': student_name,
        'student_id': student_id_str,
        'cnic': cnic_str,
        'course_name': record.course.name,
        'section_label': f"Sec {sclass.section}" if sclass else None,
        'fee_type': record.fee_type,
        'fee_month': record.fee_month.isoformat(),
        'amount_due': record.amount_due,
        'amount_paid': record.amount_paid,
        'discount_amount': record.discount_amount,
        'original_amount': record.original_amount,
        'payment_status': record.payment_status,
        'paid_date': record.paid_date.isoformat() if record.paid_date else None,
        'collected_by_name': record.collected_by_name,
        'transactions': txns,
    }


# â”€â”€â”€ Coordinator Endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _get_authenticated_user(request):
    try:
        auth = JWTAuthentication()
        result = auth.authenticate(request)
        if result is None:
            raise HttpError(401, 'Invalid or expired token')
        user, _ = result
        request.auth = user
        return user
    except HttpError:
        raise
    except Exception as e:
        raise HttpError(401, f'Authentication failed: {str(e)}')

AUTH_SERVICE_URL = os.getenv('AUTH_SERVICE_URL', 'http://auth-service:8001')

def _fetch_user_name(user_id):
    try:
        resp = requests.get(f'{AUTH_SERVICE_URL}/api/auth/users/{user_id}/', timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            return data.get('full_name', ''), data.get('email', '')
    except Exception:
        pass
    return '', ''

@course_router.get("/coordinator/attendance/", response=List[CoordinatorAttendanceResponseSchema])
def list_coordinator_attendance(request, date: Optional[str] = None, course_id: Optional[str] = None, status: Optional[str] = None, search: Optional[str] = None):
    _get_authenticated_user(request)
    qs = Attendance.objects.all().select_related('course', 'scheduled_class')
    if date:
        qs = qs.filter(date=date)
    if course_id:
        qs = qs.filter(course_id=course_id)
    if status:
        qs = qs.filter(status=status.upper())
    result = []
    for a in qs.order_by('-date', 'course__name')[:200]:
        sname, semail = _fetch_user_name(str(a.student_id))
        cls_label = ''
        if a.scheduled_class:
            day_map = {"MON": "Mon", "TUE": "Tue", "WED": "Wed", "THU": "Thu", "FRI": "Fri", "SAT": "Sat", "SUN": "Sun"}
            days_str = " ".join(day_map.get(d, d) for d in (a.scheduled_class.days or []))
            cls_label = f"Sec {a.scheduled_class.section} {days_str}".strip()
        logs = list(a.contact_logs.all().values('id', 'method', 'contacted_at', 'remarks', 'resolved', 'contacted_by_name'))
        for log in logs:
            log['id'] = str(log['id'])
            if log['contacted_at']:
                log['contacted_at'] = log['contacted_at'].isoformat()
        result.append({
            'id': str(a.id), 'student_id': str(a.student_id),
            'student_name': sname, 'student_email': semail,
            'course_id': str(a.course_id), 'course_name': a.course.name,
            'scheduled_class_id': str(a.scheduled_class_id) if a.scheduled_class else None,
            'scheduled_class_label': cls_label,
            'date': a.date.isoformat(), 'status': a.status, 'remarks': a.remarks,
            'contacted': logs and len(logs) > 0, 'contact_logs': logs,
        })
    return result

@course_router.get("/coordinator/attendance/stats/", response=CoordinatorAttendanceStatsSchema)
def coordinator_attendance_stats(request, date: Optional[str] = None):
    _get_authenticated_user(request)
    today = date or timezone.now().date().isoformat()
    qs = Attendance.objects.filter(date=today)
    total = qs.count()
    present = qs.filter(status='PRESENT').count()
    absent = qs.filter(status='ABSENT').count()
    late = qs.filter(status='LATE').count()
    excused = qs.filter(status='EXCUSED').count()
    contacted = qs.filter(contact_logs__isnull=False).distinct().count()
    contact_rate = round((contacted / (absent + late) * 100), 1) if (absent + late) > 0 else 0.0
    return {
        'total_today': total, 'present': present, 'absent': absent,
        'late': late, 'excused': excused, 'contact_rate': contact_rate,
    }

@course_router.get("/coordinator/dashboard/stats/", response=CoordinatorDashboardStatsSchema)
def coordinator_dashboard_stats(request):
    _get_authenticated_user(request)
    from django.db.models import Count
    today = timezone.now().date().isoformat()
    att_qs = Attendance.objects.filter(date=today)
    total_att = att_qs.count()
    present = att_qs.filter(status='PRESENT').count()
    absent = att_qs.filter(status='ABSENT').count()
    late = att_qs.filter(status='LATE').count()
    excused = att_qs.filter(status='EXCUSED').count()
    contacted = att_qs.filter(contact_logs__isnull=False).distinct().count()
    contact_rate = round((contacted / (absent + late) * 100), 1) if (absent + late) > 0 else 0.0
    return {
        'total_students': 0,
        'total_active_enrollments': ScheduledClass.objects.filter(active=True).count(),
        'total_courses': Course.objects.filter(is_deleted=False).count(),
        'total_teachers': len(set(ScheduledClass.objects.filter(active=True).values_list('instructor_id', flat=True))),
        'attendance_today': {
            'total_today': total_att, 'present': present, 'absent': absent,
            'late': late, 'excused': excused, 'contact_rate': contact_rate,
        },
    }

@course_router.post("/coordinator/attendance/contact/")
def create_attendance_contact(request, payload: CoordinatorAttendanceContactSchema):
    _get_authenticated_user(request)
    attendance = get_object_or_404(Attendance, id=payload.attendance_id)
    curr_user = request.auth if hasattr(request, 'auth') and request.auth else None
    curr_id = getattr(curr_user, 'id', None) or getattr(curr_user, 'pk', None) or uuid.uuid4()
    curr_name = getattr(curr_user, 'full_name', '') or getattr(curr_user, 'email', '')
    log = AttendanceContactLog.objects.create(
        attendance=attendance,
        contacted_by_id=curr_id if isinstance(curr_id, uuid.UUID) else uuid.UUID(str(curr_id)),
        contacted_by_name=curr_name,
        method=payload.method,
        remarks=payload.remarks,
        resolved=payload.resolved,
    )
    return {'success': True, 'id': str(log.id)}

# â”€â”€â”€ Coordinator Section Summary & Student Warning Endpoints â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _fetch_student_info(student_ids):
    """Batch-fetch student names/phones from auth-service."""
    if not student_ids:
        return {}
    import os, requests
    try:
        AUTH_URL = os.environ.get("AUTH_SERVICE_URL", "http://auth-service:8001")
        resp = requests.post(f"{AUTH_URL}/api/auth/users/bulk/", json={"ids": [str(sid) for sid in student_ids]}, timeout=5)
        if resp.status_code == 200:
            return {str(u['id']): u for u in resp.json()}
    except Exception:
        pass
    return {}

@course_router.get("/coordinator/sections-summary/", response=List[SectionSummarySchema], auth=JWTAuthentication())
def coordinator_sections_summary(request, status: Optional[str] = None, today: Optional[bool] = False):
    """Returns all active sections with course info, branch, room, teacher, total students, and attendance rate.
    
    Query params:
        status (str, optional): Filter by section status â€” 'active', 'completed', 'upcoming'
        today (bool, optional): If true, only return sections that have class today
    """
    sections = ScheduledClass.objects.filter(active=True).select_related('course', 'branch', 'room').order_by('course__name', 'section')
    if status and status.lower() in ('active', 'completed', 'upcoming'):
        sections = sections.filter(status=status.lower())
    if today:
        weekday_map = {0: 'MON', 1: 'TUE', 2: 'WED', 3: 'THU', 4: 'FRI', 5: 'SAT', 6: 'SUN'}
        today_abbr = weekday_map[date.today().weekday()]
        sections = [s for s in sections if today_abbr in (s.days or [])]
    else:
        sections = list(sections)
    results = []
    for sc in sections:
        total_students = CourseRegistrationHistory.objects.filter(scheduled_class=sc, status='enrolled').count()
        total_classes = Attendance.objects.filter(scheduled_class=sc).values('date').distinct().count()
        present_count = Attendance.objects.filter(scheduled_class=sc, status__in=['PRESENT', 'LATE']).count()
        total_attendance_records = Attendance.objects.filter(scheduled_class=sc).count()
        attendance_rate = round((present_count / total_attendance_records * 100), 1) if total_attendance_records > 0 else 0.0
        results.append(SectionSummarySchema(
            id=sc.id,
            course_id=sc.course_id,
            course_name=sc.course.name,
            course_code=sc.course.course_code,
            section=sc.section,
            branch_name=sc.branch.name if sc.branch else None,
            room_name=sc.room.name if sc.room else None,
            teacher_name=sc.teacher_name,
            days=sc.days,
            start_time=sc.start_time.strftime('%I:%M %p').lstrip('0') if sc.start_time else None,
            end_time=sc.end_time.strftime('%I:%M %p').lstrip('0') if sc.end_time else None,
            total_students=total_students,
            total_applications=sc.total_applications,
            strength_status=sc.strength_status,
            status=sc.status,
            attendance_rate=attendance_rate,
            total_classes=total_classes,
        ))
    return results

@course_router.get("/coordinator/sections/{section_id}/students/", response=List[SectionStudentSchema], auth=JWTAuthentication())
def coordinator_section_students(request, section_id: uuid.UUID):
    """Returns all enrolled students in a section with attendance frequency and warning count."""
    sc = get_object_or_404(ScheduledClass, id=section_id)
    enrollments = CourseRegistrationHistory.objects.filter(scheduled_class=sc, status='enrolled')
    student_ids = [e.student_id for e in enrollments]
    student_map = _fetch_student_info(student_ids)

    results = []
    for e in enrollments:
        sid = e.student_id
        student_data = student_map.get(str(sid), {})
        total_classes = Attendance.objects.filter(scheduled_class=sc, student_id=sid).count()
        present_count = Attendance.objects.filter(scheduled_class=sc, student_id=sid, status='PRESENT').count()
        absent_count = Attendance.objects.filter(scheduled_class=sc, student_id=sid, status='ABSENT').count()
        late_count = Attendance.objects.filter(scheduled_class=sc, student_id=sid, status='LATE').count()
        excused_count = Attendance.objects.filter(scheduled_class=sc, student_id=sid, status='EXCUSED').count()
        att_perc = round(((present_count + late_count) / total_classes * 100), 1) if total_classes > 0 else 0.0
        warning_count = StudentWarning.objects.filter(student_id=sid, scheduled_class=sc, resolved=False).count()
        last_warning = StudentWarning.objects.filter(student_id=sid, scheduled_class=sc).order_by('-issued_at').first()

        results.append(SectionStudentSchema(
            student_id=sid,
            full_name=student_data.get('full_name', ''),
            email=student_data.get('email', ''),
            phone=student_data.get('phone', ''),
            roll_number=e.roll_number,
            gender=student_data.get('gender', ''),
            whatsapp_number=student_data.get('whatsapp_number', ''),
            total_classes=total_classes,
            present_count=present_count,
            absent_count=absent_count,
            late_count=late_count,
            excused_count=excused_count,
            attendance_percentage=att_perc,
            warning_count=warning_count,
            last_warning_date=last_warning.issued_at.isoformat() if last_warning else None,
        ))
    return results

@course_router.get("/coordinator/sections/{section_id}/at-risk-students/", response=List[SectionStudentSchema], auth=JWTAuthentication())
def coordinator_at_risk_students(request, section_id: uuid.UUID, threshold: float = 75.0):
    """Returns students in a section with attendance below the threshold (default 75%)."""
    sc = get_object_or_404(ScheduledClass, id=section_id)
    enrollments = CourseRegistrationHistory.objects.filter(scheduled_class=sc, status='enrolled')
    student_ids = [e.student_id for e in enrollments]
    student_map = _fetch_student_info(student_ids)

    results = []
    for e in enrollments:
        sid = e.student_id
        student_data = student_map.get(str(sid), {})
        total_classes = Attendance.objects.filter(scheduled_class=sc, student_id=sid).count()
        if total_classes == 0:
            continue
        present_count = Attendance.objects.filter(scheduled_class=sc, student_id=sid, status='PRESENT').count()
        absent_count = Attendance.objects.filter(scheduled_class=sc, student_id=sid, status='ABSENT').count()
        late_count = Attendance.objects.filter(scheduled_class=sc, student_id=sid, status='LATE').count()
        excused_count = Attendance.objects.filter(scheduled_class=sc, student_id=sid, status='EXCUSED').count()
        att_perc = round(((present_count + late_count) / total_classes * 100), 1)

        if att_perc >= threshold:
            continue

        warning_count = StudentWarning.objects.filter(student_id=sid, scheduled_class=sc, resolved=False).count()
        last_warning = StudentWarning.objects.filter(student_id=sid, scheduled_class=sc).order_by('-issued_at').first()

        results.append(SectionStudentSchema(
            student_id=sid,
            full_name=student_data.get('full_name', ''),
            email=student_data.get('email', ''),
            phone=student_data.get('phone', ''),
            roll_number=e.roll_number,
            gender=student_data.get('gender', ''),
            whatsapp_number=student_data.get('whatsapp_number', ''),
            total_classes=total_classes,
            present_count=present_count,
            absent_count=absent_count,
            late_count=late_count,
            excused_count=excused_count,
            attendance_percentage=att_perc,
            warning_count=warning_count,
            last_warning_date=last_warning.issued_at.isoformat() if last_warning else None,
        ))
    return results

@course_router.get("/coordinator/warnings/", response=List[StudentWarningSchema], auth=JWTAuthentication())
def coordinator_list_warnings(request, student_id: Optional[str] = None, section_id: Optional[str] = None, resolved: Optional[bool] = None):
    """List student warnings, optionally filtered by student, section, or resolved status."""
    qs = StudentWarning.objects.all().order_by('-issued_at')
    if student_id:
        qs = qs.filter(student_id=uuid.UUID(student_id))
    if section_id:
        qs = qs.filter(scheduled_class_id=uuid.UUID(section_id))
    if resolved is not None:
        qs = qs.filter(resolved=resolved)

    warnings = list(qs[:200])
    student_ids = list(set(str(w.student_id) for w in warnings))
    student_map = _fetch_student_info(student_ids)

    results = []
    for w in warnings:
        sdata = student_map.get(str(w.student_id), {})
        results.append(StudentWarningSchema(
            id=w.id,
            student_id=w.student_id,
            student_name=sdata.get('full_name', ''),
            scheduled_class_id=str(w.scheduled_class_id) if w.scheduled_class else None,
            warning_type=w.warning_type,
            description=w.description,
            issued_by_id=w.issued_by_id,
            issued_by_name=w.issued_by_name,
            issued_at=w.issued_at,
            resolved=w.resolved,
            resolved_at=w.resolved_at,
            resolved_by_id=str(w.resolved_by_id) if w.resolved_by_id else None,
            resolution_notes=w.resolution_notes,
        ))
    return results

@course_router.post("/coordinator/warnings/", response=StudentWarningSchema, auth=JWTAuthentication())
def coordinator_create_warning(request, data: StudentWarningCreateSchema):
    """Issue a warning to a student."""
    curr_user = request.auth if hasattr(request, 'auth') and request.auth else None
    curr_id = getattr(curr_user, 'id', None) or getattr(curr_user, 'pk', None) or uuid.uuid4()
    curr_name = getattr(curr_user, 'full_name', '') or getattr(curr_user, 'email', '')

    warning = StudentWarning.objects.create(
        student_id=data.student_id,
        scheduled_class_id=data.scheduled_class_id,
        warning_type=data.warning_type,
        description=data.description,
        issued_by_id=curr_id if isinstance(curr_id, uuid.UUID) else uuid.UUID(str(curr_id)),
        issued_by_name=data.issued_by_name or curr_name,
    )

    student_map = _fetch_student_info([data.student_id])
    sdata = student_map.get(str(data.student_id), {})

    return StudentWarningSchema(
        id=warning.id,
        student_id=warning.student_id,
        student_name=sdata.get('full_name', ''),
        scheduled_class_id=str(warning.scheduled_class_id) if warning.scheduled_class else None,
        warning_type=warning.warning_type,
        description=warning.description,
        issued_by_id=warning.issued_by_id,
        issued_by_name=warning.issued_by_name,
        issued_at=warning.issued_at,
        resolved=warning.resolved,
    )

@course_router.patch("/coordinator/warnings/{warning_id}/resolve/", response=StudentWarningSchema, auth=JWTAuthentication())
def coordinator_resolve_warning(request, warning_id: uuid.UUID, data: StudentWarningResolveSchema):
    """Mark a warning as resolved."""
    warning = get_object_or_404(StudentWarning, id=warning_id)
    curr_user = request.auth if hasattr(request, 'auth') and request.auth else None
    curr_id = getattr(curr_user, 'id', None) or getattr(curr_user, 'pk', None)

    warning.resolved = True
    warning.resolved_at = timezone.now()
    warning.resolved_by_id = curr_id if isinstance(curr_id, uuid.UUID) else uuid.UUID(str(curr_id)) if curr_id else None
    warning.resolution_notes = data.resolution_notes
    warning.save()

    student_map = _fetch_student_info([warning.student_id])
    sdata = student_map.get(str(warning.student_id), {})

    return StudentWarningSchema(
        id=warning.id,
        student_id=warning.student_id,
        student_name=sdata.get('full_name', ''),
        scheduled_class_id=str(warning.scheduled_class_id) if warning.scheduled_class else None,
        warning_type=warning.warning_type,
        description=warning.description,
        issued_by_id=warning.issued_by_id,
        issued_by_name=warning.issued_by_name,
        issued_at=warning.issued_at,
        resolved=warning.resolved,
        resolved_at=warning.resolved_at,
        resolved_by_id=str(warning.resolved_by_id) if warning.resolved_by_id else None,
        resolution_notes=warning.resolution_notes,
    )

@course_router.get("/coordinator/teachers/course-wise-attendance/", response=TeacherCourseAttendanceResponse, auth=JWTAuthentication())
def coordinator_teacher_course_attendance(request, date_param: Optional[str] = None, teacher_id: Optional[str] = None, course_id: Optional[str] = None, section: Optional[str] = None):
    """Returns course-wise attendance coverage for teachers on a given date.
    
    For each teacher with scheduled classes matching the date, shows which classes
    had attendance marked by the teacher and which were missed.
    """
    target_date = date.today()
    if date_param:
        try:
            target_date = date.fromisoformat(date_param)
        except ValueError:
            raise HttpError(400, "Invalid date format. Use YYYY-MM-DD.")

    weekday_map = {0: 'MON', 1: 'TUE', 2: 'WED', 3: 'THU', 4: 'FRI', 5: 'SAT', 6: 'SUN'}
    today_abbr = weekday_map[target_date.weekday()]

    sections = ScheduledClass.objects.filter(active=True).select_related('course', 'room', 'branch').order_by('course__name', 'section')
    if teacher_id:
        sections = sections.filter(instructor_id=teacher_id)
    if course_id:
        sections = sections.filter(course_id=course_id)
    if section:
        sections = sections.filter(section__icontains=section)

    sections = [s for s in sections if today_abbr in (s.days or [])]

    if not sections:
        return TeacherCourseAttendanceResponse(results=[], total_teachers=0, total_classes_scheduled=0, total_classes_marked=0)

    class_ids = [s.id for s in sections]

    attendance_records = Attendance.objects.filter(
        scheduled_class_id__in=class_ids,
        date=target_date
    )
    att_by_class: Dict[uuid.UUID, List[Attendance]] = {}
    for a in attendance_records:
        att_by_class.setdefault(a.scheduled_class_id, []).append(a)

    enrollments = CourseRegistrationHistory.objects.filter(
        scheduled_class_id__in=class_ids,
        status='enrolled'
    )
    enrollment_count_by_class: Dict[uuid.UUID, int] = {}
    for e in enrollments:
        enrollment_count_by_class[e.scheduled_class_id] = enrollment_count_by_class.get(e.scheduled_class_id, 0) + 1

    teacher_classes: Dict[uuid.UUID, dict] = {}
    for sc in sections:
        tid = sc.instructor_id
        if not tid:
            continue
        if tid not in teacher_classes:
            teacher_classes[tid] = {
                'teacher_name': sc.teacher_name or 'Unknown',
                'classes': [],
            }
        recs = att_by_class.get(sc.id, [])
        marked = len(recs) > 0
        breakdown = {'PRESENT': 0, 'ABSENT': 0, 'LATE': 0, 'EXCUSED': 0}
        for r in recs:
            if r.status in breakdown:
                breakdown[r.status] += 1

        total_students = enrollment_count_by_class.get(sc.id, 0)

        teacher_classes[tid]['classes'].append(TeacherAttendanceClassSchema(
            scheduled_class_id=sc.id,
            course_id=sc.course_id,
            course_name=sc.course.name if sc.course else '',
            section=sc.section,
            days=sc.days or [],
            start_time=sc.start_time.strftime('%I:%M %p').lstrip('0') if sc.start_time else None,
            end_time=sc.end_time.strftime('%I:%M %p').lstrip('0') if sc.end_time else None,
            room_name=sc.room.name if sc.room else None,
            total_students=total_students,
            attendance_marked=marked,
            marked_students=len(recs),
            attendance_status_breakdown=breakdown,
        ))

    results = []
    total_classes_scheduled = 0
    total_classes_marked = 0
    for tid, data in teacher_classes.items():
        classes = data['classes']
        total = len(classes)
        marked_count = sum(1 for c in classes if c.attendance_marked)
        missed = total - marked_count
        total_classes_scheduled += total
        total_classes_marked += marked_count
        results.append(TeacherCourseAttendanceSchema(
            teacher_name=data['teacher_name'],
            teacher_id=tid,
            total_scheduled=total,
            attendance_marked_count=marked_count,
            attendance_missed_count=missed,
            classes=classes,
        ))

    return TeacherCourseAttendanceResponse(
        results=results,
        total_teachers=len(results),
        total_classes_scheduled=total_classes_scheduled,
        total_classes_marked=total_classes_marked,
    )

# -----------------------------------------------------------
# ENROLLMENT CHECK ENDPOINT (for content access control)
# -----------------------------------------------------------

@course_router.get("/enrollment/check/")
def check_enrollment_status(request, student_id: str, course_id: str):
    """
    Check if a student is enrolled in a course.
    Used by content-service to verify access before serving content.
    """
    from .models import CourseRegistrationHistory

    try:
        student_uuid = uuid.UUID(student_id)
        course_uuid = uuid.UUID(course_id)
    except ValueError:
        return {"enrolled": False, "status": "invalid_ids"}

    enrollment = CourseRegistrationHistory.objects.filter(
        student_id=student_uuid,
        course_id=course_uuid,
        status='enrolled'
    ).first()

    if enrollment:
        return {
            "enrolled": True,
            "status": enrollment.status,
            "enrollment_id": str(enrollment.id),
            "scheduled_class_id": str(enrollment.scheduled_class_id) if enrollment.scheduled_class_id else None,
            "roll_number": enrollment.roll_number,
        }

    # Check if they completed or dropped
    past = CourseRegistrationHistory.objects.filter(
        student_id=student_uuid,
        course_id=course_uuid,
    ).exclude(status='enrolled').order_by('-registration_date').first()

    if past:
        return {"enrolled": False, "status": past.status}

    return {"enrolled": False, "status": "not_found"}

# -----------------------------------------------------------
# COURSE PROGRESS ENDPOINT
# -----------------------------------------------------------

@course_router.get("/courses/{course_id}/progress/")
def get_course_progress(request, course_id: uuid.UUID, student_id: uuid.UUID = None):
    """
    Calculate and return course completion progress for a student.
    Shows module-level and lesson-level completion.
    """
    
    # If no student_id provided, try to get from request
    if not student_id:
        student_id = getattr(request, 'user_id', None) or request.headers.get('X-User-Id')
        if student_id:
            student_id = uuid.UUID(student_id)
    
    if not student_id:
        raise HttpError(400, "student_id is required")
    
    course = get_object_or_404(Course, id=course_id)
    
    # Get curriculum from content-service
    try:
        curriculum = get_course_curriculum(course_id)
    except Exception as e:
        # Fallback: count from local ContentCompletion model
        total_items = ContentCompletion.objects.filter(
            course_id=course_id
        ).values('content_id').distinct().count()
        completed_items = ContentCompletion.objects.filter(
            course_id=course_id,
            student_id=student_id
        ).values('content_id').distinct().count()
        
        completion_pct = round((completed_items / total_items * 100), 2) if total_items > 0 else 0
        
        return {
            "course_id": str(course_id),
            "student_id": str(student_id),
            "course_name": course.name,
            "total_modules": 0,
            "completed_modules": 0,
            "total_lessons": 0,
            "completed_lessons": 0,
            "total_content_items": total_items,
            "completed_content_items": completed_items,
            "completion_percentage": completion_pct,
            "modules": [],
        }
    
    # Calculate progress for each module/lesson
    total_modules = len(curriculum)
    completed_modules = 0
    total_lessons = 0
    completed_lessons = 0
    total_content_items = 0
    completed_content_items = 0
    
    modules_progress = []
    
    for module in curriculum:
        module_lessons = module.get('lessons', [])
        module_total_lessons = len(module_lessons)
        module_completed_lessons = 0
        module_total_content = 0
        module_completed_content = 0
        
        lessons_progress = []
        
        for lesson in module_lessons:
            lesson_contents = lesson.get('contents', [])
            lesson_total = len(lesson_contents)
            lesson_completed = 1 if lesson.get('is_completed') else 0
            
            total_lessons += 1
            if lesson.get('is_completed'):
                completed_lessons += 1
            
            total_content_items += lesson_total
            
            # Check content completions for this lesson
            lesson_completed_count = ContentCompletion.objects.filter(
                student_id=student_id,
                content_id__in=[str(c.get('id', '')) for c in lesson_contents if c.get('id')]
            ).count() if lesson_contents else 0
            
            completed_content_items += lesson_completed_count
            module_total_content += lesson_total
            module_completed_content += lesson_completed_count
            module_completed_lessons += lesson_completed
            
            lessons_progress.append({
                "lesson_id": str(lesson.get('id', '')),
                "title": lesson.get('title', ''),
                "is_completed": lesson.get('is_completed', False),
                "total_content": lesson_total,
                "completed_content": lesson_completed_count,
            })
        
        module_completion = round(
            (module_completed_content / module_total_content * 100), 2
        ) if module_total_content > 0 else (100.0 if module_total_lessons == 0 else 0.0)
        
        if module_total_content > 0 and module_completed_content == module_total_content:
            completed_modules += 1
        
        modules_progress.append({
            "module_id": str(module.get('id', '')),
            "title": module.get('title', ''),
            "completion_percentage": module_completion,
            "total_lessons": module_total_lessons,
            "completed_lessons": module_completed_lessons,
            "lessons": lessons_progress,
        })
    
    overall_completion = round(
        (completed_content_items / total_content_items * 100), 2
    ) if total_content_items > 0 else 0.0
    
    return {
        "course_id": str(course_id),
        "student_id": str(student_id),
        "course_name": course.name,
        "total_modules": total_modules,
        "completed_modules": completed_modules,
        "total_lessons": total_lessons,
        "completed_lessons": completed_lessons,
        "total_content_items": total_content_items,
        "completed_content_items": completed_content_items,
        "completion_percentage": overall_completion,
        "modules": modules_progress,
    }

# -----------------------------------------------------------
# REPORT EXPORT ENDPOINTS (CSV)
# -----------------------------------------------------------

import csv
import io
from django.http import StreamingHttpResponse


class Echo:
    """Pseudo-buffer that implements just the write method for streaming CSV."""
    def write(self, value):
        return value


@course_router.get("/courses/{course_id}/export/students/")
def export_students_csv(request, course_id: uuid.UUID, format: str = "csv"):
    """Export enrolled students list for a course as CSV."""
    from django.http import HttpResponse
    
    enrollments = CourseRegistrationHistory.objects.filter(
        course_id=course_id
    ).select_related('course', 'scheduled_class', 'branch').order_by('roll_number')
    
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="students_{course_id}.csv"'
    
    writer = csv.writer(response)
    writer.writerow([
        'Roll Number', 'Student ID', 'Course', 'Section', 'Branch',
        'Status', 'Registration Date'
    ])
    
    for e in enrollments:
        writer.writerow([
            e.roll_number or '',
            str(e.student_id),
            e.course.name if e.course else '',
            e.scheduled_class.section if e.scheduled_class else '',
            e.branch.name if e.branch else '',
            e.status,
            e.registration_date.strftime('%Y-%m-%d') if e.registration_date else '',
        ])
    
    return response


@course_router.get("/courses/{course_id}/export/attendance/")
def export_attendance_csv(request, course_id: uuid.UUID, 
                          month: int = None, year: int = None,
                          scheduled_class_id: uuid.UUID = None):
    """Export attendance report for a course as CSV."""
    from django.http import HttpResponse
    from django.utils import timezone
    
    queryset = Attendance.objects.filter(course_id=course_id)
    
    if scheduled_class_id:
        queryset = queryset.filter(scheduled_class_id=scheduled_class_id)
    
    if month and year:
        queryset = queryset.filter(date__year=year, date__month=month)
    else:
        # Default: current month
        now = timezone.now()
        queryset = queryset.filter(date__year=now.year, date__month=now.month)
    
    queryset = queryset.order_by('date', 'student_id')
    
    response = HttpResponse(content_type='text/csv')
    filename = f'attendance_{course_id}_{year or timezone.now().year}_{month or timezone.now().month}.csv'
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    
    writer = csv.writer(response)
    writer.writerow(['Student ID', 'Date', 'Status', 'Remarks'])
    
    for a in queryset:
        writer.writerow([
            str(a.student_id),
            a.date.strftime('%Y-%m-%d'),
            a.status,
            a.remarks or '',
        ])
    
    return response


@course_router.get("/courses/{course_id}/export/grades/")
def export_grades_csv(request, course_id: uuid.UUID, scheduled_class_id: uuid.UUID = None):
    """Export grades report for a course as CSV."""
    from django.http import HttpResponse
    
    queryset = Submission.objects.filter(
        assignment__course_id=course_id
    ).select_related('assignment').order_by('student_id', 'assignment__title')
    
    if scheduled_class_id:
        queryset = queryset.filter(assignment__scheduled_class_id=scheduled_class_id)
    
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="grades_{course_id}.csv"'
    
    writer = csv.writer(response)
    writer.writerow([
        'Student ID', 'Assignment', 'Max Score', 'Score', 
        'Percentage', 'Status', 'Submitted At', 'Graded At'
    ])
    
    for s in queryset:
        max_score = s.assignment.total_marks if s.assignment else 100
        score = s.grade if s.grade is not None else ''
        percentage = round((s.grade / max_score * 100), 2) if s.grade is not None and max_score > 0 else ''
        
        writer.writerow([
            str(s.student_id),
            s.assignment.title if s.assignment else '',
            max_score,
            score,
            percentage,
            s.status,
            s.submitted_at.strftime('%Y-%m-%d %H:%M') if s.submitted_at else '',
            s.graded_at.strftime('%Y-%m-%d %H:%M') if hasattr(s, 'graded_at') and s.graded_at else '',
        ])
    
    return response


@course_router.get("/courses/{course_id}/export/enrollments/")
def export_enrollments_csv(request, course_id: uuid.UUID):
    """Export enrollment history for a course as CSV."""
    from django.http import HttpResponse
    
    enrollments = CourseRegistrationHistory.objects.filter(
        course_id=course_id
    ).select_related('course', 'scheduled_class', 'branch').order_by('-registration_date')
    
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="enrollments_{course_id}.csv"'
    
    writer = csv.writer(response)
    writer.writerow([
        'Student ID', 'Roll Number', 'Course', 'Section', 'Branch',
        'Status', 'Registration Date'
    ])
    
    for e in enrollments:
        writer.writerow([
            str(e.student_id),
            e.roll_number or '',
            e.course.name if e.course else '',
            e.scheduled_class.section if e.scheduled_class else '',
            e.branch.name if e.branch else '',
            e.status,
            e.registration_date.strftime('%Y-%m-%d') if e.registration_date else '',
        ])
    
    return response

# -----------------------------------------------------------
# RUBRIC ENDPOINTS
# -----------------------------------------------------------

@course_router.get("/rubrics/", response=List[dict], auth=JWTAuthentication())
def list_rubrics(request, course_id: uuid.UUID = None):
    """List all rubrics, optionally filtered by course."""
    from .models import Rubric, RubricCriterion
    
    queryset = Rubric.objects.all()
    if course_id:
        queryset = queryset.filter(course_id=course_id)
    
    result = []
    for rubric in queryset:
        criteria = RubricCriterion.objects.filter(rubric=rubric).order_by('order')
        result.append({
            'id': str(rubric.id),
            'name': rubric.name,
            'description': rubric.description,
            'course_id': str(rubric.course_id),
            'criteria': [
                {
                    'id': str(c.id),
                    'name': c.name,
                    'description': c.description,
                    'max_score': c.max_score,
                    'order': c.order,
                }
                for c in criteria
            ],
            'created_at': rubric.created_at.isoformat(),
        })
    return result


@course_router.post("/rubrics/", auth=JWTAuthentication())
def create_rubric(request, data: dict):
    """Create a new rubric with criteria."""
    from .models import Rubric, RubricCriterion
    
    criteria_data = data.pop('criteria', [])
    
    rubric = Rubric.objects.create(
        name=data['name'],
        description=data.get('description', ''),
        course_id=data['course_id'],
        organization_id=request.headers.get('X-Org-Id'),
        created_by_id=getattr(request.auth, 'id', None),
    )
    
    for i, criterion in enumerate(criteria_data):
        RubricCriterion.objects.create(
            rubric=rubric,
            name=criterion['name'],
            description=criterion.get('description', ''),
            max_score=criterion.get('max_score', 10),
            order=criterion.get('order', i),
        )
    
    return {
        'id': str(rubric.id),
        'name': rubric.name,
        'message': 'Rubric created successfully',
    }


@course_router.post("/submissions/{submission_id}/rubric-grade/", auth=JWTAuthentication())
def grade_submission_with_rubric(request, submission_id: uuid.UUID, data: dict):
    """Grade a submission using rubric criteria."""
    from .models import Submission, SubmissionRubricScore, RubricCriterion
    
    submission = get_object_or_404(Submission, id=submission_id)
    
    scores = data.get('scores', [])
    total_score = 0
    max_possible = 0
    
    # Clear existing rubric scores
    SubmissionRubricScore.objects.filter(submission=submission).delete()
    
    for score_data in scores:
        criterion = get_object_or_404(RubricCriterion, id=score_data['criterion_id'])
        SubmissionRubricScore.objects.create(
            submission=submission,
            criterion=criterion,
            score=score_data['score'],
            feedback=score_data.get('feedback', ''),
        )
        total_score += score_data['score']
        max_possible += criterion.max_score
    
    # Calculate grade as percentage
    if max_possible > 0:
        percentage = (total_score / max_possible) * 100
        grade = round(percentage)
    else:
        grade = 0
    
    # Update submission
    submission.grade = grade
    submission.feedback = data.get('overall_feedback', '')
    submission.graded_by_id = getattr(request.auth, 'id', None)
    submission.status = 'GRADED'
    submission.save()
    
    return {
        'submission_id': str(submission_id),
        'grade': grade,
        'total_score': total_score,
        'max_possible': max_possible,
        'message': 'Submission graded with rubric',
    }


# -----------------------------------------------------------
# LATE SUBMISSION POLICY (update assignment creation)
# -----------------------------------------------------------

# Update the create_assignment endpoint to include late penalty fields
@course_router.patch("/assignments/{assignment_id}/late-policy/", auth=JWTAuthentication())
def update_assignment_late_policy(request, assignment_id: uuid.UUID, data: dict):
    """Update late submission policy for an assignment."""
    assignment = get_object_or_404(Assignment, id=assignment_id)
    
    if 'late_penalty_per_day' in data:
        assignment.late_penalty_per_day = data['late_penalty_per_day']
    if 'max_late_days' in data:
        assignment.max_late_days = data['max_late_days']
    if 'allow_resubmission' in data:
        assignment.allow_resubmission = data['allow_resubmission']
    if 'max_resubmissions' in data:
        assignment.max_resubmissions = data['max_resubmissions']
    
    assignment.save()
    
    return {
        'assignment_id': str(assignment_id),
        'late_penalty_per_day': assignment.late_penalty_per_day,
        'max_late_days': assignment.max_late_days,
        'allow_resubmission': assignment.allow_resubmission,
        'max_resubmissions': assignment.max_resubmissions,
        'message': 'Late policy updated',
    }
