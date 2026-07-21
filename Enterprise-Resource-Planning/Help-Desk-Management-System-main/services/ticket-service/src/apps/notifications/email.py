"""
Email notifications for ticket lifecycle events.
All sends are fire-and-forget (threaded) so they never block API responses.
"""
import threading
import logging
from django.core.mail import send_mail
from django.conf import settings
from hdms_core.clients.user_client import UserClient

logger = logging.getLogger(__name__)

FRONTEND_URL = getattr(settings, 'HDMS_FRONTEND_URL', 'http://localhost:3000')


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _send(subject: str, body: str, recipients: list[str]):
    """Fire-and-forget SMTP send."""
    recipients = [r for r in recipients if r]
    if not recipients:
        return

    def _do_send():
        try:
            send_mail(
                subject=subject,
                message=body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=recipients,
                fail_silently=False,
                html_message=_wrap_html(subject, body),
            )
            logger.info(f"Email sent: '{subject}' → {recipients}")
        except Exception as e:
            logger.error(f"Email failed: '{subject}' → {recipients}: {e}")

    threading.Thread(target=_do_send, daemon=True).start()


def _wrap_html(subject: str, plain_body: str) -> str:
    escaped = plain_body.replace('<', '&lt;').replace('>', '&gt;')
    rows_html = ''.join(
        f'<tr><td style="padding:6px 0;color:#6b7280;font-size:13px">{line}</td></tr>'
        if not line.startswith('→') else
        f'<tr><td style="padding:12px 0"><a href="{line[2:].strip()}" style="background:#274C77;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-size:13px">View Ticket</a></td></tr>'
        for line in escaped.splitlines()
    )
    return f"""
    <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;padding:24px">
      <div style="background:linear-gradient(135deg,#274C77,#6096BA);padding:20px 24px;border-radius:10px 10px 0 0">
        <h2 style="color:#fff;margin:0;font-size:18px">HDMS — Help Desk Management System</h2>
      </div>
      <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 10px 10px">
        <h3 style="color:#274C77;margin:0 0 16px">{subject}</h3>
        <table style="width:100%;border-collapse:collapse">{rows_html}</table>
        <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0">
        <p style="color:#9ca3af;font-size:12px;margin:0">
          This is an automated notification from HDMS. Please do not reply to this email.
        </p>
      </div>
    </div>
    """


def _get_info(user_id) -> dict:
    if not user_id:
        return {'name': '', 'email': ''}
    uid = str(user_id)
    # 1. auth_db is source of truth — direct query, no network
    try:
        import psycopg2
        from django.conf import settings
        db = settings.DATABASES['default']
        conn = psycopg2.connect(
            host=db['HOST'], port=int(db.get('PORT', 5432)),
            user=db['USER'], password=db['PASSWORD'],
            dbname='auth_db', connect_timeout=3,
        )
        cur = conn.cursor()
        try:
            cur.execute(
                "SELECT full_name, COALESCE(org_email,''), COALESCE(personal_email,'') FROM employees_employee WHERE id = %s AND is_deleted = false",
                (uid,)
            )
            row = cur.fetchone()
        finally:
            cur.close()
            conn.close()
        if row:
            name, org_email, personal_email = row
            email = org_email or personal_email
            if name or email:
                return {'name': name or '', 'email': email}
    except Exception as e:
        logger.warning(f"auth_db lookup failed for {uid}: {e}")
    # 2. Fallback: local JIT-synced DB
    try:
        from django.contrib.auth import get_user_model
        user = get_user_model().objects.filter(id=uid).first()
        if user and user.email:
            name = ((getattr(user, 'first_name', '') or '') + ' ' + (getattr(user, 'last_name', '') or '')).strip()
            return {'name': name or uid[:8], 'email': user.email}
    except Exception:
        pass
    return {'name': '', 'email': ''}


def _ticket_summary(ticket) -> str:
    return (
        f"  Ticket ID:   {ticket.ticket_id or str(ticket.id)[:8].upper()}\n"
        f"  Subject:     {ticket.title}\n"
        f"  Priority:    {(ticket.priority or '').upper()}\n"
        f"  Status:      {ticket.status}"
    )


# ---------------------------------------------------------------------------
# Public notification functions — one per lifecycle event
# ---------------------------------------------------------------------------

def notify_ticket_submitted(ticket):
    """Requestor confirmation on submit."""
    info = _get_info(ticket.requestor_id)
    if not info['email']:
        return
    url = f"{FRONTEND_URL}/requestor/ticket/{ticket.id}"
    _send(
        subject=f"[{ticket.ticket_id or 'HDMS'}] Your request has been received",
        body=(
            f"Dear {info['name'] or 'Requestor'},\n\n"
            f"Your support request has been submitted successfully.\n\n"
            f"{_ticket_summary(ticket)}\n\n"
            f"You will be notified when it is assigned and progress is made.\n\n"
            f"→ {url}"
        ),
        recipients=[info['email']],
    )


