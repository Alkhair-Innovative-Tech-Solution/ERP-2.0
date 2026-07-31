"""
JWKS client — fetches and caches the central auth-service's RSA public key
so tokens can be verified locally (no per-request call to auth-service).

Reusable template: only knows about JWKS, nothing VMS-specific. Copy this
file as-is to onboard the next service.
"""
import logging

import requests
from django.conf import settings
from django.core.cache import cache

logger = logging.getLogger(__name__)

AUTH_SERVICE_URL = getattr(settings, 'AUTH_SERVICE_URL', 'http://localhost:8000')
JWKS_URL = f'{AUTH_SERVICE_URL}/.well-known/jwks.json'
JWKS_TIMEOUT = getattr(settings, 'AUTH_SERVICE_TIMEOUT', 5)
JWKS_CACHE_KEY = 'central_auth:jwks'
JWKS_CACHE_TTL = 3600  # 1 hour — re-fetched automatically on cache miss or unknown kid


class JWKSUnavailable(Exception):
    """Raised when the auth-service JWKS endpoint cannot be reached and no cached key exists."""


def _fetch_jwks() -> dict:
    resp = requests.get(JWKS_URL, timeout=JWKS_TIMEOUT)
    resp.raise_for_status()
    return resp.json()


def get_signing_key(kid: str | None = None):
    """
    Return the RSA public key (as a cryptography key object) used to verify
    an access token, keyed by JWKS `kid`. Cached in Django cache; refetches
    from auth-service on a cache miss (first call, TTL expiry, or unknown kid).
    """
    jwks = cache.get(JWKS_CACHE_KEY)
    keys_by_kid = {k['kid']: k for k in jwks['keys']} if jwks else {}

    if jwks is None or (kid is not None and kid not in keys_by_kid):
        try:
            jwks = _fetch_jwks()
        except (requests.exceptions.RequestException, ValueError) as exc:
            if jwks is not None:
                logger.warning('JWKS refresh failed, using stale cached key: %s', exc)
            else:
                raise JWKSUnavailable(f'Cannot reach auth-service JWKS endpoint: {exc}') from exc
        else:
            cache.set(JWKS_CACHE_KEY, jwks, JWKS_CACHE_TTL)
        keys_by_kid = {k['kid']: k for k in jwks['keys']}

    jwk = keys_by_kid.get(kid) if kid else next(iter(keys_by_kid.values()), None)
    if jwk is None:
        raise JWKSUnavailable(f'No JWKS key found for kid={kid!r}')

    return _jwk_to_public_key(jwk)


def _jwk_to_public_key(jwk: dict):
    """Convert a JWK (RSA, kty='RSA') to a cryptography RSA public key."""
    import base64

    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.asymmetric import rsa

    def _b64url_uint(val: str) -> int:
        padded = val + '=' * (-len(val) % 4)
        return int.from_bytes(base64.urlsafe_b64decode(padded), 'big')

    n = _b64url_uint(jwk['n'])
    e = _b64url_uint(jwk['e'])
    return rsa.RSAPublicNumbers(e, n).public_key(default_backend())
