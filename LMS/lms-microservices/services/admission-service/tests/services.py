import requests
import logging
import time
import uuid
from django.db import models
from django.db.models import Q
from django.conf import settings
from django.utils import timezone
from .models import Test, TestAttempt, Question
from rest_framework_simplejwt.tokens import RefreshToken

logger = logging.getLogger(__name__)

class LMSService:
    @staticmethod
    def create_enrollment(user_id, course_id, attempt_id=None):
        """Calls LMS Service to register user after passing the test"""
        url = f"{settings.LMS_SERVICE_URL}/api/enrollment/external/"
        headers = {
            "Authorization": f"Api-Key {settings.LMS_SERVICE_API_KEY}",
            "Content-Type": "application/json"
        }
        data = {
            "user_id": str(user_id),
            "course_id": str(course_id),
            "source": "admission_test",
            "attempt_id": str(attempt_id) if attempt_id else None
        }

        # Exponential backoff retry logic
        max_retries = 3
        for i in range(max_retries):
            try:
                response = requests.post(url, json=data, headers=headers, timeout=10)
                if response.status_code in [200, 201]:
                    return response.json().get('enrollment_id')
                logger.error(f"LMS Registration Failed: {response.status_code} - {response.text}")
            except requests.exceptions.RequestException as e:
                logger.warning(f"LMS Service Attempt {i+1} failed: {str(e)}")
                time.sleep(2 ** i)
        
        return None
        
class AuthService:
    @staticmethod
    def check_user_exists(email):
        """Checks if user exists in Auth Service"""
        url = f"{settings.AUTH_SERVICE_URL}/api/auth/check-email-exists/"
        try:
            # Try to connect to auth service
            logger.info(f"🔍 Checking User Existence: {url} | Email: {email}")
            headers = {"Content-Type": "application/json"}
            # Use short timeout to avoid hanging if service is down
            response = requests.post(url, json={"email": email}, headers=headers, timeout=5)
            
            logger.info(f"Response Status: {response.status_code} | Body: {response.text}")
            
            if response.status_code == 200:
                exists = response.json().get('exists', False)
                logger.info(f"User Exists Result: {exists}")
                return exists
            else:
                logger.error(f"Auth Service Non-200: {response.status_code}")
                
        except Exception as e:
            logger.error(f"Error checking auth service for user existence: {e} | URL: {url}")
            # If service is down, assume false so we don't block lead lookup
            return False
        return False

from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags

class EmailService:
    @staticmethod
    def send_registration_confirmation(lead_name, lead_email):
        """Sends a confirmation email after the student submits the registration form"""
        subject = "Registration Received - Al Khair IT Institute"
        message = f"""Dear {lead_name},

Thank you for registering at Al Khair IT Institute!

We have received your application. You will now be directed to the entrance test.
Please complete the test to proceed with your admission.

If you face any issues, feel free to contact us.

Regards,
Admissions Team
Al Khair IT Institute
"""
        try:
            from django.core.mail import send_mail
            from django.conf import settings
            send_mail(
                subject, message,
                settings.EMAIL_HOST_USER or "noreply@ait.edu.pk",
                [lead_email], fail_silently=True,
            )
            logger.info(f"✅ Registration confirmation sent to {lead_email}")
        except Exception as e:
            logger.error(f"❌ Failed to send registration confirmation to {lead_email}: {str(e)}")

    @staticmethod
    def send_deposit_instructions(lead_name, lead_email, course_name="your selected course"):
        """Sends an email with deposit instructions to the qualified lead"""
        subject = f"Next Steps for your Admission - Al Khair IT Institute"
        
        context = {
            'name': lead_name,
            'course_name': course_name,
        }
        
        # We can use a template if we want, but for now a simple string is fine
        message = f"""
Dear {lead_name},

Congratulations! You have successfully qualified for admission in {course_name} at Al Khair IT Institute.

To complete your enrollment process, please follow these steps:

1. Pay the security deposit at our main office.
2. Receive your official deposit slip with a unique verification code from our admin staff.
3. Visit our website and enter your deposit slip code in the registration portal to activate your account.
4. Once verified, your LMS account will be created automatically and credentials will be sent to you.

Office Address: Al Khair IT Institute, Main Branch.
Office Hours: 9:00 AM - 6:00 PM (Monday to Saturday)

If you have any questions, please feel free to contact us.

Regards,
Admissions Team
Al Khair IT Institute
        """
        
        try:
            send_mail(
                subject,
                message,
                settings.EMAIL_HOST_USER,
                [lead_email],
                fail_silently=False,
            )
            logger.info(f"✅ Deposit instructions sent to {lead_email}")
            return True
        except Exception as e:
            logger.error(f"❌ Failed to send email to {lead_email}: {str(e)}")
            return False

