from django.utils import timezone
from apps.settings.models import AuditLog, SystemSetting
from apps.notifications.models import Notification


def log_action(user, action, model_name, object_id=None, description='', request=None):
    ip = None
    if request:
        x_forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_forwarded.split(',')[0] if x_forwarded else request.META.get('REMOTE_ADDR')
    AuditLog.objects.create(
        user=user, action=action, model_name=model_name,
        object_id=object_id, description=description, ip_address=ip
    )


def get_user_branch(user):
    if user.role in ['accounts_head', 'finance_head', 'program_officer']:
        return None
    return user.branch


def get_setting(key, default=None):
    try:
        setting = SystemSetting.objects.get(key=key, is_active=True)
        return setting.value
    except SystemSetting.DoesNotExist:
        return default


def create_notification(recipient, notif_type, title, message, link=''):
    Notification.objects.create(
        recipient=recipient, notif_type=notif_type,
        title=title, message=message, link=link
    )


def _excel_response(wb, filename):
    from django.http import HttpResponse
    response = HttpResponse(
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}"'
    wb.save(response)
    return response
