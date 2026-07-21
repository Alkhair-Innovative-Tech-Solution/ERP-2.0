"""
Business logic layer for profiles app
Separates business logic from views
"""
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import transaction
from .models import StudentProfile, TeacherProfile, CoordinatorProfile, AdminProfile
from .utils.validators import validate_email_format, validate_password_strength, validate_phone_number
from .exceptions import ValidationError as ProfileValidationError, ConflictError
import logging

User = get_user_model()
logger = logging.getLogger(__name__)


class UserService:
    """Service for user-related business logic"""
    
    @staticmethod
    @transaction.atomic
    def create_student_profile(
        username: str,
        email: str,
        password: str,
        first_name: str = '',
        last_name: str = '',
        phone: str = '',
        **kwargs
    ) -> StudentProfile:
        """
        Create a student profile with validation
        
        Args:
            username: Unique username
            email: Valid email address
            password: Strong password
            first_name: First name (optional)
            last_name: Last name (optional)
            phone: Phone number (optional)
            **kwargs: Additional student-specific fields
            
        Returns:
            Created StudentProfile instance
            
        Raises:
            ProfileValidationError: If validation fails
            ConflictError: If username/email already exists
        """
        # Validate inputs
        try:
            validate_email_format(email)
            validate_password_strength(password)
            if phone:
                validate_phone_number(phone)
        except ValidationError as e:
            raise ProfileValidationError(str(e))
        
        # Check for existing user
        if User.objects.filter(username=username).exists():
            raise ConflictError(f'Username "{username}" already exists.')
        
        if User. objects.filter(email=email).exists():
            raise ConflictError(f'Email "{email}" already exists.')
        
        # Create User FIRST with properly hashed password
        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,  # Django hashes this automatically
                first_name=first_name,
                last_name=last_name,
                is_active=True,
            )
            
            # Then create Profile linked to User (NO password field)
            profile = StudentProfile.objects.create(
                user=user,
                username=username,
                email=email,
                # password REMOVED - not stored in profile
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                **kwargs
            )
            
            logger.info(f"Created student user and profile: {username} (ID: {profile.student_id})")
            return profile
        except Exception as e:
            logger.error(f"Error creating student profile: {e}", exc_info=True)
            raise ProfileValidationError(f'Failed to create student profile: {str(e)}')
    
    @staticmethod
    @transaction.atomic
    def create_teacher_profile(
        username: str,
        email: str,
        password: str,
        first_name: str = '',
        last_name: str = '',
        phone: str = '',
        department: str = '',
        designation: str = '',
        qualification: str = '',
        experience_years: int = None,
        **kwargs
    ) -> TeacherProfile:
        """
        Create a teacher profile with validation
        
        Args:
            username: Unique username
            email: Valid email address
            password: Strong password
            first_name: First name (optional)
            last_name: Last name (optional)
            phone: Phone number (optional)
            department: Department name (optional)
            designation: Designation (optional)
            qualification: Qualification (optional)
            experience_years: Years of experience (optional)
            **kwargs: Additional teacher-specific fields
            
        Returns:
            Created TeacherProfile instance
            
        Raises:
            ProfileValidationError: If validation fails
            ConflictError: If username/email already exists
        """
        # Validate inputs
        try:
            validate_email_format(email)
            validate_password_strength(password)
            if phone:
                validate_phone_number(phone)
        except ValidationError as e:
            raise ProfileValidationError(str(e))
        
        # Check for existing user
        if User.objects.filter(username=username).exists():
            raise ConflictError(f'Username "{username}" already exists.')
        
        if User.objects.filter(email=email).exists():
            raise ConflictError(f'Email "{email}" already exists.')
        
        # Create User FIRST with properly hashed password
        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,  # Django hashes this automatically
                first_name=first_name,
                last_name=last_name,
                is_staff=True,  # Teachers are staff
                is_active=True,
            )
            
            # Then create Profile linked to User (NO password field)
            profile = TeacherProfile.objects.create(
                user=user,
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                department=department,
                designation=designation,
                qualification=qualification,
                experience_years=experience_years,
                **kwargs
            )
            
            logger.info(f"Created teacher user and profile: {username} (ID: {profile.teacher_id})")
            return profile
        except Exception as e:
            logger.error(f"Error creating teacher profile: {e}", exc_info=True)
            raise ProfileValidationError(f'Failed to create teacher profile: {str(e)}')
    
    @staticmethod
    @transaction.atomic
    def create_coordinator_profile(
        username: str,
        email: str,
        password: str,
        first_name: str = '',
        last_name: str = '',
        phone: str = '',
        department: str = '',
        designation: str = '',
        **kwargs
    ) -> CoordinatorProfile:
        """
        Create a coordinator profile with validation
        
        Args:
            username: Unique username
            email: Valid email address
            password: Strong password
            first_name: First name (optional)
            last_name: Last name (optional)
            phone: Phone number (optional)
            department: Department name (optional)
            designation: Designation (optional)
            **kwargs: Additional coordinator-specific fields
            
        Returns:
            Created CoordinatorProfile instance
            
        Raises:
            ProfileValidationError: If validation fails
            ConflictError: If username/email already exists
        """
        # Validate inputs
        try:
            validate_email_format(email)
            validate_password_strength(password)
            if phone:
                validate_phone_number(phone)
        except ValidationError as e:
            raise ProfileValidationError(str(e))
        
        # Check for existing user
        if User.objects.filter(username=username).exists():
            raise ConflictError(f'Username "{username}" already exists.')
        
        if User.objects.filter(email=email).exists():
            raise ConflictError(f'Email "{email}" already exists.')
        
        # Create User FIRST with properly hashed password
        try:
            user = User.objects.create_user(
                username=username,
                email=email,
                password=password,  # Django hashes this automatically
                first_name=first_name,
                last_name=last_name,
                is_staff=True,  # Coordinators are staff
                is_active=True,
            )
            
            # Then create Profile linked to User (NO password field)
            profile = CoordinatorProfile.objects.create(
                user=user,
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                department=department,
                designation=designation,
                **kwargs
            )
            
            logger.info(f"Created coordinator user and profile: {username} (ID: {profile.coordinator_id})")
            return profile
        except Exception as e:
            logger.error(f"Error creating coordinator profile: {e}", exc_info=True)
            raise ProfileValidationError(f'Failed to create coordinator profile: {str(e)}')
    
    @staticmethod
    @transaction.atomic
    def create_admin_profile(
        username: str,
        email: str,
        password: str,
        first_name: str = '',
        last_name: str = '',
        phone: str = '',
        designation: str = '',
        **kwargs
    ) -> AdminProfile:
        """
        Create an admin profile with validation
        
        Args:
            username: Unique username
            email: Valid email address
            password: Strong password
            first_name: First name (optional)
            last_name: Last name (optional)
            phone: Phone number (optional)
            designation: Designation (optional)
            **kwargs: Additional admin-specific fields
            
        Returns:
            Created AdminProfile instance
            
        Raises:
            ProfileValidationError: If validation fails
            ConflictError: If username/email already exists
        """
        # Validate inputs
        try:
            validate_email_format(email)
            validate_password_strength(password)
            if phone:
                validate_phone_number(phone)
        except ValidationError as e:
            raise ProfileValidationError(str(e))
        
        # Check for existing user
        if User.objects.filter(username=username).exists():
            raise ConflictError(f'Username "{username}" already exists.')
        
        if User.objects.filter(email=email).exists():
            raise ConflictError(f'Email "{email}" already exists.')
        
        # Create User FIRST with properly hashed password
        try:
            user = User.objects.create_superuser(
                username=username,
                email=email,
                password=password,  # Django hashes this automatically
                first_name=first_name,
                last_name=last_name,
            )
            
            # Then create Profile linked to User (NO password field)
            profile = AdminProfile.objects.create(
                user=user,
                username=username,
                email=email,
                first_name=first_name,
                last_name=last_name,
                phone=phone,
                designation=designation,
                **kwargs
            )
            
            logger.info(f"Created admin user and profile: {username} (ID: {profile.admin_id})")
            return profile
        except Exception as e:
            logger.error(f"Error creating admin profile: {e}", exc_info=True)
            raise ProfileValidationError(f'Failed to create admin profile: {str(e)}')


