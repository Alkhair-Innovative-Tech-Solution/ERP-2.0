"""
Global exception handler for certification service
"""
import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """
    Custom exception handler that returns standardized error responses
    """
    # Call REST framework's default exception handler first
    response = exception_handler(exc, context)
    
    if response is not None:
        # Customize the response data structure
        custom_response_data = {
            'error': response.data.get('detail', 'An error occurred'),
            'status_code': response.status_code
        }
        
        # Add field errors if present
        if isinstance(response.data, dict) and 'detail' not in response.data:
            custom_response_data['errors'] = response.data
        
        response.data = custom_response_data
    else:
        # Handle unexpected exceptions
        logger.error(f"Unhandled exception: {exc}", exc_info=True)
        response = Response(
            {
                'error': 'An unexpected error occurred',
                'status_code': status.HTTP_500_INTERNAL_SERVER_ERROR
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
    
    return response

