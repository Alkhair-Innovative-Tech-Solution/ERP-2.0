"""
Business logic layer for certifications
"""
import os
import uuid
import logging
from datetime import datetime
from django.db import transaction
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from .models import Certification
from .utils.certificate_generator import CertificateGenerator
from .utils.qr_generator import QRCodeGenerator
from shared.common.service_client import ServiceClient

logger = logging.getLogger(__name__)


class CertificateService:
    """Service for certificate generation and management"""
    
    def __init__(self):
        self.cert_generator = CertificateGenerator()
        self.qr_generator = QRCodeGenerator()
        self.auth_service_url = os.getenv('AUTH_SERVICE_URL', 'http://auth-service:8001')
        self.course_service_url = os.getenv('COURSE_SERVICE_URL', 'http://course-service:8002')
        self.frontend_url = os.getenv('FRONTEND_URL', 'https://lms.iak.ngo')
        self.institution_name = os.getenv('INSTITUTION_NAME', 'AIT Institute')
    
    def _fetch_student_data(self, student_id: str) -> dict:
        """Fetch student data from auth-service"""
        try:
            client = ServiceClient(base_url=self.auth_service_url, timeout=5)
            response = client.post(
                '/api/auth/users/bulk/',
                json={'ids': [student_id]},
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                users = response.json()
                if users and len(users) > 0:
                    user = users[0]
                    return {
                        'name': user.get('full_name') or user.get('email') or f'Student {student_id}',
                        'email': user.get('email', ''),
                        'cnic': user.get('cnic', ''),
                        'father_name': user.get('father_name', ''),
                        'student_id': user.get('student_id', ''),
                        'batch': user.get('batch', ''),
                        'specialization': user.get('specialization', ''),
                    }
            
            logger.warning(f"Student {student_id} not found in auth-service, status={response.status_code}")
            return {
                'name': f'Student {student_id}',
                'email': '',
                'cnic': '',
                'father_name': '',
                'student_id': '',
                'batch': '',
                'specialization': '',
            }
        except Exception as e:
            logger.error(f"Error fetching student data: {e}", exc_info=True)
            return {
                'name': f'Student {student_id}',
                'email': '',
                'cnic': '',
                'father_name': '',
                'student_id': '',
                'batch': '',
                'specialization': '',
            }
            
            logger.warning(f"Student {student_id} not found in auth-service")
            return {
                'name': f'Student {student_id}',
                'first_name': '',
                'last_name': '',
                'username': '',
                'email': '',
            }
        except Exception as e:
            logger.error(f"Error fetching student data: {e}", exc_info=True)
            return {
                'name': f'Student {student_id}',
                'first_name': '',
                'last_name': '',
                'username': '',
                'email': '',
            }
    
    def _fetch_course_data(self, course_id: str) -> dict:
        """Fetch course data from course-service"""
        try:
            client = ServiceClient(base_url=self.course_service_url, timeout=5)
            response = client.get(f'/api/courses/courses/{course_id}/')
            
            if response.status_code == 200:
                course = response.json()
                return {
                    'title': course.get('name') or course.get('title') or 'Unknown Course',
                    'code': course.get('course_code', 'N/A'),
                    'description': course.get('description', ''),
                }
            
            logger.warning(f"Course {course_id} not found in course-service")
            return {
                'title': 'Unknown Course',
                'code': 'N/A',
                'description': '',
            }
        except Exception as e:
            logger.error(f"Error fetching course data: {e}", exc_info=True)
            return {
                'title': 'Unknown Course',
                'code': 'N/A',
                'description': '',
            }
    
    def _fetch_enrollment_data(self, enrollment_id: str) -> dict:
        """Fetch enrollment data from course-service"""
        try:
            client = ServiceClient(base_url=self.course_service_url, timeout=5)
            response = client.get(f'/api/courses/enrollments/{enrollment_id}/')
            
            if response.status_code == 200:
                enrollment = response.json()
                return {
                    'progress': enrollment.get('progress', 0),
                    'grade': enrollment.get('progress', 0),  # Use progress as grade
                    'completed_at': enrollment.get('completed_at'),
                }
            
            logger.warning(f"Enrollment {enrollment_id} not found")
            return {
                'progress': 0,
                'grade': 0,
                'completed_at': None,
            }
        except Exception as e:
            logger.error(f"Error fetching enrollment data: {e}", exc_info=True)
            return {
                'progress': 0,
                'grade': 0,
                'completed_at': None,
            }
    
    def _generate_certificate_number(self) -> str:
        """Generate unique certificate number"""
        year = datetime.now().year
        # Format: CERT-YYYY-XXXXX
        # Get count of certificates this year
        count = Certification.objects.filter(
            issued_date__year=year
        ).count()
        cert_num = f"CERT-{year}-{str(count + 1).zfill(5)}"
        return cert_num
    
    def _generate_verification_code(self) -> str:
        """Generate unique verification code"""
        return str(uuid.uuid4())
    
    @transaction.atomic
    def generate_certificate(
        self,
        student_id: str,
        course_id: str,
        enrollment_id: str = None,
        grade: float = None,
        percentile: int = None,
        organization_id: str = None
    ) -> Certification:
        """
        Generate certificate for completed course
        
        Args:
            student_id: Student ID from auth-service
            course_id: Course UUID from course-service
            enrollment_id: Enrollment UUID (optional)
            grade: Grade/percentage (optional, will fetch from enrollment if not provided)
            percentile: Percentile rank (optional)
            
        Returns:
            Created Certification instance
            
        Raises:
            ValueError: If certificate already exists
        """
        # Check if certificate already exists
        existing = Certification.objects.filter(
            student_id=student_id,
            course_id=course_id
        ).first()
        
        if existing:
            logger.info(f"Certificate already exists for student {student_id}, course {course_id}")
            return existing
        
        # Fetch data from other services
        student_data = self._fetch_student_data(student_id)
        course_data = self._fetch_course_data(course_id)
        
        # Fetch enrollment data if enrollment_id provided
        if enrollment_id:
            enrollment_data = self._fetch_enrollment_data(enrollment_id)
            if grade is None:
                grade = float(enrollment_data.get('grade', 0))
        elif grade is None:
            grade = 0.0
        
        # Generate certificate number and verification code
        certificate_number = self._generate_certificate_number()
        verification_code = self._generate_verification_code()
        
        # Generate QR code
        qr_buffer = self.qr_generator.generate(
            verification_code,
            base_url=self.frontend_url
        )
        
        # Save QR code to file
        qr_filename = f"qrcodes/{verification_code}.png"
        qr_file = default_storage.save(qr_filename, ContentFile(qr_buffer.read()))
        qr_path = default_storage.path(qr_file)
        
        # Generate PDF certificate
        pdf_buffer = self.cert_generator.generate(
            student_name=student_data['name'],
            student_id=student_data['student_id'],
            student_email=student_data['email'],
            student_cnic=student_data['cnic'],
            father_name=student_data['father_name'],
            batch=student_data['batch'],
            specialization=student_data['specialization'],
            course_title=course_data['title'],
            course_code=course_data['code'],
            grade=grade,
            institution_name=self.institution_name,
            certificate_number=certificate_number,
            verification_code=verification_code,
            issued_date=datetime.now(),
            qr_code_path=qr_path,
            percentile=percentile
        )
        
        # Save PDF to file
        pdf_filename = f"certificates/{certificate_number}.pdf"
        pdf_file = default_storage.save(pdf_filename, ContentFile(pdf_buffer.read()))
        
        # Create certification record
        certification = Certification.objects.create(
            student_id=student_id,
            course_id=course_id,
            enrollment_id=enrollment_id,
            certificate_number=certificate_number,
            verification_code=verification_code,
            student_name=student_data['name'],
            course_title=course_data['title'],
            course_code=course_data['code'],
            grade=grade,
            percentile=percentile,
            institution_name=self.institution_name,
            certificate_pdf=pdf_file,
            qr_code=qr_file,
            organization_id=organization_id
        )
        
        logger.info(
            f"Generated certificate {certificate_number} for student {student_id}, "
            f"course {course_data['code']}"
        )
        
        return certification
    
    def get_student_certificates(self, student_id: str) -> list:
        """Get all certificates for a student"""
        return list(Certification.objects.filter(student_id=student_id))
    
    def verify_certificate(
        self,
        verification_code: str = None,
        student_id: str = None,
        course_code: str = None
    ) -> Certification:
        """
        Verify certificate by verification code or student_id + course_code
        
        Args:
            verification_code: Verification code
            student_id: Student ID
            course_code: Course code
            
        Returns:
            Certification instance if found
            
        Raises:
            Certification.DoesNotExist: If certificate not found
        """
        if verification_code:
            return Certification.objects.get(verification_code=verification_code)
        elif student_id and course_code:
            return Certification.objects.get(
                student_id=student_id,
                course_code=course_code
            )
        else:
            raise ValueError("Either verification_code or (student_id + course_code) must be provided")

