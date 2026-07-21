# AIT Learning Management System — Complete Documentation

> Institute: **Al-Khair Institute of Technology (AIT)**  
> Domain: `ait.iak.ngo` (Public) · `lms.iak.ngo` (LMS Dashboard)

---

## Table of Contents

1. [PRD — Product Requirements Document](#1-prd--product-requirements-document)
2. [TRD — Technical Requirements Document](#2-trd--technical-requirements-document)
3. [App Flow](#3-app-flow)
4. [UI/UX Design Briefing](#4-uiux-design-briefing)
5. [Backend Schema](#5-backend-schema)
6. [Implementation Plan](#6-implementation-plan)

---

## 1. PRD — Product Requirements Document

### 1.1 Product Overview

AIT-LMS is a full-stack educational platform that manages the complete student lifecycle — from admission and entrance testing to course enrollment, attendance tracking, assignment submission, content delivery, certification, and notification broadcasting.

### 1.2 Target Users

| Role | Description |
|------|-------------|
| Admin | Full system access — users, courses, batches, fees, certificates, settings |
| Coordinator | Academic operations — schedules, teachers, enrollments, certifications |
| Account Officer | Financial operations — deposits, receipts, leads |
| Teacher | Teaching operations — courses, classes, assignments, attendance, grading |
| Student | Learning operations — courses, assignments, attendance, certificates |
| TA | Teaching Assistant — same as Teacher (limited scope) |

### 1.3 Core Features

**Public Website (ait_fe — Port 3000)**
- Browse courses and specializations
- Multi-step registration with entrance test
- Receipt code verification for deposit payment
- Online entrance examination system
- Certificate verification (public)
- Contact and inquiry form

**LMS Dashboard (Lms_fe — Port 3001)**
- Role-based dashboards with personalized navigation
- User management (CRUD, roles, permissions)
- Course & batch management
- Enrollment & class scheduling
- Attendance tracking (bulk marking)
- Assignment creation, submission & grading
- Fee structure management & collection
- Certificate generation (PDF with QR code)
- Student ID card generator
- Notification broadcast system
- Student transfer & alumni re-enrollment

### 1.4 Student Journey

```
Browse Courses → Register (Multi-step) → Entrance Test (if required)
→ Receipt Code Verification → Account Created → Login to LMS
→ Enroll in Courses → Attend Classes → Submit Assignments
→ Check Attendance → Complete Course → Get Certificate → Alumni
```

---

## 2. TRD — Technical Requirements Document

### 2.1 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Nginx (Port 80)                       │
│     ait.iak.ngo → ait_fe:3000    lms.iak.ngo → Lms_fe:3001 │
└─────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   API Gateway      │
                    │  (FastAPI :8000)   │
                    └─────────┬─────────┘
         ┌───────────────────┼───────────────────┐
         │                   │                   │
    ┌────┴────┐        ┌────┴────┐        ┌────┴────┐
    │   Auth  │        │  Course │        │  Admin  │ ...
    │ :8001   │        │  :8002  │        │:8003-06 │
    └────┬────┘        └────┬────┘        └────┬────┘
         │                  │                  │
    ┌────┴────┐        ┌────┴────┐        ┌────┴────┐
    │Postgres │        │Postgres │        │Postgres │
    │auth_db  │        │course_db│        │  ..._db │
    └─────────┘        └─────────┘        └─────────┘
```

### 2.2 Technology Stack

**Backend (Microservices)**

| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.11+ | Runtime |
| Django | 5.0.6 | Web framework |
| Django Ninja | 1.1+ | Type-annotated REST APIs |
| Django REST Framework | 3.14 | REST APIs (notifications, certifications) |
| FastAPI | — | API Gateway reverse proxy |
| PostgreSQL | 15 | Database (6 databases) |
| Redis | 7 | Caching, sessions, rate limiting |
| RabbitMQ | 3 | Async message queue |
| Gunicorn | 22 | WSGI server |
| PyJWT / SimpleJWT | — | JWT authentication |
| Pika | 1.3 | RabbitMQ client |
| Pillow | 10.2 | Image processing |
| Google API Client | 2.122 | Google Sheets integration |
| ReportLab | — | PDF generation (certificates) |
| httpx | — | Async HTTP client |

**Frontend**

| Technology | ait_fe (Public) | Lms_fe (Dashboard) |
|------------|----------------|-------------------|
| Framework | Next.js 16 | Next.js 16 |
| Language | TypeScript 5 | TypeScript 5 |
| Styling | Tailwind CSS 3.3 | Tailwind CSS 3.6 |
| UI Library | shadcn/ui + Radix | shadcn/ui |
| State Mgmt | Zustand 5 | — |
| Server State | TanStack Query 5 | — |
| HTTP Client | — | Axios 1.6 |
| Charts | Chart.js 4.5 | Recharts 2.12 |
| Animation | Framer Motion 12 | — |
| Forms | React Hook Form + Zod | — |
| PDF | — | jsPDF 4 |
| ID Card | — | html2canvas 1.4 |

**Infrastructure**

| Tool | Purpose |
|------|---------|
| Docker / Docker Compose | Containerization & orchestration (15 containers) |
| Nginx | Reverse proxy (production) |
| GitHub Actions | CI/CD (self-hosted runner) |

### 2.3 Microservices Breakdown

| Service | Port | Framework | Auth | Database | Tables |
|---------|------|-----------|------|----------|--------|
| API Gateway | 8000 | FastAPI | — | — | — |
| Auth Service | 8001 | Django+Ninja | JWT | auth_db | 13 |
| Course Service | 8002 | Django+Ninja | JWT | course_db | 20 |
| Admission Service | 8003 | Django DRF | Mixed | admission_db | 7 |
| Notification Service | 8004 | Django DRF | JWT | notification_db | 2 |
| Certification Service | 8005 | Django DRF | JWT | certification_db | 1 |
| Content Service | 8006 | Django+Ninja | JWT | content_db | 4 |

### 2.4 Authentication & Security

**JWT Flow:**
- Login → Auth Service validates credentials → Returns access + refresh tokens
- Access token: short-lived (30 min), contains `user_id`, `email`, `role`
- Refresh token: long-lived (24h / 7d)
- Algorithm: HS256

**Token Storage:**
- `ait_fe`: HTTP-only cookies (server-side) + `lms_bridge_token` for SSO
- `Lms_fe`: `localStorage` (`lms_token`, `lms_user`)

**Security Features:**
- Password hashing: Django PBKDF2
- Rate limiting: 5 login attempts, 5-min lockout (Redis)
- Forced password change flag
- OTP verification via email
- Soft deletes (`is_deleted` flag)
- Audit logging (`AdminActionLog` in every service)
- 10-min idle timeout auto-logout (Lms_fe)

### 2.5 Inter-Service Communication

**Synchronous (HTTP REST):**
- Auth ↔ Admission: Verify lead, mark lead converted
- Auth ↔ Course: Enroll student, fetch classes
- Course ↔ Auth: Sync student profile
- Admission ↔ Auth/Course: Check user, create enrollment
- Certification ↔ Auth/Course: Fetch student/course data
- Notification ↔ Auth/Course: Fetch users/enrollments

**Asynchronous (RabbitMQ):**
- Event: `student.enrolled`
- Publisher: Auth Service
- Consumers: Course Service (creates CourseRegistrationHistory)
- Exchange: Topic exchange with routing keys

### 2.6 API Gateway Routes

| URL Prefix | Target | Port |
|------------|--------|------|
| `/api/auth/*`, `/api/v1/auth/*` | Auth Service | 8001 |
| `/api/student/*`, `/api/v1/student/*` | Auth Service | 8001 |
| `/api/courses/*`, `/api/v1/courses/*` | Course Service | 8002 |
| `/api/admission/*`, `/api/v1/admission/*` | Admission Service | 8003 |
| `/api/tests/*`, `/api/v1/tests/*` | Admission Service | 8003 |
| `/api/notifications/*`, `/api/v1/notifications/*` | Notification Service | 8004 |
| `/api/certifications/*`, `/api/v1/certifications/*` | Certification Service | 8005 |
| `/api/content/*`, `/api/v1/content/*` | Content Service | 8006 |
| `/media/content/*` | Content Service | 8006 |
| `/media/*` (default) | Course Service | 8002 |

### 2.7 API Endpoints by Service

**Auth Service (Port 8001) — Key Endpoints:**

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/login` | POST | Public | Login |
| `/api/auth/register` | POST | Public | Student registration |
| `/api/auth/logout` | POST | Auth | Logout |
| `/api/auth/refresh` | POST | Public | Refresh JWT |
| `/api/auth/me/` | GET | Auth | Current user profile |
| `/api/auth/users/` | GET | Admin | List users |
| `/api/auth/students/` | GET | Admin | List students |
| `/api/auth/students/verify-receipt-code/` | POST | Public | Verify deposit & create account |
| `/api/auth/password-reset/request/` | POST | Public | Initiate reset |
| `/api/auth/password-reset/confirm/` | POST | Public | Confirm reset |
| `/api/auth/admin/receipt-codes/` | GET/POST | Admin | Manage receipt codes |
| `/api/auth/branches/` | * | Admin | Branch CRUD |
| `/api/auth/role-permissions/` | GET/POST | Admin | RBAC management |

**Course Service (Port 8002) — Key Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/courses/courses/` | GET | List courses (filterable) |
| `/api/courses/specialization/all` | GET | List specializations |
| `/api/courses/scheduled-classes/` | GET/POST | Manage classes |
| `/api/courses/enrollments/` | GET/POST | Manage enrollments |
| `/api/courses/enrollments/transfer/` | POST | Transfer student |
| `/api/courses/enrollments/re-enroll/` | POST | Re-enroll alumni |
| `/api/courses/attendance/bulk/` | POST | Bulk mark attendance |
| `/api/courses/assignments/` | GET/POST | Manage assignments |
| `/api/courses/submissions/{id}/grade/` | POST | Grade submission |
| `/api/courses/deposits/` | GET/POST | Manage deposits |
| `/api/courses/fee-structures/` | GET/POST | Fee configuration |

**Admission Service (Port 8003) — Key Endpoints:**

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/admission/lead/` | POST | Public | Create entrance lead |
| `/api/admission/lead/lookup/` | POST | Public | Resume registration |
| `/api/admission/entrance-test/{lead_id}/` | GET | Public | Get test questions |
| `/api/admission/entrance-test/{lead_id}/submit/` | POST | Public | Submit test |
| `/api/tests/start/` | GET | Public | Start test session |
| `/api/tests/submit/` | POST | Public | Submit & auto-evaluate |
| `/api/tests/result/{attempt_id}/` | GET | Public | View result |

**Notification Service (Port 8004):** Broadcast CRUD, mark delivery read  
**Certification Service (Port 8005):** Generate/download/verify certificates  
**Content Service (Port 8006):** Curriculum tree (Modules→Lessons→ContentItems), progress tracking

---

## 3. App Flow

### 3.1 Student Journey (Detailed)

```
┌──────────────────────────────────────────────────────────────────┐
│                    PUBLIC WEBSITE (ait_fe)                        │
│                                                                   │
│  Home → Browse Courses → Click "Register"                        │
│    → Step 1: Personal Information (name, email, phone, CNIC)     │
│    → Step 2: Course Selection (specialization → course)          │
│    → Step 3: Entrance Test (if required)                         │
│        → MCQ-based, timed, auto-evaluated                        │
│        → Pass → Next Step / Fail → Redirect                      │
│    → Step 4: Receipt Code Verification                           │
│        → Enter receipt code → Deposit verified → Account created │
│    → Step 5: Enrollment Status → Login Credentials               │
│                                                                   │
│  ←→ Certificate Verification (public, by code)                   │
│  ←→ Contact Form                                                  │
└──────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                      LMS DASHBOARD (Lms_fe)                      │
│                                                                   │
│  Login → Role-based Redirect                                      │
│                                                                   │
│  STUDENT VIEW:                                                    │
│  ┌─ Dashboard (overview stats)                                   │
│  ├─ My Courses → Course Detail → Lectures (content)              │
│  ├─ Assignments → View → Submit → Check Grade                    │
│  ├─ Attendance → View monthly stats                              │
│  ├─ Certificates → View/Download PDF                             │
│  ├─ ID Card → View/Print                                         │
│  └─ Notifications → Read/Manage                                  │
│                                                                   │
│  TEACHER VIEW:                                                    │
│  ┌─ Dashboard (classes today, pending grading)                   │
│  ├─ My Courses → Manage Content                                  │
│  ├─ My Classes → Schedule → Take Attendance                      │
│  ├─ Assignments → Create → Review → Grade                        │
│  ├─ Students → View list                                         │
│  └─ Notifications → Send to class                                │
│                                                                   │
│  ADMIN VIEW:                                                      │
│  ┌─ Dashboard (system-wide stats + charts)                       │
│  ├─ Users → CRUD → Assign Roles → Track Actions                  │
│  ├─ Courses → Create/Edit → Link Specializations                 │
│  ├─ Batches → Create → Assign Teacher → Enroll Students          │
│  ├─ Scheduled Classes → Manage Rooms & Timings                   │
│  ├─ Enrollments → View/Transfer/Re-enroll                        │
│  ├─ Leads → Track admission pipeline                             │
│  ├─ Deposits → Manage → Process Returns                          │
│  ├─ Receipt Codes → Generate → Assign                            │
│  ├─ Fee Structures → Setup → Fee Collection → Analytics          │
│  ├─ Certificates → Generate → Verify                             │
│  ├─ ID Generator → Print Student ID Cards                        │
│  ├─ Notifications → Broadcast to All/Role/Course/Class           │
│  ├─ Branches → Manage multiple institute branches                │
│  ├─ Transfers → Track course transfers                           │
│  ├─ Settings → System configuration                              │
│  └─ Premium Dashboard → Advanced analytics                       │
│                                                                   │
│  COORDINATOR VIEW:                                                │
│  ┌─ Dashboard → Teachers → Deposits → Transfers                  │
│  ├─ Schedule → Manage class schedules                            │
│  └─ Certifications → Oversee                                     │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Authentication Flow

```
User → Login Page → Submit email+password
  → Auth Service validates → JWT issued
  → Token stored (cookie for ait_fe / localStorage for Lms_fe)
  → Redirect to role-based dashboard
  → Auto-refresh on expiry
  → Logout → Clear tokens → Redirect to login
```

### 3.3 Shared Flow Diagram

```
┌──────────────┐    ┌────────────────┐    ┌──────────────┐
│  ait_fe      │    │  API Gateway   │    │  Lms_fe      │
│  (Public)    │───▶│  (FastAPI)     │◀───│  (Dashboard) │
│  :3000       │    │  :8000         │    │  :3001       │
└──────────────┘    └───────┬────────┘    └──────────────┘
                            │
          ┌─────────────────┼─────────────────┐
          ▼                 ▼                  ▼
    ┌──────────┐     ┌──────────┐      ┌──────────┐
    │Auth Svc  │     │Course Svc│      │Admission │
    │:8001     │     │:8002     │      │:8003     │
    └────┬─────┘     └────┬─────┘      └────┬─────┘
         │               │                  │
         ▼               ▼                  ▼
    ┌──────────┐     ┌──────────┐      ┌──────────┐
    │Postgres  │     │Postgres  │      │Postgres  │
    │auth_db   │     │course_db │      │admission │
    └──────────┘     └──────────┘      └────┬─────┘
                                            │
                            ┌───────────────┼───────────────┐
                            ▼               ▼               ▼
                      ┌──────────┐    ┌──────────┐    ┌──────────┐
                      │Content   │    │Notif Svc │    │Cert Svc  │
                      │:8006     │    │:8004     │    │:8005     │
                      └────┬─────┘    └────┬─────┘    └────┬─────┘
                           │               │               │
                           ▼               ▼               ▼
                      ┌──────────┐    ┌──────────┐    ┌──────────┐
                      │Postgres  │    │Postgres  │    │Postgres  │
                      │content   │    │notif_db  │    │cert_db   │
                      └──────────┘    └──────────┘    └──────────┘
```

---

## 4. UI/UX Design Briefing

### 4.1 Design System

| Aspect | Detail |
|--------|--------|
| Framework | Tailwind CSS + shadcn/ui (Radix primitives) |
| Typography | System font stack (Tailwind default) |
| Color Scheme | Configurable via Tailwind + CSS variables |
| Icons | Lucide React (shadcn/ui default) |
| Components | 50+ primitives (Button, Card, Dialog, Table, Tabs, Form, etc.) |
| Responsiveness | Mobile-first (Tailwind breakpoints) |
| Theme | Light/Dark mode support (CSS variables) |

### 4.2 ait_fe — Public Website

| Page | Key UI Elements | Purpose |
|------|----------------|---------|
| Home | Hero carousel, specialization cards, features grid, testimonials, stats counter | First impression, quick overview |
| Courses | Course cards grouped by specialization, search/filter | Course discovery |
| Course Detail | Full course info, syllabus preview, instructor, CTA | Course exploration |
| Register | Multi-step wizard (Stepper component), form fields, validation | Student onboarding |
| Entrance Test | Question display, timer, progress bar, option selection | Online examination |
| Receipt Verification | Input field for code, status display, auto redirect | Payment verification |
| Certificate Verify | Code input, certificate card display | Public verification |
| About/Contact | Info sections, contact form, map | Institutional info |

### 4.3 Lms_fe — Dashboard

| Area | Key UI Elements | Notes |
|------|----------------|-------|
| Sidebar | Collapsible nav with role-specific menu items | Premium variant for Admin/Coordinator |
| Dashboard | Stats cards (metric tiles), charts (Recharts), activity feed, todo list | Role-dependent data |
| Tables | Data tables with search, sort, pagination, inline actions | CRUD operations |
| Forms | Modal dialogs for create/edit, validation, select/dropdowns | Data entry |
| Charts | Bar, line, pie charts for analytics | Fees, attendance, enrollments |
| ID Card | Live preview card with html2canvas capture | Student identity |
| Certificate | PDF preview with QR code, download button | Credential |
| Notifications | List with read/unread styling, badge count | Communication |

### 4.4 UX Principles

- **Role-based navigation**: Every user sees only relevant menus
- **Progressive disclosure**: Complex forms broken into steps
- **Immediate feedback**: Toast notifications for success/error
- **Error prevention**: Form validation with Zod schemas
- **Consistency**: Shared component library across both frontends
- **Accessibility**: Radix UI primitives (keyboard nav, ARIA labels)

---

## 5. Backend Schema

### 5.1 Auth Service — `auth_db` (13 Tables)

**User** — Core user model
| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary Key |
| full_name | VARCHAR | |
| email | VARCHAR | Unique, USERNAME_FIELD |
| phone | VARCHAR | |
| cnic | VARCHAR | |
| password | VARCHAR | PBKDF2 hashed |
| role | VARCHAR | admin/teacher/student/coordinator/account_officer |
| branch | FK→Branch | |
| must_change_password | BOOLEAN | |
| features_access | JSON | |
| is_active | BOOLEAN | |
| is_deleted | BOOLEAN | Soft delete |

**Student** — Extended student profile (OneToOne→User)
| Field | Type | Notes |
|-------|------|-------|
| student_id | VARCHAR | Auto: `AIT-BRANCH-YYYY-CODE-XXXX` |
| level | VARCHAR | |
| specialization | VARCHAR | |
| batch | FK→Batch | |
| status | VARCHAR | |
| test_score | FLOAT | |
| has_paid_deposit | BOOLEAN | |
| date_of_birth | DATE | |
| gender | VARCHAR | |
| image | ImageField | |
| branch | FK→Branch | |

**StudentAcademicRecord** — OneToOne→Student
| Field | Notes |
|-------|-------|
| highest_qualification, institute_name, passing_year, grade_or_cgpa | Academic background |

**GuardianInfo** — OneToOne→Student
| Field | Notes |
|-------|-------|
| father_name, father_cnic, father_phone, emergency_contact | Guardian details |

**ResidentialInfo** — OneToOne→Student
| Field | Notes |
|-------|-------|
| address, city, state_or_province, zip_code, country | Address details |

**Teacher** — OneToOne→User
| Field | Notes |
|-------|-------|
| specialization, qualification, experience, availability (JSON), image, branches (M2M) | Teacher profile |

**TeacherAttendance** — Teacher attendance tracking
| Field | Notes |
|-------|-------|
| FK→Teacher, date, status (PRESENT/ABSENT/LATE/LEAVE) | Daily attendance |

**ReceiptCode** — Admission deposit codes
| Field | Notes |
|-------|-------|
| code (unique), student_email, deposit_amount, verified, bag/fee/id_card fields, branch | Deposit tracking |

**Branch** — Institute branches
| Field | Notes |
|-------|-------|
| code (unique), name, address, city, contact_phone, is_active | Multi-branch support |

**PasswordResetToken** — FK→User, token, expires_at, used
**StudentTransferHistory** — FK→Student, from/to course/branch tracking
**AdminActionLog** — admin_user_id, action_type, model_name, object_id, details (JSON)
**RolePermission** — role (unique), permissions (JSON)

---

### 5.2 Course Service — `course_db` (20 Tables)

**Specialization** — Department/category
| Field | Notes |
|-------|-------|
| id (UUID), name, description, active, is_deleted | AI, Web Dev, etc. |

**Course** — Individual subject
| Field | Notes |
|-------|-------|
| FK→Specialization, name, course_code, level (1/2), duration, admission_status, branches (M2M), prerequisite_course, next_level_course | |

**ScheduledClass** — Class section with timing
| Field | Notes |
|-------|-------|
| FK→Course, instructor_id (UUID), FK→Room, start_time, end_time, days (JSON), section, status, FK→Branch | |

**Room** — name, capacity, FK→Branch
**StudentCourseProgress** — student_id (UUID), FK→Course, grade, status
**CourseRegistrationHistory** — student_id (UUID), FK→Course, FK→ScheduledClass, status, roll_number, FK→Branch
**Assignment** — FK→Course, FK→ScheduledClass, title, total_marks, due_date, attachment
**Submission** — FK→Assignment, student_id (UUID), submitted_file, grade, feedback
**Attendance** — FK→Course, FK→ScheduledClass, student_id (UUID), date, status
**StudentDeposit** — student_id (UUID), FK→Course, deposit_amount, receipt_number, bag/id_card fields
**ContentCompletion** — student_id (UUID), FK→Course, content_id (UUID)
**CourseRating** — student_id (UUID), FK→Course, FK→ScheduledClass, rating, comment
**FeeStructure** — FK→Course, scheduled_class, monthly_maintenance_fee, one_time_fee, payment_plan
**StudentFeeRecord** — student_id (UUID), FK→Course, fee_month, amount_due, payment_status
**FeePaymentTransaction** — FK→StudentFeeRecord, amount, payment_method
**AdminActionLog** — Audit log

**Batch** (batches app) — FK→Course, teacher_id, start_date, end_date, max_seats, available_seats, status
**Enrollment** (batches app) — student_id (UUID), FK→Batch, status
**TeacherAssignment** (batches app) — teacher_id (UUID), FK→Batch
**Interview** (batches app) — student_id (UUID), FK→Batch, interview_date, status

---

### 5.3 Admission Service — `admission_db` (7 Tables)

**EntranceLead** — Registration lead
| Field | Notes |
|-------|-------|
| lead_auto_id (sequential int), name, email, phone, course_id, scheduled_class_id, status (pending/passed/failed/enrolled), test_score, gender, whatsapp_number, father_guardian_name, cnic_number, date_of_birth, converted_to_student, lms_user_id, FK→Branch | |

**Test** — title, course_id (UUID), passing_marks, total_marks, duration, is_required
**Question** — FK→Test, question_text, option_a/b/c/d, correct_answer, marks, difficulty
**TestAttempt** — user_id (UUID), FK→Test, start_time, answers (JSON), score, percentage, is_passed, enrollment_status
**Interview** — FK→EntranceLead, interviewer_id, interview_date, score, status
**ReceiptCode** — code (unique), FK→EntranceLead, student_email, deposit_amount, verified
**Branch** — Mirrored from auth-service

---

### 5.4 Content Service — `content_db` (4 Tables)

**Module** — FK→Course (UUID), title, description, order, is_published
**Lesson** — FK→Module, title, description, order, duration_minutes, is_published
**ContentItem** — FK→Lesson, title, content_type (VIDEO/DOCUMENT/PRESENTATION/LINK/IMAGE/QUIZ), file, url, is_preview, order
**UserContentProgress** — user_id (UUID), FK→Lesson, is_completed, completion_date

---

### 5.5 Notification Service — `notification_db` (2 Tables)

**NotificationBroadcast** — title, message, audience_type (ALL/ROLE/COURSE/CLASS/CUSTOM), target_role, course_id, scheduled_class_id, created_by_id
**NotificationDelivery** — FK→Broadcast, recipient_id (UUID), recipient_role, status, is_read, read_at

---

### 5.6 Certification Service — `certification_db` (1 Table)

**Certification** — student_id, course_id, enrollment_id, certificate_number (auto: `CERT-YYYY-XXXXX`), verification_code (UUID), student_name, course_title, grade, certificate_pdf, qr_code, is_verified

---

## 6. Implementation Plan

### 6.1 Current Status: ✅ COMPLETED

| Phase | Status | Components |
|-------|--------|------------|
| Phase 1: Foundation | ✅ Done | Docker Compose, PostgreSQL × 6, API Gateway, Shared module, CI/CD |
| Phase 2: Core Services | ✅ Done | Auth Service, Course Service, Admission Service |
| Phase 3: Learning Features | ✅ Done | Content Service, Assignments, Attendance |
| Phase 4: Financial & Certification | ✅ Done | Fee structures, Certificates (PDF+QR), Deposits |
| Phase 5: Public Website (ait_fe) | ✅ Done | 15 pages, BFF API routes, Multi-step registration, Entrance test UI |
| Phase 6: LMS Dashboard (Lms_fe) | ✅ Done | 58+ pages across 4 roles, Role-based layout |
| Phase 7: Notifications | ✅ Done | RabbitMQ, Broadcast/Delivery system, Email service |
| Phase 8: Production Readiness | ✅ Done | Nginx, Production compose, Domains, Google Sheets seeding |

### 6.2 Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Microservices over Monolith | Separation of concerns, independent scaling, team autonomy |
| Django over FastAPI for services | ORM, admin interface, mature ecosystem, migration framework |
| Django Ninja for most services | Type-annotated endpoints, Pydantic validation, OpenAPI docs |
| PostgreSQL per service | Data isolation, independent schema evolution |
| RabbitMQ for async | Reliable message delivery, pub/sub pattern for events |
| JWT over sessions | Stateless auth, cross-service authentication |
| Two frontends (ait_fe + Lms_fe) | Different audiences (public vs authenticated), independent deployment |

### 6.3 Data Seeding Pipeline (Google Sheets)

```
1. seed_teachers_from_sheet.py    → Auth Service → Create/Update Teachers
2. import_academic_structure.py   → Course Service → Specializations, Courses, Sections
3. seed_students_from_master.py   → Auth Service → Students + Receipt Codes
4. ingest_enrollments.py          → Course Service → Enrollments + Deposits
5. seed_leads_from_sheet.py       → Admission Service → Entrance Leads
```

### 6.4 Suggested Future Enhancements

| Feature | Priority | Description |
|---------|----------|-------------|
| Mobile App | High | React Native for student access |
| Live Classes | Medium | Video conferencing integration (Zoom/Meet API) |
| Payment Gateway | High | Online fee payment (Stripe/Easypaisa/JazzCash) |
| Advanced Analytics | Medium | ML-based student performance prediction |
| Multi-language | Low | Urdu/English interface toggle |
| Backup/DR | High | Automated database backups, disaster recovery |
| Chat System | Medium | Student-Teacher direct messaging |
| Timetable | Medium | Visual timetable with calendar view |

---

> **Document Version:** 1.0  
> **Last Updated:** June 2026  
> **Project Repository:** [AIT-LMS](./)
