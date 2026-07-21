"""
Utilities for user onboarding and credential management
"""
import random
import string
from typing import Tuple


def generate_username(email: str, first_name: str = '') -> str:
    """
    Generate username from email or name
    
    Args:
        email: User's email address
        first_name: User's first name (optional)
        
    Returns:
        Generated username
    """
    if email:
        # Use part before @ as username
        username = email.split('@')[0]
        # Remove special characters
        username = ''.join(c for c in username if c.isalnum() or c in '._-')
        return username.lower()
    elif first_name:
        return first_name.lower().replace(' ', '_')
    else:
        # Fallback: random username
        return f"user_{random.randint(1000, 9999)}"


def generate_password(first_name: str = '', length: int = 8) -> str:
    """
    Generate a secure but memorable password
    
    Format: FirstName + 4 random digits + special char
    Example: Alice1234!
    
    Args:
        first_name: User's first name for personalization
        length: Minimum password length (default: 8)
        
    Returns:
        Generated password
    """
    if first_name:
        # Use first name + random digits + special char
        name_part = first_name.capitalize()
        digits = ''.join(random.choices(string.digits, k=4))
        special = random.choice('!@#$%')
        password = f"{name_part}{digits}{special}"
    else:
        # Generate random password with mix of characters
        chars = string.ascii_letters + string.digits + '!@#$%'
        password = ''.join(random.choices(chars, k=max(length, 8)))
        # Ensure it has at least one of each type
        if not any(c.isupper() for c in password):
            password = password[0].upper() + password[1:]
        if not any(c.isdigit() for c in password):
            password = password[:-1] + str(random.randint(0, 9))
        if not any(c in '!@#$%' for c in password):
            password = password + '!'
    
    return password


def generate_credentials(email: str, first_name: str = '', last_name: str = '') -> Tuple[str, str]:
    """
    Generate both username and password
    
    Args:
        email: User's email
        first_name: User's first name
        last_name: User's last name
        
    Returns:
        Tuple of (username, password)
    """
    username = generate_username(email, first_name)
    password = generate_password(first_name)
    
    return username, password


def format_credentials_text(username: str, password: str, email: str, role: str = 'User') -> str:
    """
    Format credentials for display or email
    
    Args:
        username: Generated username
        password: Generated password
        email: User's email
        role: User's role
        
    Returns:
        Formatted credentials text
    """
    return f"""
═══════════════════════════════════════
    LMS LOGIN CREDENTIALS - {role.upper()}
═══════════════════════════════════════

Email:    {email}
Username: {username}
Password: {password}

Login URL: http://10.0.8.141:8000/api/auth/login/

IMPORTANT:
- Please change your password after first login
- Complete your profile after logging in
- Keep these credentials secure

═══════════════════════════════════════
    """


def create_credentials_csv_row(username: str, password: str, email: str, first_name: str, last_name: str, role: str) -> dict:
    """
    Create a dictionary for CSV export
    
    Args:
        username: Username
        password: Password
        email: Email
        first_name: First name
        last_name: Last name
        role: User role
        
    Returns:
        Dictionary with credential data
    """
    return {
        'Email': email,
        'Username': username,
        'Password': password,
        'First Name': first_name,
        'Last Name': last_name,
        'Role': role,
    }
