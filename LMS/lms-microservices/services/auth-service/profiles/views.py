"""
API views for authentication and user management
"""
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from .models import UserProfile, StudentProfile, TeacherProfile
from .serializers import UserSerializer, UserProfileSerializer
import sys
import os

# Add shared common to path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SHARED_PATH = os.path.join(BASE_DIR, '../../shared')
if os.path.exists(SHARED_PATH):
    sys.path.insert(0, SHARED_PATH)
    from common.jwt_utils import create_access_token, create_refresh_token, decode_token
else:
    # Fallback: Use local JWT implementation
    import jwt
    from datetime import datetime, timedelta
    from django.conf import settings
    
    JWT_SECRET_KEY = getattr(settings, 'JWT_SECRET_KEY', 'your-secret-key-change-in-production')
    JWT_ALGORITHM = 'HS256'
    
    def create_access_token(data, expires_delta=None):
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=60 * 24)
        to_encode.update({"exp": expire, "iat": datetime.utcnow()})
        return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    
    def create_refresh_token(data):
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=7)
        to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "refresh"})
        return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    
    def decode_token(token):
        try:
            return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    """ViewSet for user management"""
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        if self.request.user.is_superuser:
            return User.objects.all()
        return User.objects.filter(id=self.request.user.id)


class LoginView(APIView):
    """Login endpoint with JWT token generation"""
    permission_classes = [AllowAny]

    def post(self, request):
        email_or_username = request.data.get('email') or request.data.get('username')
        password = request.data.get('password')
        
        if not email_or_username or not password:
            return Response(
                {'error': 'Email/username and password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = None
        try:
            user = User.objects.get(email=email_or_username)
        except User.DoesNotExist:
            try:
                user = User.objects.get(username=email_or_username)
            except User.DoesNotExist:
                return Response(
                    {'error': 'Invalid email/username or password.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        authenticated_user = authenticate(username=user.username, password=password)
        
        if authenticated_user is None:
            return Response(
                {'error': 'Invalid email/username or password.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = authenticated_user
        
        if not user.is_active:
            return Response(
                {'error': 'User account is disabled.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create JWT tokens
        access_token = create_access_token({
            'user_id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role.upper()
        })
        refresh_token = create_refresh_token({
            'user_id': user.id,
            'username': user.username,
        })
        
        return Response({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'token_type': 'Bearer',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role.upper(),
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
            }
        })


class RegisterView(APIView):
    """User registration endpoint"""
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username')
        email = request.data.get('email')
        password = request.data.get('password')
        first_name = request.data.get('first_name', '') or request.data.get('firstName', '')
        last_name = request.data.get('last_name', '') or request.data.get('lastName', '')
        # Determine role from path or request data
        role = request.data.get('role', 'STUDENT')
        # Check if path contains 'student' or 'teacher' to force role
        if 'student' in request.path.lower():
            role = 'STUDENT'
        elif 'teacher' in request.path.lower():
            role = 'TEACHER'
        
        if not username or not email or not password:
            return Response(
                {'error': 'Username, email, and password are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if User.objects.filter(username=username).exists():
            return Response(
                {'error': 'Username already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if User.objects.filter(email=email).exists():
            return Response(
                {'error': 'Email already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            validate_password(password)
        except ValidationError as e:
            return Response(
                {'error': 'Password validation failed.', 'details': list(e.messages)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
            role=role
        )
        
        # Create user profile
        UserProfile.objects.create(user=user)
        
        # Create role-specific profile
        if role == 'STUDENT':
            StudentProfile.objects.create(user=user)
        elif role == 'TEACHER':
            TeacherProfile.objects.create(user=user)
        
        # Create tokens
        access_token = create_access_token({
            'user_id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role
        })
        refresh_token = create_refresh_token({
            'user_id': user.id,
            'username': user.username,
        })
        
        return Response({
            'access_token': access_token,
            'refresh_token': refresh_token,
            'token_type': 'Bearer',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
            }
        }, status=status.HTTP_201_CREATED)


class CurrentUserView(APIView):
    """Get current authenticated user"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        return Response({
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'first_name': user.first_name,
            'last_name': user.last_name,
            'role': user.role,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
        })


class RefreshTokenView(APIView):
    """Refresh JWT access token"""
    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.data.get('refresh_token')
        
        if not refresh_token:
            return Response(
                {'error': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        payload = decode_token(refresh_token)
        
        if not payload or payload.get('type') != 'refresh':
            return Response(
                {'error': 'Invalid or expired refresh token.'},
                status=status.HTTP_401_UNAUTHORIZED
            )
        
        try:
            user = User.objects.get(id=payload['user_id'])
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Create new access token
        access_token = create_access_token({
            'user_id': user.id,
            'username': user.username,
            'email': user.email,
            'role': user.role
        })
        
        return Response({
            'access_token': access_token,
            'token_type': 'Bearer',
        })

