"""
User Service client for Communication Service.
"""
import requests
# Remove module-level settings import


class UserClient:
    """Client to communicate with User Service."""
    
    @classmethod
    def _get_base_url(cls):
        """Get base URL from settings (lazy access)."""
        # Import settings only when method is called
        from django.conf import settings
        return settings.USER_SERVICE_URL
    
    @classmethod
    def get_user(cls, user_id: str, token: str = None):
        """Get user details from User Service."""
        headers = {}
        if token:
            headers['Authorization'] = f'Bearer {token}'
        
        try:
            response = requests.get(
                f'{cls._get_base_url()}/api/v1/users/{user_id}',
                headers=headers,
                timeout=5
            )
            response.raise_for_status()
            return response.json()
        except requests.ConnectionError:
            # Service not ready yet, return None instead of crashing
            return None
        except requests.Timeout:
            return None
        except requests.RequestException:
            return None
    
    @classmethod
    def validate_user(cls, user_id: str, token: str = None) -> bool:
        """Validate if user exists in User Service."""
        return cls.get_user(user_id, token) is not None
