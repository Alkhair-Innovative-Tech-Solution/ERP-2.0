# NGO Expense Management System — System Documentation

---

## 1. Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│                    Client Browser                          │
│                   Next.js 14 (SPA)                         │
│          Tailwind CSS + Recharts + react-hook-form         │
└─────────────────────────┬──────────────────────────────────┘
                          │ HTTP / REST API (JSON)
                          │ JWT Bearer Token Auth
┌─────────────────────────┼──────────────────────────────────┐
│                    NGINX Reverse Proxy                     │
│         /api/ → backend  / → frontend  /media/ → static    │
└─────────────────────────┼──────────────────────────────────┘
                          │
┌─────────────────────────┼──────────────────────────────────┐
│              Django REST Framework (Python)                │
│         JWT Auth | DRF ViewSets | OpenPyXL Exports         │
│           PostgreSQL via psycopg2 (configurable)           │
└─────────────────────────┼──────────────────────────────────┘
                          │
┌─────────────────────────┼──────────────────────────────────┐
│                   PostgreSQL 16                            │
│        Tables: branches, users, expense_categories,        │
│        monthly_budgets, transactions, cash_fund,           │
│        replenishments, audit_logs                          │
└────────────────────────────────────────────────────────────┘
```

---

## 2. Tech Stack

| Layer    | Technology | Version |
|----------|------------|---------|
| Frontend |   Next.js  |   14.x  |
| Frontend |   React    |   18.x  |
| Frontend | TypeScript | 5.x |
| Frontend | Tailwind CSS | 3.x |
| Frontend | Recharts | 2.x |
| Frontend | react-hook-form | 7.x |
| Frontend | react-hot-toast | 2.x |
| Frontend | axios | 1.x |
| Frontend | js-cookie | 3.x |
| Backend | Python | 3.11+ |
| Backend | Django | 5.x |
| Backend | Django REST Framework | 3.x |
| Backend | djangorestframework-simplejwt | 5.x |
| Backend | django-cors-headers | 4.x |
| Backend | django-filter | 23.x |
| Backend | openpyxl | 3.x |
| Backend | python-decouple | 3.x |
| Backend | psycopg2-binary | 2.x |
| Database | PostgreSQL | 16 (Alpine) |
| Database GUI | pgAdmin 4 | latest |
| Proxy | NGINX | latest |
| Container | Docker | with Compose V2 |

---

## 3. Project Structure

```
petty-cash/
│
├── backend/                          # Django REST API
│   ├── config/                       # Django project config
│   │   ├── __init__.py
│   │   ├── settings.py               # All settings (DB, JWT, CORS, etc.)
│   │   ├── urls.py                   # Root URL routing
│   │   └── wsgi.py                   # WSGI entry point
│   │
│   ├── petty_cash/                   # Main application
│   │   ├── management/
│   │   │   └── commands/
│   │   │       └── seed_data.py      # Seeds demo data (users, categories, branches)
│   │   ├── migrations/               # Django DB migrations
│   │   ├── __init__.py
│   │   ├── admin.py                  # Django admin config
│   │   ├── exports.py                # Excel export logic (openpyxl)
│   │   ├── models.py                 # All database models (8 models)
│   │   ├── permissions.py            # Custom DRF permissions
│   │   ├── serializers.py            # DRF serializers
│   │   ├── urls.py                   # API route definitions
│   │   └── views.py                  # All API views/logic
│   │
│   ├── media/                        # Uploaded receipts (gitignored)
│   │   └── receipts/
│   │
│   ├── .dockerignore
│   ├── .env.example
│   ├── Dockerfile
│   ├── entrypoint.sh
│   ├── manage.py
│   └── requirements.txt
│
├── frontend/                         # Next.js 14 Application
│   ├── public/
│   ├── src/
│   │   ├── app/                      # App Router pages
│   │   │   ├── audit-logs/           # Audit trail page
│   │   │   │   └── page.tsx
│   │   │   ├── branches/             # Branch overview page
│   │   │   │   └── page.tsx
│   │   │   ├── cashbook/             # Cashbook ledger page
│   │   │   │   └── page.tsx
│   │   │   ├── dashboard/            # Main dashboard page
│   │   │   │   └── page.tsx
│   │   │   ├── expenses/             # Expense entry page
│   │   │   │   └── page.tsx
│   │   │   ├── login/                # Login page
│   │   │   │   └── page.tsx
│   │   │   ├── replenishments/       # Fund replenishment page
│   │   │   │   └── page.tsx
│   │   │   ├── settings/             # Settings page (categories/budgets/fund)
│   │   │   │   └── page.tsx
│   │   │   ├── transactions/         # Alternate transaction page
│   │   │   │   └── page.tsx
│   │   │   ├── globals.css           # Global styles + Tailwind
│   │   │   ├── layout.tsx            # Root layout
│   │   │   └── page.tsx              # Root redirect (→ /dashboard or /login)
│   │   │
│   │   ├── components/
│   │   │   ├── AppLayout.tsx         # Authenticated layout wrapper
│   │   │   └── Sidebar.tsx           # Navigation sidebar
│   │   │
│   │   ├── context/
│   │   │   └── AuthContext.tsx        # Auth state management
│   │   │
│   │   └── lib/
│   │       └── api.ts                # Axios API client + all API functions
│   │
│   ├── .dockerignore
│   ├── .env.local.example
│   ├── .next/
│   ├── Dockerfile
│   ├── next-env.d.ts
│   ├── next.config.js
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── tsconfig.json
│
├── database/
│   ├── pgadmin_servers.json          # pgAdmin auto-connect config
│   └── schema.sql                    # Full PostgreSQL schema + constraints
│
├── nginx/
│   └── nginx.conf                    # Reverse proxy config
│
├── docker-compose.yml                # Docker Compose (dev)
├── docker-compose.prod.yml           # Docker Compose (production)
├── DOCKER.md                         # Docker setup guide
└── README.md                         # Project README
```

---

## 4. Database Schema

### 4.1 Entity Relationship Summary

```
branches ──┬── users
           ├── transactions
           ├── monthly_budgets
           ├── cash_fund
           └── replenishments

