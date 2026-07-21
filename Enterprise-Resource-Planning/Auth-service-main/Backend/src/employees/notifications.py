from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def send_employee_code_notification(employee, new_code):
    """
    Sends an email notification to the employee when their code changes.
    """
    subject = f"Your New Employee Code: {new_code}"
    message = f"Hello {employee.full_name},\n\nYour official employee code has been updated.\n\nNew Employee Code: {new_code}\n\nPlease use this code for all official purposes.\n\nBest regards,\nIAK HR Team"
    
    recipient_list = []
    if employee.org_email:
        recipient_list.append(employee.org_email)
    if employee.personal_email:
        recipient_list.append(employee.personal_email)
    
    if not recipient_list:
        logger.warning(f"No email address found for employee {employee.employee_id}. Notification skipped.")
        return False

    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipient_list,
            fail_silently=False,
        )
        logger.info(f"Notification sent to {employee.employee_id} for code {new_code}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {employee.employee_id}: {str(e)}")
        return False
