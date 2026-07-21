"""
Admin configuration for notifications
"""
from django.contrib import admin
from .models import NotificationBroadcast, NotificationDelivery


@admin.register(NotificationBroadcast)
class NotificationBroadcastAdmin(admin.ModelAdmin):
    list_display = ('title', 'audience_type', 'target_role', 'created_at')
    list_filter = ('audience_type', 'target_role', 'created_at')
    search_fields = ('title', 'message')

@admin.register(NotificationDelivery)
class NotificationDeliveryAdmin(admin.ModelAdmin):
    list_display = ('broadcast', 'recipient_id', 'status', 'is_read', 'delivered_at')
    list_filter = ('status', 'is_read', 'delivered_at')
    search_fields = ('broadcast__title', 'recipient_id')

