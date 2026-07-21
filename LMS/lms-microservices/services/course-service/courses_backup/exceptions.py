"""
Custom exceptions for courses app
"""
from rest_framework.exceptions import APIException
from rest_framework import status


class ValidationError(APIException):
    """Validation error exception"""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Validation error occurred.'
    default_code = 'validation_error'


class ConflictError(APIException):
    """Resource conflict exception"""
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'Resource conflict occurred.'
    default_code = 'conflict'


class AuthenticationError(APIException):
    """Authentication error exception"""
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = 'Authentication failed.'
    default_code = 'authentication_failed'


class PermissionDenied(APIException):
    """Permission denied exception"""
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = 'Permission denied.'
    default_code = 'permission_denied'


class NotFoundError(APIException):
    """Resource not found exception"""
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = 'Resource not found.'
    default_code = 'not_found'


class ServiceUnavailable(APIException):
    """Service unavailable exception"""
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'Service unavailable.'
    default_code = 'service_unavailable'

# Re-export common exceptions for convenience
__all__ = [
    'ValidationError',
    'AuthenticationError',
    'PermissionDenied',
    'NotFoundError',
    'ServiceUnavailable',
    'ConflictError',
]

