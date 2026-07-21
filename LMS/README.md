# AIT-LMS Complete System

This is the master docker-compose configuration for the entire Al Khair IT Institute Learning Management System.

---

## 🚀 Quick Start

Run the entire system (all microservices + frontends) with a single command:

```bash
docker compose up -d
```

## 📦 What's Included

### Infrastructure (6 services)
- **PostgreSQL Databases** (6 instances) — Auth, Course, Admission, Notification, Certification, Content
- **Redis** — Caching and session management
- **RabbitMQ** — Message queue for inter-service communication

### Backend Services (7 services)
| Service | Port | Purpose |
|---------|------|---------|
| **API Gateway** | 8000 | Central entry point |
| **Auth Service** | 8001 | Authentication & user management |
| **Course Service** | 8002 | Course management, scheduling, enrollments |
| **Admission Service** | 8003 | Student admissions, leads, entrance tests |
| **Notification Service** | 8004 | Notifications & broadcasts |
| **Certification Service** | 8005 | Certificate generation |
| **Content Service** | 8006 | Content management |

### Frontend Applications (2 services)
| App | Port | Purpose |
|-----|------|---------|
| **AIT Portal** | 3000 | Public-facing admission portal (register, courses, about) |
| **LMS Dashboard** | 3001 | Role-based admin panel (student/teacher/coordinator/admin) |

---

## 👥 Role-Based Access Control (RBAC)

### Role Hierarchy & Permissions Matrix

| Permission Key | ADMIN | COORDINATOR | ACCOUNT_OFFICER | TEACHER | STUDENT | TA |
|---|---|---|---|---|---|---|
| **Dashboard** | | | | | | |
| `view_admin_dashboard` | ✓ | ✓ | ✓ | | | |
| `view_coordinator_dashboard` | ✓ | ✓ | | | | |
| `view_teacher_dashboard` | ✓ | ✓ | | ✓ | | ✓ |
| `view_student_dashboard` | ✓ | | | | ✓ | |
| **Academic Operations** | | | | | | |
| `manage_courses` | ✓ | | | | | |
| `manage_classes` | ✓ | ✓ | | | | |
| `manage_enrollments` | ✓ | ✓ | | | | |
| `manage_assignments` | ✓ | ✓ | | ✓ | | ✓ |
| `manage_certifications` | ✓ | ✓ | | | | |
| **Student Management** | | | | | | |
| `view_students` | ✓ | ✓ | | ✓ | | ✓ |
| `manage_teachers` | ✓ | ✓ | | | | |
| `manage_users` | ✓ | | | | | |
| `id_generator` | ✓ | ✓ | | | | |
| **Financial Operations** | | | | | | |
| `view_deposits` | ✓ | | ✓ | | | |
| `view_entrance_leads` | ✓ | | ✓ | | | |
| `manage_receipts` | ✓ | | ✓ | | | |
| `manage_refunds` | ✓ | | | | | |
| `manage_transfers` | ✓ | ✓ | | | | |
| **Academic Records** | | | | | | |
| `view_attendance` | ✓ | ✓ | | ✓ | ✓ | ✓ |
| `view_analytics` | ✓ | ✓ | | | | |
| `manage_notifications` | ✓ | ✓ | | | | |

---

### 1. ADMIN — System Administrator

**Access**: Full system — all pages, all features.

**Dashboard URL**: `/admin/`

**Responsibilities**:
- Create/manage users (students, teachers, coordinators, account officers)
- Create/manage courses, specializations, categories
- Create/manage branches
- Manage scheduled classes and room assignments
- View and manage all enrollments
- Generate student IDs and certificates
- Full financial controls (deposits, leads, receipts, refunds, transfers)
- Configure roles and permissions
- View analytics across all branches

**Key Pages**:
- `/admin/dashboard/` — Admin overview
- `/admin/users/` — User management (create/edit/archive)
- `/admin/courses/` — Course CRUD
- `/admin/scheduled-classes/` — Class scheduling with conflict detection
- `/admin/enrollments/` — Enrollment management
- `/admin/branches/` — Branch management
- `/admin/deposits/` — Student deposit management
- `/admin/leads/` — Entrance lead management
- `/admin/receipt-codes/` — Receipt code management
- `/admin/control-panel/` — System settings & permissions
- `/admin/fee-structures/` — Fee configuration
- `/admin/id-generator/` — Student ID generation
- `/admin/certificate-generator/` — Certificate generation

