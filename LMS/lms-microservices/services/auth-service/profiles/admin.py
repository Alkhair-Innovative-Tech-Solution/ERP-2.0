"""
Admin configuration for profiles app
"""
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, UserProfile, StudentProfile, TeacherProfile


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('username', 'email', 'first_name', 'last_name', 'role', 'is_staff', 'is_active')
    list_filter = BaseUserAdmin.list_filter + ('role',)
    fieldsets = BaseUserAdmin.fieldsets + (
        ('Role Information', {'fields': ('role',)}),
        ('Profile Media', {'fields': ('profile_picture', 'cover_photo')}),
    )


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'headline', 'location', 'joined_date')
    list_filter = ('location', 'joined_date')
    search_fields = ('user__username', 'user__email', 'headline')


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'student_id', 'enrollment_date', 'is_active')
    list_filter = ('is_active', 'enrollment_date')
    search_fields = ('user__username', 'student_id')
    readonly_fields = ('student_id',)  # Make student_id readonly so it auto-generates
    
    def save_model(self, request, obj, form, change):
        """Override save_model to ensure student_id is generated"""
        # If student_id is empty, let the model's save() method generate it
        if not obj.student_id or obj.student_id.strip() == '':
            obj.student_id = None  # Set to None so save() method generates it
        super().save_model(request, obj, form, change)


@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'teacher_id', 'department', 'designation', 'is_verified', 'is_active')
    list_filter = ('is_verified', 'is_active', 'department')
    search_fields = ('user__username', 'teacher_id', 'department')
    readonly_fields = ('teacher_id',)  # Make teacher_id readonly so it auto-generates
    
    def save_model(self, request, obj, form, change):
        """Override save_model to ensure teacher_id is generated"""
        # If teacher_id is empty, let the model's save() method generate it
        if not obj.teacher_id or obj.teacher_id.strip() == '':
            obj.teacher_id = None  # Set to None so save() method generates it
        super().save_model(request, obj, form, change)