def notify_ticket_assigned(ticket):
    """Assignee gets notified when ticket is assigned to them."""
    if not ticket.assignee_id:
        return
    assignee = _get_info(ticket.assignee_id)
    requestor = _get_info(ticket.requestor_id)
    if not assignee['email']:
        return
    url = f"{FRONTEND_URL}/assignee/ticket/{ticket.id}"
    _send(
        subject=f"[{ticket.ticket_id or 'HDMS'}] A ticket has been assigned to you",
        body=(
            f"Dear {assignee['name'] or 'Assignee'},\n\n"
            f"The following ticket has been assigned to you:\n\n"
            f"{_ticket_summary(ticket)}\n"
            f"  Requestor:   {requestor['name'] or 'N/A'}\n\n"
            f"Please acknowledge the ticket at your earliest convenience.\n\n"
            f"→ {url}"
        ),
        recipients=[assignee['email']],
    )


def notify_ticket_acknowledged(ticket):
    """Requestor gets notified when assignee acknowledges."""
    requestor = _get_info(ticket.requestor_id)
    assignee = _get_info(ticket.assignee_id)
    if not requestor['email']:
        return
    url = f"{FRONTEND_URL}/requestor/ticket/{ticket.id}"
    _send(
        subject=f"[{ticket.ticket_id or 'HDMS'}] Your ticket has been acknowledged",
        body=(
            f"Dear {requestor['name'] or 'Requestor'},\n\n"
            f"Good news — your ticket has been acknowledged by {assignee['name'] or 'the assignee'}.\n\n"
            f"{_ticket_summary(ticket)}\n\n"
            f"Work will begin shortly.\n\n"
            f"→ {url}"
        ),
        recipients=[requestor['email']],
    )


def notify_ticket_in_progress(ticket):
    """Requestor gets notified when work starts."""
    requestor = _get_info(ticket.requestor_id)
    assignee = _get_info(ticket.assignee_id)
    if not requestor['email']:
        return
    url = f"{FRONTEND_URL}/requestor/ticket/{ticket.id}"
    _send(
        subject=f"[{ticket.ticket_id or 'HDMS'}] Work has started on your ticket",
        body=(
            f"Dear {requestor['name'] or 'Requestor'},\n\n"
            f"{assignee['name'] or 'The assignee'} has started working on your ticket.\n\n"
            f"{_ticket_summary(ticket)}\n\n"
            f"→ {url}"
        ),
        recipients=[requestor['email']],
    )



def notify_ticket_resolved(ticket):
    """Requestor gets notified when ticket is resolved."""
    requestor = _get_info(ticket.requestor_id)
    if not requestor['email']:
        return
    url = f"{FRONTEND_URL}/requestor/ticket/{ticket.id}"
    _send(
        subject=f"[{ticket.ticket_id or 'HDMS'}] Your ticket has been resolved",
        body=(
            f"Dear {requestor['name'] or 'Requestor'},\n\n"
            f"Your support request has been marked as resolved.\n\n"
            f"{_ticket_summary(ticket)}\n\n"
            f"If you are satisfied, no action is needed — the ticket will auto-close.\n"
            f"If the issue persists, you can reopen it from the ticket page.\n\n"
            f"→ {url}"
        ),
        recipients=[requestor['email']],
    )


def notify_ticket_rejected(ticket, reason: str = ''):
    """Requestor gets notified when ticket is rejected."""
    requestor = _get_info(ticket.requestor_id)
    if not requestor['email']:
        return
    url = f"{FRONTEND_URL}/requestor/ticket/{ticket.id}"
    reason_line = f"  Reason:      {reason}\n" if reason else ''
    _send(
        subject=f"[{ticket.ticket_id or 'HDMS'}] Your ticket has been rejected",
        body=(
            f"Dear {requestor['name'] or 'Requestor'},\n\n"
            f"Unfortunately, your support request has been rejected.\n\n"
            f"{_ticket_summary(ticket)}\n"
            f"{reason_line}\n"
            f"You may submit a new request if needed.\n\n"
            f"→ {url}"
        ),
        recipients=[requestor['email']],
    )


def notify_ticket_postponed(ticket, reason: str = ''):
    """Requestor + assignee notified when ticket is postponed."""
    requestor = _get_info(ticket.requestor_id)
    assignee = _get_info(ticket.assignee_id) if ticket.assignee_id else {'name': '', 'email': ''}
    reason_line = f"  Reason:      {reason}\n" if reason else ''
    url = f"{FRONTEND_URL}/requestor/ticket/{ticket.id}"

    recipients = [e for e in [requestor['email'], assignee['email']] if e]
    if not recipients:
        return
    _send(
        subject=f"[{ticket.ticket_id or 'HDMS'}] Ticket has been postponed",
        body=(
            f"This is to inform you that the following ticket has been postponed.\n\n"
            f"{_ticket_summary(ticket)}\n"
            f"{reason_line}\n"
            f"→ {url}"
        ),
        recipients=recipients,
    )


def notify_ticket_closed(ticket):
    """Requestor gets notified when ticket is closed."""
    requestor = _get_info(ticket.requestor_id)
    if not requestor['email']:
        return
    url = f"{FRONTEND_URL}/requestor/ticket/{ticket.id}"
    _send(
        subject=f"[{ticket.ticket_id or 'HDMS'}] Ticket closed",
        body=(
            f"Dear {requestor['name'] or 'Requestor'},\n\n"
            f"Your ticket has been closed.\n\n"
            f"{_ticket_summary(ticket)}\n\n"
            f"Thank you for using the Help Desk.\n\n"
            f"→ {url}"
        ),
        recipients=[requestor['email']],
    )