---

### 2. COORDINATOR — Academic Coordinator

**Access**: Academic operations — courses, classes, enrollments, certifications, teacher management.

**Dashboard URL**: `/coordinator/`

**Responsibilities**:
- Manage scheduled classes and room assignments
- Manage enrollments and student transfers
- Manage certifications
- Manage teachers
- View attendance and analytics
- Send notifications

**Key Pages**:
- `/coordinator/dashboard/` — Coordinator overview
- `/coordinator/schedule/` — Class scheduling
- `/coordinator/transfers/` — Student transfers
- `/coordinator/certifications/` — Certificate management
- `/coordinator/teachers/` — Teacher management
- `/coordinator/deposits/` — View deposits

---

### 3. ACCOUNT_OFFICER — Financial Officer

**Access**: Financial operations — deposits, leads, receipts, fee management.

**Dashboard URL**: `/admin/receipt-codes/`

**Responsibilities**:
- Manage receipt codes (create, verify, process returns)
- View and manage entrance leads
- View deposits
- Fee collection and analytics

**Key Pages**:
- `/admin/receipt-codes/` — Receipt code management
- `/admin/leads/` — Entrance lead management
- `/admin/deposits/` — Deposit management
- `/admin/fee-collection/` — Fee collection
- `/admin/fee-analytics/` — Fee analytics

---

### 4. TEACHER — Faculty Member

**Access**: Teaching operations — courses, assignments, attendance, students.

**Dashboard URL**: `/teacher/`

**Responsibilities**:
- View assigned courses and scheduled classes
- Create and grade assignments
- Mark student attendance
- View enrolled students
- Send notifications to students

**Key Pages**:
- `/teacher/dashboard/` — Teacher overview
- `/teacher/my-courses/` — Assigned courses
- `/teacher/my-classes/` — Scheduled classes
- `/teacher/assignments/` — Assignment management
- `/teacher/students/` — Enrolled students
- `/teacher/attendance/` — Attendance marking
- `/teacher/notifications/` — Send notifications

---

### 5. STUDENT — Learner

**Access**: Learning operations — courses, assignments, attendance, certificates.

**Dashboard URL**: `/student/`

**Responsibilities**:
- View enrolled courses and materials
- Submit assignments
- View attendance records
- Download certificates and ID cards
- Track learning progress

**Key Pages**:
- `/student/dashboard/` — Student overview
- `/student/my-courses/` — Enrolled courses
- `/student/assignments/` — Submit assignments
- `/student/attendance/` — View attendance
- `/student/certificates/` — Download certificates
- `/student/id-card/` — View/download ID card

---

### 6. TA (Teaching Assistant)

**Access**: Same as TEACHER with limited scope — assignments, students, attendance.

**Dashboard URL**: `/teacher/`

---

## 🔄 System Flow

### Registration → Enrollment → Learning → Certification

```
AIT Portal (Public)
       │
       ▼
    Register Page
    ├── Select Specialization → Course → Branch
    ├── Fill personal details
    ├── Select Session (scheduled class)
    └── Submit → EntranceLead created
         │
         ▼
    Entrance Test (if required)
    ├── Lead-based flow (redirect with lead_id)
    └── Submit → status = 'passed' | 'failed'
         │
         ▼
    Receipt Code Verification
    ├── Admin generates ReceiptCode in dashboard
    ├── Student enters receipt code + creates password
    └── Auth Service creates User + Student record
         │
         ▼
    RabbitMQ Event: student.enrolled
    ├── Auth Service publishes {student_id, course_id, scheduled_class_id, branch_id}
    └── Course Service consumer creates CourseRegistrationHistory
         │
         ▼
    Learning Journey
    ├── Student accesses LMS Dashboard
    ├── Views courses, submits assignments
    ├── Attendance tracked by teacher
    └── Progress tracked per course
         │
         ▼
    Certification
    ├── Admin generates certificate
    ├── Student downloads from dashboard
    └── Certificate verified via public endpoint
```

### Data Flow Between Services

