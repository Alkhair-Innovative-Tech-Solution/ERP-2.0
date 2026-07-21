import logging
import secrets
from datetime import timedelta
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from .models import PasswordResetToken

logger = logging.getLogger(__name__)

class EmailService:
    @staticmethod
    def send_lms_credentials(full_name: str, email: str, password: str, course_name: str = ""):
        """Sends LMS login credentials to the newly registered student"""
        subject = "Your LMS Account is Ready - Al Khair IT Institute"
        course_line = f"Course: {course_name}\n" if course_name else ""
        message = f"""Dear {full_name},

Congratulations! Your LMS account has been successfully created.

Your Login Details:
  Email:    {email}
  Password: {password}
  {course_line}
Login at: {settings.FRONTEND_URL}/login

Once logged in, you will find your enrolled course, schedule, assignments, and attendance records.

If you face any issues logging in, please contact our support team.

Regards,
Al Khair IT Institute
"""
        try:
            send_mail(
                subject,
                message,
                settings.EMAIL_HOST_USER or "noreply@ait.edu.pk",
                [email],
                fail_silently=True,
            )
            logger.info(f"✅ LMS credentials email sent to {email}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to send LMS credentials email to {email}: {str(e)}")
            return False

    @staticmethod
    def send_password_reset_email(user, token):
        """Sends a password reset email to the user"""
        # frontend link
        reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"
        
        subject = "Reset Your Password - Al Khair IT Institute"
        message = f"""
Hi {user.full_name},

You requested a password reset for your Al Khair IT Institute account. 
Click the link below to set a new password:

{reset_link}

This link will expire in 1 hour. If you didn't request this, please ignore this email.

Regards,
Systems Team
Al Khair IT Institute
        """
        
        try:
            send_mail(
                subject,
                message,
                settings.EMAIL_HOST_USER,
                [user.email],
                fail_silently=False,
            )
            logger.info(f"✅ Password reset email sent to {user.email}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to send reset email to {user.email}: {str(e)}")
            return False

class AuthService:
    @staticmethod
    def initiate_password_reset(email):
        """Creates a reset token and sends the email"""
        from users.models import User
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            # We return True even if user doesn't exist to prevent enumeration
            return True

        # Generate secure random token
        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(hours=1)
        
        PasswordResetToken.objects.create(
            user=user,
            token=token,
            expires_at=expires_at
        )
        
        return EmailService.send_password_reset_email(user, token)

    @staticmethod
    def confirm_password_reset(token, new_password):
        """Validates the token and updates the password"""
        try:
            reset_token = PasswordResetToken.objects.get(token=token)
            if not reset_token.is_valid():
                return False, "Token has expired or already been used"
            
            user = reset_token.user
            user.set_password(new_password)
            user.save()
            
            # Mark token as used
            reset_token.used = True
            reset_token.save()
            
            return True, "Password successfully reset"
        except PasswordResetToken.DoesNotExist:
            return False, "Invalid reset token"

import os
from shared.common.service_client import ServiceClient

