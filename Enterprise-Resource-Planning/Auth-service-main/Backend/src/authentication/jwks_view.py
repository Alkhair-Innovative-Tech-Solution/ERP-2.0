"""
JWKS endpoint — serves the RSA public key so downstream services can verify
Auth-service-issued JWTs without needing the PEM file distributed out-of-band.
"""
import base64

from cryptography.hazmat.primitives import serialization
from django.http import JsonResponse

from .jwt_utils import JWT_PUBLIC_KEY

KEY_ID = "auth-service-1"


def _b64url_uint(value: int) -> str:
    length = (value.bit_length() + 7) // 8
    return base64.urlsafe_b64encode(value.to_bytes(length, "big")).rstrip(b"=").decode("ascii")


def jwks_view(request):
    public_key = serialization.load_pem_public_key(JWT_PUBLIC_KEY.encode())
    numbers = public_key.public_numbers()
    jwk = {
        "kty": "RSA",
        "use": "sig",
        "alg": "RS256",
        "kid": KEY_ID,
        "n": _b64url_uint(numbers.n),
        "e": _b64url_uint(numbers.e),
    }
    return JsonResponse({"keys": [jwk]})
