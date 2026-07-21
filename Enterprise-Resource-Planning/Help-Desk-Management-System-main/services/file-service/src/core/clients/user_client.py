"""
User Service client for File Service.
"""
from django.conf import settings
from clients import HTTPClient


class UserClient:
    """Client to communicate with User Service."""
    
    BASE_URL = settings.USER_SERVICE_URL
    _client = HTTPClient()
    
    @classmethod
    def get_user(cls, user_id: str, token: str = None):
        """Get user details from User Service."""
        try:
            return cls._client.get_json(
                f'{cls.BASE_URL}/api/v1/users/{user_id}',
                token=token
            )
        except Exception:
            return None
    
    @classmethod
    def validate_user(cls, user_id: str, token: str = None) -> bool:
        """Validate if user exists in User Service."""
        return cls.get_user(user_id, token) is not None
