from django.contrib import admin
from .models import Batch, Enrollment, TeacherAssignment, Interview

@admin.register(Batch)
class BatchAdmin(admin.ModelAdmin):
    list_display = ('course', 'teacher_id', 'start_date', 'end_date', 'max_seats', 'available_seats', 'status')
    list_filter = ('status',)
    search_fields = ('course__name', 'teacher_id')

@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ('student_id', 'batch', 'status', 'enrollment_date', 'completion_date')
    list_filter = ('status',)
    search_fields = ('student_id', 'batch__course__name')

@admin.register(TeacherAssignment)
class TeacherAssignmentAdmin(admin.ModelAdmin):
    list_display = ('teacher_id', 'batch', 'assigned_at')
    search_fields = ('teacher_id', 'batch__course__name')

@admin.register(Interview)
class InterviewAdmin(admin.ModelAdmin):
    list_display = ('student_id', 'batch', 'interview_date', 'status')
    list_filter = ('status',)
    search_fields = ('student_id', 'batch__course__name')
