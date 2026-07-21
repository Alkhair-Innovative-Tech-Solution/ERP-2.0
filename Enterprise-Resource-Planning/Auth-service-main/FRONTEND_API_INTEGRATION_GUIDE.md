# Auth-Service Frontend API Integration Guide

**For:** Frontend Intern  
**Prerequisite:** Basic knowledge of Django backend, REST APIs, and Next.js  
**Base URL:** Configured via `NEXT_PUBLIC_API_URL` environment variable (default: `http://localhost:8000/api`)

---

## Table of Contents

1. [How the Backend URLs Work](#1-how-the-backend-urls-work)
2. [How the Frontend Calls APIs](#2-how-the-frontend-calls-apis)
3. [Environment Variable Setup](#3-environment-variable-setup)
4. [API Reference by Page](#4-api-reference-by-page)
   - [Login Page](#41-login-page)
   - [Dashboard (Home Page)](#42-dashboard-home-page)
   - [Employees List](#43-employees-list)
   - [New Employee Form](#44-new-employee-form)
   - [Edit Employee Form](#45-edit-employee-form)
   - [Institutions Page](#46-institutions-page)
   - [Institution Detail & Edit Pages](#47-institution-detail--edit-pages)
   - [Departments Page](#48-departments-page)
   - [Designations Page](#49-designations-page)
   - [Branches Page](#410-branches-page)
   - [Profile Page](#411-profile-page)
   - [Audit Logs Page](#412-audit-logs-page)
   - [Settings Page](#413-settings-page)
5. [Issues Found: Mock/Hardcoded Data](#5-issues-found-mockhardcoded-data)
6. [Common Patterns and Gotchas](#6-common-patterns-and-gotchas)
7. [Best Practices for API Integration](#7-best-practices-for-api-integration)
8. [Working Strategy: Connecting All APIs Perfectly](#8-working-strategy-connecting-all-apis-perfectly)
9. [How to Debug: Step-by-Step Guide](#9-how-to-debug-step-by-step-guide)

---

## 1. How the Backend URLs Work

The Django backend uses **Django Ninja** (not Django REST Framework). All APIs are registered in:

**File:** `Backend/src/core/urls.py`

```python
api.add_router("/auth", auth_router)          # --> /api/auth/...
api.add_router("/permissions", permissions_router)  # --> /api/permissions/...
api.add_router("/employees", employees_router)      # --> /api/employees/...
```

So when the backend is running on `localhost:8000`, the full URL pattern is:

| Router Prefix   | Example Full URL                          |
|-----------------|-------------------------------------------|
| `/api/auth`     | `http://localhost:8000/api/auth/login`     |
| `/api/employees`| `http://localhost:8000/api/employees/employees` |
| `/api/permissions`| `http://localhost:8000/api/permissions/services` |

**IMPORTANT:** The employees router is mounted at `/api/employees`, and its internal endpoints also start with `/employees`, `/institutions`, `/departments`, etc. This means:

- `GET /api/employees/employees` - list employees
- `GET /api/employees/institutions` - list institutions
- `GET /api/employees/departments` - list departments
- `GET /api/employees/designations` - list designations
- `GET /api/employees/branches` - list branches

---

## 2. How the Frontend Calls APIs

**File:** `frontend/src/utils/api.ts`

The `fetchWithAuth()` helper function:
- Reads `NEXT_PUBLIC_API_URL` from environment (or falls back to `http://{hostname}:8000/api`)
- Automatically attaches `Authorization: Bearer <token>` from `localStorage`
- Sends `Content-Type: application/json` by default
- On 401 response, clears the stored token

**Usage pattern:**
```typescript
// The endpoint you pass gets appended to API_BASE_URL
// So fetchWithAuth('/employees') calls: http://localhost:8000/api/employees
const res = await fetchWithAuth('/employees');
const data = await res.json();
```

**CRITICAL:** The `fetchWithAuth` appends the endpoint to `/api`. But the backend employees router is at `/api/employees/...`. So:
- `fetchWithAuth('/employees')` hits `http://localhost:8000/api/employees` 
- `fetchWithAuth('/institutions')` hits `http://localhost:8000/api/institutions`

Since the employees router is mounted at `/api/employees`, the actual backend URL for listing employees is `/api/employees/employees`. The frontend is calling `/api/employees` which also resolves because the router handles the endpoint. Check the router prefix carefully when debugging 404s.

---

## 3. Environment Variable Setup

**File:** `frontend/.env.local`

```
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

- `NEXT_PUBLIC_` prefix is required for Next.js to expose the variable to the browser
- In production/Docker, this should point to the actual backend URL
- If not set, falls back to `http://{window.location.hostname}:8000/api`

---

## 4. API Reference by Page

### 4.1 Login Page

**File:** `frontend/src/app/login/page.tsx`

| Action | Method | Endpoint | Auth Required |
|--------|--------|----------|---------------|
| Login  | POST   | `/auth/login` | No |

**Request Body:**
```json
{
  "employee_code": "IAK-0001",
  "password": "yourPassword"
}
```

**Response (200 OK):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "expires_in": 3600,
  "employee": {
    "id": "uuid",
    "code": "IAK-0001",
    "full_name": "John Doe",
    "email": "john@example.com",
    "is_superadmin": false,
    "employee_id": "IAK-0001",
    "department": "Engineering",
    "designation": "Developer"
  }
}
```

**Note:** The login page correctly uses `process.env.NEXT_PUBLIC_API_URL` with a direct `fetch()` call (not `fetchWithAuth`) because there's no token yet.

---

### 4.2 Dashboard (Home Page)

**File:** `frontend/src/app/page.tsx`

**APIs called on page load (all GET, all need Auth):**

| Purpose | Endpoint | Backend Handler |
|---------|----------|-----------------|
| Employee count | `GET /employees/` | `employees.api.list_employees` |
| Institution count | `GET /institutions/` | `employees.api.list_institutions` |
| Department count | `GET /departments/` | `employees.api.list_departments` |
| Designation count | `GET /designations/` | `employees.api.list_designations` |

**Response Formats:**

| Endpoint | Response Type |
|----------|--------------|
| `/employees/` | `{ employees: [...], total, page, per_page, total_pages }` |
| `/institutions/` | `[{ inst_code, name, inst_type, address, city, ... }]` (array) |
| `/departments/` | `[{ id, dept_code, dept_name, institution_code }]` (array) |
| `/designations/` | `[{ id, position_code, position_name, department__dept_code }]` (array) |

**HARDCODED/MOCK DATA found (see Section 5):**
- `streamEvents` - hardcoded activity stream
- `monthlyTrend` - hardcoded chart data `[14, 22, 18, 30, 26, 40]`
- Organization Alerts ("72 employees missing CNIC", "3 Contracts end this month") - hardcoded
- `SystemStatusCard` inactive count is hardcoded to `15`
- Org Mix fallback uses hardcoded departments with random employee counts

---

### 4.3 Employees List

**File:** `frontend/src/app/employees/page.tsx`

| Action | Method | Endpoint | Auth Required |
|--------|--------|----------|---------------|
| List employees | GET | `/employees` | Yes (via fetchWithAuth) |

**Response:**
```json
{
  "employees": [
    {
      "employee_id": "IAK-0001",
      "employee_code": "IAK-0001",
      "full_name": "John Doe",
      "email": "john@example.com",
      "phone": "03001234567",
      "department": { "dept_name": "Engineering", "dept_code": "ENG" },
      "designation": { "position_name": "Developer", "position_code": "DEV" },
      "is_active": true,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 50,
  "page": 1,
  "per_page": 20,
  "total_pages": 3
}
```

**Query Parameters supported by backend (not fully used by frontend yet):**
- `page` (int) - page number
- `per_page` (int) - items per page (max 100)
- `search` (string) - search in name, email, code
- `department` (string) - filter by dept_code
- `designation` (string) - filter by position_code

**Note:** The frontend does client-side filtering by name/code and a "Priority" filter that does NOT exist in the backend (it's a frontend-only concept).

---

### 4.4 New Employee Form

**File:** `frontend/src/app/employees/new/page.tsx`

**APIs called on page load (metadata for dropdowns):**

| Purpose | Method | Endpoint |
|---------|--------|----------|
| Load institutions | GET | `/institutions` |
| Load departments | GET | `/departments` |
| Load organizations | GET | `/organizations` |

**APIs called on user interaction:**

| Trigger | Method | Endpoint |
|---------|--------|----------|
| Institution selected | GET | `/branches?institution_code={code}` |
| Department selected | GET | `/designations?department_code={code}` |

**API called on form submit:**

| Action | Method | Endpoint |
|--------|--------|----------|
| Create employee | POST | `/employees` |

**Submit Request Body (JSON):**
```json
{
  "fullName": "John Doe",
  "cnic": "42101-1234567-1",
  "dob": "1990-05-15",
  "gender": "male",
  "maritalStatus": "single",
  "nationality": "Pakistani",
  "religion": "Islam",
  "personalEmail": "john@example.com",
  "mobile": "03001234567",
  "orgEmail": "",
  "orgPhone": "",
  "residentialAddress": "123 Street, Block A",
  "permanentAddress": "",
  "city": "Karachi",
  "state": "Sindh",
  "organizationCode": "IAK",
  "bankName": "HBL",
  "accountNumber": "1234567890",
  "emergencyName": "Jane Doe",
  "emergencyPhone": "03009876543",
  "institutionCode": "AKS01",
  "branchCode": "BR-01",
  "departmentCode": "ENG",
  "designationCode": "DEV",
  "joiningDate": "2024-01-01",
  "shift": "general",
  "education": [
    { "degree": "BS CS", "institute": "FAST", "passingYear": "2020" }
  ],
  "experience": [
    { "employer": "XYZ Corp", "jobTitle": "Intern", "startDate": "2020-06", "endDate": "2021-01", "responsibilities": "Development" }
  ]
}
```

**IMPORTANT NOTE:** The backend `create_employee` endpoint expects `Form(...)` data (multipart form) with optional file upload, but the frontend sends `JSON`. This mismatch may cause issues. The backend has **two** `create_employee` definitions (duplicate route at lines 182 and 587) - the second one overrides the first.

**Validation rules enforced by backend:**
- CNIC: format `XXXXX-XXXXXXX-X` (Pakistani format)
- Mobile: Pakistani format starting with 3XX
- Email: standard email format
- CNIC must be unique (no existing employee with same CNIC)

---

### 4.5 Edit Employee Form

**File:** `frontend/src/app/employees/[id]/edit/page.tsx`

**APIs called on page load:**

| Purpose | Method | Endpoint |
|---------|--------|----------|
| Load institutions | GET | `/institutions` |
| Load departments | GET | `/departments` |
| Load organizations | GET | `/organizations` |
| Load employee data | GET | `/employees/{employee_id}` |
| Load branches per assignment | GET | `/branches?institution_code={code}` |
| Load designations per assignment | GET | `/designations?department_code={code}` |

**Employee detail response fields used for form pre-fill:**
```json
{
  "employee_id": "IAK-0001",
  "full_name": "John Doe",
  "cnic": "4210112345671",
  "dob": "1990-05-15",
  "gender": "Male",
  "marital_status": "Single",
  "nationality": "Pakistani",
  "religion": "Islam",
  "personal_email": "john@example.com",
  "personal_phone": "03001234567",
  "org_email": "",
  "org_phone": "",
  "address": {
    "residential": "123 Street",
    "permanent": "",
    "city": "Karachi",
    "state": "Sindh"
  },
  "bank_info": {
    "bank_name": "HBL",
    "account_number": "1234567890"
  },
  "emergency_contact": {
    "name": "Jane Doe",
    "phone": "03009876543"
  },
  "assignments": [...],
  "education_history": [...],
  "work_experience": [...],
  "resume_url": "...",
  "is_active": true
}
```

**API called on form submit:**

| Action | Method | Endpoint |
|--------|--------|----------|
| Update employee | PUT | `/employees/{employee_id}` |

**NOTE:** There is NO `PUT /employees/{employee_id}` endpoint in the backend! The backend only has `GET` and `DELETE` for individual employees. The update will return 405 Method Not Allowed. This needs to be implemented in the backend.

---

### 4.6 Institutions Page

**File:** `frontend/src/app/institutions/page.tsx`

**APIs called on page load:**

| Purpose | Method | Endpoint |
|---------|--------|----------|
| List institutions | GET | `/institutions` |
| List organizations | GET | `/organizations` |

**CRUD operations:**

| Action | Method | Endpoint | Request Body |
|--------|--------|----------|-------------|
| Create institution | POST | `/institutions` | `{ inst_code, name, inst_type, organization_code, city, address, contact_number }` |
| Update institution | PUT | `/institutions/{id}` | Same fields as create |
| Delete institution | DELETE | `/institutions/{id}` | - |
| Load branches for an institution | GET | `/branches?institution_code={code}` | - |
| Create branch | POST | `/branches` | `{ branch_name, branch_code, institution_code, status, address, city, contact_number, email, branch_head_name }` |
| Delete branch | DELETE | `/branches/{branch_id}` | - |

**Backend Institution Response Fields:**
```json
{
  "id": "uuid",
  "inst_id": "auto-generated",
  "inst_code": "AKS01",
  "name": "Al-Khair School",
  "inst_type": "educational",
  "address": "123 Main St",
  "city": "Karachi",
  "contact_number": "+92-300-1234567",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Backend Branch Response Fields:**
```json
{
  "branch_id": "auto-generated",
  "branch_code": "BR-01",
  "branch_name": "Main Campus",
  "institution_code": "AKS01",
  "status": "active",
  "address": "...",
  "city": "Karachi",
  "contact_number": "...",
  "email": "branch@school.edu.pk",
  "branch_head_name": "Dr. Ali",
  "domain_data": {}
}
```

---

### 4.7 Institution Detail & Edit Pages

**Files:**
- `frontend/src/app/institutions/[id]/page.tsx` (detail view)
- `frontend/src/app/institutions/[id]/edit/page.tsx` (edit form)
- `frontend/src/app/institutions/new/page.tsx` (create form)

**BUG: Wrong API path prefix!** These pages call:
- `fetchWithAuth('/employees/institutions/{id}/')` 
- `fetchWithAuth('/employees/institutions/', { method: 'POST' })`

The correct endpoint from the main institutions page is:
- `fetchWithAuth('/institutions/{id}')`
- `fetchWithAuth('/institutions', { method: 'POST' })`

The `/employees/` prefix is added because these were coded to match the full router path (`/api/employees/institutions/`) but `fetchWithAuth` already prepends `/api`. Since the employees router is mounted at `/api/employees`, calling `/employees/institutions` actually resolves to `/api/employees/institutions` which IS the correct full path. **Both patterns work but for consistency, all pages should use the same path style.**

**Fields for create/edit institution form:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `inst_code` | string | Yes | Unique identifier, e.g. "AKS01" |
| `name` | string | Yes | Full institution name |
| `inst_type` | string | Yes | One of: educational, healthcare, social_welfare, administrative, technical, operational, other |
| `address` | string | No | Full address |
| `city` | string | No | City name |
| `contact_number` | string | No | Phone number |

---

### 4.8 Departments Page

**File:** `frontend/src/app/departments/page.tsx`

**APIs called on page load:**

| Purpose | Method | Endpoint |
|---------|--------|----------|
| List departments | GET | `/departments` |
| List institutions (for modal dropdown) | GET | `/institutions` |

**CRUD operations:**

| Action | Method | Endpoint | Request Body |
|--------|--------|----------|-------------|
| Create | POST | `/departments` | `{ dept_code, dept_name, institution_code, description }` |
| Update | PUT | `/departments/{dept_code}` | `{ dept_name, description, institution_code }` |
| Delete | DELETE | `/departments/{dept_code}` | - |

**Backend Department Fields:**

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `dept_code` | string | Yes | Max 6 chars, alphanumeric only, must be unique |
| `dept_name` | string | Yes | Department full name |
| `institution_code` | string | No | Links to an institution |
| `description` | string | No | Brief description |

**Backend response for list:**
```json
[
  {
    "id": "uuid",
    "dept_code": "ENG",
    "dept_name": "Engineering",
    "dept_sector": "General",
    "institution_code": "AKS01"
  }
]
```

**Delete restriction:** Cannot delete a department that has active employees assigned to it.

---

### 4.9 Designations Page

**File:** `frontend/src/app/designations/page.tsx`

**APIs called on page load:**

| Purpose | Method | Endpoint |
|---------|--------|----------|
| List designations | GET | `/designations` |
| List departments (for modal dropdown) | GET | `/departments` |

**CRUD operations:**

| Action | Method | Endpoint | Request Body |
|--------|--------|----------|-------------|
| Create | POST | `/designations` | `{ department_code, position_code, position_name, description }` |
| Update | PUT | `/designations/{id}` | `{ position_name, description }` |
| Delete | DELETE | `/designations/{id}` | - |

**NOTE:** The frontend POST for creating designations sends the data but there is NO `POST /designations` handler in the backend `api.py`! The backend only has GET (list), GET/{id}, PUT/{id}, DELETE/{id}. You need to check if there's a separate creation endpoint or if this is missing.

**Backend response for list:**
```json
[
  {
    "id": "uuid",
    "position_code": "DEV-01",
    "position_name": "Software Developer",
    "department__dept_code": "ENG"
  }
]
```

**Delete restriction:** Cannot delete a designation with active employees.

---

### 4.10 Branches Page

**File:** `frontend/src/app/branches/page.tsx`

**APIs called on page load:**

| Purpose | Method | Endpoint |
|---------|--------|----------|
| List all branches | GET | `/branches` |

**MAJOR ISSUE: Save and Delete are NOT calling the API!**

The `handleSave` and `handleDelete` functions in this page only update local state (client-side array manipulation). They do NOT call `fetchWithAuth` to persist changes to the backend.

```typescript
// Current code - LOCAL ONLY, NOT HITTING API:
async function handleSave(data: Partial<Branch>) {
  if (editTarget) {
    setBranches(prev => prev.map(b => b.branch_id === editTarget.branch_id ? { ...b, ...data } : b));
  } else {
    setBranches(prev => [{ branch_id: String(Date.now()), ...data } as Branch, ...prev]);
  }
}
```

**Should be calling:**
- Create: `POST /branches` with `{ branch_name, branch_code, institution_code, status, ... }`
- Update: `PUT /branches/{branch_id}` (NOTE: this endpoint doesn't exist in backend yet)
- Delete: `DELETE /branches/{branch_id}` (NOTE: this endpoint doesn't exist in backend yet)

---

### 4.11 Profile Page

**File:** `frontend/src/app/profile/page.tsx`

**No API calls.** This page reads user data from the `AuthContext` (which stores data from the login response in `localStorage`). The displayed fields are:
- `user.full_name`
- `user.code` (employee_code)
- `user.email`
- `user.department`
- `user.designation`
- `user.is_superadmin`

The "Edit Profile" button is non-functional (no handler attached).

---

### 4.12 Audit Logs Page

**File:** `frontend/src/app/audit-logs/page.tsx`

| Action | Method | Endpoint | Auth Required |
|--------|--------|----------|---------------|
| Load logs | GET | `/audit-logs?limit=50` | Yes |

**NOTE:** There is NO `/audit-logs` endpoint defined in the backend. This endpoint does not exist in any of the three routers (auth, employees, permissions). The page will always show "No activity records found" because the API call will return 404.

---

### 4.13 Settings Page

**File:** `frontend/src/app/settings/page.tsx`

**No API calls.** This is a fully static/UI-only page. The "Save Preferences" and "Change Password" buttons are non-functional (no handlers).

---

## 5. Issues Found: Mock/Hardcoded Data

### CRITICAL (Must Fix - These fake data/logic will mislead users)

| Page | Issue | Location | Fix Required |
|------|-------|----------|-------------|
| **Dashboard** | `streamEvents` array is hardcoded ("James Smith joined Engineering", etc.) | `page.tsx` lines 288-292 | Replace with real API call or remove section |
| **Dashboard** | `monthlyTrend = [14, 22, 18, 30, 26, 40]` chart data is hardcoded | `page.tsx` line 296 | Need a backend endpoint for hiring trends |
| **Dashboard** | Organization Alerts are hardcoded ("72 employees missing CNIC", "3 Contracts end this month") | `page.tsx` lines 477-488 | Need backend endpoint or remove |
| **Dashboard** | `SystemStatusCard` inactive count is hardcoded to `15` | `page.tsx` line 410 | Should come from employee data |
| **Dashboard** | Org Mix fallback uses hardcoded dept names with `Math.random()` counts | `page.tsx` lines 348-354 | Should use `employee_count` from `/departments/{code}` endpoint |
| **Dashboard** | `dept_mix` uses `d.employee_count || Math.floor(Math.random() * 150 + 50)` - random fallback! | `page.tsx` line 345 | The `/departments` list endpoint doesn't return `employee_count`; use `GET /departments/{dept_code}` which does |
| **Branches Page** | Create/Edit/Delete only update local state, NOT the backend API | `page.tsx` lines 130-142 | Must call `fetchWithAuth('/branches', { method: 'POST', ... })` |
| **Employees List** | "Priority" filter (High/Medium/Low) - backend has no `priority` field | `page.tsx` line 309 | Remove filter or add field to backend |
| **Employees List** | Gender stats count relies on `e.gender === 'Male'` but backend returns `get_gender_display()` which could be different casing | `page.tsx` lines 317-318 | Normalize comparison |

### MODERATE (Should Fix)

| Page | Issue |
|------|-------|
| **Audit Logs** | Calls `/audit-logs` endpoint which doesn't exist in backend |
| **Settings** | Entirely static - no save functionality |
| **Profile** | "Edit Profile" button does nothing |
| **Institution pages** | Inconsistent path prefixes (`/employees/institutions/` vs `/institutions`) |
| **Edit Employee** | Calls `PUT /employees/{id}` which doesn't exist in backend |
| **Dashboard** | Sub text "+0 this month", "1 this week", "+1.2% growth" are hardcoded strings |

---

## 6. Common Patterns and Gotchas

### Pattern: How dropdown cascading works

When building forms with dependent dropdowns (Institution -> Branch, Department -> Designation):

```
1. Page loads -> fetch all institutions and departments
2. User selects Institution -> fetch branches filtered: GET /branches?institution_code=AKS01
3. User selects Department -> fetch designations filtered: GET /designations?department_code=ENG
```

### Pattern: How fetchWithAuth works

```typescript
// GET request
const res = await fetchWithAuth('/employees');
const data = await res.json();

// POST request
const res = await fetchWithAuth('/departments', {
  method: 'POST',
  body: JSON.stringify({ dept_code: 'ENG', dept_name: 'Engineering' })
});

// PUT request
const res = await fetchWithAuth(`/departments/${deptCode}`, {
  method: 'PUT',
  body: JSON.stringify({ dept_name: 'Updated Name' })
});

// DELETE request
const res = await fetchWithAuth(`/departments/${deptCode}`, { method: 'DELETE' });
```

### Gotcha: Response format inconsistency

- `/employees` returns `{ employees: [...], total, page, ... }` (object with array inside)
- `/institutions` returns `[...]` (direct array)
- `/departments` returns `[...]` (direct array)
- `/designations` returns `[...]` (direct array)
- `/branches` returns `[...]` (direct array)

The frontend handles this with:
```typescript
const data = await res.json();
const array = Array.isArray(data) ? data : (data.employees || []);
```

### Gotcha: Auth token flow

1. User logs in -> receives `access_token` and `refresh_token`
2. `access_token` stored in `localStorage` as `access_token`
3. `fetchWithAuth` reads from `localStorage` and adds `Authorization: Bearer <token>` header
4. Token expires in 3600 seconds (1 hour)
5. On 401, token is cleared from localStorage (user must re-login)

### Quick Backend Endpoint Cheat Sheet

| Method | Full Backend Path | What It Does |
|--------|-------------------|-------------|
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/logout` | Logout |
| POST | `/api/auth/refresh` | Refresh token |
| GET | `/api/auth/me` | Current user info |
| GET | `/api/employees/employees` | List employees (paginated) |
| GET | `/api/employees/employees/{id}` | Get single employee |
| POST | `/api/employees/employees` | Create employee |
| DELETE | `/api/employees/employees/{id}` | Soft-delete employee |
| GET | `/api/employees/institutions` | List institutions |
| POST | `/api/employees/institutions` | Create institution |
| GET | `/api/employees/institutions/{id}` | Get single institution |
| PUT | `/api/employees/institutions/{id}` | Update institution |
| DELETE | `/api/employees/institutions/{id}` | Soft-delete institution |
| GET | `/api/employees/branches` | List branches (optional `?institution_code=X`) |
| POST | `/api/employees/branches` | Create branch |
| GET | `/api/employees/departments` | List departments (optional `?institution_code=X` or `?branch_code=X`) |
| POST | `/api/employees/departments` | Create department |
| GET | `/api/employees/departments/{dept_code}` | Get department detail |
| PUT | `/api/employees/departments/{dept_code}` | Update department |
| DELETE | `/api/employees/departments/{dept_code}` | Soft-delete department |
| GET | `/api/employees/designations` | List designations (optional `?department_code=X`) |
| GET | `/api/employees/designations/{id}` | Get designation detail |
| PUT | `/api/employees/designations/{id}` | Update designation |
| DELETE | `/api/employees/designations/{id}` | Soft-delete designation |
| GET | `/api/permissions/services` | Get employee's available services |
| GET | `/api/permissions/check/{service}` | Check service access |
| GET | `/api/permissions/hdms-role` | Get HDMS role info |
| GET | `/api/permissions/hdms-users` | List all HDMS users |
| POST | `/api/permissions/grant-hdms-access` | Grant HDMS access to employee |
| GET | `/api/permissions/hdms-access/{employee_id}` | Check employee's HDMS access |

### Missing Backend Endpoints (Frontend expects but don't exist)

| What Frontend Calls | Status |
|---------------------|--------|
| `PUT /employees/{id}` | Does NOT exist - employee update not implemented |
| `POST /designations` | Does NOT exist - designation creation not implemented |
| `GET /organizations` | Does NOT exist - returns 404 |
| `GET /audit-logs` | Does NOT exist |
| `PUT /branches/{id}` | Does NOT exist |
| `DELETE /branches/{id}` | Does NOT exist |

---

## 7. Best Practices for API Integration

### 7.1 Always Use `fetchWithAuth` - Never Raw `fetch`

The ONLY exception is the login page (because you don't have a token yet). Everywhere else, use `fetchWithAuth`:

```typescript
// WRONG - don't do this on authenticated pages
const res = await fetch('http://localhost:8000/api/employees');

// CORRECT - always use the helper
const res = await fetchWithAuth('/employees');
```

**Why:** `fetchWithAuth` handles three things for you automatically:
1. Prepends the correct `API_BASE_URL` (reads from env)
2. Attaches the `Authorization: Bearer` token from localStorage
3. Clears stale tokens on 401 errors

### 7.2 Always Use the Environment Variable for API URL

Never hardcode `http://localhost:8000` anywhere in your code.

```typescript
// WRONG
const res = await fetch('http://localhost:8000/api/departments');

// WRONG - even with template string
const res = await fetch(`http://127.0.0.1:8000/api/departments`);

// CORRECT - the env is already baked into fetchWithAuth
const res = await fetchWithAuth('/departments');

// CORRECT - if you MUST use raw fetch (login page only)
const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/login`, { ... });
```

**Why:** The URL changes between development (`localhost:8000`), Docker (`http://auth-service:8000`), and production. The env variable handles this.

### 7.3 Always Check `res.ok` Before Parsing JSON

```typescript
// WRONG - will crash on 404/500
const res = await fetchWithAuth('/employees');
const data = await res.json(); // crash if res is 404

// CORRECT
const res = await fetchWithAuth('/employees');
if (res.ok) {
  const data = await res.json();
  setEmployees(data.employees || []);
} else {
  const errorData = await res.json();
  console.error("API Error:", errorData.error);
  setError(errorData.error || 'Something went wrong');
}
```

### 7.4 Handle Both Array and Object Responses

The backend is inconsistent - some endpoints return arrays, others return objects. Always handle both:

```typescript
const res = await fetchWithAuth('/departments');
if (res.ok) {
  const data = await res.json();
  // This one-liner handles both formats safely
  const departments = Array.isArray(data) ? data : (data.departments || []);
  setDepartments(departments);
}
```

### 7.5 Never Store API Data That Doesn't Exist

If the backend doesn't return a field, don't fake it on the frontend:

```typescript
// WRONG - inventing data the backend doesn't provide
const stats = {
  total: employees.length,
  priority_high: employees.filter(e => e.priority === 'High').length, // 'priority' doesn't exist in backend!
};

// CORRECT - only use fields the backend actually returns
const stats = {
  total: employees.length,
  active: employees.filter(e => e.is_active).length, // 'is_active' exists in backend
};
```

### 7.6 Use the Correct HTTP Method

Django Ninja is strict about HTTP methods. Using the wrong method gives `405 Method Not Allowed`:

| Operation | Method | Example |
|-----------|--------|---------|
| Fetch data | `GET` | `fetchWithAuth('/departments')` |
| Create new record | `POST` | `fetchWithAuth('/departments', { method: 'POST', body: ... })` |
| Update existing record | `PUT` | `fetchWithAuth('/departments/ENG', { method: 'PUT', body: ... })` |
| Delete record | `DELETE` | `fetchWithAuth('/departments/ENG', { method: 'DELETE' })` |

### 7.7 Send JSON Body Correctly

`fetchWithAuth` already sets `Content-Type: application/json`. Just stringify your data:

```typescript
const res = await fetchWithAuth('/departments', {
  method: 'POST',
  body: JSON.stringify({
    dept_code: 'ENG',
    dept_name: 'Engineering',
    institution_code: 'AKS01',
    description: 'Engineering department'
  })
});
```

**Do NOT** set `Content-Type` again manually - it will conflict with the default.

### 7.8 Reload Data After Mutations

After any create/update/delete, always refetch the list:

```typescript
async function handleDelete(deptCode: string) {
  const res = await fetchWithAuth(`/departments/${deptCode}`, { method: 'DELETE' });
  if (res.ok) {
    loadData(); // re-fetch the full list from backend
  } else {
    const err = await res.json();
    alert(err.error || 'Failed to delete');
  }
}
```

**Never** just update local state without hitting the API (like the Branches page currently does).

### 7.9 Use Loading States for Every API Call

```typescript
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

async function loadData() {
  try {
    setLoading(true);
    setError(null);
    const res = await fetchWithAuth('/departments');
    if (res.ok) {
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    } else {
      setError('Failed to load departments');
    }
  } catch (err) {
    setError('Network error - is the backend running?');
  } finally {
    setLoading(false); // ALWAYS runs - even if error
  }
}
```

### 7.10 Know the Correct Endpoint Path Pattern

The employees router is mounted at `/api/employees`. So inside the router:
- `@router.get("/employees")` becomes `GET /api/employees/employees`
- `@router.get("/institutions")` becomes `GET /api/employees/institutions`

But `fetchWithAuth` prepends `API_BASE_URL` which is `/api`. So:

```
fetchWithAuth('/employees')         -> GET http://localhost:8000/api/employees
fetchWithAuth('/employees/IAK-0001') -> GET http://localhost:8000/api/employees/IAK-0001
fetchWithAuth('/institutions')       -> GET http://localhost:8000/api/institutions  <-- will this work?
```

**The trick:** Django Ninja resolves `/api/employees` to the `list_employees` handler because the router prefix `/employees` + endpoint `/employees` = `/employees/employees`, but the frontend calls `/employees` which matches the LIST endpoint directly. This works because Django Ninja sees `/api` + `/employees` and the employees router catches it.

**Rule of thumb:** Call `fetchWithAuth` with the short path that matches the endpoint decorator:
- List employees: `fetchWithAuth('/employees')`
- List institutions: `fetchWithAuth('/institutions')`
- List departments: `fetchWithAuth('/departments')`
- Single employee: `fetchWithAuth('/employees/IAK-0001')`

---

## 8. Working Strategy: Connecting All APIs Perfectly

### Step 1: Understand the Full Request Journey

```
[User Action in Browser]
        |
        v
[React Component] -- calls --> fetchWithAuth('/departments')
        |
        v
[fetchWithAuth in utils/api.ts]
   - Reads NEXT_PUBLIC_API_URL from .env ("http://localhost:8000/api")
   - Reads access_token from localStorage
   - Makes: GET http://localhost:8000/api/departments
   - Adds Header: Authorization: Bearer eyJ...
   - Adds Header: Content-Type: application/json
        |
        v
[Django Backend at localhost:8000]
   - Nginx/Gunicorn receives request at /api/departments
   - Django Ninja matches URL to employees router
   - Router finds @router.get("/departments") handler
   - AuthBearer() checks the Bearer token (if auth required)
   - Handler queries database and returns JSON
        |
        v
[Response flows back to React]
   - Component checks res.ok
   - Parses JSON with res.json()
   - Sets state -> UI re-renders
```

### Step 2: For Each Page, Follow This Checklist

Before writing any API call, answer these questions:

1. **Does the backend endpoint exist?** 
   - Open `Backend/src/employees/api.py` (or `authentication/api.py` or `permissions/api.py`)
   - Search for `@router.get("/your-endpoint")` or `@router.post(...)`
   - If it doesn't exist, you need to ask the backend developer to create it

2. **What method does it expect?**
   - Look at the decorator: `@router.get`, `@router.post`, `@router.put`, `@router.delete`

3. **Does it require authentication?**
   - Look for `auth=AuthBearer()` in the decorator
   - If yes, you must use `fetchWithAuth` (which adds the Bearer token)
   - If no (like login), you can use raw `fetch`

4. **What fields does it expect in the request body?**
   - Look at the Schema class referenced in the handler
   - Example: `payload: DepartmentCreateSchema` -> go read `DepartmentCreateSchema` to see exact field names

5. **What does it return?**
   - Look at the `response=` parameter in the decorator
   - Look at the `return` statement in the handler function
   - Example: `return 201, {"message": "...", "dept_code": "..."}` 

6. **What field names does the backend use?**
   - Backend uses `snake_case` (e.g., `dept_name`, `employee_id`, `inst_code`)
   - Frontend form uses `camelCase` (e.g., `deptName`, `employeeId`)
   - You need to map between them when sending/receiving data

### Step 3: Connecting a Form (Complete Working Example)

Here's the exact strategy for connecting a form to a backend API, using the Department Create as a reference:

**a) Read the backend endpoint first:**

```python
# Backend: employees/api.py
@router.post("/departments", response={201: dict, 400: ErrorResponseSchema})
def create_department(request, payload: DepartmentCreateSchema):
    # DepartmentCreateSchema requires:
    #   dept_code: str (required, max 6 chars, alphanumeric)
    #   dept_name: str (required)
    #   institution_code: Optional[str]
    #   description: Optional[str]
```

**b) Build the form state to match:**

```typescript
const [form, setForm] = useState({
  dept_code: '',        // matches backend field name exactly
  dept_name: '',        // matches backend field name exactly
  institution_code: '', // matches backend field name exactly
  description: '',      // matches backend field name exactly
});
```

**c) Submit with exact field names:**

```typescript
async function handleSave() {
  const res = await fetchWithAuth('/departments', {
    method: 'POST',
    body: JSON.stringify(form)  // field names already match backend
  });
  
  if (res.ok) {
    const data = await res.json();
    // data = { message: "Department created successfully", department_id: "...", dept_code: "ENG" }
    loadData(); // refresh the list
  } else {
    const err = await res.json();
    // err = { error: "Department code 'ENG' already exists" }
    alert(err.error);
  }
}
```

### Step 4: Connecting a List Page (Complete Working Example)

**a) Read the backend endpoint:**

```python
# Backend: returns array of dicts
@router.get("/departments", response=List[dict])
def list_departments(request, branch_code: str = None, institution_code: str = None):
    # Returns: [{ id, dept_code, dept_name, dept_sector, institution_code }]
```

**b) Define your TypeScript type to match:**

```typescript
type Department = {
  id: string;
  dept_code: string;
  dept_name: string;
  dept_sector: string;
  institution_code: string;
};
```

**c) Fetch and set state:**

```typescript
const [departments, setDepartments] = useState<Department[]>([]);

async function loadData() {
  setLoading(true);
  try {
    const res = await fetchWithAuth('/departments');
    if (res.ok) {
      const data = await res.json();
      setDepartments(Array.isArray(data) ? data : []);
    }
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
}

useEffect(() => { loadData(); }, []);
```

### Step 5: Connecting Dependent Dropdowns (Cascading Selects)

This is used in the Employee form: selecting an Institution loads its Branches, selecting a Department loads its Designations.

```typescript
// When Institution dropdown changes:
const handleInstitutionChange = async (instCode: string) => {
  setSelectedInstitution(instCode);
  setSelectedBranch(''); // reset dependent dropdown
  
  if (instCode) {
    // Fetch branches filtered by this institution
    const res = await fetchWithAuth(`/branches?institution_code=${instCode}`);
    if (res.ok) {
      setBranches(await res.json());
    }
  } else {
    setBranches([]); // clear if nothing selected
  }
};

// When Department dropdown changes:
const handleDepartmentChange = async (deptCode: string) => {
  setSelectedDepartment(deptCode);
  setSelectedDesignation(''); // reset dependent dropdown
  
  if (deptCode) {
    // Fetch designations filtered by this department
    const res = await fetchWithAuth(`/designations?department_code=${deptCode}`);
    if (res.ok) {
      setDesignations(await res.json());
    }
  } else {
    setDesignations([]);
  }
};
```

### Step 6: Connecting Stats/Counts (Dashboard Pattern)

**a) Use `Promise.all` to fetch multiple endpoints in parallel:**

```typescript
useEffect(() => {
  async function loadDashboard() {
    setLoading(true);
    try {
      const [empRes, instRes, deptRes] = await Promise.all([
        fetchWithAuth('/employees'),
        fetchWithAuth('/institutions'),
        fetchWithAuth('/departments'),
      ]);

      // Parse each response safely
      const employees = empRes.ok ? await empRes.json() : { employees: [] };
      const institutions = instRes.ok ? await instRes.json() : [];
      const departments = deptRes.ok ? await deptRes.json() : [];

      // Extract counts
      const empArray = Array.isArray(employees) ? employees : (employees.employees || []);
      
      setStats({
        totalEmployees: empArray.length,
        totalInstitutions: Array.isArray(institutions) ? institutions.length : 0,
        totalDepartments: Array.isArray(departments) ? departments.length : 0,
      });
    } catch (err) {
      console.error('Dashboard load failed:', err);
    } finally {
      setLoading(false);
    }
  }
  loadDashboard();
}, []);
```

**b) DO NOT mix real data with fake data.** If a stat can't come from the API, show "N/A" or hide the card - don't invent numbers.

---

## 9. How to Debug: Step-by-Step Guide

### 9.1 Your Primary Debugging Tool: Browser DevTools Network Tab

This is the **single most important** debugging tool. Open it with `F12` -> `Network` tab.

**What to look for:**

| Column | What It Tells You |
|--------|-------------------|
| **Name** | The URL that was called (e.g., `departments`) |
| **Status** | `200` = success, `400` = bad request, `401` = not authenticated, `404` = endpoint not found, `405` = wrong HTTP method, `500` = backend crashed |
| **Method** | GET, POST, PUT, DELETE - must match what the backend expects |
| **Response** | Click the request -> "Response" tab to see the JSON the backend sent back |
| **Request** | Click the request -> "Payload" tab to see what you sent |
| **Headers** | Click the request -> "Headers" tab to verify Authorization header is present |

### 9.2 Debugging by HTTP Status Code

#### Status `200` - Success but data looks wrong
```
Problem: Page shows wrong or empty data
Debug Steps:
1. Network tab -> click the request -> "Response" tab
2. Look at the actual JSON the backend returned
3. Compare field names in JSON vs what your TypeScript expects
4. Common issue: backend returns `dept_name` but you're reading `department_name`
```

#### Status `400` - Bad Request
```
Problem: Form submission fails with error
Debug Steps:
1. Network tab -> click the request -> "Response" tab
2. Read the error message (e.g., {"error": "Department code must be 6 characters or less"})
3. Network tab -> "Payload" tab to see what you sent
4. Compare your payload field names with what DepartmentCreateSchema expects
5. Common issue: sending "name" instead of "dept_name"
```

#### Status `401` - Unauthorized
```
Problem: User gets logged out or sees auth error
Debug Steps:
1. Open browser Console -> type: localStorage.getItem('access_token')
2. If null/empty -> user is not logged in, redirect to /login
3. If token exists -> it may be expired (tokens last 1 hour)
4. Check Network tab -> Headers -> is "Authorization: Bearer ..." present?
5. Common issue: token expired, need to re-login
```

#### Status `404` - Not Found
```
Problem: API returns "Not Found"
Debug Steps:
1. Network tab -> look at the FULL URL that was called
2. Compare with the backend endpoint cheat sheet in Section 6
3. Check: Did you add a trailing slash that shouldn't be there?
   fetchWithAuth('/departments/')  vs  fetchWithAuth('/departments')
4. Check: Is the endpoint actually defined in the backend api.py?
5. Common issue: calling an endpoint that doesn't exist yet
```

#### Status `405` - Method Not Allowed
```
Problem: Backend says "Method not allowed"
Debug Steps:
1. Network tab -> check the Method column (GET, POST, PUT, DELETE)
2. Backend only defines specific methods. If you send PUT but only GET exists, you get 405
3. Open api.py and search for the endpoint - check which @router.XXX decorator it uses
4. Common issue: trying to PUT/update an employee but only GET/DELETE exist
```

#### Status `422` - Validation Error (Django Ninja specific)
```
Problem: Backend rejects your data format
Debug Steps:
1. Response will contain specific validation errors
2. Usually means your JSON field names or types don't match the Pydantic Schema
3. Check the Schema class in api.py for exact field names and types
4. Common issue: sending string for a number field, missing required field
```

#### Status `500` - Internal Server Error
```
Problem: Backend crashed
Debug Steps:
1. This is a BACKEND bug, not your frontend fault
2. Check the Django terminal/logs for the Python traceback
3. Report the error to the backend developer with:
   - What endpoint you called
   - What data you sent (copy from Network -> Payload)
   - The error from Django logs
```

### 9.3 Common Frontend Debugging Scenarios

#### Scenario: "Page loads but shows no data"

```
Step 1: Open DevTools Network tab, reload the page
Step 2: Look for API requests (filter by "Fetch/XHR")
Step 3: 
  - If NO requests appear -> your useEffect or loadData function isn't being called
  - If requests appear with 200 -> data is coming but your state/render logic has a bug
  - If requests appear with 401 -> token issue, check localStorage
  - If requests appear with 404 -> wrong endpoint URL
Step 4: Add console.log to trace the data:
  
  const res = await fetchWithAuth('/departments');
  console.log('Response status:', res.status);
  const data = await res.json();
  console.log('Raw data from API:', data);
  const depts = Array.isArray(data) ? data : [];
  console.log('Parsed departments:', depts);
  setDepartments(depts);
```

#### Scenario: "Form submits but nothing happens"

```
Step 1: Check if the request was sent (Network tab)
Step 2: If sent - check the response status and body
Step 3: If NOT sent - your handleSubmit function has a bug:
  - Is the form's onSubmit={handleSubmit} wired up?
  - Is e.preventDefault() called?
  - Are there early returns blocking execution? (like step navigation)
  - Add console.log at the start of handleSubmit
Step 4: If response is 200/201 but page doesn't update:
  - Are you calling loadData() after success?
  - Are you closing the modal?
  - Are you navigating to the list page?
```

#### Scenario: "Changes save locally but disappear on page refresh"

```
This means you're updating React state only, NOT calling the backend API.

Step 1: Check your handleSave/handleDelete function
Step 2: Look for fetchWithAuth calls - if there are NONE, that's the bug
Step 3: The Branches page has this exact problem:

  // BUG - local only:
  setBranches(prev => prev.map(b => b.branch_id === id ? { ...b, ...data } : b));
  
  // FIX - hit the API:
  const res = await fetchWithAuth(`/branches/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
  if (res.ok) loadData(); // refresh from backend
```

#### Scenario: "Token expires and everything breaks"

```
Step 1: Token lasts 1 hour. After that, all API calls return 401
Step 2: fetchWithAuth clears the token on 401 but doesn't redirect
Step 3: The AuthContext checks for token on route change and redirects to /login
Step 4: Quick fix if stuck: open Console and type:
  localStorage.removeItem('access_token');
  localStorage.removeItem('user');
  window.location.href = '/login';
```

### 9.4 Backend Debugging (When You Need to Check the Django Side)

If you have access to the backend terminal:

```bash
# 1. Check if backend is running
curl http://localhost:8000/api/

# 2. Test an endpoint directly (without frontend)
curl http://localhost:8000/api/employees/departments

# 3. Test with authentication
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" http://localhost:8000/api/employees/employees

# 4. Test POST request
curl -X POST http://localhost:8000/api/employees/departments \
  -H "Content-Type: application/json" \
  -d '{"dept_code": "TEST", "dept_name": "Test Department"}'

# 5. Check Django logs in the terminal where `python manage.py runserver` is running
# Look for lines starting with [ERROR] or Python tracebacks
```

### 9.5 Quick Debug Checklist

When something isn't working, go through this checklist in order:

```
[ ] 1. Is the backend running? (check terminal for "Starting development server at http://127.0.0.1:8000/")
[ ] 2. Is the frontend running? (check terminal for "ready started server on 0.0.0.0:3000")
[ ] 3. Is NEXT_PUBLIC_API_URL correct in .env.local? (should be http://localhost:8000/api)
[ ] 4. Is the user logged in? (check localStorage for access_token)
[ ] 5. Open Network tab - is the request being sent?
[ ] 6. What status code comes back? (200, 400, 401, 404, 405, 500?)
[ ] 7. What does the response body say? (click request -> Response tab)
[ ] 8. Does the endpoint actually exist in api.py?
[ ] 9. Are you sending the correct field names? (compare with backend Schema)
[ ] 10. Are you using the correct HTTP method? (GET/POST/PUT/DELETE)
```

### 9.6 Django Ninja Auto-Generated API Docs

The backend has auto-generated interactive API documentation. When the backend is running, visit:

```
http://localhost:8000/api/docs
```

This shows ALL available endpoints, their expected request bodies, and response formats. You can even test endpoints directly from this page. **This is the ultimate source of truth for what endpoints exist and what they expect.**

---

## 10. Current Bugs & Errors in API Integration (Per Page)

> **Summary:** Problems exist on BOTH sides - frontend AND backend.  
> The backend has a critical missing import (`Branch`), a duplicate route, and several missing endpoints.  
> The frontend has wrong URL paths, wrong data format, mock data pretending to be real, and local-only mutations.

---

### 10.1 BACKEND BUG: `Branch` Model Not Imported (Crashes Multiple Endpoints)

**File:** `Backend/src/employees/api.py`, line 13  
**Severity:** CRITICAL - will crash at runtime

The import line is:
```python
from employees.models import Employee, Organization, Institution, Department, Designation, EmployeeAssignment
```

`Branch` is **missing** from this import but is used at:
- Line 409: `Branch.objects.filter(...)` in `list_branches`
- Line 436: `Branch.objects.create(...)` in `create_branch`
- Line 618: `Branch.objects.filter(...)` in second `create_employee`

**Result:** Any call to `GET /branches`, `POST /branches`, or `POST /employees` (with branchCode) will crash with:
```
NameError: name 'Branch' is not defined
```

**Fix:**
```python
from employees.models import Employee, Organization, Institution, Department, Designation, EmployeeAssignment, Branch
```

---

### 10.2 BACKEND BUG: Duplicate `create_employee` Route

**File:** `Backend/src/employees/api.py`, lines 182-324 AND lines 587-683  
**Severity:** HIGH - confusing behavior

Two functions both named `create_employee` are registered on `POST /employees`. In Python, the second definition silently overrides the first. So:
- The first function (lines 182-324) with resume upload proxy logic is **dead code** - it never runs
- The second function (lines 587-683) is the one that actually handles requests, but it's missing the resume upload proxy logic

**Result:** Resume uploads via the employee creation form will silently fail (employee gets created but resume is ignored).

**Fix:** Remove the first duplicate (lines 182-324) and add the resume upload proxy logic to the second function.

---

### 10.3 Login Page (`/login`)

**File:** `frontend/src/app/login/page.tsx`  
**Status:** Mostly working, 1 minor issue

| Bug | Detail | Where |
|-----|--------|-------|
| Hardcoded fallback URL | Uses `'http://127.0.0.1:8000/api'` as fallback - uses `127.0.0.1` instead of `localhost`. Could cause CORS mismatch if backend is configured for `localhost` only | Line 22 |

**Backend endpoint:** `POST /api/auth/login` - EXISTS and works correctly.

---

### 10.4 Dashboard (`/`)

**File:** `frontend/src/app/page.tsx`  
**Status:** 6 bugs found

| # | Bug | Type | Detail |
|---|-----|------|--------|
| 1 | Trailing slashes on endpoints | Frontend bug | Calls `fetchWithAuth("/employees/")`, `fetchWithAuth("/institutions/")` etc. with trailing `/`. Django Ninja may or may not handle trailing slashes depending on config. Should be `/employees`, `/institutions` etc. (lines 309-312) |
| 2 | Employee count logic is wrong | Frontend bug | `empArr.length` counts only current page (default 20 per page), not total employees. The backend returns `{ employees: [...20 items...], total: 150 }` but frontend ignores `total` and counts the array length. Should use `employees.total` instead (line 333) |
| 3 | `streamEvents` hardcoded | Mock data | "James Smith joined Engineering" etc. is fake. No backend endpoint exists for activity stream (lines 288-292) |
| 4 | `monthlyTrend` hardcoded | Mock data | Chart data `[14, 22, 18, 30, 26, 40]` is fake. No backend endpoint for hiring trends (line 296) |
| 5 | Org Mix uses `Math.random()` | Mock data | When departments don't have `employee_count`, it falls back to `Math.floor(Math.random() * 150 + 50)`. Shows random fake numbers to users (line 345) |
| 6 | Organization Alerts hardcoded | Mock data | "72 employees missing CNIC" and "3 Contracts end this month" are completely fake (lines 477-488) |
| 7 | Inactive count hardcoded | Mock data | `SystemStatusCard` shows inactive = `15` always (line 410) |
| 8 | Sub-text hardcoded | Mock data | "+0 this month", "1 this week", "+1.2% growth" are static strings, not computed (lines 393-409) |

---

### 10.5 Employees List (`/employees`)

**File:** `frontend/src/app/employees/page.tsx`  
**Status:** 3 bugs found

| # | Bug | Type | Detail |
|---|-----|------|--------|
| 1 | `gender` field not in list response | Data mismatch | Frontend filters by `e.gender === 'Male'` and `e.gender === 'Female'` (lines 317-318) but the `GET /employees` list endpoint does NOT return a `gender` field. Stats will always show Male: 0, Female: 0 |
| 2 | `priority` filter doesn't exist | Frontend bug | Priority filter (High/Medium/Low) at line 309 filters by `e.priority` but backend has no `priority` field. Filter does nothing useful |
| 3 | Client-side pagination only | Frontend limitation | Frontend fetches all employees then slices with `entriesPerPage`. Backend supports `page` and `per_page` query params but frontend never sends them. For large employee counts, this loads everything into memory |

**Backend endpoint:** `GET /api/employees/employees` - EXISTS and works.

---

### 10.6 New Employee Form (`/employees/new`)

**File:** `frontend/src/app/employees/new/page.tsx`  
**Status:** 4 CRITICAL bugs found

| # | Bug | Type | Detail |
|---|-----|------|--------|
| 1 | **JSON body vs Form data mismatch** | CRITICAL | Backend expects `Form(...)` (multipart form data) but frontend sends `JSON.stringify(payload)` with `Content-Type: application/json`. The backend will fail to parse the request body. `EmployeeCreateSchema = Form(...)` requires form-encoded data, not JSON (line 225-228) |
| 2 | **Payload structure mismatch** | CRITICAL | Backend expects flat fields: `departmentCode`, `designationCode`, `institutionCode`, `branchCode` at the top level. Frontend puts them inside a nested `assignments` array. Backend schema has no `assignments` field - it will ignore them, and the required `departmentCode`/`designationCode` will be missing, causing validation error (lines 218-223) |
| 3 | **`GET /organizations` doesn't exist** | Missing endpoint | Form calls `fetchWithAuth('/organizations')` to populate organization dropdown (line 106) but there's no `/organizations` endpoint in the backend. Will return 404. Organization dropdown will be empty |
| 4 | **Extra fields sent that schema rejects** | Data mismatch | Frontend sends `isActive`, `resumeUrl`, `assignments` which are NOT in `EmployeeCreateSchema`. Pydantic will either ignore them or error depending on config |

**What the backend actually expects (flat form data):**
```
fullName=John+Doe&cnic=42101-1234567-1&departmentCode=ENG&designationCode=DEV&...
```

**What the frontend actually sends (JSON with nested structure):**
```json
{
  "fullName": "John Doe",
  "cnic": "42101-1234567-1",
  "assignments": [{"departmentCode": "ENG", "designationCode": "DEV", ...}],
  ...
}
```

These are completely incompatible.

---

### 10.7 Edit Employee Form (`/employees/[id]/edit`)

**File:** `frontend/src/app/employees/[id]/edit/page.tsx`  
**Status:** 3 CRITICAL bugs found

| # | Bug | Type | Detail |
|---|-----|------|--------|
| 1 | **`PUT /employees/{id}` doesn't exist** | Missing endpoint | The form submits to `fetchWithAuth('/employees/${id}', { method: 'PUT' })` (line 257) but there is NO `PUT` handler for employees in the backend. Will return `405 Method Not Allowed`. Editing an employee is completely broken |
| 2 | **`GET /organizations` doesn't exist** | Missing endpoint | Same as the new employee form - calls for organizations list which doesn't exist (line 90) |
| 3 | **Assignment field name mismatch** | Data mismatch | When loading employee data, the code reads `asgn.institutionCode` from the backend response (line 133) but the backend's `GET /employees/{id}` returns assignments with different field names: `institution` (full name string), `department` (full name string), not `institutionCode`/`departmentCode` |

**Backend returns this for assignments:**
```json
{
  "institution": "Al-Khair School",
  "department": "Engineering",
  "designation": "Developer",
  "shift": "General",
  "joining_date": "2024-01-01",
  "is_primary": true
}
```

**Frontend expects this:**
```json
{
  "institutionCode": "AKS01",
  "departmentCode": "ENG",
  "designationCode": "DEV"
}
```

The codes vs names mismatch means the edit form's dropdowns will never show the correct selected values.

---

### 10.8 Institutions Page (`/institutions`)

**File:** `frontend/src/app/institutions/page.tsx`  
**Status:** 2 bugs found

| # | Bug | Type | Detail |
|---|-----|------|--------|
| 1 | **`GET /organizations` doesn't exist** | Missing endpoint | Called at line 229 to populate the "Parent Organization" dropdown in the modal. Returns 404, dropdown is empty |
| 2 | **`DELETE /branches/{branch_id}` may not exist** | Missing endpoint | The branches delete at line 306 calls `fetchWithAuth('/branches/${id}', { method: 'DELETE' })`. There is no `@router.delete("/branches/...")` in the backend. Will return 405 |

**Working endpoints on this page:**
- `GET /institutions` - works
- `POST /institutions` - works
- `PUT /institutions/{id}` - works
- `DELETE /institutions/{id}` - works
- `GET /branches?institution_code=X` - will CRASH due to missing `Branch` import (see bug 10.1)
- `POST /branches` - will CRASH due to missing `Branch` import

---

### 10.9 Institution Detail Page (`/institutions/[id]`)

**File:** `frontend/src/app/institutions/[id]/page.tsx`  
**Status:** 1 bug found

| # | Bug | Type | Detail |
|---|-----|------|--------|
| 1 | **Wrong URL path prefix** | Frontend bug | Calls `fetchWithAuth('/employees/institutions/${id}/')` (line 35). The `fetchWithAuth` prepends `API_BASE_URL` which is `http://localhost:8000/api`. So the full URL becomes `http://localhost:8000/api/employees/institutions/{id}/`. This actually WORKS because the employees router is mounted at `/api/employees` and the endpoint is `/institutions/{id}`. But the trailing slash may cause issues with Django Ninja's URL matching |

---

### 10.10 Institution Create Page (`/institutions/new`)

**File:** `frontend/src/app/institutions/new/page.tsx`  
**Status:** 1 bug found

| # | Bug | Type | Detail |
|---|-----|------|--------|
| 1 | **Wrong/inconsistent URL path** | Frontend bug | Calls `fetchWithAuth('/employees/institutions/', { method: 'POST' })` (line 57) while the main institutions list page calls `fetchWithAuth('/institutions', { method: 'POST' })`. Both technically resolve but inconsistency causes confusion. The `/employees/` prefix is the router mount point and shouldn't be manually added |

---

### 10.11 Institution Edit Page (`/institutions/[id]/edit`)

**File:** `frontend/src/app/institutions/[id]/edit/page.tsx`  
**Status:** 1 bug found

| # | Bug | Type | Detail |
|---|-----|------|--------|
| 1 | **Wrong/inconsistent URL path** | Frontend bug | Both GET (line 53) and PUT (line 104) call `fetchWithAuth('/employees/institutions/${id}/')` - same inconsistency as the detail page |

---

### 10.12 Departments Page (`/departments`)

**File:** `frontend/src/app/departments/page.tsx`  
**Status:** Working correctly

All API calls match backend endpoints correctly:
- `GET /departments` - works
- `GET /institutions` - works (for modal dropdown)
- `POST /departments` - works
- `PUT /departments/{dept_code}` - works
- `DELETE /departments/{dept_code}` - works

The `handleDelete` passes `d.id` (UUID) to `setDeleteId` but then passes it to `handleDelete(deptCode)` which calls `/departments/${deptCode}`. Need to verify that `deleteId` state actually contains `dept_code` not `id`. Looking at the code: `setDeleteId(d.id)` stores UUID, then `handleDelete(deleteId)` sends UUID to `/departments/${UUID}`, but the backend expects `dept_code` not UUID.

| # | Bug | Type | Detail |
|---|-----|------|--------|
| 1 | **Delete uses UUID instead of dept_code** | Frontend bug | `setDeleteId(d.id)` stores the UUID, but `DELETE /departments/{dept_code}` expects the department CODE (e.g., "ENG"), not the UUID. Will return 404 "Department not found" |

---

### 10.13 Designations Page (`/designations`)

**File:** `frontend/src/app/designations/page.tsx`  
**Status:** 2 bugs found

| # | Bug | Type | Detail |
|---|-----|------|--------|
| 1 | **`POST /designations` doesn't exist** | Missing endpoint | The `DesignationCreateSchema` class exists in the backend but NO route handler is registered for `POST /designations`. The frontend calls `fetchWithAuth('/designations', { method: 'POST' })` (line 153) which will return 405 Method Not Allowed. Creating designations is completely broken |
| 2 | **Frontend sends wrong field name** | Data mismatch | Frontend sends `{ department_code: "ENG" }` but the backend schema `DesignationCreateSchema` expects `department_code` as the field name, so that matches. However, the schema also requires `position_code` and `position_name` but the frontend sends them too, so this part is fine. The main issue is the missing endpoint |

---

### 10.14 Branches Page (`/branches`)

**File:** `frontend/src/app/branches/page.tsx`  
**Status:** 3 CRITICAL bugs found

| # | Bug | Type | Detail |
|---|-----|------|--------|
| 1 | **`GET /branches` will crash** | Backend crash | Due to missing `Branch` import in api.py (see bug 10.1), this endpoint crashes with `NameError` |
| 2 | **Create/Edit is LOCAL ONLY** | CRITICAL | `handleSave` function (lines 130-137) only updates React state with `setBranches(...)`. It does NOT call any API. Changes disappear on page refresh |
| 3 | **Delete is LOCAL ONLY** | CRITICAL | `handleDelete` function (lines 140-142) only removes from local array with `setBranches(prev => prev.filter(...))`. No API call. Doesn't actually delete from database |

**What the code does (WRONG):**
```typescript
async function handleSave(data: Partial<Branch>) {
  if (editTarget) {
    setBranches(prev => prev.map(b => ...));  // Local only!
  } else {
    setBranches(prev => [{ branch_id: String(Date.now()), ...data }, ...prev]);  // Fake ID!
  }
}
```

**What it SHOULD do:**
```typescript
async function handleSave(data: Partial<Branch>) {
  if (editTarget) {
    const res = await fetchWithAuth(`/branches/${editTarget.branch_id}`, {
      method: 'PUT', body: JSON.stringify(data)
    });
    if (res.ok) loadBranches();
  } else {
    const res = await fetchWithAuth('/branches', {
      method: 'POST', body: JSON.stringify(data)
    });
    if (res.ok) loadBranches();
  }
}
```

---

### 10.15 Audit Logs Page (`/audit-logs`)

**File:** `frontend/src/app/audit-logs/page.tsx`  
**Status:** 1 CRITICAL bug

| # | Bug | Type | Detail |
|---|-----|------|--------|
| 1 | **`GET /audit-logs` doesn't exist** | Missing endpoint | There is no audit-logs endpoint anywhere in the backend. The page calls `fetchWithAuth('/audit-logs?limit=50')` (line 31) which returns 404. Page always shows "No activity records found" |

---

### 10.16 Profile Page (`/profile`)

**File:** `frontend/src/app/profile/page.tsx`  
**Status:** Minor issues

| # | Bug | Type | Detail |
|---|-----|------|--------|
| 1 | External avatar URL | Security/reliability | Uses `https://ui-avatars.com/api/` (line 30) - an external service. Will break if the service is down or if the app is used offline/in restricted networks |
| 2 | "Edit Profile" non-functional | Missing feature | The button has no onClick handler and no API call |

---

### 10.17 Settings Page (`/settings`)

**File:** `frontend/src/app/settings/page.tsx`  
**Status:** Entirely static

| # | Bug | Type | Detail |
|---|-----|------|--------|
| 1 | No API calls at all | Missing feature | "Save Preferences" button does nothing. "Change Password" button does nothing. The entire page is UI-only with no backend integration |

---

### Bug Summary Table

| Page | Critical Bugs | Moderate Bugs | Working Correctly |
|------|:---:|:---:|:---:|
| Login | 0 | 1 | Yes |
| Dashboard | 0 | 8 (all mock data) | Partially (counts work, rest is fake) |
| Employees List | 0 | 3 | Mostly (list loads, filters broken) |
| New Employee | 4 | 0 | **NO - form submission is completely broken** |
| Edit Employee | 3 | 0 | **NO - no backend endpoint exists** |
| Institutions | 0 | 2 | Mostly (branches will crash) |
| Institution Detail | 0 | 1 | Yes (works but inconsistent URL) |
| Institution New | 0 | 1 | Yes (works but inconsistent URL) |
| Institution Edit | 0 | 1 | Yes (works but inconsistent URL) |
| Departments | 0 | 1 | Mostly (delete uses wrong ID) |
| Designations | 1 | 1 | **NO - create doesn't work** |
| Branches | 3 | 0 | **NO - backend crashes + no real API calls** |
| Audit Logs | 1 | 0 | **NO - endpoint doesn't exist** |
| Profile | 0 | 2 | Yes (read-only, no edit) |
| Settings | 0 | 1 | No backend integration |
| **BACKEND** | **2** | **0** | Missing `Branch` import + duplicate route |

### Priority Fix Order

**Fix these first (backend is blocking everything):**
1. Add `Branch` to the import in `api.py` line 13
2. Remove the duplicate `create_employee` function (lines 182-324)

**Fix these second (core features completely broken):**
3. Change employee creation form to send `FormData` instead of JSON, OR change backend to accept JSON body
4. Flatten the assignment fields in employee form payload to match `EmployeeCreateSchema`
5. Add `PUT /employees/{employee_id}` endpoint to backend
6. Add `POST /designations` endpoint to backend
7. Add `GET /organizations` endpoint to backend (or hardcode organization dropdown since there's only one)

**Fix these third (data integrity):**
8. Fix Branches page to use real API calls instead of local state
9. Fix Departments page delete to use `dept_code` instead of UUID
10. Fix Dashboard to stop showing fake/random data

**Fix these last (nice to have):**
11. Add `DELETE /branches/{id}` and `PUT /branches/{id}` endpoints
12. Add `/audit-logs` endpoint or remove the page
13. Connect Settings page to backend
14. Add actual edit profile functionality
