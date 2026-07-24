from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


def send_host_notification(visit):
    """Issue #10: Send email to host when visitor arrives."""
    host_email, host_name = None, None
    if visit.employee_host and visit.employee_host.email:
        host_email = visit.employee_host.email
        host_name = visit.employee_host.name
    elif visit.host and visit.host.email:
        host_email = visit.host.email
        host_name = visit.host.name

    if not host_email:
        logger.warning(f"No host email for visit {visit.id} — notification skipped.")
        return False

    try:
        send_mail(
            subject=f"[VMS] Your visitor {visit.visitor.full_name} has arrived",
            message=f"""Hi {host_name},

Your visitor has checked in and is waiting at reception.

Visitor Details:
  Name:     {visit.visitor.full_name}
  CNIC:     {visit.visitor.cnic or 'N/A'}
  Phone:    {visit.visitor.phone or 'N/A'}
  Company:  {visit.visitor.company or 'N/A'}
  Purpose:  {visit.get_purpose_display() if visit.purpose else visit.purpose_other or 'N/A'}
  Check-in: {visit.checked_in_at.strftime('%d %b %Y, %I:%M %p') if visit.checked_in_at else 'N/A'}

Please proceed to reception or send someone to escort them.

— VMS Front Desk""",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[host_email],
            fail_silently=False,
        )
        logger.info(f"Host notification sent to {host_email} for visit {visit.id}")
        return True
    except Exception as e:
        logger.error(f"Failed to send host notification for visit {visit.id}: {e}")
        return False


def send_overnight_notification(visit):
    admin_email = getattr(settings, 'ADMIN_EMAIL', settings.EMAIL_HOST_USER)
    try:
        send_mail(
            subject=f"[VMS] OVERNIGHT ALERT: {visit.visitor.full_name}",
            message=f"""OVERNIGHT VISITOR DETECTED

Visitor:   {visit.visitor.full_name}
CNIC:      {visit.visitor.cnic or 'N/A'}
Phone:     {visit.visitor.phone or 'N/A'}
Host:      {visit.employee_host.name if visit.employee_host else (visit.host.name if visit.host else visit.host_name_manual or 'N/A')}
Check-in:  {visit.checked_in_at.strftime('%d %b %Y, %I:%M %p') if visit.checked_in_at else 'N/A'}
Current:   {timezone.now().strftime('%d %b %Y, %I:%M %p')}

Please take immediate action.

— VMS Automated Alert""",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[admin_email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        logger.error(f"Overnight notification failed: {e}")
        return False


def check_overnight_stays():
    from .models import Visit
    threshold = timezone.now() - timedelta(hours=12)
    visits = Visit.objects.filter(
        status=Visit.Status.CHECKED_IN,
        checked_in_at__lte=threshold,
        overnight_notified=False,
    )
    count = 0
    for visit in visits:
        visit.is_overnight = True
        visit.overnight_notified = True
        visit.save(update_fields=['is_overnight', 'overnight_notified'])
        send_overnight_notification(visit)
        count += 1
    return count


def send_late_checkout_alert(visit, late_minutes: int):
    """Send alert when visitor checks out late."""
    admin_email = getattr(settings, 'ADMIN_EMAIL', settings.EMAIL_HOST_USER)
    host_email = None
    if visit.employee_host and visit.employee_host.email:
        host_email = visit.employee_host.email
    elif visit.host and visit.host.email:
        host_email = visit.host.email

    recipients = [r for r in [admin_email, host_email] if r]
    if not recipients:
        return False

    host_name = (visit.employee_host.name if visit.employee_host else
                 visit.host.name if visit.host else visit.host_name_manual or 'N/A')

    try:
        send_mail(
            subject=f"[VMS] LATE CHECKOUT: {visit.visitor.full_name} — {late_minutes} min overdue",
            message=f"""LATE CHECKOUT ALERT

Visitor:        {visit.visitor.full_name}
CNIC:           {visit.visitor.cnic or 'N/A'}
Phone:          {visit.visitor.phone or 'N/A'}
Host:           {host_name}
Expected Out:   {visit.expected_checkout_at.strftime('%d %b %Y, %I:%M %p') if visit.expected_checkout_at else 'N/A'}
Actual Out:     {visit.checked_out_at.strftime('%d %b %Y, %I:%M %p') if visit.checked_out_at else 'N/A'}
Late By:        {late_minutes} minutes

— VMS Automated Alert""",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipients,
            fail_silently=False,
        )
        return True
    except Exception as e:
        logger.error(f"Late checkout alert failed: {e}")
        return False


def send_card_by_email(visit, recipient_email: str):
    """Send visitor card details to visitor's email."""
    host_name = (visit.employee_host.name if visit.employee_host else
                 visit.host.name if visit.host else visit.host_name_manual or 'N/A')
    try:
        send_mail(
            subject=f"[VMS] Your Visitor Pass — {visit.visitor.full_name}",
            message=f"""Dear {visit.visitor.full_name},

Your visitor pass details are below. Please show this at the front desk if required.

━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VISITOR PASS
━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Visiting ID:  {visit.visiting_id or str(visit.id)[:8].upper()}
  Name:         {visit.visitor.full_name}
  CNIC:         {visit.visitor.cnic or 'N/A'}
  Phone:        {visit.visitor.phone or 'N/A'}
  Company:      {visit.visitor.company or 'N/A'}
  Meeting:      {host_name}
  Purpose:      {visit.get_purpose_display() if visit.purpose else visit.purpose_other or 'N/A'}
  Check-in:     {visit.checked_in_at.strftime('%d %b %Y, %I:%M %p') if visit.checked_in_at else 'N/A'}
  Expected Out: {visit.expected_checkout_at.strftime('%I:%M %p') if visit.expected_checkout_at else 'N/A'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠ This pass must be visible at all times during your visit.

— VMS Front Desk""",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            fail_silently=False,
        )
        return True
    except Exception as e:
        logger.error(f"Card email failed: {e}")
        return False
