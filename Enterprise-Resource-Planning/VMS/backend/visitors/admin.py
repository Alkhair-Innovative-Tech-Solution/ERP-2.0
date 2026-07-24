from django.contrib import admin
from .models import Visitor, Host, Visit, Employee


@admin.register(Visitor)
class VisitorAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'cnic', 'phone', 'email', 'company', 'is_blacklisted', 'created_at']
    search_fields = ['full_name', 'cnic', 'phone', 'email']
    list_filter = ['is_blacklisted']


@admin.register(Host)
class HostAdmin(admin.ModelAdmin):
    list_display = ['name', 'department', 'employee_id', 'phone', 'is_active']
    list_filter = ['is_active']


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = ['name', 'department', 'designation', 'employee_id', 'email', 'is_active']
    list_filter = ['department', 'is_active']
    search_fields = ['name', 'employee_id', 'email', 'department', 'designation']


@admin.register(Visit)
class VisitAdmin(admin.ModelAdmin):
    list_display = [
        'visitor', 'status', 'entry_type', 'purpose', 
        'checked_in_at', 'expected_checkout_at', 'checked_out_at',
        'is_late', 'is_returning', 'created_at'
    ]
    list_filter = ['status', 'entry_type', 'purpose', 'is_returning', 'is_late', 'is_overnight']
    search_fields = ['visitor__full_name', 'visiting_id']
    readonly_fields = ['visiting_id', 'is_late']
    
    fieldsets = (
        ('Visitor Info', {
            'fields': ('visitor', 'host', 'host_name_manual', 'purpose', 'purpose_other')
        }),
        ('Condition-Based Fields', {
            'fields': (
                'interview_position',
                'contractor_company', 'contractor_designation', 'contractor_address',
                'delivery_company',
                'official_department', 'official_rank',
                'vip_category',
            ),
            'classes': ('collapse',)
        }),
        ('Timing', {
            'fields': ('scheduled_at', 'checked_in_at', 'expected_checkout_at', 'checked_out_at')
        }),
        ('Status', {
            'fields': ('status', 'entry_type', 'visiting_id', 'is_returning', 'is_late', 'is_overnight', 'overnight_notified')
        }),
        ('Additional', {
            'fields': ('approved_by', 'notes'),
            'classes': ('collapse',)
        }),
    )
