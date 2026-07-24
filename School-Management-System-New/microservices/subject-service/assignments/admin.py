from django.contrib import admin
from .models import Assignment, Submission


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ['title', 'subject', 'classroom_label', 'total_marks', 'due_date', 'is_published', 'created_by_name']
    list_filter = ['is_published', 'assignment_type']
    search_fields = ['title', 'subject__name', 'created_by_name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ['assignment', 'student_name', 'status', 'grade', 'submitted_at']
    list_filter = ['status']
    search_fields = ['student_name', 'assignment__title']
    readonly_fields = ['submitted_at', 'graded_at']