users ──┬── transactions (entered_by)
        ├── transactions (voided_by)
        ├── monthly_budgets (created_by)
        ├── replenishments (added_by)
        └── audit_logs (user)

expense_categories ──┬── transactions

monthly_budgets ──┬── transactions
```

### 4.2 Table: `branches`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PK | Auto-increment ID |
| type | VARCHAR(20) | NOT NULL, CHECK ('head_office','school','college','hospital','medical_center','it_institute') | Branch type |
| name | VARCHAR(200) | NOT NULL | Display name |
| code | VARCHAR(20) | UNIQUE, NOT NULL | Short code (e.g. HQ, SCH01) |
| location | VARCHAR(255) | DEFAULT '' | Physical address |
| contact | VARCHAR(20) | DEFAULT '' | Phone number |
| is_active | BOOLEAN | DEFAULT TRUE | Soft delete flag |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

### 4.3 Table: `users`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PK | Auto-increment ID |
| password | VARCHAR(128) | NOT NULL | Hashed password |
| username | VARCHAR(150) | UNIQUE, NOT NULL | Login username |
| first_name | VARCHAR(150) | DEFAULT '' | First name |
| last_name | VARCHAR(150) | DEFAULT '' | Last name |
| email | VARCHAR(254) | DEFAULT '' | Email address |
| role | VARCHAR(20) | DEFAULT 'branch_manager', CHECK ('accounts_head','branch_manager','auditor') | User role |
| department | VARCHAR(100) | DEFAULT '' | Department name |
| employee_id | VARCHAR(50) | UNIQUE | Employee ID |
| phone | VARCHAR(20) | DEFAULT '' | Phone number |
| branch_id | BIGINT | FK → branches(id), ON DELETE SET NULL | Assigned branch |
| is_active | BOOLEAN | DEFAULT TRUE | Account active flag |
| is_superuser | BOOLEAN | DEFAULT FALSE | Django superuser |
| date_joined | TIMESTAMPTZ | DEFAULT NOW() | Account creation date |

Extends Django's `AbstractUser`.

### 4.4 Table: `expense_categories`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PK | Auto-increment ID |
| name | VARCHAR(100) | NOT NULL | Category name (e.g. Stationery) |
| description | TEXT | DEFAULT '' | Description |
| is_allowed | BOOLEAN | DEFAULT TRUE | Can be used for expenses? |
| monthly_limit | NUMERIC(10,2) | CHECK (>= 0) | Per-category monthly limit |
| is_active | BOOLEAN | DEFAULT TRUE | Active flag |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

### 4.5 Table: `monthly_budgets`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PK | Auto-increment ID |
| year | INTEGER | NOT NULL | Budget year |
| month | INTEGER | NOT NULL, CHECK (1-12) | Budget month |
| department | VARCHAR(100) | DEFAULT 'General' | Department name |
| total_budget | NUMERIC(12,2) | NOT NULL, CHECK (> 0) | Total budget amount |
| notes | TEXT | DEFAULT '' | Notes |
| created_by_id | BIGINT | FK → users(id), ON DELETE SET NULL | Who created it |
| branch_id | BIGINT | FK → branches(id), ON DELETE CASCADE | Branch this budget is for |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Unique Constraint:** (year, month, department, branch_id)

### 4.6 Table: `transactions`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PK | Auto-increment ID |
| date | DATE | NOT NULL | Transaction date |
| amount | NUMERIC(10,2) | NOT NULL, CHECK (> 0) | Amount in PKR |
| category_id | BIGINT | FK → expense_categories(id), ON DELETE RESTRICT | Expense category |
| budget_id | BIGINT | FK → monthly_budgets(id), ON DELETE RESTRICT | Linked budget |
| description | TEXT | NOT NULL | Expense description |
| receipt | VARCHAR(255) | | File path to uploaded receipt |
| vendor_name | VARCHAR(200) | DEFAULT '' | Vendor/shop name |
| entered_by_id | BIGINT | FK → users(id), ON DELETE SET NULL | Who entered it |
| branch_id | BIGINT | FK → branches(id), ON DELETE CASCADE | Branch |
| is_void | BOOLEAN | DEFAULT FALSE | Void flag |
| void_reason | TEXT | DEFAULT '' | Reason if voided |
| voided_by_id | BIGINT | FK → users(id), ON DELETE SET NULL | Who voided it |
| voided_at | TIMESTAMPTZ | | When voided |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** date, category_id, branch_id, is_void, entered_by_id

### 4.7 Table: `cash_fund`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | INTEGER | NOT NULL DEFAULT 1 | Fixed ID |
| current_balance | NUMERIC(12,2) | DEFAULT 0 | Current cash balance |
| low_balance_threshold | NUMERIC(10,2) | DEFAULT 5000 | Alert threshold |
| branch_id | BIGINT | FK → branches(id), ON DELETE CASCADE | Branch |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Unique Constraint:** (id, branch_id) — one fund per branch

### 4.8 Table: `replenishments`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PK | Auto-increment ID |
| amount | NUMERIC(10,2) | NOT NULL, CHECK (> 0) | Amount added |
| date | DATE | NOT NULL | Replenishment date |
| reference_number | VARCHAR(100) | DEFAULT '' | Cheque/voucher ref |
| notes | TEXT | DEFAULT '' | Notes |
| added_by_id | BIGINT | FK → users(id), ON DELETE SET NULL | Who added it |
| branch_id | BIGINT | FK → branches(id), ON DELETE CASCADE | Branch |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** date, branch_id

### 4.9 Table: `audit_logs`

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGSERIAL | PK | Auto-increment ID |
| user_id | BIGINT | FK → users(id), ON DELETE SET NULL | User who performed action |
| action | VARCHAR(20) | NOT NULL, CHECK ('create','update','void','login','replenish','budget_set') | Action type |
| model_name | VARCHAR(50) | NOT NULL | Affected model |
| object_id | INTEGER | | Affected object ID |
| description | TEXT | NOT NULL | Human-readable description |
| ip_address | INET | | Client IP |
| timestamp | TIMESTAMPTZ | DEFAULT NOW() | |

**Indexes:** timestamp DESC, user_id

---

## 5. API Endpoints Reference

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/login/` | None | Login, returns JWT + user data |
| POST | `/api/auth/refresh/` | None | Refresh access token |

