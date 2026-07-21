"""
Service Authentication Middleware
For internal service-to-service communication
"""
from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed
from django.contrib.auth.models import AnonymousUser
from django.conf import settings


class ServiceUser:
    """Pseudo-user for service-to-service authentication"""
    is_authenticated = True
    is_active = True
    is_staff = True
    is_superuser = True
    username = 'service_account'
    
    def __str__(self):
        return 'Internal Service Account'


class ServiceAuthentication(authentication.BasicAuthentication):
    """
    Service-to-service authentication using API Key
    Checks X-Service-API-Key header
    """
    
    def authenticate(self, request):
        api_key = request.META.get('HTTP_X_SERVICE_API_KEY')
        
        if not api_key:
            return None  # Fall through to other authentication
        
        # Get service API key from settings
        expected_key = getattr(settings, 'SERVICE_API_KEY', None)
        
        if not expected_key:
            raise AuthenticationFailed('Service API key not configured')
        
        if api_key != expected_key:
            raise AuthenticationFailed('Invalid service API key')
        
        # Return pseudo-user for service requests
        return (ServiceUser(), None)
