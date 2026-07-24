from django.contrib import admin
from .models import Subject, SubjectTeacherAssignment


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'subject_code', 'grade_name', 'campus_name', 'is_active', 'organization']
    list_filter = ['is_active', 'is_deleted', 'campus_name']
    search_fields = ['name', 'subject_code', 'grade_name']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(SubjectTeacherAssignment)
class SubjectTeacherAssignmentAdmin(admin.ModelAdmin):
    list_display = ['subject', 'teacher_name', 'classroom_label', 'academic_year', 'is_active']
    list_filter = ['is_active', 'academic_year']
    search_fields = ['teacher_name', 'classroom_label', 'subject__name']
