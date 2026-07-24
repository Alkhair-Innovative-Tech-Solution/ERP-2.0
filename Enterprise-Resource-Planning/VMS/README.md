# VMS — Visitor Management System

Full-stack visitor management system for front desk / reception use.
Built with **Next.js 14**, **Django 4.2**, **PostgreSQL 16**, **Redis**, **Docker**.

---

## Features

- **Receptionist dashboard** — live visit feed, approve/reject, checkout
- **Manual entry** — search existing visitor by CNIC/phone/email, or create new
- **QR self check-in** — visitor scans QR, fills form, receptionist approves in real-time
- **Pre-scheduled visits** — generates a visiting ID for fast entry on arrival
- **Duplicate detection** — CNIC → phone → email priority matching
- **Returning visitor detection** — auto-flagged on check-in
- **WebSocket live updates** — no refresh needed on dashboard
- **Analytics** — today's stats, 7-day chart, frequent visitors
- **Host management** — employee directory for visit routing

---

## Quick Start

```bash
# Clone / navigate to project
cd vms

# Start everything
docker compose up --build

# Wait ~60 seconds for first build
# App runs at: http://localhost
```

### Default credentials

| Role         | Username       | Password        |
|--------------|----------------|-----------------|
| Admin        | admin          | admin123        |
| Receptionist | receptionist   | reception123    |

Django Admin: http://localhost/admin

---

## Project Structure

```
vms/
├── backend/                  # Django + Channels
│   ├── config/               # settings, urls, asgi
│   ├── visitors/             # main app
│   │   ├── models.py         # Visitor, Host, Visit, QRSession
│   │   ├── views.py          # all API endpoints
│   │   ├── serializers.py
│   │   ├── utils.py          # duplicate detection logic
│   │   ├── consumers.py      # WebSocket consumer
│   │   └── management/
│   │       └── commands/
│   │           └── seed_data.py
│   ├── Dockerfile
│   ├── entrypoint.sh         # runs migrations + seed + daphne
│   └── requirements.txt
│
├── frontend/                 # Next.js 14 App Router
│   ├── app/
│   │   ├── login/            # login page
│   │   ├── dashboard/        # protected dashboard
│   │   │   ├── page.tsx      # main dashboard with stats
│   │   │   ├── visits/       # all visits with filters
│   │   │   ├── entry/        # manual entry + visiting ID
│   │   │   ├── schedule/     # schedule future visit
│   │   │   ├── qr/           # QR code generator
│   │   │   └── hosts/        # host management
│   │   └── checkin/          # visitor-facing QR form (public)
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── VisitRow.tsx
│   │   └── StatusBadge.tsx
│   ├── lib/
│   │   ├── api.ts            # axios client + all API calls
│   │   └── types.ts          # TypeScript types
│   └── store/
│       └── auth.ts           # Zustand auth store
│
├── nginx/
│   └── nginx.conf            # reverse proxy config
│
└── docker-compose.yml
```

---

## API Endpoints

### Public (no auth)
| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/qr/generate/` | Get QR session token |
| POST | `/api/qr/checkin/` | Visitor submits QR form |
| GET | `/api/visits/status/{id}/` | Poll visit approval status |
| POST | `/api/visits/scheduled-entry/` | Entry via visiting ID |

### Protected (JWT)
| Method | URL | Description |
|--------|-----|-------------|
| POST | `/api/auth/login/` | Get JWT tokens |
| POST | `/api/visits/receptionist-entry/` | Manual check-in |
| POST | `/api/visits/approve/{id}/` | Approve pending visit |
| POST | `/api/visits/reject/{id}/` | Reject pending visit |
| POST | `/api/visits/checkout/{id}/` | Check out visitor |
| POST | `/api/visits/schedule/` | Schedule future visit |
| GET | `/api/visits/` | List visits (filterable) |
| GET | `/api/visitors/search/?q=` | Search by CNIC/phone/email/name |
| GET | `/api/dashboard/stats/` | Stats for dashboard |
| GET/POST | `/api/hosts/` | Host list + create |

### WebSocket
```
ws://localhost/ws/dashboard/
```
Messages: `visit_notification` (new pending), `visit_update` (status change)

---

## Entry Flows

### Walk-in via Receptionist
1. Visitor tells name + details to receptionist
2. Receptionist searches if visitor exists (CNIC/phone/email)
3. If found → marks as returning, links to existing profile
4. If new → creates visitor record
5. Entry logged as `checked_in` immediately

### Walk-in via QR Self Check-in
1. Visitor scans QR code displayed at reception
2. Fills form on mobile (name, CNIC, phone, purpose, host)
3. System checks for duplicate → marks returning if found
4. Receptionist gets real-time notification on dashboard
5. Receptionist approves/rejects
6. Visitor's phone shows approved/rejected screen

### Pre-Scheduled Visit
1. Receptionist schedules visit in advance → system generates `VID-XXXXXXXX`
2. Visiting ID shared with visitor (email/WhatsApp)
3. On arrival, visitor gives ID at reception
4. Receptionist enters ID → instant check-in

---

## Duplicate Detection Logic

Priority order: **CNIC → Phone → Email**

```python
find_existing_visitor(cnic, phone, email)
# 1. Check CNIC match → return if found
# 2. Check phone match → return if found  
# 3. Check email match → return if found
# 4. None found → create new visitor
```

---

## Development (without Docker)

```bash
# Backend
cd backend
pip install -r requirements.txt
# Set DB env vars or use SQLite for local dev
python manage.py migrate
python manage.py seed_data
daphne config.asgi:application

# Frontend
cd frontend
npm install
npm run dev
```
