"""
Custom validators for profile fields
"""
import re
from django.core.exceptions import ValidationError
from django.contrib.auth.password_validation import validate_password as django_validate_password


def validate_email_format(email: str) -> None:
    """
    Validate email format
    
    Args:
        email: Email string to validate
        
    Raises:
        ValidationError: If email format is invalid
    """
    if not email:
        raise ValidationError('Email is required.')
    
    # Basic email regex pattern
    email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(email_pattern, email):
        raise ValidationError('Invalid email format.')


def validate_password_strength(password: str) -> None:
    """
    Validate password strength
    
    Args:
        password: Password string to validate
        
    Raises:
        ValidationError: If password doesn't meet strength requirements
    """
    if not password:
        raise ValidationError('Password is required.')
    
    if len(password) < 8:
        raise ValidationError('Password must be at least 8 characters long.')
    
    if not re.search(r'[A-Z]', password):
        raise ValidationError('Password must contain at least one uppercase letter.')
    
    if not re.search(r'[a-z]', password):
        raise ValidationError('Password must contain at least one lowercase letter.')
    
    if not re.search(r'\d', password):
        raise ValidationError('Password must contain at least one digit.')
    
    # Use Django's built-in password validation
    try:
        django_validate_password(password)
    except ValidationError as e:
        raise ValidationError(e.messages)


def validate_phone_number(phone: str) -> None:
    """
    Validate phone number format (basic validation)
    
    Args:
        phone: Phone number string to validate
        
    Raises:
        ValidationError: If phone format is invalid
    """
    if not phone:
        return  # Phone is optional
    
    # Remove common separators
    cleaned_phone = re.sub(r'[\s\-\(\)]', '', phone)
    
    # Check if it's all digits
    if not cleaned_phone.isdigit():
        raise ValidationError('Phone number must contain only digits and common separators.')
    
    # Check length (between 10 and 15 digits)
    if len(cleaned_phone) < 10 or len(cleaned_phone) > 15:
        raise ValidationError('Phone number must be between 10 and 15 digits.')


def validate_file_size(file, max_size_mb: int = 10) -> None:
    """
    Validate file size
    
    Args:
        file: File object to validate
        max_size_mb: Maximum file size in MB (default: 10MB)
        
    Raises:
        ValidationError: If file exceeds maximum size
    """
    if not file:
        return
    
    max_size_bytes = max_size_mb * 1024 * 1024
    if file.size > max_size_bytes:
        raise ValidationError(f'File size must not exceed {max_size_mb}MB.')


def validate_file_type(file, allowed_types: list) -> None:
    """
    Validate file type
    
    Args:
        file: File object to validate
        allowed_types: List of allowed MIME types or extensions
        
    Raises:
        ValidationError: If file type is not allowed
    """
    if not file:
        return
    
    file_type = file.content_type if hasattr(file, 'content_type') else None
    file_name = file.name if hasattr(file, 'name') else ''
    
    # Check by MIME type
    if file_type:
        if file_type not in allowed_types:
            raise ValidationError(f'File type {file_type} is not allowed. Allowed types: {", ".join(allowed_types)}')
    
    # Check by extension as fallback
    if file_name:
        extension = file_name.split('.')[-1].lower() if '.' in file_name else ''
        allowed_extensions = [ext.replace('image/', '').replace('application/', '') for ext in allowed_types]
        if extension and extension not in allowed_extensions:
            raise ValidationError(f'File extension .{extension} is not allowed. Allowed extensions: {", ".join(allowed_extensions)}')