```
User/Auth
┌─────────────┐
│ Auth Service │◄──── LMS Frontend (login, users, roles)
│ (Port 8001)  │────► RabbitMQ: student.enrolled
└──────┬──────┘
       │ sync_student_profile
       ▼
┌──────────────┐    ┌─────────────────┐
│ Course Service│◄───┤ Admission Service│
│ (Port 8002)   │    │ (Port 8003)      │
│               │    │                  │
│ • Courses     │    │ • Leads          │
│ • Classes     │    │ • Entrance Tests │
│ • Enrollments │    │ • Receipt Codes  │
│ • Attendance  │    └─────────────────┘
│ • Assignments │
│ • Deposits    │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Certification    │
│ Service (8005)   │
│                  │
│ • Certificates   │
│ • Verification   │
└──────────────────┘
```

---

## 🌐 Access Points

| Service | URL |
|---------|-----|
| API Gateway | http://localhost:8000 |
| AIT Admission Portal | http://localhost:3000 |
| LMS Dashboard | http://localhost:3001 |
| RabbitMQ Management | http://localhost:15672 |

RabbitMQ default credentials: `lms_user` / `lms_password`

---

## 🗄️ Database Schema Overview

### Auth Service (Users DB)
- `User` — All users with role, branch, login credentials
- `Student` — Student-specific profile (status, level, batch, deposit info)
- `Teacher` — Teacher-specific profile (specialization, qualification, availability)
- `GuardianInfo` — Student guardian/emergency contact
- `ResidentialInfo` — Student address
- `StudentAcademicRecord` — Student qualification history
- `Branch` — Institute branches (Karachi Main, Karachi North, Lahore, Islamabad)
- `RolePermission` — Role-based permission JSON storage

### Course Service (Courses DB)
- `Course` — Course details, specialization, fees, admission dates
- `Specialization` — Course categories (Web, Mobile, AI/ML, etc.)
- `ScheduledClass` — Class sessions (teacher, room, time, days, branch)
- `Room` — Physical rooms with branch assignment
- `CourseRegistrationHistory` — Student enrollments with branch
- `StudentDeposit` — Financial deposit records
- `Assignment` / `Submission` — Coursework management
- `Attendance` — Student attendance records
- `Branch` — Mirror of branch data for local FK references

### Admission Service (Admissions DB)
- `EntranceLead` — Student leads from registration (branch, course, test status)
- `ReceiptCode` — Payment receipt codes for enrollment verification
- `EntranceTest` / `TestAttempt` — Entrance examination records

---

## 🔧 Common Commands

### Start all services
```bash
docker compose up -d
```

### View logs
```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f auth-service
docker compose logs -f ait-frontend
```

### Stop all services
```bash
docker compose down
```

### Rebuild and restart
```bash
docker compose up -d --build
```

### Check service status
```bash
docker compose ps
```

---

## 📋 Data Pipeline — CSV Import (from Google Sheets)

The system reads data from **CSV files** exported from Google Sheets. Seed scripts read local CSVs via `read_csv_data()` (`google_sheets_util.py`) instead of live API calls.

### Required CSV Files

Download each tab from Google Sheets (**File → Download → Comma Separated Values (.csv)**) and save to `scripts/data/`:

| Tab | CSV File | Used By |
|-----|----------|---------|
| `Specializations and TimeTable` | `timetable.csv` | `seed_teachers_from_sheet.py`, `import_academic_structure.py` |
| `Students` | `students.csv` | `seed_from_master_sheet.py` |
| `Admissions Application` | `admissions.csv` | `import_sheet_data.py` (optional) |

### Flow

```
Google Sheets (manual export)
       │
       ▼ (save CSVs to scripts/data/)
timetable.csv  students.csv  admissions.csv
       │
       ▼ (Step 1 of seed_all.sh — docker cp into containers)
/app/seed_data/timetable.csv  (auth-service + course-service)
/app/seed_data/students.csv   (auth-service)
       │
       ├── [seed_teachers_from_sheet.py]  (auth-service)
       │     Reads: timetable.csv → Teacher + Ass. Teacher columns
       │     Action: Creates User(role=teacher) + Teacher profiles
       │     Output: teacher_mapping.json (name → UUID)
       │
       ├── [import_academic_structure.py]  (course-service)
       │     Reads: timetable.csv → Specialization, Code, Section, Days, Time, etc.
       │     Action: Creates/Updates Specialization → Course → ScheduledClass
       │       • Populates Course.duration from 'Durration' column
       │       • Populates Course.description from 'Description' column
       │       • Populates Course.admission_status from 'Course Status' column
       │     Output: course_mapping.json + section_mapping.json
       │
       ├── [seed_from_master_sheet.py]  (auth-service)
       │     Reads: students.csv
       │     Classifies: DP=Y/YES/WAIVER + Batch exists → Student
       │                 Otherwise → Lead
       │     Action: Upsert User + Student/Lead + ReceiptCode
       │     Output: master_enrollment_mapping.json + enrollment_mapping.json
       │
       └── [ingest_enrollments.py]  (course-service)
             Reads: master_enrollment_mapping.json
             Action: Create CourseRegistrationHistory + StudentDeposit
```

