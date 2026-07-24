from django.contrib import admin
from .models import ClassRoom, Grade, Level

# ----------------------
@admin.register(Level)
class LevelAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "organization", "campus", "coordinator_name")
    list_filter = ("organization", "campus")
    search_fields = ("name", "code")
    readonly_fields = ("coordinator_name",)

    def coordinator_name(self, obj):
        return obj.coordinator_name or "-"
    coordinator_name.short_description = "Coordinator"


@admin.register(Grade)
class GradeAdmin(admin.ModelAdmin):
    list_display = ("name", "code", "organization", "level", "campus_display")
    list_filter = ("organization", "level", "level__campus")
    search_fields = ("name", "code")

    def campus_display(self, obj):
        return obj.level.campus.campus_name if obj.level and obj.level.campus else '-'
    campus_display.short_description = 'Campus'


@admin.register(ClassRoom)
class ClassRoomAdmin(admin.ModelAdmin):
    list_display = ("grade", "section", "organization", "class_teacher", "capacity", "code", "campus_display")
    list_filter = ("organization", "grade", "capacity", "grade__level__campus")
    search_fields = ("grade__name", "section", "code")

    def campus_display(self, obj):
        return obj.grade.level.campus.campus_name if obj.grade and obj.grade.level and obj.grade.level.campus else '-'
    campus_display.short_description = 'Campus'

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('grade', 'class_teacher', 'grade__level__campus')


import os as _os
if not _os.environ.get("DJANGO_SETTINGS_MODULE", "").startswith("campus_service"):
    try:
        from django.contrib import admin as _admin
        from .models import Level as _Level, Grade as _Grade, ClassRoom as _ClassRoom
        for _m in [_Level, _Grade, _ClassRoom]:
            try:
                _admin.site.unregister(_m)
            except Exception:
                pass
    except Exception:
        pass

