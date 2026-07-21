# Docker Setup — Petty Cash System

## Files Added

```
petty-cash/
├── docker-compose.yml          # Development (3 containers)
├── docker-compose.prod.yml     # Production overrides (+ Nginx)
├── .env.example                # Environment variables template
├── nginx/
│   └── nginx.conf              # Nginx reverse proxy config
├── backend/
│   ├── Dockerfile              # Python 3.11 slim image
│   ├── entrypoint.sh           # Wait for DB → migrate → seed → run
│   └── .dockerignore
└── frontend/
    ├── Dockerfile              # Multi-stage Node 20 build
    └── .dockerignore
```

---

## Development — Sirf 3 Commands

```bash
# 1. Clone/copy project folder mein jao
cd petty-cash

# 2. .env file banao
cp .env.example .env

# 3. Sab kuch start karo
docker compose up --build
```

Bas. Yeh automatically:
- PostgreSQL database start karega
- Django migrations chalayega
- Default users aur categories seed karega
- Backend `http://localhost:8000` par start hoga
- Frontend `http://localhost:3000` par start hoga

---

## Login (auto-seeded)

| Role      | Username     | Password   |
|-----------|--------------|------------|
| CFO       | cfo_admin    | Admin@1234 |
| Custodian | custodian1   | Admin@1234 |
| Auditor   | auditor1     | Admin@1234 |

---

## Useful Commands

```bash
# Background mein chalao
docker compose up -d --build

# Logs dekhna
docker compose logs -f
docker compose logs -f backend      # sirf backend
docker compose logs -f frontend     # sirf frontend

# Containers ka status
docker compose ps

# Sab band karo
docker compose down

# Sab band karo + database bhi delete karo (fresh start)
docker compose down -v
```

---

## Production Deployment

```bash
# 1. .env mein production values set karo
SECRET_KEY=<strong-random-key>
DEBUG=False
DB_PASSWORD=<strong-password>
ALLOWED_HOSTS=yourdomain.com
CORS_ALLOWED_ORIGINS=http://yourdomain.com
NEXT_PUBLIC_API_URL=http://yourdomain.com/api

# 2. Production compose file use karo
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

Production mein Nginx port 80 par chalta hai — sab kuch usi se route hota hai:
- `yourdomain.com/api/` → Django
- `yourdomain.com/admin/` → Django Admin
- `yourdomain.com/` → Next.js

---

## Containers Architecture

```
Browser
   │
   ├── localhost:3000 ──→ [frontend] Next.js
   │
   └── localhost:8000 ──→ [backend] Django
                               │
                               └──→ [db] PostgreSQL :5432

(Production mein Nginx port 80 par dono ko route karta hai)
```

---

## Data Persistence

Sab data Docker volumes mein save hota hai:
- `petty_cash_postgres_data` — database
- `petty_cash_media_files` — uploaded receipts

`docker compose down` se data **nahi** jaata.
`docker compose down -v` se data **chala jaata** hai (fresh start ke liye).

---

## Django Admin

`http://localhost:8000/admin/` par directly superuser se login karo:

```bash
# Superuser banana
docker compose exec backend python manage.py createsuperuser
```
