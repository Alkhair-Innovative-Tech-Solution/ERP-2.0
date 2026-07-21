from django.contrib import admin
from .models import Module, Lesson, ContentItem, UserContentProgress

class ContentItemInline(admin.TabularInline):
    model = ContentItem
    extra = 1

class LessonInline(admin.TabularInline):
    model = Lesson
    extra = 1

@admin.register(Module)
class ModuleAdmin(admin.ModelAdmin):
    list_display = ('title', 'course_id', 'order', 'is_published')
    list_filter = ('is_published',)
    search_fields = ('title', 'course_id')
    inlines = [LessonInline]

@admin.register(Lesson)
class LessonAdmin(admin.ModelAdmin):
    list_display = ('title', 'module', 'order', 'duration_minutes', 'is_published')
    list_filter = ('module__course_id', 'is_published')
    search_fields = ('title', 'module__title')
    inlines = [ContentItemInline]

@admin.register(ContentItem)
class ContentItemAdmin(admin.ModelAdmin):
    list_display = ('title', 'lesson', 'content_type', 'order', 'is_preview')
    list_filter = ('content_type', 'is_preview')
    search_fields = ('title', 'lesson__title')

@admin.register(UserContentProgress)
class UserContentProgressAdmin(admin.ModelAdmin):
    list_display = ('user_id', 'lesson', 'is_completed', 'last_accessed')
    list_filter = ('is_completed',)
    search_fields = ('user_id', 'lesson__title')
