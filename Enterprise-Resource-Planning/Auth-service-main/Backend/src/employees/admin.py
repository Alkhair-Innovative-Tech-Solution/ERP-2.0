"""
Django Admin configuration for Employees app.

Registers all models with auto-generation, soft delete support, and filters.
"""
from django.contrib import admin
from django.utils.html import format_html
from .models import Organization, Institution, Branch, Department, Designation, Employee, EmployeeAssignment


class SoftDeleteAdmin(admin.ModelAdmin):
    """Base Admin for all models supporting soft delete"""
    def is_deleted_badge(self, obj):
        if obj.is_deleted:
            return format_html('<span style="color: red; font-weight: bold;">🗑️ DELETED</span>')
        return format_html('<span style="color: green; font-weight: bold;">✓ Active</span>')
    is_deleted_badge.short_description = 'Status'

    def restore_items(self, request, queryset):
        count = 0
        for obj in queryset:
            if obj.is_deleted:
                obj.restore()
                count += 1
        self.message_user(request, f'{count} item(s) restored.')
    restore_items.short_description = 'Restore selected'

    def get_queryset(self, request):
        return self.model.all_objects.all()


@admin.register(Organization)
class OrganizationAdmin(SoftDeleteAdmin):
    list_display = ['org_code', 'name', 'website', 'is_deleted_badge']
    search_fields = ['org_code', 'name']
    actions = ['restore_items']


@admin.register(Institution)
class InstitutionAdmin(SoftDeleteAdmin):
    list_display = ['inst_code', 'name', 'inst_type', 'organization', 'is_deleted_badge']
    list_filter = ['inst_type', 'organization']
    search_fields = ['inst_code', 'name']
    actions = ['restore_items']


@admin.register(Branch)
class BranchAdmin(SoftDeleteAdmin):
    list_display = ['branch_code', 'branch_name', 'city', 'institution', 'is_deleted_badge']
    list_filter = ['institution', 'city', 'status']
    search_fields = ['branch_code', 'branch_name']
    actions = ['restore_items']


@admin.register(Department)
class DepartmentAdmin(SoftDeleteAdmin):
    list_display = ['dept_name', 'dept_code', 'scope_display', 'is_deleted_badge']
    list_filter = ['branch', 'institution', 'organization']
    search_fields = ['dept_code', 'dept_name']
    actions = ['restore_items']

    def scope_display(self, obj):
        if obj.branch:
            return f"{obj.branch.branch_code}"
        return "Global" if obj.is_global else obj.institution.inst_code
    scope_display.short_description = 'Scope'


@admin.register(Designation)
class DesignationAdmin(SoftDeleteAdmin):
    list_display = ['position_name', 'position_code', 'department_display', 'is_deleted_badge']
    list_filter = ['department']
    search_fields = ['position_name', 'position_code']
    actions = ['restore_items']

    def department_display(self, obj):
        return str(obj.department)
    department_display.short_description = 'Department'


class AssignmentInline(admin.TabularInline):
    model = EmployeeAssignment
    fields = ['department', 'designation', 'joining_date', 'shift', 'is_primary', 'is_active']
    extra = 1


@admin.register(Employee)
class EmployeeAdmin(SoftDeleteAdmin):
    list_display = ['employee_id', 'employee_code', 'full_name', 'cnic', 'is_active_badge', 'is_deleted_badge']
    list_filter = ['is_active', 'organization']
    search_fields = ['employee_id', 'employee_code', 'full_name', 'cnic']
    
    fieldsets = (
        ('Personal Info', {
            'fields': ('full_name', 'cnic', 'dob', 'gender', 'marital_status', 'nationality', 'religion', 'resume_url')
        }),
        ('Contact Details', {
            'fields': (('personal_email', 'personal_phone'), ('org_email', 'org_phone'))
        }),
        ('Address', {
            'fields': ('residential_address', 'permanent_address', 'city')
        }),
        ('Emergency & Bank', {
            'fields': (('emergency_contact_name', 'emergency_contact_phone'), ('bank_name', 'account_number'))
        }),
        ('HR Records', {
            'fields': ('education_history', 'work_experience')
        }),
        ('System Metadata', {
            'fields': ('employee_id', 'employee_code', 'organization', 'is_active')
        }),
    )
    
    readonly_fields = ['employee_id', 'employee_code']
    inlines = [AssignmentInline]
    
    def save_related(self, request, form, formsets, change):
        super().save_related(request, form, formsets, change)
        # Check if code was changed during assignment saves
        for formset in formsets:
            if formset.model == EmployeeAssignment:
                for obj in formset.queryset.all():
                    if hasattr(obj, '_new_employee_code'):
                        from django.contrib import messages
                        self.message_user(
                            request, 
                            f"Success: Employee code for {obj.employee.full_name} has been updated to {obj._new_employee_code}",
                            level=messages.SUCCESS
                        )
                        # Clean up so it doesn't fire multiple times on next save if object is reused
                        del obj._new_employee_code
    
    actions = ['activate_employees', 'deactivate_employees', 'restore_items']

    def is_active_badge(self, obj):
        if obj.is_active:
            return format_html('<span style="color: green; font-weight: bold;">✓ Active</span>')
        return format_html('<span style="color: orange; font-weight: bold;">⚠ Inactive</span>')
    is_active_badge.short_description = 'Access'

    def activate_employees(self, request, queryset):
        queryset.update(is_active=True)
    activate_employees.short_description = 'Activate selected'

    def deactivate_employees(self, request, queryset):
        queryset.update(is_active=False)
    deactivate_employees.short_description = 'Deactivate selected'


@admin.register(EmployeeAssignment)
class EmployeeAssignmentAdmin(SoftDeleteAdmin):
    list_display = ['employee', 'designation', 'branch_display', 'institution_display', 'is_primary', 'is_deleted_badge']
    list_filter = ['is_primary', 'shift']
    search_fields = ['employee__full_name', 'employee__employee_id']

    def save_model(self, request, obj, form, change):
        super().save_model(request, obj, form, change)
        if hasattr(obj, '_new_employee_code'):
            from django.contrib import messages
            self.message_user(
                request,
                f"Success: Employee code for {obj.employee.full_name} has been updated to {obj._new_employee_code}",
                level=messages.SUCCESS
            )
            del obj._new_employee_code

    def branch_display(self, obj):
        dept = obj.designation.department
        return dept.branch.branch_code if dept.branch_id else "—"
    branch_display.short_description = 'Branch'

    def institution_display(self, obj):
        from employees.api import _assignment_institution
        inst = _assignment_institution(obj)
        return inst.inst_code if inst else "Global"
    institution_display.short_description = 'Institution'
