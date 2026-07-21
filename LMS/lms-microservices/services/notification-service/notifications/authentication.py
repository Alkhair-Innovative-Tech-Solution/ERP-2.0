"""
JWT authentication helper for notification service
"""
import jwt
import logging
from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed
from django.conf import settings

logger = logging.getLogger(__name__)


class JWTAuthentication(authentication.BaseAuthentication):
    """
    Lightweight JWT auth that trusts tokens issued by auth-service/API gateway.
    Creates a simple user-like object with id/role attributes for DRF.
    """

    def authenticate(self, request):
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None

        token = auth_header.split(' ')[1].strip()
        if not token:
            return None

        try:
            secret = getattr(settings, 'JWT_SECRET_KEY', None)
            if not secret:
                logger.error('JWT_SECRET_KEY missing in settings')
                raise AuthenticationFailed('Authentication misconfigured')

            payload = jwt.decode(token, secret, algorithms=['HS256'])

            class SimpleUser:
                def __init__(self, data: dict):
                    self.id = data.get('user_id') or data.get('id')
                    self.username = data.get('username', '')
                    self.email = data.get('email', '')
                    self.role = (data.get('role') or '').upper()
                    self.is_authenticated = True
                    self.is_active = True

            return SimpleUser(payload), token
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token has expired')
        except jwt.InvalidTokenError as exc:
            logger.warning('Invalid JWT token: %s', exc)
            raise AuthenticationFailed('Invalid token')
        except Exception as exc:
            logger.error('JWT authentication failed: %s', exc, exc_info=True)
            raise AuthenticationFailed('Authentication failed')