### Dashboard

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/dashboard/` | JWT | Dashboard stats, charts, recent txns |

**Response includes:**
- `current_balance` — Cash fund balance
- `is_low_balance` — Alert flag
- `this_month_spent` — Total spent this month
- `this_month_budget` — Total budget this month
- `budget_remaining` — Remaining budget
- `budget_percent_used` — Percentage used (0-100)
- `total_transactions_this_month` — Count
- `recent_transactions` — Last 5 transactions
- `monthly_trend` — Last 6 months spending (array)
- `category_breakdown` — Per-category spending (array)
- `branch_wise_spent` — Per-branch spending (Accounts Head only)

### Transactions

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/transactions/` | JWT | List (filterable by year, month, category, branch, is_void, search) |
| GET | `/api/transactions/{id}/` | JWT | Detail with receipt URL |
| POST | `/api/transactions/` | JWT | Create (multipart/form-data with receipt file) |
| POST | `/api/transactions/{id}/void/` | JWT | Void transaction (reason required) |

### Categories

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/categories/` | JWT | List all categories |
| POST | `/api/categories/` | JWT + Accounts Head | Create category |
| PATCH | `/api/categories/{id}/` | JWT + Accounts Head | Update category |

### Budgets

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/budgets/` | JWT | List budgets (scoped by branch) |
| GET | `/api/budgets/current/` | JWT | Get current month budget |
| POST | `/api/budgets/` | JWT + Accounts Head | Create budget |
| PATCH | `/api/budgets/{id}/` | JWT + Accounts Head | Update budget |

