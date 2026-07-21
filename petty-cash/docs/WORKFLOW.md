# NGO Expense Management System — Workflow Documentation
# این جی او اخراجات کے انتظام کا نظام — ورک فلو دستاویزات

---

## Table of Contents
1. [System Overview / نظام کا تعارف](#1-system-overview)
2. [User Roles & Permissions / کردار اور اجازتیں](#2-user-roles--permissions)
3. [Complete Workflow Diagram](#3-complete-workflow-diagram)
4. [Login Flow / لاگ ان کا عمل](#4-login-flow)
5. [Expense Entry Workflow / اخراجات درج کرنے کا عمل](#5-expense-entry-workflow)
6. [Void Transaction Workflow / لین دین منسوخ کرنے کا عمل](#6-void-transaction-workflow)
7. [Fund Replenishment Workflow / فنڈ ری پلینشمنٹ کا عمل](#7-fund-replenishment-workflow)
8. [Budget Management Workflow / بجٹ کے انتظام کا عمل](#8-budget-management-workflow)
9. [Cashbook & Audit Workflow / کیش بک اور آڈٹ کا عمل](#9-cashbook--audit-workflow)
10. [Category Management Workflow / زمرہ جات کے انتظام کا عمل](#10-category-management-workflow)
11. [Data Flow Diagram](#11-data-flow-diagram)
12. [Business Rules / کاروباری اصول](#12-business-rules)

---

## 1. System Overview / نظام کا تعارف

This is a **Petty Cash / Expense Management System** designed for NGOs with multiple branches/campuses. It allows tracking of daily petty cash expenses, maintaining a cashbook, managing budgets, and providing full audit trails.

**Purpose:** Replace paper-based petty cash management with a digital system that enforces accountability through receipt mandates, role-based access, and complete audit logging.

**Supported Branch Types:**
- Head Office (ہیڈ آفس)
- School Campus (اسکول کیمپس)
- College (کالج)
- Hospital (ہسپتال)
- Medical Center (میڈیکل سینٹر)
- IT Institute (آئی ٹی انسٹی ٹیوٹ)

---

## 2. User Roles & Permissions / کردار اور اجازتیں

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ROLE ACCESS MATRIX                                     │
├──────────────────────┬──────────┬───────────────┬──────────┤
│ Feature              │ Accounts │ Branch        │ Auditor  │
│                      │ Head     │ Manager       │          │
├──────────────────────┼──────────┼───────────────┼──────────┤
│ Dashboard            │    ✓     │      ✓        │    ✓     │
│ Add Expense          │    ✓     │      ✓        │    ✗     │
│ View Cashbook        │    ✓     │      ✓        │    ✓     │
│ Void Transaction     │    ✓     │      ✓        │    ✗     │
│ Add Replenishment    │    ✓     │      ✓        │    ✗     │
│ View Replenishments  │    ✓     │      ✓        │    ✗     │
│ Manage Categories    │    ✓     │      ✗        │    ✗     │
│ Set Monthly Budget   │    ✓     │      ✗        │    ✗     │
│ Fund Settings        │    ✓     │      ✗        │    ✗     │
│ Audit Trail          │    ✓     │      ✗        │    ✓     │
│ View Branches        │    ✓     │      ✗        │    ✗     │
│ Manage Branches      │    ✓     │      ✗        │    ✗     │
└──────────────────────┴──────────┴───────────────┴──────────┘
```

### Role Descriptions:

| Role | Urdu | Access Level |
|------|------|-------------|
| **Accounts Head** | اکاؤنٹس ہیڈ | Full access — all branches, settings, configuration |
| **Branch Manager** | برانچ مینیجر | Own branch only — add expenses, view cashbook, replenish fund |
| **Auditor** | آڈیٹر | Read-only — dashboard, cashbook, audit logs |

### Branch Scoping:
- **Accounts Head**: Sees data for ALL branches
- **Branch Manager**: Sees data ONLY for their assigned branch
- **Auditor**: Can see audit logs for all branches (read-only)

---

## 3. Complete Workflow Diagram

```
                          ┌──────────────┐
                          │   LOGIN      │
                          │  (POST /api/ │
                          │  auth/login/)│
                          └──────┬───────┘
                                 │
                          ┌──────▼───────┐
                          │  JWT Token   │
                          │  Issued      │
                          └──────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
              ┌─────▼─────┐ ┌───▼────┐ ┌────▼─────┐
              │ Accounts  │ │Branch  │ │  Auditor  │
              │ Head      │ │Manager │ │           │
              └─────┬─────┘ └───┬────┘ └────┬─────┘
                    │            │            │
         ┌──────────┼────────────┼────────────┼──────────┐
         │          │            │            │          │
    ┌────▼───┐ ┌────▼───┐ ┌────▼───┐ ┌──────▼───┐ ┌────▼───┐
    │DASH-   │ │EXPENSE │ │CASH-   │ │REPLENISH-│ │AUDIT   │
    │BOARD   │ │ENTRY   │ │BOOK    │ │MENT      │ │TRAIL   │
    └────────┘ └────┬───┘ └────────┘ └─────┬────┘ └────────┘
                    │                       │
              ┌─────▼─────┐          ┌──────▼──────┐
              │ Upload    │          │ Fund        │
              │ Receipt   │          │ Balance     │
              │ (mandatory)│          │ Increases   │
              └─────┬─────┘          └──────┬──────┘
                    │                       │
              ┌─────▼─────┐          ┌──────▼──────┐
              │ Fund      │          │ Audit Log   │
              │ Balance   │          │ Created     │
              │ Decreases │          │             │
              └─────┬─────┘          └─────────────┘
                    │
              ┌─────▼─────┐
              │ Can be    │
              │ VOIDED    │
              │ later     │
              └───────────┘
```

---

## 4. Login Flow / لاگ ان کا عمل

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────►│ Backend  │────►│  JWT     │────►│ Redirect │
│  enters  │     │ Validates│     │ Tokens   │     │ to       │
│  creds   │     │          │     │ Returned │     │ Dashboard│
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                      │
                      ▼
               ┌──────────────┐
               │ Audit Log    │
               │ "User logged │
               │ in" created  │
               └──────────────┘
```

**Step-by-step:**
1. User navigates to `/login`
2. Enters username + password
3. Frontend calls `POST /api/auth/login/`
4. Backend validates credentials via JWT
5. On success:
   - `access_token` + `refresh_token` returned
   - Tokens stored in cookies (access: 1 day, refresh: 7 days)
   - User object returned with role, branch, profile info
   - Audit log entry created: "User logged in"
6. User redirected to `/dashboard`
7. On failure: error message displayed

**Token Refresh Flow:**
- On 401 response, frontend intercepts
- Calls `POST /api/auth/refresh/` with refresh token
- New access token issued
- Original request retried
- If refresh fails → redirect to `/login`

---

## 5. Expense Entry Workflow / اخراجات درج کرنے کا عمل

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────►│  Fill    │────►│ Upload   │────►│ Submit   │
│ clicks   │     │  Form    │     │ Receipt  │     │          │
│ "New     │     │          │     │ (Image/  │     │          │
│ Expense" │     │          │     │  PDF)    │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                                       │
                                                       ▼
                                                ┌──────────────┐
                                                │  Backend     │
                                                │  Validates:  │
                                                │  • Category  │
                                                │    allowed?  │
                                                │  • Amount>0  │
                                                │  • Receipt   │
                                                │    present   │
                                                └──────┬───────┘
                                                       │
                                          ┌────────────┼────────────┐
                                          │            │            │
                                          ▼            ▼            ▼
                                   ┌──────────┐ ┌──────────┐ ┌──────────┐
                                   │ Save     │ │ Deduct   │ │ Audit   │
                                   │ Trans-   │ │ from     │ │ Log     │
                                   │ action   │ │ Cash     │ │ Created │
                                   │ in DB    │ │ Fund     │ │         │
                                   └──────────┘ └──────────┘ └──────────┘
```

**Step-by-step:**
1. User with `canEdit` permission (Accounts Head or Branch Manager) clicks "New Expense"
2. Modal form opens with fields:
   - **Date** (default: today)
   - **Amount (PKR)** — must be > 0
   - **Category** — dropdown of allowed categories only (not-allowed categories like Salary, Rent are excluded)
   - **Branch** — only shown to Accounts Head (can assign to any branch)
   - **Description** — required text
   - **Vendor/Shop Name** — optional
   - **Receipt** — **mandatory**, image or PDF upload
3. User uploads receipt file
4. Frontend validates: receipt must be present
5. Form submitted as `FormData` via `POST /api/transactions/`
6. Backend validation:
   - Category must be `is_allowed=True` and `is_active=True`
   - Amount must be > 0
   - Receipt file must be attached
7. Transaction saved, `entered_by` set to current user
8. Cash Fund balance **decreased** by transaction amount
9. Audit log entry created: "New transaction: PKR X - CategoryName"
10. Success message shown, form closed, table refreshed

**Validation Rules:**
- Receipt is MANDATORY — no exception
- Not-allowed categories cannot be selected
- Amount must be positive
- Branch Manager can only add expenses for their own branch

---

## 6. Void Transaction Workflow / لین دین منسوخ کرنے کا عمل

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────►│  Confirms│────►│ Backend  │────►│ Fund     │
│  clicks  │     │  Void    │     │ Validates│     │ Balance  │
│  "Void"  │     │  + enters│     │ • Not    │     │ INCREASED│
│          │     │  Reason  │     │   already│     │          │
│          │     │          │     │   voided │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                       │
                                       ▼
                                ┌──────────────┐
                                │ Transaction  │
                                │ marked       │
                                │ is_void=True │
                                │ void_reason, │
                                │ voided_by,   │
                                │ voided_at    │
                                │ saved        │
                                └──────────────┘
                                       │
                                       ▼
                                ┌──────────────┐
                                │ Audit Log    │
                                │ "Voided      │
                                │ transaction  │
                                │ PKR X: reason"│
                                └──────────────┘
```

**Rules:**
- Transactions are NEVER deleted — only voided
- Void reason is REQUIRED
- Only Accounts Head and Branch Manager can void
- Voiding **restores** the amount to Cash Fund balance
- Already voided transactions cannot be voided again
- Voided transactions appear in all views with strikethrough + "Voided" badge

---

## 7. Fund Replenishment Workflow / فنڈ ری پلینشمنٹ کا عمل

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────►│  Fill    │────►│ Submit   │────►│ Cash     │
│  clicks  │     │  form:   │     │ POST /api│     │ Fund     │
│  "Add    │     │  Date,   │     │ /replen- │     │ Balance  │
│  Fund"   │     │  Amount, │     │ ishments/ │     │ INCREASED│
│          │     │  Ref #,  │     │          │     │          │
│          │     │  Notes   │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                       │
                                       ▼
                                ┌──────────────┐
                                │ Audit Log    │
                                │ "Fund        │
                                │ replenished: │
                                │ PKR X. Ref:  │
                                │ Y"           │
                                └──────────────┘
```

**Step-by-step:**
1. User with permission (Accounts Head or Branch Manager) clicks "Add Fund"
2. Form: Date, Amount (PKR), Reference Number, Notes
3. Submitted via `POST /api/replenishments/`
4. Cash Fund balance **increased** by replenishment amount
5. Audit log created
6. Low balance alert disappears if balance now above threshold

---

## 8. Budget Management Workflow / بجٹ کے انتظام کا عمل

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Accounts │────►│  Set     │────►│ System   │────►│ Dashboard│
│ Head     │     │  Budget  │     │ tracks   │     │ shows    │
│ opens    │     │  (Month, │     │ spent vs │     │ budget   │
│ Settings │     │  Year,   │     │ budget   │     │ progress │
│          │     │  Amount) │     │          │     │ bar      │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

**Features:**
- Only Accounts Head can set/edit budgets
- Budget is per branch + department per month/year
- Unique constraint: (year, month, department, branch)
- Dashboard shows: budget amount, spent, remaining, percentage used
- Visual indicator: Green (<70%), Amber (70-90%), Red (>90%)
- Budget can be updated later

---

## 9. Cashbook & Audit Workflow / کیش بک اور آڈٹ کا عمل

### Cashbook (کیش بک):
- Complete transaction ledger for a selected month/year
- Shows BOTH expenses (debit) and replenishments (credit)
- Sorted by date
- Running totals at bottom
- Month navigation (prev/next)
- Export to Excel

### Audit Trail (آڈٹ ٹریل):
- Every important action is logged with:
  - User who performed it
  - Action type (create, update, void, login, replenish, budget_set)
  - Module/model name
  - Description
  - IP address
  - Timestamp
- Viewable by: Accounts Head and Auditor only
- Filters: by action type

**Audited Events:**
| Event | Logged As |
|-------|-----------|
| User login | `login` |
| Transaction created | `create` |
| Transaction voided | `void` |
| Fund replenished | `replenish` |
| Budget set/updated | `budget_set` |

---

## 10. Category Management Workflow / زمرہ جات کے انتظام کا عمل

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Accounts │────►│ Add/Edit │────►│ Toggle   │
│ Head     │     │ Category │     │ Active/  │
│          │     │          │     │ Inactive │
└──────────┘     └──────────┘     └──────────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ Allowed  │ │ NOT     │ │ Inactive │
   │ (available│ │ Allowed  │ │ (hidden) │
   │  for      │ │ (ref.   │ │          │
   │  expense) │ │  only)  │ │          │
   └──────────┘ └──────────┘ └──────────┘
```

**Category Types:**
- **Allowed** — Available for expense entry (e.g., Stationery, Travel, Meals)
- **Not Allowed** — Reference only, cannot be used (e.g., Salary, Rent, Equipment)
- **Inactive** — Completely hidden from selection

---

## 11. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌────────┐ │
│  │Dashboard│ │ Expenses │ │Cashbook │ │Replenish │ │Settings│ │
│  │  Page   │ │  Page    │ │  Page   │ │  Page    │ │ Page   │ │
│  └────┬────┘ └────┬─────┘ └────┬────┘ └────┬─────┘ └───┬────┘ │
│       │           │            │           │           │       │
│  ┌────▼───────────▼────────────▼───────────▼───────────▼────┐  │
│  │                 API Client (axios)                        │  │
│  │           • JWT token injection (interceptor)             │  │
│  │           • Auto refresh on 401                          │  │
│  └─────────────────────────┬──────────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────────┘
                             │ HTTP/HTTPS
┌────────────────────────────┼────────────────────────────────────┐
│                     NGINX (Reverse Proxy)                       │
│  • /api/ → backend:8000   • /admin/ → backend:8000             │
│  • /media/ → backend media  • / → frontend:3000                │
└────────────────────────────┼────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                    BACKEND (Django REST)                        │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐ ┌────────┐ │
│  │  Auth   │ │Transaction│ │  Cash   │ │Category  │ │ Budget │ │
│  │ Views   │ │  Views   │ │ Fund    │ │ Views    │ │ Views  │ │
│  └────┬────┘ └────┬─────┘ └────┬────┘ └────┬─────┘ └───┬────┘ │
│       │           │            │           │           │       │
│  ┌────▼───────────▼────────────▼───────────▼───────────▼────┐  │
│  │              Serializers + Permissions                    │  │
│  └─────────────────────────┬──────────────────────────────────┘  │
│                            │                                     │
│  ┌─────────────────────────▼──────────────────────────────────┐  │
│  │                     Models (ORM)                            │  │
│  │  User │ Branch │ ExpenseCategory │ MonthlyBudget           │  │
│  │  Transaction │ CashFund │ Replenishment │ AuditLog         │  │
│  └─────────────────────────┬──────────────────────────────────┘  │
└────────────────────────────┼────────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────────┐
│                   PostgreSQL Database                            │
│  Tables: branches, users, expense_categories,                   │
│  monthly_budgets, transactions, cash_fund,                      │
│  replenishments, audit_logs                                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## 12. Business Rules / کاروباری اصول

### Core Rules:
1. **Receipt Mandatory** — No transaction saved without receipt upload
2. **No Delete** — Transactions are voided, never deleted
3. **Auto Balance** — Cash fund updates automatically on every transaction & replenishment
4. **Audit Everything** — Every action logged with IP and timestamp
5. **Branch Scoping** — Branch Manager sees only their branch data

### Transaction Rules:
- Amount must be > 0
- Category must be "allowed" and "active"
- Only 1 receipt per transaction
- Void requires a written reason

### Budget Rules:
- Unique per (year, month, department, branch)
- Can be set/updated anytime by Accounts Head
- Budget does not block overspending — only tracks it

### Fund Rules:
- Updated automatically on transaction create/void/replenish
- Low balance alert when balance ≤ threshold (default: 5000 PKR)
- Accounts Head can manually adjust balance if needed

### Audit Rules:
- Login, create, void, replenish, budget_set all logged
- IP address captured via X-Forwarded-For (or REMOTE_ADDR)
- Audit logs are view-only, never editable or deletable

---

## Demo Accounts / ڈیمو اکاؤنٹس

| Role | Username | Password | Branch |
|------|----------|----------|--------|
| Accounts Head | `accounts_head` | `Admin@1234` | All |
| Branch Manager (HQ) | `manager_hq` | `Admin@1234` | Head Office |
| Branch Manager (School) | `manager_sch01` | `Admin@1234` | School Campus 1 |
| Auditor | `auditor1` | `Admin@1234` | All (read-only) |

---

## Quick Links

| Page | URL | Roles |
|------|-----|-------|
| Login | `/login` | All |
| Dashboard | `/dashboard` | All |
| Expenses | `/expenses` | Accounts Head, Branch Manager |
| Cashbook | `/cashbook` | All |
| Replenishments | `/replenishments` | Accounts Head, Branch Manager |
| Branches | `/branches` | Accounts Head only |
| Audit Trail | `/audit-logs` | Accounts Head, Auditor |
| Settings | `/settings` | Accounts Head only |
