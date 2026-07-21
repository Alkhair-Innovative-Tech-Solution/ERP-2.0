"""
Middleware to track current user and IP for audit logging.

Stores request user and IP in thread-local storage so signals can access them.
"""
import threading
from django.utils.deprecation import MiddlewareMixin


_thread_locals = threading.local()


def get_current_user():
    """Get the current user from thread-local storage"""
    return getattr(_thread_locals, 'user', None)


def get_current_ip():
    """Get the current IP from thread-local storage"""
    return getattr(_thread_locals, 'ip', None)


class AuditMiddleware(MiddlewareMixin):
    """
    Middleware to capture current user and IP for audit logging.
    
    This allows signals to know WHO made the change and FROM WHERE.
    """
    
    def process_request(self, request):
        """Store request user and IP in thread-local storage"""
        # Store user
        _thread_locals.user = getattr(request, 'user', None)
        
        # Get client IP (handle proxy/load balancer)
        ip = request.META.get('HTTP_X_FORWARDED_FOR')
        if ip:
            ip = ip.split(',')[0]  # Get first IP if multiple
        else:
            ip = request.META.get('REMOTE_ADDR')
        
        _thread_locals.ip = ip
    
    def process_response(self, request, response):
        """Clean up thread-local storage"""
        # Clear after request completes
        if hasattr(_thread_locals, 'user'):
            del _thread_locals.user
        if hasattr(_thread_locals, 'ip'):
            del _thread_locals.ip
        
        return response