### Cash Fund

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/cash-fund/` | JWT | Get fund balance + threshold |
| PATCH | `/api/cash-fund/` | JWT + Accounts Head | Update fund balance/threshold |

### Replenishments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/replenishments/` | JWT | List replenishments |
| POST | `/api/replenishments/` | JWT + Branch Manager+ | Add replenishment |

### Audit Logs

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/audit-logs/` | JWT + Auditor+ | List audit logs (filterable by action, model) |

### Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/users/` | JWT + Accounts Head | List all users |
| GET | `/api/me/` | JWT | Get current user profile |

### Exports

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/export/cashbook/` | JWT | Download cashbook Excel (year, month params) |
| GET | `/api/export/transactions/` | JWT | Download transactions Excel |
| GET | `/api/export/replenishments/` | JWT | Download replenishments Excel |

### Branches

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/branches/` | JWT | List active branches |
| POST | `/api/branches/` | JWT + Accounts Head | Create branch |
| PATCH | `/api/branches/{id}/` | JWT + Accounts Head | Update branch |

### Django Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| ANY | `/admin/` | Staff only | Django admin interface |

---

## 6. Frontend Pages & Components

### Pages

| Route | File | Description | Roles |
|-------|------|-------------|-------|
| `/` | `page.tsx` | Redirects to /dashboard or /login | All |
| `/login` | `login/page.tsx` | Login form with demo quick-login buttons | All |
| `/dashboard` | `dashboard/page.tsx` | Stats, budget bar, charts, recent txns | All |
| `/expenses` | `expenses/page.tsx` | Expense CRUD with filters + void | Accounts Head, Branch Manager |
| `/transactions` | `transactions/page.tsx` | Same as expenses (alternate route) | Accounts Head, Branch Manager |
| `/cashbook` | `cashbook/page.tsx` | Monthly ledger with debit/credit | All |
| `/replenishments` | `replenishments/page.tsx` | Fund replenishment list + add | Accounts Head, Branch Manager |
| `/branches` | `branches/page.tsx` | Branch cards with monthly spending | Accounts Head |
| `/audit-logs` | `audit-logs/page.tsx` | Audit trail table with action filter | Accounts Head, Auditor |
| `/settings` | `settings/page.tsx` | Categories, Budgets, Fund config tabs | Accounts Head |

