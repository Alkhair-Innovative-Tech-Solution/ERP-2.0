import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime, date, time
from pydantic import BaseModel, Field, validator, model_validator

# Base Schemas
class BranchSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    code: str
    name: str
    is_active: bool = True

class SpecializationSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    name: str
    description: Optional[str] = None
    active: bool = True
    # 🔹 Multi-Tenancy
    organization_id: Optional[uuid.UUID] = None

class SpecializationCreateSchema(BaseModel):
    name: str
    description: Optional[str] = None
    # 🔹 Multi-Tenancy: Optional org_id from request or middleware
    organization_id: Optional[str] = None

class SpecializationUpdateSchema(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    active: Optional[bool] = None

class CourseTinySchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    name: str
    course_code: Optional[str] = None

class SessionSummarySchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    section: Optional[str] = None
    days: List[str] = []
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    room_name: Optional[str] = None
    teacher_name: Optional[str] = None
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    branch_code: Optional[str] = None
    strength_status: str = 'seats_available'
    admission_open_date: Optional[str] = None
    course_start_date: Optional[str] = None
    total_students: int = 0
    room_capacity: Optional[int] = None
    seats_available: Optional[int] = None

    @model_validator(mode='before')
    @classmethod
    def populate_session_fields(cls, data):
        if isinstance(data, dict):
            return data
        if hasattr(data, 'room') and data.room:
            data.room_name = data.room.name
            data.room_capacity = data.room.capacity
        if hasattr(data, 'branch') and data.branch:
            data.branch_id = str(data.branch.id)
            data.branch_name = data.branch.name
            data.branch_code = data.branch.code
        if hasattr(data, 'start_time') and data.start_time:
            data.start_time = data.start_time.strftime('%I:%M %p').lstrip('0')
        if hasattr(data, 'end_time') and data.end_time:
            data.end_time = data.end_time.strftime('%I:%M %p').lstrip('0')
        if hasattr(data, 'admission_open_date') and data.admission_open_date:
            data.admission_open_date = data.admission_open_date.isoformat()
        if hasattr(data, 'course_start_date') and data.course_start_date:
            data.course_start_date = data.course_start_date.isoformat()
        room = getattr(data, 'room', None)
        cap = room.capacity if room else None
        total = getattr(data, 'total_students', 0) or 0
        if cap is not None:
            data.seats_available = max(0, cap - total)
        return data

class CourseSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    specialization_id: uuid.UUID
    specialization: Optional[SpecializationSchema] = None
    name: str
    course_code: Optional[str] = None
    description: Optional[str] = None
    additional_description: Optional[str] = None
    image: Optional[str] = None

    @validator('image', pre=True, always=True)
    def resolve_image_url(cls, v):
        if not v:
            return None
        if hasattr(v, 'url'):
            return v.url
        return str(v)

    @validator('branches', pre=True, always=True)
    def resolve_branches(cls, v):
        if hasattr(v, 'all'):
            return list(v.all())
        return v or []

    level: int = 1
    duration: int = 6
    admission_status: Optional[str] = 'coming_soon'
    admission_open_date: Optional[date] = None
    course_start_date: Optional[date] = None
    course_end_date: Optional[date] = None
    active: bool = True
    branches: List[BranchSchema] = []
    sessions: List[SessionSummarySchema] = []
    sessions_count: int = 0
    prerequisite_course: Optional[CourseTinySchema] = None
    next_level_course: Optional[CourseTinySchema] = None

class CourseCreateSchema(BaseModel):
    specialization: uuid.UUID
    name: str
    course_code: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    level: int = 1
    duration: int = 6
    admission_status: Optional[str] = 'coming_soon'
    admission_open_date: Optional[date] = None
    course_start_date: Optional[date] = None
    course_end_date: Optional[date] = None
    # 🔹 Multi-Tenancy
    organization_id: Optional[str] = None

class CourseUpdateSchema(BaseModel):
    specialization: Optional[uuid.UUID] = None
    name: Optional[str] = None
    course_code: Optional[str] = None
    description: Optional[str] = None
    image: Optional[str] = None
    level: Optional[int] = None
    duration: Optional[int] = None
    admission_status: Optional[str] = None
    admission_open_date: Optional[date] = None
    course_start_date: Optional[date] = None
    course_end_date: Optional[date] = None
    active: Optional[bool] = None

class RoomSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    name: str
    capacity: int = 30
    active: bool = True
    # 🔹 Campus (Primary)
    campus_id: Optional[uuid.UUID] = None
    campus_name: Optional[str] = None
    # 🔹 Branch (Deprecated)
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def populate_fields(cls, data):
        if hasattr(data, 'branch') and data.branch:
            data.branch_id = str(data.branch.id)
            data.branch_name = data.branch.name
        return data

class RoomCreateSchema(BaseModel):
    name: str
    capacity: int = 30
    active: bool = True
    # 🔹 Campus (Primary)
    campus_id: Optional[str] = None
    # 🔹 Branch (Deprecated)
    branch_id: Optional[str] = None
    # 🔹 Multi-Tenancy
    organization_id: Optional[str] = None

class ScheduledClassSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    course: CourseTinySchema
    instructor_id: Optional[uuid.UUID] = None
    teacher_name: Optional[str] = None
    assistant_teacher_id: Optional[uuid.UUID] = None
    room: RoomSchema
    # 🔹 Campus (Primary)
    campus_id: Optional[uuid.UUID] = None
    campus_name: Optional[str] = None
    # 🔹 Branch (Deprecated)
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    
    start_time: time
    end_time: time
    days: List[str]
    section: Optional[str] = None
    lab_room: Optional[str] = None
    strength_status: str = 'seats_available'
    
    whatsapp_group_link_boys: Optional[str] = None
    whatsapp_group_link_girls: Optional[str] = None
    content_shared: bool = False
    
    admission_open_date: Optional[date] = None
    course_start_date: Optional[date] = None
    course_end_date: Optional[date] = None
    
    exam_date: Optional[date] = None
    exam_status: Optional[str] = None
    certificate_date: Optional[date] = None
    certificate_status: Optional[str] = None
    status: Optional[str] = None
    
    total_students: int = 0
    total_applications: int = 0
    active: bool = True

    @model_validator(mode='before')
    @classmethod
    def populate_branch_fields(cls, data):
        if hasattr(data, 'branch'):
            branch = data.branch
            data.branch_id = str(branch.id) if branch else None
            data.branch_name = branch.name if branch else None
        return data

    @property
    def label(self) -> str:
        day_map = {"MON": "Mon", "TUE": "Tue", "WED": "Wed", "THU": "Thu",
                   "FRI": "Fri", "SAT": "Sat", "SUN": "Sun"}
        unique_days = list(dict.fromkeys(self.days))
        days_str = " ".join(day_map.get(d, d) for d in unique_days)
        def fmt(t): return t.strftime("%-I:%M%p").lower() if t else ""
        sec = f"Sec {self.section} — " if self.section else ""
        return f"{sec}{days_str}  {fmt(self.start_time)}–{fmt(self.end_time)}"

class ScheduledClassCreateSchema(BaseModel):
    course_id: uuid.UUID
    instructor_id: uuid.UUID
    room_id: uuid.UUID
    # 🔹 Campus (Primary)
    campus_id: Optional[str] = None
    # 🔹 Branch (Deprecated)
    branch_id: Optional[str] = None
    start_time: time
    end_time: time
    days: List[str]
    section: Optional[str] = None
    lab_room: Optional[str] = None
    strength_status: str = 'seats_available'
    whatsapp_group_link_boys: Optional[str] = None
    whatsapp_group_link_girls: Optional[str] = None
    admission_open_date: Optional[date] = None
    course_start_date: Optional[date] = None
    course_end_date: Optional[date] = None
    active: bool = True
    # 🔹 Multi-Tenancy
    organization_id: Optional[str] = None

class ScheduledClassUpdateSchema(BaseModel):
    instructor_id: Optional[uuid.UUID] = None
    assistant_teacher_id: Optional[uuid.UUID] = None
    room_id: Optional[uuid.UUID] = None
    branch_id: Optional[str] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    days: Optional[List[str]] = None
    admission_open_date: Optional[date] = None
    course_start_date: Optional[date] = None
    course_end_date: Optional[date] = None
    section: Optional[str] = None
    lab_room: Optional[str] = None
    strength_status: Optional[str] = None
    whatsapp_group_link_boys: Optional[str] = None
    whatsapp_group_link_girls: Optional[str] = None
    content_shared: Optional[bool] = None
    active: Optional[bool] = None

class AttendanceSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    student_id: uuid.UUID
    course_id: uuid.UUID
    scheduled_class_id: Optional[uuid.UUID] = None
    date: date
    status: str
    remarks: Optional[str] = None

class BulkAttendanceCreateSchema(BaseModel):
    course_id: Optional[uuid.UUID] = None
    scheduled_class_id: Optional[uuid.UUID] = None
    date: date
    records: List[Dict[str, Any]]

class AssignmentSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    title: str
    course_id: uuid.UUID
    due_date: Optional[datetime] = None
    is_published: bool

class AssignmentCreateSchema(BaseModel):
    title: str
    course_id: uuid.UUID
    scheduled_class_id: Optional[uuid.UUID] = None
    due_date: Optional[datetime] = None
    description: Optional[str] = None
    instructions: Optional[str] = None
    total_marks: Optional[int] = 100
    assignment_type: Optional[str] = "Individual"
    is_published: Optional[bool] = True
    created_by_id: Optional[uuid.UUID] = None

class SubmissionSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    assignment_id: uuid.UUID
    student_id: uuid.UUID
    status: str
    grade: Optional[float] = None

class SubmissionCreateSchema(BaseModel):
    assignment_id: uuid.UUID
    student_id: uuid.UUID
    submission_text: Optional[str] = None

class GradeSubmissionSchema(BaseModel):
    grade: float
    feedback: Optional[str] = None
    graded_by_id: uuid.UUID

class AssignmentStatsSchema(BaseModel):
    total: int
    pending: int
    graded: int
    average_grade: float

class CourseRegistrationSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    student_id: uuid.UUID
    course_id: uuid.UUID
    registration_date: datetime
    status: str
    roll_number: Optional[str] = None

class EnrollmentSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    student_id: uuid.UUID
    course: CourseTinySchema
    scheduled_class: Optional[ScheduledClassSchema] = None
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    status: str
    roll_number: Optional[str] = None
    registration_date: datetime
    progress: float = 0.0

    @model_validator(mode='before')
    @classmethod
    def populate_enrollment_branch(cls, data):
        if hasattr(data, 'branch') and data.branch:
            data.branch_id = str(data.branch.id)
            data.branch_name = data.branch.name
        return data

class EnrollmentCreateSchema(BaseModel):
    student_id: uuid.UUID
    course_id: uuid.UUID
    scheduled_class_id: Optional[uuid.UUID] = None
    branch_id: Optional[str] = None
    # 🔹 Multi-Tenancy
    organization_id: Optional[str] = None

class EnrollmentTransferSchema(BaseModel):
    student_id: uuid.UUID
    old_course_id: uuid.UUID
    new_course_id: uuid.UUID
    new_scheduled_class_id: Optional[uuid.UUID] = None

class ReEnrollmentSchema(BaseModel):
    student_id: uuid.UUID
    course_id: uuid.UUID
    scheduled_class_id: Optional[uuid.UUID] = None

class EnrollmentUpdateSchema(BaseModel):
    status: Optional[str] = None
    roll_number: Optional[str] = None
    scheduled_class_id: Optional[uuid.UUID] = None
    branch_id: Optional[str] = None

class ContentCompletionSchema(BaseModel):
    model_config = {"from_attributes": True}
    student_id: uuid.UUID
    content_id: uuid.UUID
    completed_at: datetime

class ContentCompletionCreateSchema(BaseModel):
    student_id: uuid.UUID
    content_id: uuid.UUID
    course_id: uuid.UUID

class CourseProgressSchema(BaseModel):
    course_id: uuid.UUID
    progress: float

class AssignmentStatsSchema(BaseModel):
    total: int
    submitted: int
    graded: int

class CourseRatingSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    student_id: uuid.UUID
    course_id: uuid.UUID
    rating: int
    comment: Optional[str] = None
    created_at: datetime

class CourseRatingCreateSchema(BaseModel):
    student_id: uuid.UUID
    course_id: uuid.UUID
    scheduled_class_id: uuid.UUID
    rating: int = 5
    comment: Optional[str] = None

# Student Deposit Schemas
class StudentDepositSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    student_id: uuid.UUID
    course_id: uuid.UUID
    deposit_amount: int
    receipt_number: Optional[str] = None
    is_waived: bool = False
    bag_taken: bool
    bag_fee: int
    bag_paid: bool = True
    bag_waived: bool = False
    id_card_taken: bool
    id_card_fee: int
    id_card_paid: bool = True
    id_card_waived: bool = False
    certificate_taken: bool
    certificate_fee: int
    certificate_paid: bool = True
    certificate_waived: bool = False
    is_returned: bool
    amount_returned: int
    returned_at: Optional[datetime] = None
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
class StudentDepositCreateSchema(BaseModel):
    student_id: uuid.UUID
    course_id: uuid.UUID
    deposit_amount: int
    is_waived: bool = False
    bag_taken: bool = True
    bag_fee: int = 800
    bag_paid: bool = True
    bag_waived: bool = False
    id_card_taken: bool = True
    id_card_fee: int = 200
    id_card_paid: bool = True
    id_card_waived: bool = False
    certificate_taken: bool = True
    certificate_fee: int = 200
    certificate_paid: bool = True
    certificate_waived: bool = False
    remarks: Optional[str] = None

class StudentDepositProcessReturnSchema(BaseModel):
    remarks: Optional[str] = None

class PaginatedEnrollmentResponseSchema(BaseModel):
    items: List[EnrollmentSchema]
    total: int
    page: int
    limit: int
    pages: int

# ─── Coordinator Schemas ────────────────────────────────────────────

class CoordinatorAttendanceResponseSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str = ""
    student_email: str = ""
    course_id: uuid.UUID
    course_name: str = ""
    scheduled_class_id: Optional[uuid.UUID] = None
    scheduled_class_label: str = ""
    date: date
    status: str
    remarks: Optional[str] = None
    contacted: bool = False
    contact_logs: List[Dict[str, Any]] = []

class CoordinatorAttendanceContactSchema(BaseModel):
    attendance_id: uuid.UUID
    method: str = "whatsapp"
    remarks: Optional[str] = None
    resolved: bool = False

class CoordinatorAttendanceStatsSchema(BaseModel):
    total_today: int = 0
    present: int = 0
    absent: int = 0
    late: int = 0
    excused: int = 0
    contact_rate: float = 0.0

class CoordinatorDashboardStatsSchema(BaseModel):
    total_students: int = 0
    total_active_enrollments: int = 0
    total_courses: int = 0
    total_teachers: int = 0
    attendance_today: Optional[CoordinatorAttendanceStatsSchema] = None

# ─── Section Summary Schemas ─────────────────────────────────────────────

class SectionSummarySchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    course_id: uuid.UUID
    course_name: str = ""
    course_code: Optional[str] = None
    section: Optional[str] = None
    branch_name: Optional[str] = None
    room_name: Optional[str] = None
    teacher_name: Optional[str] = None
    days: List[str] = []
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    total_students: int = 0
    total_applications: int = 0
    strength_status: str = 'seats_available'
    status: str = 'active'
    attendance_rate: float = 0.0
    total_classes: int = 0

    @model_validator(mode='before')
    @classmethod
    def populate_section_fields(cls, data):
        if isinstance(data, dict):
            return data
        if hasattr(data, 'room') and data.room:
            data.room_name = data.room.name
        if hasattr(data, 'branch') and data.branch:
            data.branch_name = data.branch.name
        if hasattr(data, 'course') and data.course:
            data.course_name = data.course.name
            data.course_code = data.course.course_code
        if hasattr(data, 'start_time') and data.start_time:
            data.start_time = data.start_time.strftime('%I:%M %p').lstrip('0')
        if hasattr(data, 'end_time') and data.end_time:
            data.end_time = data.end_time.strftime('%I:%M %p').lstrip('0')
        return data

class SectionStudentSchema(BaseModel):
    student_id: uuid.UUID
    full_name: str = ""
    email: str = ""
    phone: str = ""
    roll_number: Optional[str] = None
    gender: Optional[str] = None
    whatsapp_number: Optional[str] = None
    total_classes: int = 0
    present_count: int = 0
    absent_count: int = 0
    late_count: int = 0
    excused_count: int = 0
    attendance_percentage: float = 0.0
    warning_count: int = 0
    last_warning_date: Optional[str] = None

class StudentWarningSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    student_id: uuid.UUID
    student_name: str = ""
    scheduled_class_id: Optional[str] = None
    warning_type: str
    description: Optional[str] = None
    issued_by_id: uuid.UUID
    issued_by_name: Optional[str] = None
    issued_at: datetime
    resolved: bool = False
    resolved_at: Optional[datetime] = None
    resolved_by_id: Optional[str] = None
    resolution_notes: Optional[str] = None

class StudentWarningCreateSchema(BaseModel):
    student_id: uuid.UUID
    scheduled_class_id: Optional[uuid.UUID] = None
    warning_type: str = 'absent'
    description: Optional[str] = None
    issued_by_name: Optional[str] = None

class StudentWarningResolveSchema(BaseModel):
    resolution_notes: Optional[str] = None

# ─── Course-Wise Teacher Attendance ──────────────────────────────────────

class TeacherAttendanceClassSchema(BaseModel):
    scheduled_class_id: uuid.UUID
    course_id: uuid.UUID
    course_name: str = ""
    section: Optional[str] = None
    days: List[str] = []
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    room_name: Optional[str] = None
    total_students: int = 0
    attendance_marked: bool = False
    marked_students: int = 0
    attendance_status_breakdown: Dict[str, int] = {}

class TeacherCourseAttendanceSchema(BaseModel):
    teacher_name: str = ""
    teacher_id: uuid.UUID
    total_scheduled: int = 0
    attendance_marked_count: int = 0
    attendance_missed_count: int = 0
    classes: List[TeacherAttendanceClassSchema] = []

class TeacherCourseAttendanceResponse(BaseModel):
    results: List[TeacherCourseAttendanceSchema] = []
    total_teachers: int = 0
    total_classes_scheduled: int = 0
    total_classes_marked: int = 0
