from django.contrib import admin
from .models import Module, Lesson, ContentItem, StudentContentProgress


@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ['title', 'subject_name', 'order', 'is_published', 'organization']
    list_filter = ['is_published']
    search_fields = ['title', 'subject_name']
    ordering = ['subject_id', 'order']


@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ['title', 'module', 'order', 'duration_minutes', 'is_published']
    list_filter = ['is_published']
    search_fields = ['title', 'module__title']
    ordering = ['module__order', 'order']


@admin.register(ContentItem)
class ContentItemAdmin(admin.ModelAdmin):
    list_display = ['title', 'lesson', 'content_type', 'order', 'is_preview']
    list_filter = ['content_type', 'is_preview']
    search_fields = ['title', 'lesson__title']


@admin.register(StudentContentProgress)
class StudentContentProgressAdmin(admin.ModelAdmin):
    list_display = ['student_id', 'lesson', 'is_completed', 'last_accessed']
    list_filter = ['is_completed']
    search_fields = ['lesson__title']
