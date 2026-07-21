import os
import sys
from django.conf import settings
from shared.common.jwt_utils import decode_token

class SimpleUser:
    """A simple user class for services without User table"""
    def __init__(self, user_id, email, role, username=None):
        self.id = user_id
        self.pk = user_id
        self.username = username or email
        self.email = email
        self.role = str(role or 'STUDENT').upper()
        self.is_authenticated = True
        self.is_active = True
        self.is_staff = self.role == 'ADMIN'
        self.is_superuser = self.role == 'ADMIN'

    def __str__(self):
        return self.email or "User"

class JWTAuthentication:
    """JWT Authentication for all microservices."""
    def __call__(self, request):
        return self.authenticate(request)

    def authenticate(self, request):
        from rest_framework import exceptions
        from django.contrib.auth import get_user_model
        
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None

        try:
            prefix, token = auth_header.split()
            if prefix.lower() != 'bearer': return None
        except ValueError: return None

        secret_key = getattr(settings, 'JWT_SECRET_KEY', 'your-secret-key-change-in-production')
        payload = decode_token(token, secret_key=secret_key)
        
        if not payload:
            raise exceptions.AuthenticationFailed('Invalid or expired token')

        user_id = payload.get('user_id') or payload.get('id') or payload.get('sub')
        email = payload.get('email', '')
        # Robust role detection
        role = payload.get('role', payload.get('roles'))
        
        # Hard fallback for Admin user
        if not role:
            if 'admin@ait.edu' in email or payload.get('is_superuser') or payload.get('is_staff'):
                role = 'ADMIN'
            else:
                role = 'STUDENT'
        
        # Super-hard fallback: if email contains admin, it MUST be admin
        if 'admin' in email.lower() and role != 'ADMIN':
            role = 'ADMIN'

        try:
            # Check if we are in Auth Service
            if 'users' in settings.INSTALLED_APPS and 'profiles' not in settings.INSTALLED_APPS:
                User = get_user_model()
                user = User.objects.get(id=user_id)
            else:
                user = SimpleUser(user_id, email, role)
        except Exception:
            user = SimpleUser(user_id, email, role)

        return user

def roles_required(allowed_roles):
    from functools import wraps
    from ninja.errors import HttpError

    def decorator(func):
        @wraps(func)
        def wrapper(request, *args, **kwargs):
            if not hasattr(request, 'auth') or not request.auth:
                raise HttpError(401, "Unauthorized: No token provided")
            
            # request.auth is the User object returned by JWTAuthentication
            user = request.auth
            user_role = getattr(user, 'role', 'STUDENT').upper()
            allowed_upper = [role.upper() for role in allowed_roles]
            
            if user_role == 'ADMIN' or user_role in allowed_upper:
                return func(request, *args, **kwargs)
            
            raise HttpError(403, f"Permission Denied: Role '{user_role}' not in {allowed_upper}")
        return wrapper
    return decorator
