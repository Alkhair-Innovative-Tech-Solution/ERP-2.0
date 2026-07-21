# ERP New — Developer Setup Guide

Monorepo for Idara al-Khair NGO's ERP suite. Contains shared infrastructure + 3 microservice sub-repos as git submodules.

---

## Architecture

| Service | Submodule | Internal Port | Local Access |
|---|---|---|---|
| **Auth-service** (Django + Next.js) | `Auth-service/` | 8000 (API), 3000 (frontend) | `http://localhost:8000/api` via nginx |
| **HDMS** — Help Desk (4 Django services + Next.js) | `HDMS/` | 8002–8005, 3000 | `http://localhost/` |
| **VMS** — Visitor Management (Django + Next.js) | `VMS/` | via own nginx | `http://localhost:8080` |
| **PostgreSQL 16** | infra | 5432 | `localhost:5432` |
| **PgBouncer** | infra | 6432 | `localhost:6432` |
| **Redis** | infra | 6379 | `localhost:6380` |
| **Edge Nginx** | infra | 80 | `localhost:80` |

**Production domains (behind HAProxy):**

| Domain | Routes to |
|---|---|
| `hrms.idaraalkhair.sbs` | Auth-service (API + frontend) |
| `hdms.idaraalkhair.sbs` | HDMS frontend (Next.js proxies APIs internally) |
| `vms.idaraalkhair.sbs` | VMS nginx |

---

## Prerequisites

Install these before anything else:

| Tool | Version | Notes |
|---|---|---|
| Docker | 24+ | `docker --version` |
| Docker Compose | v2 (plugin) | `docker compose version` — note: `compose` not `compose-v1` |
| Git | 2.30+ | Needed for submodule support |

No local Python, Node, or Postgres needed — everything runs in containers.

---

## 1. Clone the Repository

```bash
git clone https://github.com/fun33333/erp_new.git
cd erp_new

# Pull submodules (Auth-service + HDMS)
git submodule update --init --recursive
```

> **VMS** is not a submodule — it lives at `VMS/` directly in this repo.

---

## 2. Environment Variables

Copy the template and fill in all values:

```bash
cp .env.example .env
```

Then edit `.env`. Fields that **must** be changed from defaults:

| Variable | What to set |
|---|---|
| `POSTGRES_PASSWORD` | Strong random password |
| `REDIS_PASSWORD` | Strong random password |
| `SECRET_KEY` | Long random string (50+ chars) — Django secret key |
| `POSTGRES_MULTIPLE_DATABASES` | Keep as `auth_db,hdms_db,sms_iak_db` |
| `DATABASE_URL` | Update password to match `POSTGRES_PASSWORD` |
| `AUTH_DATABASE_URL` | Update password to match `POSTGRES_PASSWORD` |
| `SIS_DATABASE_URL` | Update password to match `POSTGRES_PASSWORD` |
| `AUTH_REDIS_URL` | Update password to match `REDIS_PASSWORD` |
| `REDIS_URL` | Update password to match `REDIS_PASSWORD` |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1` for local, domain for prod |

**Frontend URLs (local dev):**
```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:8000
```

**Frontend URLs (production):**
```env
NEXT_PUBLIC_API_URL=https://hrms.idaraalkhair.sbs/api
NEXT_PUBLIC_AUTH_SERVICE_URL=https://hrms.idaraalkhair.sbs
```

> `.env` is gitignored. **Never commit it.**

---

## 3. JWT RS256 Keys

Auth-service uses **RS256 asymmetric JWT signing**. Keys must be present at `config/jwt_private.pem` and `config/jwt_public.pem` before starting auth-service.

**Option A — Get from team lead** (recommended for dev)
Ask for the existing keypair. Place them at:
```
erp_new/config/jwt_private.pem
erp_new/config/jwt_public.pem
```

**Option B — Generate fresh** (only if setting up a new environment)
```bash
# Generate private key
openssl genrsa -out config/jwt_private.pem 2048

