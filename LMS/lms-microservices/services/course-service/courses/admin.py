from django.contrib import admin
from .models import (
    CourseRegistrationHistory, Specialization, Course,
    StudentCourseProgress, Assignment, Submission, Attendance,
    StudentAttendance, Room, ScheduledClass, CourseRating,
    Holiday, Weekend, StaffAttendance, ZKTecoDevice, ZKTecoEmployeeMapping,
    AttendanceBackfillPermission, AttendanceAuditLog
)

class CourseInline(admin.TabularInline):
    model = Course
    extra = 0
    show_change_link = True

@admin.register(Specialization)
class SpecializationAdmin(admin.ModelAdmin):
    list_display = ('name', 'active')
    search_fields = ('name',)
    list_filter = ('active',)
    inlines = [CourseInline]

@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ('name', 'specialization', 'level', 'active', 'created_at')
    list_filter = ('level', 'specialization', 'active')
    search_fields = ('name', 'specialization__name')

@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ('name', 'capacity', 'active')
    search_fields = ('name',)

@admin.register(ScheduledClass)
class ScheduledClassAdmin(admin.ModelAdmin):
    list_display = ('course', 'section', 'instructor_id', 'room', 'strength_status', 'start_time', 'end_time', 'active')
    list_filter = ('course', 'room', 'strength_status', 'active')
    search_fields = ('course__name', 'instructor_id', 'section')
    fieldsets = (
        ('Class Info', {
            'fields': ('course', 'section', 'instructor_id', 'assistant_teacher_id', 'room', 'lab_room')
        }),
        ('Schedule', {
            'fields': ('start_time', 'end_time', 'days', 'ramdan_time')
        }),
        ('Status & Registration', {
            'fields': ('strength_status', 'admission_open_date', 'course_start_date', 'course_end_date', 'total_students', 'total_applications', 'active')
        }),
        ('Exam & Certification', {
            'fields': ('exam_date', 'exam_status', 'certificate_date', 'certificate_status')
        }),
        ('Social', {
            'fields': ('whatsapp_group_link_boys', 'whatsapp_group_link_girls', 'content_shared')
        }),
    )

@admin.register(CourseRating)
class CourseRatingAdmin(admin.ModelAdmin):
    list_display = ('course', 'scheduled_class', 'student_id', 'rating', 'created_at')
    list_filter = ('rating', 'course')
    search_fields = ('student_id', 'course__name')

@admin.register(StudentCourseProgress)
class StudentCourseProgressAdmin(admin.ModelAdmin):
    list_display = ('student_id', 'course', 'status', 'grade', 'completion_date')
    list_filter = ('status',)
    search_fields = ('student_id', 'course__name')

@admin.register(CourseRegistrationHistory)
class CourseRegistrationHistoryAdmin(admin.ModelAdmin):
    list_display = ('student_id', 'course', 'status', 'registration_date')
    list_filter = ('status',)
    search_fields = ('student_id', 'course__name')

@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'scheduled_class', 'assignment_type', 'is_published', 'due_date')
    list_filter = ('course', 'assignment_type', 'is_published')
    search_fields = ('title', 'course__name')

@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ('student_id', 'assignment', 'status', 'grade', 'submitted_at')
    list_filter = ('status', 'assignment__course')
    search_fields = ('student_id', 'assignment__title')

@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ('course', 'scheduled_class', 'date', 'status', 'total_students', 'present_count', 'absent_count', 'created_at')
    list_filter = ('status', 'course', 'date')
    search_fields = ('course__name',)

@admin.register(StudentAttendance)
class StudentAttendanceAdmin(admin.ModelAdmin):
    list_display = ('student_id', 'attendance', 'status', 'remarks')
    list_filter = ('status',)
    search_fields = ('student_id',)

@admin.register(Holiday)
class HolidayAdmin(admin.ModelAdmin):
    list_display = ('name', 'date', 'organization_id', 'is_active', 'created_at')
    list_filter = ('date', 'is_active')

@admin.register(StaffAttendance)
class StaffAttendanceAdmin(admin.ModelAdmin):
    list_display = ('user_id', 'date', 'status', 'check_in_time', 'check_out_time', 'source')
    list_filter = ('status', 'date', 'source')

@admin.register(ZKTecoDevice)
class ZKTecoDeviceAdmin(admin.ModelAdmin):
    list_display = ('name', 'ip_address', 'serial_number', 'campus_id', 'last_sync')
    search_fields = ('name', 'serial_number')

@admin.register(AttendanceAuditLog)
class AttendanceAuditLogAdmin(admin.ModelAdmin):
    list_display = ('feature', 'action', 'entity_type', 'entity_id', 'user_id', 'timestamp')
    list_filter = ('feature', 'action')
    search_fields = ('entity_id',)