class UserService:
    @staticmethod
    def get_admission_client():
        return ServiceClient(os.environ.get("ADMISSION_SERVICE_URL", "http://admission-service:8003"))

    @staticmethod
    def get_course_client():
        return ServiceClient(os.environ.get("COURSE_SERVICE_URL", "http://course-service:8002"))

    @staticmethod
    def verify_lead_status(lead_id: str):
        """Checks if a lead has passed the entrance test via admission-service"""
        client = UserService.get_admission_client()
        try:
            response = client.get(f"/api/admission/lead/{lead_id}/status/")
            if response.status_code == 200:
                return response.json(), None
            return None, f"Failed to verify lead: {response.text}"
        except Exception as e:
            logger.error(f"Admission service error: {str(e)}")
            return None, "Admission service unavailable"

    @staticmethod
    def enroll_in_course_service(user_id: str, course_id: str):
        """Calls course-service to enroll a student"""
        client = UserService.get_course_client()
        try:
            # 1. Fetch available scheduled classes
            classes_res = client.get(f"/api/courses/scheduled-classes/?course_id={course_id}")
            scheduled_class_id = None
            if classes_res.status_code == 200:
                classes_data = classes_res.json()
                classes_list = classes_data.get('results', classes_data) if isinstance(classes_data, dict) else classes_data
                if classes_list:
                    scheduled_class_id = classes_list[0].get('id')

            # Try to get from settings or environment
            base_url = getattr(settings, 'FRONTEND_URL', 'https://lms.iak.ngo')

            # 2. Create Enrollment
            enroll_res = client.post("/api/courses/enrollments/", json={
                "student_id": str(user_id),
                "course_id": str(course_id),
                "scheduled_class_id": scheduled_class_id,
                "status": "enrolled"
            })
            return enroll_res.status_code in [200, 201]
        except Exception as e:
            logger.error(f"Course service error: {str(e)}")
            return False

    @staticmethod
    def create_user_with_role(data: dict):
        """
        Handles complex user creation including associated models (Teacher/Student).
        """
        from users.models import User, Teacher, Student
        
        email = data.get('email')
        password = data.get('password')
        full_name = data.get('full_name')
        cnic = data.get('cnic')
        phone = data.get('phone')
        role = str(data.get('role', 'student')).lower()
        
        user = User.objects.create_user(
            full_name=full_name,
            cnic=cnic,
            email=email,
            phone=phone,
            password=password,
            role=role
        )
        
        user.must_change_password = data.get('must_change_password', False)
        user.is_staff = data.get('is_staff', False)
        user.is_admin = data.get('is_admin', False)

        branch_id = data.get('branch_id')
        if branch_id:
            from users.models import Branch
            try:
                user.branch = Branch.objects.get(id=branch_id)
            except Branch.DoesNotExist:
                pass

        # 🔹 Multi-Tenancy: Set organization_id and campus_id
        org_id = data.get('organization_id')
        campus_id = data.get('campus_id')
        if org_id:
            user.organization_id = org_id
        if campus_id:
            user.campus_id = campus_id

        user.save()
        
        if role == 'teacher':
            Teacher.objects.get_or_create(
                user=user,
                defaults={
                    'specialization': data.get('specialization', 'General'),
                    'qualification': data.get('qualification', 'Master'),
                    'experience': data.get('experience', 0),
                    'availability': data.get('availability', {}),
                    'organization_id': user.organization_id,
                    'campus_id': user.campus_id,
                }
            )
        elif role == 'student':
            student, created = Student.objects.get_or_create(
                user=user,
                defaults={
                    'status': data.get('status', 'enrolled'),
                    'completed_courses': [],
                    'eligible_course': data.get('eligible_course', {}),
                    'level': data.get('level', 'Level 1'),
                    'batch': data.get('batch'),
                    'specialization': data.get('specialization'),
                    'whatsapp_number': data.get('whatsapp_number'),
                    'gender': data.get('gender'),
                    'study_work_status': data.get('study_work_status'),
                    'study_work_details': data.get('work_details'),
                    'signature': data.get('signature'),
                    'studied_at_idara': data.get('studied_at_idara', False),
                    'studying_at_idara': data.get('studying_at_idara', False),
                    'student_id': data.get('student_id'),
                    'test_score': data.get('test_score'),
                    'has_paid_deposit': data.get('has_paid_deposit', False),
                    'organization_id': user.organization_id,
                    'campus_id': user.campus_id,
                }
            )
            # Parse and set date_of_birth if provided
            dob_str = data.get('dob') or data.get('date_of_birth')
            if dob_str and created:
                from datetime import datetime as dt
                try:
                    student.date_of_birth = dt.strptime(str(dob_str), '%Y-%m-%d').date()
                    student.save(update_fields=['date_of_birth'])
                except (ValueError, TypeError):
                    pass
            
            # Create/Update associated records with actual data
            from users.models import StudentAcademicRecord, GuardianInfo, ResidentialInfo
            
            # Academic Record
            academic, _ = StudentAcademicRecord.objects.get_or_create(student=student)
            if data.get('last_qualification'):
                academic.highest_qualification = data['last_qualification']
                academic.save()
            
            # Guardian Info
            guardian, _ = GuardianInfo.objects.get_or_create(student=student)
            if data.get('father_name'):
                guardian.father_name = data['father_name']
            
            # Map guardian/emergency fields from various possible input names
            g_name = data.get('guardian_name') or data.get('emergency_contact_name')
            if g_name:
                guardian.emergency_contact_name = g_name
            
            g_contact = data.get('guardian_contact') or data.get('emergency_contact_phone') or data.get('father_phone')
            if g_contact:
                guardian.emergency_contact_phone = g_contact
                guardian.father_phone = g_contact
                
            rel = data.get('relationship') or data.get('relationship_to_student')
            if rel:
                guardian.relationship_to_student = rel
                
            guardian.save()

            # Residential Info
            residential, _ = ResidentialInfo.objects.get_or_create(student=student)
            if data.get('address'):
                residential.address = data['address']
                residential.save()
            
        return user
