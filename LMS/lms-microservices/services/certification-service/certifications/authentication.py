"""
JWT Authentication for certification service
"""
import jwt
import logging
from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings

logger = logging.getLogger(__name__)


class JWTAuthentication(authentication.BaseAuthentication):
    """
    Custom JWT authentication class for Django REST Framework.
    Extracts and validates JWT tokens from the Authorization header.
    Since certification service doesn't have a User model, we create a simple user-like object.
    """
    
    def authenticate(self, request):
        """
        Authenticate the request using JWT token.
        
        Returns:
            tuple: (user, token) if authentication succeeds, None otherwise
        """
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        
        if not auth_header:
            return None
        
        # Check if it's a Bearer token
        if not auth_header.startswith('Bearer '):
            return None
        
        # Extract token
        try:
            token = auth_header.split(' ')[1]
        except IndexError:
            return None
        
        if not token:
            return None
        
        try:
            # Decode and validate token
            jwt_secret = getattr(settings, 'JWT_SECRET_KEY', None)
            if not jwt_secret:
                logger.error("JWT_SECRET_KEY not configured in settings")
                return None
            
            payload = jwt.decode(token, jwt_secret, algorithms=['HS256'])
            
            # Create a simple user object with the payload data
            # We don't have a User model in certification service, so we create a minimal user-like object
            class SimpleUser:
                def __init__(self, payload):
                    self.id = payload.get('user_id')
                    self.username = payload.get('username', '')
                    self.email = payload.get('email', '')
                    self.role = payload.get('role', '')
                    self.is_authenticated = True
                    self.is_active = True
                    self.is_staff = False
                    self.is_superuser = False
            
            user = SimpleUser(payload)
            logger.debug(f"JWT authentication successful for user {user.id} ({user.username})")
            return (user, token)
            
        except jwt.ExpiredSignatureError:
            logger.warning("JWT token has expired")
            raise AuthenticationFailed('Token has expired')
        except jwt.InvalidTokenError as e:
            logger.warning(f"Invalid JWT token: {e}")
            raise AuthenticationFailed('Invalid token')
        except Exception as e:
            logger.error(f"Error authenticating JWT token: {e}", exc_info=True)
            raise AuthenticationFailed('Authentication failed')