class TestService:
    @staticmethod
    def check_test_requirement(course_id, specialization_id=None):
        """Checks if a test exists and is required for the given course/spec"""
        query = Q(course_id=course_id)
        if specialization_id:
            query |= Q(specialization_id=specialization_id)
        
        return Test.objects.filter(query, is_required=True).first()

    @staticmethod
    def generate_test_token(user_id, user_email, test_id):
        """Generates a JWT token forced to this specific test session"""
        test = Test.objects.get(id=test_id)
        
        # Check for existing ongoing attempts
        existing_attempt = TestAttempt.objects.filter(
            user_id=user_id, test=test, status='ongoing'
        ).first()
        
        if existing_attempt:
            # Check if expired
            elapsed = timezone.now() - existing_attempt.start_time
            if elapsed.total_seconds() > (test.duration * 60):
                existing_attempt.status = 'expired'
                existing_attempt.save()
            else:
                attempt = existing_attempt
        else:
            # Create new attempt
            prev_attempts = TestAttempt.objects.filter(user_id=user_id, test=test).count()
            if prev_attempts >= 3: # Limit to 3 attempts
                raise ValueError("Maximum attempts reached for this test.")
                
            attempt = TestAttempt.objects.create(
                user_id=user_id,
                user_email=user_email,
                test=test,
                attempt_number=prev_attempts + 1
            )

        # Generate Custom JWT
        refresh = RefreshToken.for_user(type('User', (), {'id': user_id, 'is_active': True})())
        refresh['user_id'] = str(user_id)
        refresh['user_email'] = user_email
        refresh['test_id'] = str(test_id)
        refresh['attempt_id'] = str(attempt.id)
        
        return str(refresh.access_token), attempt.id

    @staticmethod
    def check_attempt_validity(attempt_id):
        """Validates if the session is still active and not timed out"""
        try:
            attempt = TestAttempt.objects.get(id=attempt_id)
        except TestAttempt.DoesNotExist:
            return False, "Attempt not found"

        if attempt.status != 'ongoing':
            return False, f"Test is already {attempt.status}"

        # Duration check
        elapsed = timezone.now() - attempt.start_time
        if elapsed.total_seconds() > (attempt.test.duration * 60):
            attempt.status = 'expired'
            attempt.save()
            return False, "Test session expired"

        return True, None

    @staticmethod
    def calculate_score(attempt_id, answers):
        """Scores the test and triggers enrollment if passed"""
        attempt = TestAttempt.objects.get(id=attempt_id)
        questions = attempt.test.questions.all()
        
        total_score = 0
        total_marks = attempt.test.total_marks
        
        for q in questions:
            user_ans = answers.get(str(q.id))
            if not user_ans:
                continue
            if q.question_type == 'multiple_choice':
                expected = q.correct_answers or q.correct_answer
                expected_set = set(expected.upper().split(','))
                actual_set = set(str(user_ans).upper().split(','))
                if actual_set == expected_set:
                    total_score += q.marks
            else:
                if str(user_ans).upper() == q.correct_answer.upper():
                    total_score += q.marks
        
        percentage = (total_score / total_marks) * 100 if total_marks > 0 else 0
        is_passed = total_score >= attempt.test.passing_marks
        
        attempt.score = total_score
        attempt.percentage = percentage
        attempt.is_passed = is_passed
        attempt.status = 'completed'
        attempt.end_time = timezone.now()
        attempt.answers = answers
        
        if is_passed:
            attempt.enrollment_status = 'pending'
            attempt.save()
            
            enrollment_id = LMSService.create_enrollment(
                attempt.user_id, attempt.test.course_id, attempt.id
            )
            
            if enrollment_id:
                attempt.enrollment_status = 'success'
                attempt.lms_enrollment_id = enrollment_id
            else:
                attempt.enrollment_status = 'failed'
        else:
            attempt.enrollment_status = 'none'
            
        attempt.save()

        return total_score, percentage, is_passed, attempt.lms_enrollment_id
