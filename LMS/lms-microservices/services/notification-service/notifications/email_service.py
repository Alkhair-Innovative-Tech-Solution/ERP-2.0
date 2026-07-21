"""
Email notification service for sending transactional emails.
"""
import os
import logging
from typing import Optional, Dict, Any
from django.core.mail import send_mail, EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending transactional emails."""

    def __init__(self):
        self.default_from = os.environ.get(
            'DEFAULT_FROM_EMAIL',
            getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@lms.example.com')
        )
        self.frontend_url = os.environ.get(
            'FRONTEND_URL',
            getattr(settings, 'FRONTEND_URL', 'http://localhost:3001')
        )

    def send_welcome_email(self, user_email: str, user_name: str, course_name: str) -> bool:
        """Send welcome email after course enrollment."""
        subject = f"Welcome to {course_name} - Enrollment Confirmed"
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Welcome to {course_name}!</h2>
            <p>Hi {user_name},</p>
            <p>Congratulations! You have been successfully enrolled in <strong>{course_name}</strong>.</p>
            <p>You can now access your course materials and start learning.</p>
            <p>
                <a href="{self.frontend_url}/student/my-courses/" 
                   style="background: #2563eb; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; display: inline-block;">
                    Go to My Courses
                </a>
            </p>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
                If you have any questions, please contact your coordinator.
            </p>
        </div>
        """
        return self._send_email(subject, html_content, [user_email])

    def send_grade_notification(self, user_email: str, user_name: str, 
                                 assignment_title: str, grade: int, 
                                 total_marks: int, feedback: str = None) -> bool:
        """Send grade notification after assignment is graded."""
        percentage = round((grade / total_marks) * 100) if total_marks > 0 else 0
        subject = f"Assignment Graded: {assignment_title}"
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Assignment Graded</h2>
            <p>Hi {user_name},</p>
            <p>Your assignment <strong>{assignment_title}</strong> has been graded.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Score:</strong> {grade} / {total_marks} ({percentage}%)</p>
            </div>
            {f'<p><strong>Feedback:</strong> {feedback}</p>' if feedback else ''}
            <p>
                <a href="{self.frontend_url}/student/assignments/" 
                   style="background: #2563eb; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; display: inline-block;">
                    View Assignments
                </a>
            </p>
        </div>
        """
        return self._send_email(subject, html_content, [user_email])

    def send_assignment_notification(self, user_email: str, user_name: str,
                                      assignment_title: str, course_name: str,
                                      due_date: str) -> bool:
        """Send notification when a new assignment is created."""
        subject = f"New Assignment: {assignment_title}"
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">New Assignment</h2>
            <p>Hi {user_name},</p>
            <p>A new assignment has been posted in <strong>{course_name}</strong>.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Assignment:</strong> {assignment_title}</p>
                <p style="margin: 5px 0;"><strong>Due Date:</strong> {due_date}</p>
            </div>
            <p>
                <a href="{self.frontend_url}/student/assignments/" 
                   style="background: #2563eb; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; display: inline-block;">
                    View Assignment
                </a>
            </p>
        </div>
        """
        return self._send_email(subject, html_content, [user_email])

    def send_certificate_notification(self, user_email: str, user_name: str,
                                       course_name: str, certificate_number: str) -> bool:
        """Send notification when certificate is ready."""
        subject = f"Certificate Ready: {course_name}"
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #16a34a;">Certificate Ready!</h2>
            <p>Hi {user_name},</p>
            <p>Congratulations! Your certificate for <strong>{course_name}</strong> is ready.</p>
            <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #bbf7d0;">
                <p style="margin: 5px 0;"><strong>Certificate Number:</strong> {certificate_number}</p>
            </div>
            <p>
                <a href="{self.frontend_url}/student/certificates/" 
                   style="background: #16a34a; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; display: inline-block;">
                    Download Certificate
                </a>
            </p>
        </div>
        """
        return self._send_email(subject, html_content, [user_email])

    def send_password_reset_email(self, user_email: str, user_name: str, 
                                    reset_link: str) -> bool:
        """Send password reset email."""
        subject = "Password Reset Request"
        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2563eb;">Password Reset</h2>
            <p>Hi {user_name},</p>
            <p>You requested a password reset. Click the button below to set a new password.</p>
            <p>
                <a href="{reset_link}" 
                   style="background: #2563eb; color: white; padding: 12px 24px; 
                          text-decoration: none; border-radius: 6px; display: inline-block;">
                    Reset Password
                </a>
            </p>
            <p style="color: #666; font-size: 12px;">
                This link expires in 1 hour. If you didn't request this, please ignore this email.
            </p>
        </div>
        """
        return self._send_email(subject, html_content, [user_email])

    def send_bulk_notification(self, recipients: list, subject: str, 
                                 html_content: str) -> Dict[str, Any]:
        """Send email to multiple recipients."""
        success_count = 0
        fail_count = 0
        
        for email in recipients:
            try:
                if self._send_email(subject, html_content, [email]):
                    success_count += 1
                else:
                    fail_count += 1
            except Exception as e:
                logger.error(f"Failed to send email to {email}: {e}")
                fail_count += 1
        
        return {
            "success": success_count,
            "failed": fail_count,
            "total": len(recipients),
        }

    def _send_email(self, subject: str, html_content: str, 
                     recipient_list: list, from_email: str = None) -> bool:
        """Internal method to send email."""
        try:
            from_email = from_email or self.default_from
            text_content = strip_tags(html_content)
            
            email = EmailMultiAlternatives(
                subject=subject,
                body=text_content,
                from_email=from_email,
                to=recipient_list,
            )
            email.attach_alternative(html_content, "text/html")
            email.send(fail_silently=False)
            
            logger.info(f"Email sent: {subject} to {recipient_list}")
            return True
            
        except Exception as e:
            logger.error(f"Email send failed: {e}", exc_info=True)
            return False


# Singleton instance
email_service = EmailService()
