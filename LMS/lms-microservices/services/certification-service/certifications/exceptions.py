"""
Custom exceptions for certification service
"""
from rest_framework.exceptions import APIException, status


class NotFoundError(APIException):
    status_code = status.HTTP_404_NOT_FOUND
    default_detail = 'Resource not found'
    default_code = 'not_found'


class ValidationError(APIException):
    status_code = status.HTTP_400_BAD_REQUEST
    default_detail = 'Validation error'
    default_code = 'validation_error'


class ConflictError(APIException):
    status_code = status.HTTP_409_CONFLICT
    default_detail = 'Resource conflict'
    default_code = 'conflict'

