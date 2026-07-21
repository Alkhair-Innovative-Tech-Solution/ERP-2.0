# Auth-Service

Django Ninja backend + Next.js 16 frontend for HRMS authentication and employee management.

- **Backend API:** Django 5 + django-ninja → `/api/*`
- **Frontend:** Next.js 16 App Router (React 19, Tailwind v4)
- **Domain (prod):** `hrms.idaraalkhair.sbs`

---

## Prerequisites

- Docker + Docker Compose v2
- Node.js 20+ (for local frontend dev only)
- Shared `erp_network` running (via `../docker-compose.infra.yml`)

---

## Development Setup (Local Machine)

### 1. Create `.env.dev`

```bash
cp ../.env.example ../.env.dev
```

Edit `../.env.dev` — the key differences from prod are already set in `.env.example` comments:
- `DB_HOST=erp_postgres`, `DB_PORT=5432` — bypasses pgbouncer, connects directly
- `DEBUG=True`
- `ALLOWED_HOSTS=*`
- `CORS_ALLOW_ALL_ORIGINS=True`
- `AUTH_DATABASE_URL` uses `erp_postgres:5432` (not `erp_pgbouncer:6432`)

> **Important:** `@` signs in the DB password must be URL-encoded as `%40` in `*_DATABASE_URL` vars.
> Example: password `abc@def` → URL = `postgresql://erp_admin:abc%40def@erp_postgres:5432/auth_db`

### 2. Start infra (if not running)

```bash
cd ..
docker compose -f docker-compose.infra.yml up -d
```

### 3. Start backend with dev overlay

```bash
# From Auth-service/ directory
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d auth-service
```

This uses `.env.dev` and exposes port `8000` to the host. The `auth-frontend` container is excluded (we run frontend natively instead).

### 4. Start frontend natively

```bash
cd frontend
npm install        # first time only
npm run dev        # starts on http://localhost:3000
```

Frontend reads `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

### 5. Access

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000/api |
| Django Admin | http://localhost:8000/auth-admin/ |

### Useful dev commands

```bash
# Django management (inside container)
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec auth-service python manage.py migrate
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec auth-service python manage.py createsuperuser

# Run tests
docker compose -f docker-compose.yml -f docker-compose.dev.yml exec auth-service pytest

# View backend logs
docker compose -f docker-compose.yml -f docker-compose.dev.yml logs -f auth-service
```

---

## Production Setup (Server)

### 1. Create `.env`

```bash
cp .env.example ../.env
```

Edit `../.env` with production values:
- `DEBUG=False`
- `ALLOWED_HOSTS=hrms.idaraalkhair.sbs,...`
- `CORS_ALLOW_ALL_ORIGINS=False`
- `DB_HOST=erp_pgbouncer`, `DB_PORT=6432` (use pgbouncer)
- Strong `POSTGRES_PASSWORD` and `SECRET_KEY`

> **Important:** `@` signs in DB password must be URL-encoded as `%40` in `*_DATABASE_URL` vars.

### 2. Start infra

```bash
cd ..
docker compose -f docker-compose.infra.yml up -d
```

### 3. Start auth-service (prod — no dev overlay)

```bash
# From Auth-service/ directory
docker compose up -d
```

### 4. Verify

```bash
docker compose logs -f auth-service
curl http://localhost/health/       # via nginx
```

---

## ⚠ Changing the Database Password

If you change `POSTGRES_PASSWORD` in `.env` or `.env.dev`, you must also:

**Step 1 — Update the actual postgres role:**
```bash
docker exec erp_postgres psql -U erp_admin -d postgres \
  -c "ALTER USER erp_admin PASSWORD 'new_password_here';"
```

**Step 2 — Recreate pgbouncer** (so it regenerates its auth hash from the new password):
```bash
docker compose -f docker-compose.infra.yml up -d pgbouncer
```

**Step 3 — Restart auth-service:**
```bash
# Prod
docker compose up -d auth-service

# Dev
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d auth-service
```

> Skipping any of these steps will cause `password authentication failed` errors.

---

## Environment Files

| File | Purpose | Committed? |
|------|---------|-----------|
| `.env.example` | Template — all keys, no secrets | ✅ Yes |
| `.env` | Production secrets | ❌ Gitignored |
| `.env.dev` | Local dev secrets | ❌ Gitignored |
| `frontend/.env.local` | Frontend dev API URL | ❌ Gitignored |

---

## Project Structure

```
Auth-service/
├── Backend/                   # Django 5 + django-ninja
│   ├── Dockerfile
│   ├── requirements.txt
│   └── src/
│       ├── core/              # settings, urls, wsgi
│       ├── authentication/    # login, JWT, refresh
│       ├── employees/         # org hierarchy + employee CRUD
│       ├── permissions/       # service access, HDMS/VMS roles
│       └── audit/             # audit logs
├── frontend/                  # Next.js 16 App Router
│   ├── Dockerfile
│   └── src/
│       ├── app/               # pages (login, employees, branches, …)
│       ├── components/        # shared UI components
│       ├── context/           # AuthContext (JWT state)
│       └── utils/api.ts       # fetchWithAuth — all API calls go here
├── docker-compose.yml         # production
├── docker-compose.dev.yml     # local dev overlay
├── CLAUDE.md                  # assistant instructions
├── FRONTEND_API_INTEGRATION_GUIDE.md   # API contract per page
├── authservice_architecture_report.md  # hierarchy/denormalization audit
└── PROJECT_LOG.md             # master change log
```

---

## Key Architecture Notes

- All API calls from frontend use `fetchWithAuth()` in `src/utils/api.ts` — never call `fetch()` directly.
- Django admin is at `/auth-admin/` (not `/admin/`) — intentional, avoids conflict with other ERP services.
- `/api/employees/employees` — the double `employees` is intentional (router prefix + route prefix). Do not "fix" it.
- JWT uses RS256 (private key signs, public key verifies). Key files mount from `../config/` — never commit `.pem` files.
- Superadmins are a separate model (`authentication/superadmin_models.py`), not a flag on `Employee`.

See `FRONTEND_API_INTEGRATION_GUIDE.md` for full endpoint reference before wiring any new page.