# Derive public key
openssl rsa -in config/jwt_private.pem -pubout -out config/jwt_public.pem
```

> Keys are gitignored (`config/*.pem`). All services that verify JWTs need the **same** public key.

---

## 4. Docker Network

Create the shared network once — all services attach to it:

```bash
docker network create erp_network
```

If it already exists, this command will error safely — ignore it.

---

## 5. Start Services (in order)

### Step 1 — Infra (Postgres, PgBouncer, Redis, Edge Nginx)

```bash
docker compose -f docker-compose.infra.yml up -d
```

Wait ~15 seconds for Postgres healthcheck to pass before proceeding.

```bash
# Verify all healthy
docker compose -f docker-compose.infra.yml ps
```

### Step 2 — Auth-service

```bash
cd Auth-service
docker compose up -d --build
cd ..
```

Run migrations (first time only):
```bash
docker exec auth_service python manage.py migrate
```

### Step 3 — HDMS

```bash
cd HDMS
docker compose up -d --build
cd ..
```

Run migrations (first time only):
```bash
docker exec hdms-ticket-service python manage.py migrate
docker exec hdms-communication-service python manage.py migrate
docker exec hdms-file-service python manage.py migrate
```

### Step 4 — VMS

```bash
cd VMS
docker compose up -d --build
cd ..
```

Run migrations (first time only):
```bash
docker exec vms-backend-1 python manage.py migrate
```

---

## 6. Verify Everything Running

```bash
docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
```

Expected running containers: `erp_postgres`, `erp_pgbouncer`, `erp_redis`, `erp-edge-nginx`, `auth_service`, `auth_frontend`, `hdms-ticket-service`, `hdms-communication-service`, `hdms-file-service`, `hdms-frontend-service`, `vms-backend-1`, `vms-frontend-1`, `vms-nginx-1`.

---

## 7. Create Superadmin / Seed Data

### Auth-service superadmin
```bash
docker exec -it auth_service python manage.py shell
```
```python
from authentication.models import SuperAdmin
SuperAdmin.objects.create_superuser(employee_code='ADMIN-001', password='yourpassword')
```

### VMS default credentials (development only)
| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Receptionist | `receptionist` | `reception123` |

---

## 8. Local Access URLs

| What | URL |
|---|---|
| HDMS App | `http://localhost/` |
| Auth frontend | `http://localhost:3005` (dev mapping) or `http://localhost/auth` |
| Auth Django Admin | `http://localhost/auth-admin/` |
| Ticket Django Admin | `http://localhost/ticket-admin/` |
| VMS App | `http://localhost:8080/` |
| Postgres | `localhost:5432` (user: `erp_admin`) |
| PgBouncer | `localhost:6432` |
| Redis | `localhost:6380` |

---

## 9. Common Commands

```bash
# View logs for a service
docker logs auth_service -f
docker logs hdms-ticket-service -f

# Restart a service after code change
docker compose -f docker-compose.infra.yml restart edge-nginx

cd Auth-service && docker compose up -d --build auth-service

# Run Django shell
docker exec -it auth_service python manage.py shell

# Stop everything
docker compose -f docker-compose.infra.yml down
cd Auth-service && docker compose down
cd HDMS && docker compose down
cd VMS && docker compose down
```

---

## 10. Git Workflow

This repo uses **git submodules** for Auth-service and HDMS. Each submodule is an independent repo.

```bash
# After pulling erp_new, always sync submodules
git pull
git submodule update --recursive

# To work on Auth-service
cd Auth-service
git checkout main
git pull

# To work on HDMS
cd HDMS
git checkout main
git pull
```

Active branches:
- `erp_new` main branch: `master`
- `Auth-service`: `main`
- `HDMS`: `main`

---

## 11. Production Server

| Detail | Value |
|---|---|
| Server IP | `10.0.8.135` (ERP1 VM) |
| Deploy path | `/var/www/erp_new` |
| Deploy method | GitHub Actions (auto on push to `master`/`main`) |
| Reverse proxy | HAProxy at `10.0.8.131` → port 80 on ERP1 |

CI/CD workflows: `.github/workflows/` in each submodule repo.

---

## Troubleshooting

**`erp_network not found`** — Run `docker network create erp_network` first.

**Postgres not ready** — Wait 15–20s after infra start. Check `docker logs erp_postgres`.

**Auth JWT errors** — Verify `config/jwt_private.pem` and `config/jwt_public.pem` exist and match across services.

**HDMS can't reach auth-service** — Both must be on `erp_network`. Check `docker network inspect erp_network`.

**Port 80 already in use** — Stop any local nginx/apache: `sudo systemctl stop nginx`.

**Submodule shows wrong commit** — Run `git submodule update --init --recursive` from repo root.
