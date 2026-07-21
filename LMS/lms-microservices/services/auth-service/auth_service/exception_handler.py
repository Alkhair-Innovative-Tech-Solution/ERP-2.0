"""
Custom exception handler for DRF
"""
import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status
from django.conf import settings

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that provides consistent error responses
    
    Args:
        exc: The exception instance
        context: Dictionary containing context information
        
    Returns:
        Response object with error details
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    # If response is None, it's an unhandled exception
    if response is None:
        # Log the exception
        logger.error(
            f"Unhandled exception: {type(exc).__name__}",
            exc_info=True,
            extra={'context': context}
        )
        
        # Return a generic error response
        # In production, don't expose internal error details
        if settings.DEBUG:
            error_detail = str(exc)
        else:
            error_detail = 'An internal server error occurred. Please try again later.'
        
        return Response(
            {
                'error': 'Internal server error',
                'detail': error_detail,
                'status_code': status.HTTP_500_INTERNAL_SERVER_ERROR
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    # Customize the response data structure
    custom_response_data = {
        'error': response.data.get('detail', 'An error occurred'),
        'status_code': response.status_code
    }
    
    # Add field errors if present
    if 'detail' not in response.data and isinstance(response.data, dict):
        # Check for field-level errors
        field_errors = {}
        for key, value in response.data.items():
            if isinstance(value, (list, dict)):
                field_errors[key] = value
        
        if field_errors:
            custom_response_data['errors'] = field_errors
        else:
            # If no field errors, include all data
            custom_response_data.update(response.data)
    
    # Log errors (except 404s which are common)
    if response.status_code >= 500:
        logger.error(
            f"Server error: {custom_response_data.get('error', 'Unknown error')}",
            exc_info=True,
            extra={'context': context, 'status_code': response.status_code}
        )
    elif response.status_code >= 400 and response.status_code != 404:
        logger.warning(
            f"Client error: {custom_response_data.get('error', 'Unknown error')}",
            extra={'context': context, 'status_code': response.status_code}
        )
    
    # In production, hide sensitive error details
    if not settings.DEBUG and response.status_code >= 500:
        custom_response_data['error'] = 'An internal server error occurred. Please try again later.'
        custom_response_data.pop('detail', None)
    
    response.data = custom_response_data
    return response


