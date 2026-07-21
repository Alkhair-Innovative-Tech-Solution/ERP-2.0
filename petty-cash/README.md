# Petty Cash Management System

Django REST + Next.js + PostgreSQL

## Project Structure

```
petty-cash/
├── backend/          Django REST API
│   ├── config/       Settings, URLs, WSGI
│   ├── petty_cash/   Main app (models, views, serializers)
│   └── requirements.txt
├── frontend/         Next.js 14 + Tailwind CSS
│   ├── src/
│   │   ├── app/      Pages (dashboard, transactions, cashbook, etc.)
│   │   ├── components/  Sidebar, AppLayout
│   │   ├── context/  AuthContext
│   │   └── lib/      API client (axios)
│   └── package.json
└── database/
    └── schema.sql    PostgreSQL schema + seed data
```

---

## Quick Setup

### 1. PostgreSQL Database

```bash
# Create database
psql -U postgres
CREATE DATABASE petty_cash_db;
\q

# Run schema (optional — Django migrations will also create tables)
psql -U postgres -d petty_cash_db -f database/schema.sql
```

---

### 2. Backend (Django)

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate        # Linux/Mac
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env
# Edit .env with your DB credentials

# Run migrations
python manage.py migrate

# Seed initial data (users + categories)
python manage.py seed_data

# Start server
python manage.py runserver
# API running at: http://localhost:8000
```

---

### 3. Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Create env file
cp .env.local.example .env.local

# Start dev server
npm run dev
# App running at: http://localhost:3000
```

---

## Login Credentials (after seed_data)

| Role      | Username     | Password    |
|-----------|--------------|-------------|
| CFO       | cfo_admin    | Admin@1234  |
| Custodian | custodian1   | Admin@1234  |
| Auditor   | auditor1     | Admin@1234  |

---

## API Endpoints

| Method | Endpoint                        | Description              |
|--------|---------------------------------|--------------------------|
| POST   | /api/auth/login/                | Login, get JWT tokens    |
| POST   | /api/auth/refresh/              | Refresh access token     |
| GET    | /api/dashboard/                 | Dashboard stats + charts |
| GET    | /api/transactions/              | List transactions        |
| POST   | /api/transactions/              | Create transaction       |
| POST   | /api/transactions/{id}/void/    | Void a transaction       |
| GET    | /api/categories/                | List categories          |
| POST   | /api/categories/                | Create category (CFO)    |
| GET    | /api/budgets/                   | List budgets             |
| GET    | /api/budgets/current/           | Current month budget     |
| POST   | /api/budgets/                   | Set budget (CFO)         |
| GET    | /api/cash-fund/                 | Current fund balance     |
| PATCH  | /api/cash-fund/                 | Update fund (CFO)        |
| GET    | /api/replenishments/            | List replenishments      |
| POST   | /api/replenishments/            | Add replenishment        |
| GET    | /api/audit-logs/                | Audit trail (CFO/Auditor)|
| GET    | /api/me/                        | Current user info        |

---

## User Roles & Access

| Feature              | CFO | Custodian | Auditor |
|----------------------|-----|-----------|---------|
| Dashboard            | ✓   | ✓         | ✓       |
| Add Expense          | ✓   | ✓         | ✗       |
| View Cashbook        | ✓   | ✓         | ✓       |
| Void Transaction     | ✓   | ✓         | ✗       |
| Add Replenishment    | ✓   | ✓         | ✗       |
| View Replenishments  | ✓   | ✓         | ✗       |
| Manage Categories    | ✓   | ✗         | ✗       |
| Set Monthly Budget   | ✓   | ✗         | ✗       |
| Fund Settings        | ✓   | ✗         | ✗       |
| Audit Trail          | ✓   | ✗         | ✓       |

---

## Rules

- **Receipt mandatory** — no transaction can be saved without uploading a receipt
- **Not-allowed categories** — categories like Salary, Rent, Equipment cannot be selected
- **Void instead of delete** — transactions are never deleted, only voided with a reason
- **Auto balance update** — cash fund balance updates automatically on every transaction
- **Audit everything** — every login, create, void, replenishment is logged with IP and timestamp
