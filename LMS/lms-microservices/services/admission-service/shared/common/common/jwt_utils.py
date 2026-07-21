"""
Shared JWT utilities for all services
"""
import jwt
from datetime import datetime, timedelta
from typing import Optional, Dict, Any


class JWTUtils:
    """JWT utility class"""
    
    def __init__(self, secret_key: str = 'your-secret-key-change-in-production', algorithm: str = 'HS256'):
        self.secret_key = secret_key
        self.algorithm = algorithm
    
    def create_access_token(self, data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=60 * 24)  # 24 hours
        to_encode.update({"exp": expire, "iat": datetime.utcnow()})
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
    
    def create_refresh_token(self, data: Dict[str, Any]) -> str:
        """Create JWT refresh token"""
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(days=7)  # 7 days
        to_encode.update({"exp": expire, "iat": datetime.utcnow(), "type": "refresh"})
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
    
    def decode_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Decode JWT token"""
        try:
            return jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
        except jwt.ExpiredSignatureError:
            return None
        except jwt.InvalidTokenError:
            return None


# Global instance (can be overridden)
_jwt_utils = JWTUtils()


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None, secret_key: Optional[str] = None) -> str:
    """Create JWT access token"""
    if secret_key:
        utils = JWTUtils(secret_key=secret_key)
        return utils.create_access_token(data, expires_delta)
    return _jwt_utils.create_access_token(data, expires_delta)


def create_refresh_token(data: Dict[str, Any], secret_key: Optional[str] = None) -> str:
    """Create JWT refresh token"""
    if secret_key:
        utils = JWTUtils(secret_key=secret_key)
        return utils.create_refresh_token(data)
    return _jwt_utils.create_refresh_token(data)


def decode_token(token: str, secret_key: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Decode JWT token"""
    if secret_key:
        utils = JWTUtils(secret_key=secret_key)
        return utils.decode_token(token)
    return _jwt_utils.decode_token(token)

