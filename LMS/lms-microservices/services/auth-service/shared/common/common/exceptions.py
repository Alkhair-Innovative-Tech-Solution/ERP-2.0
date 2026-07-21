"""
Common exception classes for all services
"""
from rest_framework.exceptions import APIException
from rest_framework import status


class ValidationError(APIException):
    """Custom validation error"""
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Validation error occurred.'
    default_code = 'validation_error'


class AuthenticationError(APIException):
    """Custom authentication error"""
    status_code = status.HTTP_401_UNAUTHORIZED
    default_detail = 'Authentication failed.'
    default_code = 'authentication_failed'


class PermissionDenied(APIException):
    """Custom permission denied error"""
    status_code = status.HTTP_403_FORBIDDEN
    default_detail = 'You do not have permission to perform this action.'
    default_code = 'permission_denied'


class NotFoundError(APIException):
    """Custom not found error"""
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = 'Resource not found.'
    default_code = 'not_found'


class ServiceUnavailable(APIException):
    """Custom service unavailable error"""
    status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    default_detail = 'Service is temporarily unavailable.'
    default_code = 'service_unavailable'


class ConflictError(APIException):
    """Custom conflict error (e.g., duplicate resource)"""
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'Resource conflict occurred.'
    default_code = 'conflict'


