"""
Admin configuration for certifications
"""
from django.contrib import admin
from .models import Certification


@admin.register(Certification)
class CertificationAdmin(admin.ModelAdmin):
    list_display = ('title', 'user_id', 'course_id', 'issued_date')
    list_filter = ('issued_date',)
    search_fields = ('title', 'user_id', 'course_id')

