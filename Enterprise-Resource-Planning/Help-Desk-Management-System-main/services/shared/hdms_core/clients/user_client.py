"""
User Service client for Ticket Service.
"""
from django.conf import settings
from . import HTTPClient


class UserClient:
    """Client to communicate with User Service."""
    
    # Use lazy loading for settings to avoid circular import issues
    @property
    def BASE_URL(self):
        return settings.USER_SERVICE_URL
    
    _client = HTTPClient()
    
    @classmethod
    def get_user(cls, user_id: str, token: str = None):
        """Get user details from User Service."""
        try:
            # Access settings lazily if needed, but here we can't use 'self' 
            # easily in classmethod unless we instantiate or inspect settings directly
            base_url = settings.USER_SERVICE_URL
            return cls._client.get_json(
                f'{base_url}/api/v1/users/{user_id}',
                token=token
            )
        except Exception:
            return None
    
    @classmethod
    def validate_user(cls, user_id: str, token: str = None) -> bool:
        """Validate if user exists in User Service."""
        return cls.get_user(user_id, token) is not None
    
    @classmethod
    def validate_user_exists(cls, user_id: str, token: str = None) -> bool:
        """Alias for validate_user."""
        return cls.validate_user(user_id, token)

    @classmethod
    def get_user_info(cls, user_id: str) -> dict:
        """Fetch name + email for a user UUID from auth-service."""
        try:
            auth_url = settings.AUTH_SERVICE_URL
            resp = cls._client.get_json(f'{auth_url}/api/employees/employees/by-user/{user_id}/')
            if resp:
                return {
                    'name': resp.get('name') or resp.get('full_name') or resp.get('employee_name', ''),
                    'email': resp.get('email', ''),
                }
        except Exception:
            pass
        return {'name': '', 'email': ''}