### Run Full Pipeline

```bash
bash scripts/seed_all.sh
```

This automates: copy CSVs into containers → reset teacher passwords → seed teachers → import academic structure → seed students+leads → ingest enrollments → verify.

### Quick Import (Manual Steps)

```bash
# 1. Copy CSV files into containers
docker cp scripts/data/timetable.csv auth-service:/app/seed_data/timetable.csv
docker cp scripts/data/timetable.csv course-service:/app/seed_data/timetable.csv
docker cp scripts/data/students.csv auth-service:/app/seed_data/students.csv

# 2. Run seed scripts in order
docker exec auth-service python seed_data/seed_teachers_from_sheet.py
docker exec course-service python seed_data/import_academic_structure.py
docker exec auth-service python seed_data/seed_from_master_sheet.py

# 3. Copy JSON mapping files to shared volume
docker exec auth-service sh -c "cp -f /app/seed_data/master_enrollment_mapping.json /app/shared/enrollment_mapping.json"
docker exec course-service sh -c "cp -f /app/shared/enrollment_mapping.json /app/master_enrollment_mapping.json"

# 4. Ingest enrollments
docker exec course-service python seed_data/ingest_enrollments.py
```

### Fresh Start (Delete All Data + Re-import)

```bash
# Purge all databases
docker exec auth-service python manage.py flush --noinput
docker exec course-service python manage.py flush --noinput
docker exec admission-service python manage.py flush --noinput

# Then run: bash scripts/seed_all.sh
```

### Data Source Architecture

- `scripts/data_utils.py` — **Consolidated utility** (single source of truth) with `read_csv_data()` for reading local CSVs and `get_sheet_data()` for live Google Sheets API (fallback)
- 4 copies of `google_sheets_util.py` (root, auth-service, course-service, admission-service) — each has both `read_csv_data()` and `get_sheet_data()`
- Override CSV path via environment: `TIMETABLE_CSV=/custom/path.csv` or `STUDENTS_CSV=/custom/path.csv`

---

## 🏗️ Architecture

### Frontend
- **AIT Portal** (`ait_fe/`) — Next.js 14, public-facing, no auth required
- **LMS Dashboard** (`Lms_fe/`) — Next.js 14, role-based routing with JWT auth

### Backend
- All services built with Django Ninja (REST Framework)
- JWT authentication via `shared/common/authentication.py`
- `@roles_required()` decorator for endpoint protection
- RabbitMQ for async inter-service communication (enrollment events)
- API Gateway (Express.js) proxies `/api/*` to individual services

### Branch Multi-Tenancy
- Branches are seeded: Karachi Main, Karachi North, Lahore, Islamabad
- Used for: user assignment, scheduled classes, enrollments, leads, rooms
- Roll numbers include branch code: `AIT-KHI-2026-WD13-0001`
- Courses can be offered at multiple branches via M2M

---

## 📝 Environment Variables

Create a `.env` file in this directory to customize:

```env
JWT_SECRET_KEY=your-production-secret-key
```

---

## 🛠️ Development

For development with hot-reload, run frontends locally:

```bash
# AIT Frontend
cd ait_fe
npm run dev

# LMS Frontend
cd lms_fe
npm run dev
```

---

## 🔍 Troubleshooting

### Services not starting
```bash
# Check logs
docker compose logs

# Restart specific service
docker compose restart auth-service
```

### Database issues
```bash
# Run migrations
docker exec auth-service python manage.py migrate
docker exec course-service python manage.py migrate
```

### Clear everything and start fresh
```bash
docker compose down -v
docker compose up -d --build
```
