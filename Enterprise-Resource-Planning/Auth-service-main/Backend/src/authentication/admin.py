from django.contrib import admin
from django.utils.html import format_html
from .models import UserCredentials, RefreshToken, BlacklistedToken, SuperAdmin
from .forms import UserCredentialsForm


@admin.register(UserCredentials)
class UserCredentialsAdmin(admin.ModelAdmin):
    """Admin panel for User Credentials"""
    form = UserCredentialsForm
    list_display = ['employee', 'last_login', 'failed_login_attempts', 'is_locked_badge', 'password_changed_at']
    list_filter = ['last_login', 'password_changed_at']
    search_fields = ['employee__employee_code', 'employee__full_name', 'last_login_ip']
    readonly_fields = ['password_hash', 'last_login', 'last_login_ip', 'password_changed_at', 
                      'created_at', 'updated_at', 'deleted_at', 'deleted_by']
    autocomplete_fields = ['employee', 'superadmin']
    
    fieldsets = (
        ('User Identity', {
            'fields': ('employee', 'superadmin')
        }),
        ('Password', {
            'fields': ('password', 'password_hash', 'password_changed_at'),
            'description': 'Enter a value in "Password" to change it. The "Password hash" field is read-only.'
        }),
        ('Login Info', {
            'fields': ('last_login', 'last_login_ip', 'failed_login_attempts', 'locked_until')
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at', 'deleted_by', 'deletion_reason'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def is_locked_badge(self, obj):
        if obj.is_locked():
            return format_html('<span style="color: red; font-weight: bold;">🔒 LOCKED</span>')
        return format_html('<span style="color: green; font-weight: bold;">✓ Unlocked</span>')
    is_locked_badge.short_description = 'Lock Status'
    
    def get_queryset(self, request):
        return UserCredentials.all_objects.all()


@admin.register(RefreshToken)
class RefreshTokenAdmin(admin.ModelAdmin):
    """Admin panel for Refresh Tokens"""
    list_display = ['employee', 'created_at', 'expires_at', 'is_valid_badge', 'device_info', 'ip_address']
    list_filter = ['is_revoked', 'created_at', 'expires_at']
    search_fields = ['employee__employee_code', 'employee__full_name', 'ip_address', 'device_info']
    readonly_fields = ['token', 'created_at', 'expires_at', 'device_info', 'ip_address']
    
    fieldsets = (
        ('Token Info', {
            'fields': ('employee', 'token', 'created_at', 'expires_at')
        }),
        ('Status', {
            'fields': ('is_revoked',)
        }),
        ('Device Info', {
            'fields': ('device_info', 'ip_address')
        }),
    )
    
    actions = ['revoke_tokens']
    
    def is_valid_badge(self, obj):
        if obj.is_valid():
            return format_html('<span style="color: green; font-weight: bold;">✓ Valid</span>')
        elif obj.is_expired():
            return format_html('<span style="color: orange; font-weight: bold;">⏱ Expired</span>')
        else:
            return format_html('<span style="color: red; font-weight: bold;">❌ Revoked</span>')
    is_valid_badge.short_description = 'Status'
    
    def revoke_tokens(self, request, queryset):
        count = 0
        for token in queryset:
            if not token.is_revoked:
                token.revoke()
                count += 1
        self.message_user(request, f'{count} token(s) revoked.')
    revoke_tokens.short_description = 'Revoke selected tokens'


@admin.register(BlacklistedToken)
class BlacklistedTokenAdmin(admin.ModelAdmin):
    """Admin panel for Blacklisted Tokens"""
    list_display = ['token_preview', 'blacklisted_at', 'expires_at', 'reason', 'is_expired_badge']
    list_filter = ['reason', 'blacklisted_at', 'expires_at']
    search_fields = ['token']
    readonly_fields = ['token', 'blacklisted_at', 'expires_at']
    
    fieldsets = (
        ('Token Info', {
            'fields': ('token', 'blacklisted_at', 'expires_at', 'reason')
        }),
    )
    
    actions = ['cleanup_expired_tokens']
    
    def token_preview(self, obj):
        """Show first 20 chars of token"""
        return f"{obj.token[:20]}..." if len(obj.token) > 20 else obj.token
    token_preview.short_description = 'Token'
    
    def is_expired_badge(self, obj):
        from django.utils import timezone
        if timezone.now() > obj.expires_at:
            return format_html('<span style="color: green; font-weight: bold;">✓ Expired (can clean)</span>')
        return format_html('<span style="color: orange; font-weight: bold;">⏱ Active</span>')
    is_expired_badge.short_description = 'Status'
    
    def cleanup_expired_tokens(self, request, queryset):
        count = BlacklistedToken.cleanup_expired()
        self.message_user(request, f'{count} expired token(s) cleaned up.')
    cleanup_expired_tokens.short_description = 'Cleanup expired tokens'


@admin.register(SuperAdmin)
class SuperAdminAdmin(admin.ModelAdmin):
    """Admin panel for SuperAdmins"""
    list_display = ['superadmin_code', 'full_name', 'email', 'phone', 'is_active']
    list_filter = ['is_active', 'organization']
    search_fields = ['superadmin_code', 'full_name', 'email']
    readonly_fields = ['created_at', 'updated_at', 'deleted_at', 'deleted_by']
    
    fieldsets = (
        ('Identity', {
            'fields': ('superadmin_code', 'full_name', 'email', 'phone')
        }),
        ('Status', {
            'fields': ('is_active', 'organization')
        }),
        ('Soft Delete', {
            'fields': ('is_deleted', 'deleted_at', 'deleted_by', 'deletion_reason'),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def get_queryset(self, request):
        return SuperAdmin.all_objects.all()