### Shared Components

| Component | File | Description |
|-----------|------|-------------|
| `AppLayout` | `components/AppLayout.tsx` | Authenticated layout with sidebar, redirects to /login if unauthenticated |
| `Sidebar` | `components/Sidebar.tsx` | Navigation sidebar with role-based menu items, brand, user info, sign out |

### Context

| Context | File | Description |
|---------|------|-------------|
| `AuthContext` | `context/AuthContext.tsx` | Provides user, login, logout, role helpers (isAccountsHead, canEdit, etc.) |

### API Client

| File | Description |
|------|-------------|
| `lib/api.ts` | Axios instance with JWT interceptor, auto-refresh on 401, all API functions |

---

## 7. Role-Based Access Control

### Backend Permissions (`permissions.py`)

| Permission Class | Allows | Code Check |
|-----------------|--------|------------|
| `IsAccountsHead` | role == 'accounts_head' | `request.user.role == 'accounts_head'` |
| `IsBranchManagerOrAbove` | role in ['branch_manager', 'accounts_head'] | `request.user.role in ['branch_manager', 'accounts_head']` |
| `IsAuditorOrAbove` | role in ['auditor', 'branch_manager', 'accounts_head'] | `request.user.role in ['auditor', 'branch_manager', 'accounts_head']` |

### Frontend Auth Helpers (`AuthContext`)

| Helper | Logic |
|--------|-------|
| `isAccountsHead` | `user.role === 'accounts_head'` |
| `isBranchManager` | `user.role === 'branch_manager'` |
| `canEdit` | `user.role === 'accounts_head' \|\| user.role === 'branch_manager'` |

### Branch Scoping Logic (`views.py`)

```python
def get_user_branch(user):
    if user.role == 'accounts_head':
        return None  # sees all branches
    return user.branch  # limited to own branch
```

---

## 8. Key Business Logic

### Transaction Creation
1. Validate category is_allowed=True and is_active=True
2. Save transaction with entered_by = current user
3. Get or create CashFund for the branch
4. Deduct amount: `fund.current_balance -= transaction.amount`
5. Log audit: `action='create', model_name='Transaction'`

### Transaction Void
1. Check user has permission (Accounts Head or Branch Manager)
2. Check transaction not already voided
3. Validate reason is provided
4. Set is_void=True, void_reason, voided_by, voided_at
5. Restore amount: `fund.current_balance += transaction.amount`
6. Log audit: `action='void', model_name='Transaction'`

### Replenishment
1. Get or create CashFund for the branch
2. Add amount: `fund.current_balance += replenishment.amount`
3. Log audit: `action='replenish', model_name='Replenishment'`

### Dashboard Aggregation
- Scoped by user's branch (Accounts Head sees all)
- Current month's budget, spent, remaining, percentage
- Last 6 months spending trend
- Category breakdown for current month
- Branch-wise spending (Accounts Head only)
- Low balance alert

---

## 9. Environment Variables

