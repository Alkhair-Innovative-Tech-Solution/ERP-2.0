import os
import sys
from django.contrib.auth import get_user_model
from rest_framework import authentication
from rest_framework import exceptions
from django.conf import settings

# Add shared common to path to import jwt_utils
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHARED_PATH = os.path.join(BASE_DIR, '../../shared')

if os.path.exists(SHARED_PATH):
    sys.path.insert(0, SHARED_PATH)
    from common.jwt_utils import decode_token
else:
    # Fallback to local import or mock if shared not found (should not happen in this env)
    from .views import decode_token

User = get_user_model()

class JWTAuthentication(authentication.BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            return None

        try:
            # Header format: "Bearer <token>"
            prefix, token = auth_header.split()
            if prefix.lower() != 'bearer':
                return None
        except ValueError:
            return None

        # Decode token
        # Get SECRET_KEY from settings
        secret_key = getattr(settings, 'JWT_SECRET_KEY', 'your-secret-key-change-in-production')
        payload = decode_token(token, secret_key=secret_key)
        
        if not payload:
            raise exceptions.AuthenticationFailed('Invalid or expired token')

        try:
            user_id = payload.get('user_id')
            if not user_id:
                raise exceptions.AuthenticationFailed('Token contains no user identifier')
                
            user = User.objects.get(id=user_id)
        except User.DoesNotExist:
            raise exceptions.AuthenticationFailed('User not found')

        return (user, None)
