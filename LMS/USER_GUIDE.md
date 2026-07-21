# AIT-LMS User Guide & Portal Access

## Platform URLs

| Service | URL | Description |
|---------|-----|-------------|
| LMS Dashboard | `http://localhost:3001` | Login page for all roles |
| AIT Public Portal | `http://localhost:3000` | Public registration & courses |
| API Gateway | `http://localhost:8000` | Backend API |

---

## Users & Login Credentials

### 1. SuperAdmin (Platform Owner)

| Field | Value |
|-------|-------|
| Email | `superadmin@ait.edu` |
| Password | `admin123` |
| Portal | `http://localhost:3001/superadmin/dashboard` |

**What SuperAdmin Can Do:**
- Manage ALL organizations on the platform
- View platform-wide statistics
- Create, edit, delete organizations
- View all users across all organizations

---

### 2. OrgAdmin (AIT Institution Admin)

| Field | Value |
|-------|-------|
| Email | `admin@ait.edu` |
| Password | `admin123` |
| Portal | `http://localhost:3001/admin/dashboard` |

**What OrgAdmin Can Do:**
- Manage campus, users, courses, enrollments
- Manage fee structures and collections
- Manage certifications and notifications
- View analytics and reports
- Create teachers, coordinators, students
- Manage scheduled classes and assignments

---

### 3. Teacher

| Field | Value |
|-------|-------|
| Email | `teacher@ait.edu` |
| Password | `teacher123` |
| Portal | `http://localhost:3001/teacher/dashboard` |

**What Teacher Can Do:**
- View assigned courses and classes
- Mark student attendance
- Create and manage assignments
- Upload course content (modules, lessons)
- View enrolled students
- View notifications

---

### 4. Coordinator

| Field | Value |
|-------|-------|
| Email | `coordinator@ait.edu` |
| Password | `coord123` |
| Portal | `http://localhost:3001/coordinator/dashboard` |

**What Coordinator Can Do:**
- Review and approve attendance
- Manage sections and classes
- Handle student transfers
- Collect fees
- View coordinator dashboard with stats
- Manage notifications

---

### 5. Financial Officer (Account Officer)

| Field | Value |
|-------|-------|
| Email | `finance@ait.edu` |
| Password | `finance123` |
| Portal | `http://localhost:3001/accounts_officer/dashboard` |

**What Financial Officer Can Do:**
- View fee collection dashboard
- Record and manage payments
- Verify bank transfer payments
- View financial reports
- Manage bank accounts
- Generate collection reports

---

### 6. Student

| Field | Value |
|-------|-------|
| Email | `student@ait.edu` |
| Password | `student123` |
| Portal | `http://localhost:3001/student/dashboard` |

**What Student Can Do:**
- View enrolled courses
- View assignments and submit work
- View attendance records
- View fee records and payment status
- Download certificates
- View notifications
- Access alumni portal

---

## Portal URLs by Role

| Role | Dashboard URL |
|------|---------------|
| SuperAdmin | `http://localhost:3001/superadmin/dashboard` |
| OrgAdmin | `http://localhost:3001/admin/dashboard` |
| Teacher | `http://localhost:3001/teacher/dashboard` |
| Coordinator | `http://localhost:3001/coordinator/dashboard` |
| Financial Officer | `http://localhost:3001/accounts_officer/dashboard` |
| Student | `http://localhost:3001/student/dashboard` |

---

## Quick Reference

### Login Steps
1. Go to `http://localhost:3001/login`
2. Enter email and password
3. You'll be redirected to your role's dashboard

### Organization Context
- All users are assigned to **AIT Main** organization
- OrgSelector in header shows current organization
- Campus selector shows current campus
- Data is filtered by organization

### Role Permissions

| Role | Courses | Users | Attendance | Fees | Certifications | Notifications |
|------|---------|-------|------------|------|----------------|---------------|
| SuperAdmin | View All | View All | View All | View All | View All | View All |
| OrgAdmin | Manage | Manage | Monitor | Manage | Manage | Manage |
| Teacher | My Courses | View Students | Mark | View | View | View |
| Coordinator | View | View Teachers | Review | Collect | View | Manage |
| Financial Officer | View | View | View | Collect & Verify | View | View |
| Student | My Courses | No | View Own | View Own | Download | View |

---

## Multi-Tenancy

### How It Works
1. **Organization**: Each institution (e.g., AIT) is an Organization
2. **Campus**: Each physical location is a Campus under an Organization
3. **Data Isolation**: Users only see their organization's data
4. **OrgSelector**: Header dropdown to switch between organizations (SuperAdmin only)

### Current Test Data
- **Organization**: AIT Main (ID: 63d4672b-c4e0-4855-a863-bfe0f859258d)
- **Campus**: Karachi Main Campus (ID: 6192e609-7b33-4e29-a0f3-7ce54f01ab4f)

---

## Services Running

| Service | Port | Status |
|---------|------|--------|
| API Gateway | 8000 | Healthy |
| Auth Service | 8001 | Healthy |
| Course Service | 8002 | Healthy |
| Admission Service | 8003 | Healthy |
| Notification Service | 8004 | Healthy |
| Certification Service | 8005 | Healthy |
| Content Service | 8006 | Healthy |
| Org Service | 8007 | Healthy |
| Fee Service | 8008 | Healthy |

---

## Git Branch

- **Branch**: `feature/multi-tenancy-saas`
- **Commits**: 9 commits
- **Status**: All services healthy, all pages working