### Backend (`.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | django-insecure-... | Django secret key |
| `DEBUG` | True | Debug mode |
| `DB_NAME` | petty_cash_db | PostgreSQL database name |
| `DB_USER` | postgres | Database user |
| `DB_PASSWORD` | postgres | Database password |
| `DB_HOST` | localhost | Database host |
| `DB_PORT` | 5432 | Database port |
| `ALLOWED_HOSTS` | localhost,127.0.0.1 | Django allowed hosts |
| `CORS_ALLOWED_ORIGINS` | http://localhost:3000 | CORS origins |

### Frontend (`.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | http://localhost:8000/api | Backend API URL |

---

## 10. Docker Deployment

### Services (`docker-compose.yml`)

| Service | Image | Port | Description |
|---------|-------|------|-------------|
| `db` | postgres:16-alpine | 5432 | PostgreSQL database |
| `pgadmin` | dpage/pgadmin4:latest | 5050 | Database GUI (profile: tools) |
| `backend` | ./backend/Dockerfile | 8000 | Django REST API |
| `frontend` | ./frontend/Dockerfile | 3000 | Next.js SPA |

### Docker Compose Commands

```bash
# Start all services
docker compose up -d

# Start with pgAdmin (tools profile)
docker compose --profile tools up -d

# Production
docker compose -f docker-compose.prod.yml up -d
```

### Dockerfile Highlights

**Backend:**
- Base: python:3.11-slim
- Installs system deps for psycopg2
- Runs migrations, seed_data, then gunicorn

**Frontend:**
- Multi-stage build (node:18-alpine)
- Builds Next.js static, runs with `npm start`

---

## 11. Export System

### Cashbook Excel Export
- Combines transactions (debit) and replenishments (credit) sorted by date
- Columns: Date, Particulars, Category/Ref, Branch, Vendor, Debit (Out), Credit (In), Receipt, Status
- Footer row with monthly totals
- Styled headers (dark navy), money format, auto-width columns

### Transactions Excel Export
- All transactions for selected month/year
- Columns: Date, Description, Category, Branch, Vendor, Amount, Receipt, Status, Entered By

### Replenishments Excel Export
- All replenishments for selected month/year
- Columns: Date, Amount, Reference#, Notes, Branch, Added By

---

## 12. Seed Data

The `seed_data` management command creates:

**Branches:**
- Head Office (HQ)
- School Campus 1 (SCH01)
- School Campus 2 (SCH02)
- City College (CLG01)
- City Hospital (HOS01)
- Community Medical Center (MED01)
- Tech Institute (IT01)

**Users:**
- accounts_head / Admin@1234 (role: accounts_head, no branch)
- manager_hq / Admin@1234 (role: branch_manager, branch: HQ)
- manager_sch01 / Admin@1234 (role: branch_manager, branch: SCH01)
- auditor1 / Admin@1234 (role: auditor, no branch)

**Categories:**
- Allowed: Stationery, Travel, Meals & Refreshments, Office Supplies, Utilities, Fuel & Transport, Maintenance
- NOT Allowed: Salary, Rent, Equipment Purchase, Furniture

---

## 13. JWT Configuration

| Setting | Value |
|---------|-------|
| Access token lifetime | 8 hours |
| Refresh token lifetime | 7 days |
| Rotate refresh tokens | Enabled |
| Token payload includes | role, full_name, employee_id |

---

## 14. Security Considerations

1. **JWT tokens** stored in cookies (not localStorage)
2. **Auto-refresh** on 401 with retry mechanism
3. **Role-based permissions** enforced at both backend (DRF permissions) and frontend (conditional rendering)
4. **Branch scoping** — Branch Managers cannot access other branches' data
5. **IP logging** — all audit entries store client IP
6. **File upload** restricted to images and PDF only
7. **Receipt mandatory** enforced at backend serializer and frontend form
8. **CORS** configured to allow only specific origins
9. **Password hashing** via Django's built-in PBKDF2
10. **Django admin** available only to staff/superuser accounts
