# JWT Key Management

Auth-service uses **RS256** (RSA asymmetric) JWT signing. Auth-service holds the private key and signs tokens. All consumer services (HDMS ticket/file/communication) verify tokens using the public key only.

---

## Algorithm Summary

| Setting | Value |
|---|---|
| Algorithm | RS256 |
| Key size | RSA-4096 |
| Access token lifetime | 1 hour |
| Refresh token lifetime | 7 days |

---

## Key Files

| File | Who reads it | Purpose |
|---|---|---|
| `jwt_private.pem` | **Auth-service ONLY** | Signing new tokens |
| `jwt_public.pem` | Auth-service + all HDMS services | Verifying token signatures |

**Dev location:** `erp_new/config/jwt_private.pem` and `erp_new/config/jwt_public.pem`

**Production location:** Recommended `/etc/erp/jwt_private.pem` (Auth-service host only), `/etc/erp/jwt_public.pem` (all service hosts)

> **NEVER commit key files to git.** They are in `.gitignore`.
> **NEVER share the private key with HDMS or any consumer service.**

---

## Environment Variables

Add to `.env` (shared across all services via `erp_new/.env`):

```bash
JWT_ALGORITHM=RS256
JWT_PRIVATE_KEY_PATH=/etc/erp/keys/jwt_private.pem   # Auth-service only reads this
JWT_PUBLIC_KEY_PATH=/etc/erp/keys/jwt_public.pem     # All services read this
```

Docker volume in `Auth-service/docker-compose.yml`:
```yaml
volumes:
  - ../config:/etc/erp/keys:ro   # mounts erp_new/config/ read-only
```

---

## Generating Keys (First Time)

```bash
# Create storage directory (outside all repos)
mkdir -p /path/to/erp_new/config

# Generate RSA-4096 private key
openssl genrsa -out /path/to/erp_new/config/jwt_private.pem 4096

# Extract public key
openssl rsa -in /path/to/erp_new/config/jwt_private.pem \
  -pubout -out /path/to/erp_new/config/jwt_public.pem

# Set permissions (dev: 644 for Docker compatibility, prod: 600 with correct user)
chmod 644 /path/to/erp_new/config/jwt_private.pem
chmod 644 /path/to/erp_new/config/jwt_public.pem

# Verify RS256 roundtrip works
python3 -c "
import jwt
priv = open('jwt_private.pem').read()
pub = open('jwt_public.pem').read()
token = jwt.encode({'test': 'ok'}, priv, algorithm='RS256')
payload = jwt.decode(token, pub, algorithms=['RS256'])
print('OK:', payload)
"
```

---

## Key Rotation Procedure

> **Warning:** Rotating the private key invalidates ALL existing tokens. All users across all services will be logged out simultaneously.

1. Generate new key pair (new files, different names)
2. Update `JWT_PRIVATE_KEY_PATH` on Auth-service host → point to new private key
3. Update `JWT_PUBLIC_KEY_PATH` on ALL service hosts → point to new public key
4. Restart Auth-service first
5. Restart HDMS services (ticket, file, communication)
6. Verify login works with a test account
7. Delete old key files

---

## Services Map

| Service | Reads | Usage |
|---|---|---|
| Auth-service | Private + Public | Signs tokens, verifies own tokens |
| HDMS ticket-service | Public only | Verifies incoming tokens via `SIMPLE_JWT['VERIFYING_KEY']` |
| HDMS file-service | Public only | Same |
| HDMS communication-service | Public only | Same |

---

## Token Characteristics

RS256 tokens are longer than HS256:
- HS256: ~300 chars
- RS256: ~1300 chars

For this reason, `RefreshToken.token` and `BlacklistedToken.token` are `TextField` (not `CharField`) in `authentication/models.py`.

---

## Troubleshooting

**`JWT_PRIVATE_KEY_PATH not set`** — env var missing in `.env` or container not restarted after `.env` change.

**`JWT key file not found: /etc/erp/keys/jwt_private.pem`** — key file not mounted or path wrong. Check docker-compose volume mount.

**`PermissionError: [Errno 13]`** — container user can't read the key file. Run `chmod 644 jwt_private.pem` for dev.

**`Algorithm 'RS256' could not be found`** — `cryptography` package not installed. Container image needs rebuild: `docker compose build auth-service`.

**Existing tokens rejected after restart** — expected if keys were rotated. All users must re-login.
