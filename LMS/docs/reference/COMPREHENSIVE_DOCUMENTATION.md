# AIT Learning Management System — Comprehensive Documentation

> **Institute:** Al-Khair Institute of Technology (AIT)
> **Version:** 1.0.0
> **Last Updated:** May 2026

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [Backend Microservices](#5-backend-microservices)
6. [Frontend Applications](#6-frontend-applications)
7. [API Gateway & Routing](#7-api-gateway--routing)
8. [Authentication & Authorization](#8-authentication--authorization)
9. [Database Schema](#9-database-schema)
10. [Key Workflows](#10-key-workflows)
11. [Inter-Service Communication](#11-inter-service-communication)
12. [Deployment](#12-deployment)
13. [Development Guide](#13-development-guide)
14. [Security](#14-security)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. Project Overview

The **AIT Learning Management System (LMS)** is a full-stack educational platform built with a microservices architecture. It manages the complete student lifecycle — from admission and entrance testing to course enrollment, attendance tracking, assignment submission, certification, and notification broadcasting.

### Core Capabilities

- **Student Admission** — Registration with entrance test or direct admission, lead tracking, receipt code verification
- **Course Management** — Specializations, batches, courses with multiple levels (Beginner/Advanced), scheduled classes
- **Learning Management** — Assignments, attendance tracking, content delivery (video, PDF, presentations)
- **Certification** — Automated certificate generation with QR codes and verification codes
- **Notifications** — Broadcast and targeted messaging with role/course/class-based delivery
- **Content Delivery** — Hierarchical course materials (Module → Lesson → ContentItem) with progress tracking
- **Role-Based Dashboards** — Separate interfaces for Admin, Coordinator, Teacher, and Student roles

---

## 2. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                               │
├──────────────────────────────────┬───────────────────────────────────┤
│   ait_fe (Port 3000)            │   Lms_fe (Port 3001)              │
│   - Public Website               │   - Student Dashboard             │
│   - Course Catalog               │   - Teacher Dashboard             │
│   - Registration/Entrance Test   │   - Admin/Coordinator Panels      │
│   - Certificate Verification     │   - Full LMS Functionality        │
└──────────────┬───────────────────┴──────────────┬────────────────────┘
               │                                   │
               └───────────┬───────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                    API GATEWAY (Port 8000)                          │
│              FastAPI Reverse Proxy (httpx)                          │
│         Routes: /api/auth/* → :8001, /api/courses/* → :8002, ...   │
└──┬─────────┬──────────┬──────────┬──────────┬──────────┬───────────┘
   │         │          │          │          │          │
   ▼         ▼          ▼          ▼          ▼          ▼
┌──────┐ ┌──────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Auth │ │Course│ │Admission│ │Notif.  │ │ Certif.│ │Content │
│:8001 │ │:8002 │ │:8003   │ │:8004   │ │:8005   │ │:8006   │
│Django│ │Django│ │Django  │ │Django  │ │Django  │ │Django  │
└──┬───┘ └──┬───┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘
   │        │         │          │          │          │
   ▼        ▼         ▼          ▼          ▼          ▼
┌──────┐ ┌──────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│PG DB │ │PG DB │ │PG DB   │ │PG DB   │ │PG DB   │ │PG DB   │
│auth_ │ │course│ │admiss- │ │notif.  │ │certif. │ │content │
│ db   │ │_db   │ │ion_db  │ │_db     │ │_db     │ │_db     │
└──────┘ └──────┘ └────────┘ └────────┘ └────────┘ └────────┘
   │        │         │          │          │          │
   └────────┴─────────┴──────────┴──────────┴──────────┘
                        │
                  ┌─────▼──────┐      ┌──────────┐
                  │   Redis    │      │ RabbitMQ │
                  │ (Caching & │      │  (Async  │
                  │  Sessions) │      │ Messages)│
                  └────────────┘      └──────────┘
```

### Architectural Principles

- **Microservices Isolation** — Each service has its own database, models, and API endpoints
- **API Gateway Pattern** — Single entry point (FastAPI) routes to all backend services
- **JWT Authentication** — Stateless auth with access/refresh tokens
- **Event-Driven** — RabbitMQ for async inter-service communication (e.g., student enrollment events)
- **Profile-First Architecture** — Profiles auto-create User objects via Django signals

---

## 3. Technology Stack

### Backend

| Technology | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Runtime |
| Django | 5.0.6 | Web framework |
| Django REST Framework | 3.14 | REST APIs |
| Django Ninja | | Type-annotated APIs with Pydantic validation |
| FastAPI | | API Gateway |
| PostgreSQL | 15+ | Database (one per service) |
| Redis | | Caching, session management, rate limiting |
| RabbitMQ | | Async message queue |
| Gunicorn | | WSGI server |
| httpx | | Async HTTP client (API Gateway) |
| ReportLab | | PDF generation (certificates) |
| Pika | | RabbitMQ client |
| SimpleJWT | | JWT auth |

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| Next.js | 16 | React framework (App Router) |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.3 | Styling |
| Radix UI | | Accessible UI primitives |
| shadcn/ui | | Component library |
| Zustand | 5 | State management (ait_fe) |
| TanStack React Query | 5 | Server state (ait_fe) |
| Axios | 1.6 | HTTP client (Lms_fe) |
| Recharts | 2 | Charts (Lms_fe) |
| Chart.js | 4 | Charts (ait_fe) |
| Framer Motion | 12 | Animation (ait_fe) |
| React Hook Form | 7 | Form management |
| Zod | 3 | Schema validation |
| jsPDF | 4 | PDF generation (Lms_fe) |
| Lottie | 2 | Animations (Lms_fe) |

### Infrastructure

| Tool | Purpose |
|---|---|
| Docker / Docker Compose | Containerization & orchestration |
| Nginx | Reverse proxy (production) |
| GitHub Actions | CI/CD |

---

## 4. Project Structure

```
AIT-LMS/
├── .env                          # Environment variables
├── .github/workflows/            # CI/CD pipelines
│   └── production-deploy.yml     # Production deployment workflow
├── docker-compose.yml            # Master docker-compose (infra + frontends)
├── nginx/                        # Nginx configuration for production
│
├── lms-microservices/            # All backend code
│   ├── docker-compose.yml        # Backend services docker-compose
│   ├── pyproject.toml            # Python project configuration
│   ├── pytest.ini                # Pytest configuration
│   ├── .pre-commit-config.yaml   # Pre-commit hooks
│   │
│   ├── api-gateway/              # FastAPI reverse proxy
│   │   ├── main.py               # Route definitions & proxy logic
│   │   ├── Dockerfile
│   │   └── requirements.txt
│   │
│   ├── shared/                   # Shared module (mounted into all services)
│   │   └── common/
│   │       ├── authentication.py  # JWTAuthentication, roles_required decorator
│   │       ├── jwt_utils.py       # Token creation & validation
│   │       ├── exceptions.py      # Custom exception classes
│   │       ├── rabbitmq_client.py # RabbitMQ publish/subscribe
│   │       └── service_client.py  # HTTP client with retry logic
│   │
│   ├── services/                 # Individual microservices
│   │   ├── auth-service/         # Port 8001
│   │   ├── course-service/       # Port 8002
│   │   ├── admission-service/    # Port 8003
│   │   ├── notification-service/ # Port 8004
│   │   ├── certification-service/# Port 8005
│   │   └── content-service/      # Port 8006
│   │
│   ├── docs/                     # Documentation
│   │   ├── ARCHITECTURE.md
│   │   ├── API.md
│   │   └── DEPLOYMENT.md
│   │
│   └── infra/                    # Infrastructure configs
│
├── ait_fe/                       # Public-facing website (Next.js 16)
│   ├── app/                      # App Router pages
│   │   ├── (main)/               # Public pages route group
│   │   │   ├── about/
│   │   │   ├── contact/
│   │   │   ├── courses/
│   │   │   ├── register/         # Multi-step registration + entrance test
│   │   │   ├── test/             # Entrance exams
│   │   │   ├── how-to-apply/
│   │   │   ├── verify-certificate/
│   │   │   └── admin/
│   │   │       └── receipt-codes/
│   │   └── api/                  # Server-side API proxy routes
│   │       ├── auth/             # Login, signup, logout, password reset
│   │       ├── admission/        # Admission API proxy
│   │       ├── contact/
│   │       └── proxy/            # Generic GET proxies (auth + unauth)
│   ├── components/
│   │   ├── ui/                   # shadcn/ui primitives (50+)
│   │   ├── mainComponent/        # Landing page components
│   │   ├── dashboard/            # Dashboard & question bank components
│   │   └── ...
│   ├── hooks/                    # Zustand stores, custom hooks
│   └── lib/                      # Auth utils, helpers
│
└── Lms_fe/                       # LMS Dashboard (Next.js 16)
    ├── app/
    │   ├── (auth)/               # Login, Register
    │   ├── (dashboard)/          # Authenticated pages
    │   │   ├── admin/            # 20 pages
    │   │   ├── coordinator/      # 6 pages
    │   │   ├── teacher/          # 11 pages
    │   │   └── student/          # 8 pages
    │   ├── forgot-password/
    │   ├── reset-password/
    │   ├── change-password/
    │   ├── complete-profile/
    │   └── force-password-change/
    ├── components/
    │   ├── ui/                   # Selective shadcn/ui components
    │   ├── shared/               # Sidebar, Header, Shared UI
    │   ├── premium/              # Admin/Coordinator sidebar & analytics
    │   ├── dashboard/            # Stats cards, tabs, modals
    │   ├── features/deposits/    # Deposit management widgets
    │   └── student/              # Student ID card
    └── lib/
        ├── api.ts                # Axios client (1230 lines) — all API integrations
        ├── auth.ts               # Token management, idle timeout, role helpers
        └── utils.ts              # Formatting utilities
```

---

## 5. Backend Microservices

### 5.1 Auth Service (Port 8001)

**Purpose:** User authentication, authorization, and profile management

**Database:** `auth_db` (PostgreSQL) + Redis DB 1 (rate limiting)

**Django Apps:** `users`

#### Models

| Model | Key Fields | Description |
|---|---|---|
| `User` | `id` (UUID PK), `full_name`, `email` (unique), `phone`, `password`, `role` (STUDENT/TEACHER/COORDINATOR/ADMIN), `must_change_password`, `features_access` (JSON), `is_active`, `is_deleted` | Custom user model with email as USERNAME_FIELD |
| `Student` | OneToOne → `User`, `student_id` (auto: `AIT-YYYY-CODE-XXXX`), `level`, `specialization`, `batch`, `image`, `status`, `has_paid_deposit`, `date_of_birth`, `whatsapp_number` | Extended student profile |
| `StudentAcademicRecord` | OneToOne → `Student`, `highest_qualification`, `institute_name`, `passing_year`, `grade_or_cgpa` | Academic background |
| `GuardianInfo` | OneToOne → `Student`, `father_name`, `father_cnic`, `father_phone`, `emergency_contact` | Guardian details |
| `ResidentialInfo` | OneToOne → `Student`, `address`, `city`, `state_or_province`, `country` | Residential details |
| `Teacher` | OneToOne → `User`, `specialization`, `qualification`, `image`, `experience`, `availability` (JSON) | Teacher profile |
| `TeacherAttendance` | FK → `Teacher`, `User`; `date`, `status` (PRESENT/ABSENT/LATE/LEAVE) | Teacher attendance tracking |
| `ReceiptCode` | `code` (unique), `student_email`, `deposit_amount`, `verified`, `bag_taken/fee`, `id_card_taken/fee`, `is_returned` | Admission deposit codes |
| `PasswordResetToken` | FK → `User`, `token`, `expires_at`, `used` | Password reset flow |
| `StudentTransferHistory` | FK → `Student`, `ReceiptCode`; `from_course_id`, `to_course_id`, `reason` | Course transfer tracking |
| `AdminActionLog` | `admin_user_id`, `action_type`, `model_name`, `object_id`, `details` (JSON) | Audit logging |
| `RolePermission` | `role` (unique), `permissions` (JSON) | Role-based access control |

#### Key API Endpoints

| Endpoint | Method | Description | Auth |
|---|---|---|---|
| `/api/auth/register` | POST | Student registration (with lead verification) | Public |
| `/api/auth/login` | POST | Email/student_id + password login | Public |
| `/api/auth/logout` | POST | Logout | Authenticated |
| `/api/auth/refresh` | POST | Refresh JWT token | Public |
| `/api/auth/me/` | GET | Current user profile | Authenticated |
| `/api/auth/users/` | GET | List users (paginated, searchable, filterable) | Admin/Coordinator |
| `/api/auth/users/{id}/` | GET/PATCH/DELETE | User detail/update/soft-delete | Admin/Coordinator |
| `/api/auth/students/` | GET | List students | Admin/Coordinator |
| `/api/auth/students/verify-receipt-code/` | POST | Verify deposit & create LMS account | Public |
| `/api/auth/send-verification-otp` | POST | Send OTP for password change | Authenticated |
| `/api/auth/force-password-change` | POST | Change password with OTP | Authenticated |
| `/api/auth/password-reset/request/` | POST | Initiate password reset | Public |
| `/api/auth/password-reset/confirm/` | POST | Confirm password reset | Public |
| `/api/auth/admin/receipt-codes/` | GET/POST | Manage receipt codes | Admin |
| `/api/auth/student/identity-card/` | GET | Student ID card data | Student |
| `/api/auth/analytics/overview/` | GET | Dashboard statistics | Admin |

#### Inter-Service Calls
- → **Admission Service**: Verify lead status, lookup leads by email, mark leads as converted
- → **Course Service**: Enroll students, fetch scheduled classes
- **RabbitMQ**: Publishes `student.enrolled` event

---

### 5.2 Course Service (Port 8002)

**Purpose:** Course and academic management — the "heart" of the LMS

**Database:** `course_db` (PostgreSQL) + Redis DB 2

**Django Apps:** `courses`, `batches`

#### Models

| Model | Key Fields | Description |
|---|---|---|
| `Specialization` | `id` (UUID), `name`, `description`, `active`, `is_deleted` | Department (e.g., AI, Web Dev) |
| `Course` | `id` (UUID), FK → `Specialization`, `name`, `course_code`, `level` (1=Beginner/2=Advanced), `duration`, `image`, `admission_status`, `prerequisite_course`, `next_level_course` | Individual subject |
| `ScheduledClass` | FK → `Course`, `instructor_id`, FK → `Room`, `start_time`, `end_time`, `days` (JSON), `section`, `strength_status`, `status` (upcoming/active/completed) | Class section with timing |
| `Room` | `name` (unique), `capacity` | Physical/virtual rooms |
| `StudentCourseProgress` | `student_id`, FK → `Course`, `grade`, `status` | Student progress per course |
| `CourseRegistrationHistory` | `student_id`, FK → `Course`, FK → `ScheduledClass`, `status`, `roll_number` (auto: `AIT-YEAR-CODE-SEC-XXXX`) | Enrollment records |
| `Assignment` | FK → `Course`, FK → `ScheduledClass`, `title`, `total_marks`, `due_date`, `attachment` | Course assignments |
| `Submission` | FK → `Assignment`, `student_id`, `submitted_file`, `grade`, `feedback`, `status` | Student submissions |
| `Attendance` | FK → `Course`, FK → `ScheduledClass`, `student_id`, `date`, `status` | Attendance records |
| `StudentDeposit` | `student_id`, FK → `Course`, `deposit_amount`, `receipt_number`, `bag_taken/fee/paid/waived`, `id_card_taken/fee/paid/waived`, `is_returned` | Deposit tracking |
| `Batch` | FK → `Course`, `teacher_id`, `start_date`, `end_date`, `max_seats`, `available_seats` | Batch grouping |
| `Enrollment` | `student_id`, FK → `Batch`, `status` | Batch enrollment |
| `ContentCompletion` | `student_id`, FK → `Course`, `content_id`, `completed_at` | Content tracking |
| `CourseRating` | `student_id`, FK → `Course`, FK → `ScheduledClass`, `rating`, `comment` | Student feedback |
| `AdminActionLog` | Same pattern as Auth Service | Audit logging |

#### Key API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/courses/courses/` | GET | List courses (filterable) |
| `/api/courses/courses/{id}/` | GET/POST/PATCH/DELETE | Course CRUD |
| `/api/courses/specialization/all` | GET | List specializations |
| `/api/courses/specialization` | POST | Create specialization |
| `/api/courses/scheduled-classes/` | GET/POST | List/create scheduled classes |
| `/api/courses/enrollments/` | GET/POST | List/create enrollments |
| `/api/courses/enrollments/transfer/` | POST | Transfer student between courses |
| `/api/courses/attendance/` | GET | List attendance records |
| `/api/courses/attendance/bulk/` | POST | Bulk mark attendance |
| `/api/courses/attendance/stats/{student_id}/` | GET | Student attendance statistics |
| `/api/courses/assignments/` | GET/POST | List/create assignments |
| `/api/courses/submissions/` | GET/POST | List/create submissions |
| `/api/courses/submissions/{id}/grade/` | POST | Grade submission |
| `/api/courses/deposits/` | GET/POST | List/create deposits |
| `/api/courses/rooms/` | GET/POST | List/create rooms |

#### Inter-Service Calls
- → **Auth Service**: Sync student profile (level, batch, specialization)
- **RabbitMQ**: Consumes `student.enrolled` events

---

### 5.3 Admission Service (Port 8003)

**Purpose:** Student admission, lead management, and entrance testing

**Database:** `admission_db` (PostgreSQL) + Redis DB 8

**Django Apps:** `tests`

#### Models

| Model | Key Fields | Description |
|---|---|---|
| `EntranceLead` | `lead_auto_id` (sequential int), `name`, `email`, `phone`, `course_id`, `status` (pending/passed/failed/enrolled), `test_score`, `has_paid_deposit`, `converted_to_student`, `lms_user_id` | Registration leads |
| `Test` | `id` (UUID), `title`, `course_id`, `passing_marks`, `total_marks`, `duration`, `is_required` | Entrance test definition |
| `Question` | FK → `Test`, `question_text`, `option_a/b/c/d`, `correct_answer`, `marks`, `difficulty` | Test questions |
| `TestAttempt` | `user_id`, FK → `Test`, `start_time`, `answers` (JSON), `score`, `percentage`, `status`, `is_passed` | Student test attempts |
| `Interview` | FK → `Lead`, `interviewer_id`, `interview_date`, `score`, `status` | Admission interviews |
| `ReceiptCode` | `code` (unique), FK → `EntranceLead`, `student_email`, `deposit_amount`, `verified`, `lms_account_created` | Deposit receipt codes |
| `AdminActionLog` | Same pattern | Audit logging |

#### Key API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/admission/lead/` | POST | Create entrance lead (registration) |
| `/api/admission/lead/lookup/` | POST | Resume registration by email/seq ID |
| `/api/admission/lead/{id}/status/` | GET | Lead status check |
| `/api/admission/lead-list/paginated/` | GET | Paginated lead list (admin) |
| `/api/admission/check-requirement/` | POST | Check if test is required for course |
| `/api/admission/entrance-test/{lead_id}/` | GET | Get test questions |
| `/api/admission/entrance-test/{lead_id}/submit/` | POST | Submit entrance test |
| `/api/tests/start/` | GET | Start test session |
| `/api/tests/submit/` | POST | Submit answers, auto-evaluate |
| `/api/tests/result/{attempt_id}/` | GET | Get test result |
| `/api/admission/receipt-codes/` | GET/POST | Manage receipt codes |

#### Inter-Service Calls
- → **Auth Service**: Check user email existence
- → **Course Service**: Create enrollment after test pass

---

### 5.4 Notification Service (Port 8004)

**Purpose:** Broadcast and targeted notifications

**Database:** `notification_db` (PostgreSQL) + Redis DB 3

**Django Apps:** `notifications`

#### Models

| Model | Key Fields | Description |
|---|---|---|
| `NotificationBroadcast` | `title`, `message`, `audience_type` (ALL/ROLE/COURSE/CLASS/CUSTOM), `target_role`, `course_id`, `scheduled_class_id`, `created_by_id` | Broadcast definition |
| `NotificationDelivery` | FK → `Broadcast`, `recipient_id`, `recipient_role`, `status` (PENDING/SENT/FAILED), `is_read`, `read_at` | Per-user delivery (fan-out) |

#### Key API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/notifications/broadcasts/` | GET/POST | List/create broadcasts |
| `/api/notifications/broadcasts/{id}/` | GET/PATCH/DELETE | Broadcast detail/update/delete |
| `/api/notifications/deliveries/` | GET | List current user's deliveries |
| `/api/notifications/deliveries/{id}/mark_read/` | POST | Mark notification as read |

#### Inter-Service Calls
- → **Auth Service**: Fetch users by role for recipient resolution
- → **Course Service**: Fetch enrollments, course details, class details, class students

---

### 5.5 Certification Service (Port 8005)

**Purpose:** Certificate generation and verification

**Database:** `certification_db` (PostgreSQL) + Redis DB 4

**Django Apps:** `certifications`

#### Models

| Model | Key Fields | Description |
|---|---|---|
| `Certification` | `student_id`, `course_id`, `enrollment_id`, `certificate_number` (auto: `CERT-YYYY-XXXXX`), `verification_code` (UUID), `student_name`, `course_title`, `grade`, `certificate_pdf` (FileField), `qr_code` (ImageField), `is_verified`, `issued_date` | Generated certificates |

#### Key API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/certifications/` | GET | List certifications |
| `/api/certifications/generate/` | POST | Generate certificate (PDF + QR) |
| `/api/certifications/{id}/` | GET | Certificate detail |
| `/api/certifications/{id}/download/` | GET | Download certificate PDF |
| `/api/certifications/verify/{code}/` | GET | Verify certificate by code |
| `/api/certifications/webhook/completion/` | POST | Course completion webhook |

#### Inter-Service Calls
- → **Auth Service**: Fetch student name
- → **Course Service**: Fetch course details & enrollment data

---

### 5.6 Content Service (Port 8006)

**Purpose:** Course content delivery with structured hierarchy

**Database:** `content_db` (PostgreSQL) + Redis DB 5

**Django Apps:** `content`

#### Models

| Model | Key Fields | Description |
|---|---|---|
| `Module` | `course_id` (UUID), `title`, `description`, `order`, `is_published` | Course chapters/sections |
| `Lesson` | FK → `Module`, `title`, `description`, `order`, `duration_minutes`, `is_published` | Learning units |
| `ContentItem` | FK → `Lesson`, `title`, `content_type` (VIDEO/DOCUMENT/PRESENTATION/LINK/IMAGE/QUIZ), `file` (FileField), `url`, `is_preview`, `order` | Actual learning assets |
| `UserContentProgress` | `user_id`, FK → `Lesson`, `is_completed`, `completion_date` | Per-user lesson completion |

#### Key API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/content/` | GET/POST | List/create content items |
| `/api/content/{course_id}/curriculum/` | GET | Full curriculum tree (nested) |
| `/api/content/progress/` | POST | Mark lesson complete/incomplete |
| `/api/content/modules/` | POST | Create module |
| `/api/content/lessons/` | POST | Create lesson |
| `/api/content/items/` | POST | Create content item |

---

### 5.7 API Gateway (Port 8000)

**Technology:** FastAPI + httpx

**Purpose:** Single entry point that reverse-proxies requests to the appropriate microservice based on URL prefix. No business logic.

#### Route Table

| URL Prefix | Target Service | Port |
|---|---|---|
| `/api/auth/`, `/api/v1/auth/` | Auth Service | 8001 |
| `/api/student/`, `/api/v1/student/` | Auth Service | 8001 |
| `/api/courses/`, `/api/v1/courses/` | Course Service | 8002 |
| `/api/admission/`, `/api/v1/admission/` | Admission Service | 8003 |
| `/api/tests/`, `/api/v1/tests/` | Admission Service | 8003 |
| `/api/notifications/`, `/api/v1/notifications/` | Notification Service | 8004 |
| `/api/certifications/`, `/api/v1/certifications/` | Certification Service | 8005 |
| `/api/content/`, `/api/v1/content/` | Content Service | 8006 |
| `/media/content/` | Content Service | 8006 |
| `/media/` (default) | Course Service | 8002 |

**Public (no auth) routes:**
- `/api/admission/*` — Lead creation, entrance test
- `/api/certifications/verify/*` — Certificate verification
- `/api/certifications/webhook/*` — Course completion webhook

---

## 6. Frontend Applications

### 6.1 `ait_fe` — Public Website (Port 3000)

**Purpose:** Public-facing website for Al-Khair Institute of Technology

**Tech:** Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Zustand, React Query

#### Pages

| Route | Page | Description |
|---|---|---|
| `/` | Home | Hero carousel, specializations, features, testimonials |
| `/about` | About | Mission, vision, CEO message, team, partners |
| `/contact` | Contact | Contact form with address/phone/email |
| `/courses` | Courses | Specializations grouped by batch, course carousels |
| `/courses/details` | Course Detail | Individual course detail view |
| `/register` | Register | Multi-step: personal info → course selection → receipt code → account creation |
| `/register/entrance-test` | Entrance Test | Online entrance examination |
| `/register/enrollment-status` | Enrollment Status | Check enrollment status |
| `/how-to-apply` | How to Apply | Application instructions |
| `/HowToRegister` | How to Register | Step-by-step registration guide |
| `/test` | Tests | Test listing |
| `/test/[id]` | Take Test | Take a specific test |
| `/test/result/[id]` | Test Result | View test result |
| `/verify-certificate` | Verify Certificate | Public certificate verification |
| `/admin/receipt-codes` | Receipt Codes | Admin panel for receipt code management |

#### API Integration

Uses Next.js **server-side API route proxies** as a Backend-for-Frontend (BFF) layer:
- `/api/auth/*` — Authentication endpoints (login, signup, logout, password reset)
- `/api/admission/[...path]` — Admission API proxy
- `/proxy/get?url=...` — Unauthenticated GET proxy
- `/proxy/get_auth?url=...` — Authenticated GET proxy with auto token refresh
- **Auth storage:** HTTP-only cookies (server-side), Zustand stores (client-side localStorage)

**SSO Bridge:** Sets a non-httpOnly `lms_bridge_token` cookie for cross-subdomain auto-authentication with `Lms_fe`.

---

### 6.2 `Lms_fe` — LMS Dashboard (Port 3001)

**Purpose:** Internal LMS with role-based dashboards for all user types

**Tech:** Next.js 16 (App Router), TypeScript, Tailwind CSS, Axios, Recharts, jsPDF

#### Pages by Role

**Admin (20 pages):**
Dashboard, Users, Courses, Batches, Specializations, Enrollments, Scheduled Classes, Leads, Deposits, Receipt Codes, Transfers, Notifications, Settings, Certifications, Certificate Generator, ID Generator, Control Panel, Metrics, Premium Dashboard

**Coordinator (6 pages):**
Dashboard, Teachers, Deposits, Transfers, Schedule, Certifications

**Teacher (11 pages):**
Dashboard, My Courses, Course Detail, Course Content, My Classes, Create Class, Assignments, Create Assignment, Assignment Detail/Grade, Attendance, Students, Notifications, Settings

**Student (8 pages):**
Dashboard, My Courses, Course Detail (with lectures), Assignments, Assignment Submit, Attendance, Certificates, ID Card, Notifications

**Utility (5 pages):**
Login, Register, Forgot Password, Reset Password, Change Password, Complete Profile, Force Password Change

#### API Integration

Uses **Axios** with request/response interceptors:
- **Base URL:** Auto-detected (same-origin via nginx, or `localhost:8000` in dev)
- **Auth:** JWT stored in `localStorage('lms_token')`
- **Request interceptor:** Attaches `Authorization: Bearer` header
- **Response interceptor:** Handles 401 errors
- **Idle timeout:** Auto-logout after 10 minutes of inactivity

**API modules** (all in `lib/api.ts`, ~1230 lines):
`authAPI`, `courseAPI`, `contentAPI`, `batchAPI`, `interviewAPI`, `attendanceAPI`, `assignmentAPI`, `submissionAPI`, `notificationAPI`, `userAPI`, `certificateAPI`, `enrollmentAPI`, `receiptAPI`, `admissionAPI`, `rolePermissionAPI`

---

## 7. Authentication & Authorization

### 7.1 JWT Authentication Flow

```
┌─────────┐      ┌──────────┐      ┌──────────┐
│ Frontend│      │  Backend │      │ Database │
└────┬────┘      └────┬─────┘      └────┬─────┘
     │ POST /login    │                  │
     │ email+password │                  │
     ├───────────────►│  Verify creds   │
     │                ├────────────────►│
     │                │◄────────────────┤
     │  Return JWT    │                  │
     │  (access +     │                  │
     │   refresh)     │                  │
     │◄───────────────┤                  │
     │                │                  │
     │ Store token    │                  │
     │ in cookies/    │                  │
     │ localStorage   │                  │
     │                │                  │
     │ Request+Bearer │                  │
     ├───────────────►│  Validate JWT   │
     │                │  (shared module) │
     │ 200 OK + data  │                  │
     │◄───────────────┤                  │
```

### 7.2 Token Management

- **Access Token:** Short-lived (configurable, default 30 min)
- **Refresh Token:** Long-lived (configurable, default 24h)
- **Storage:**
  - `ait_fe`: HTTP-only cookies (server-side API routes)
  - `Lms_fe`: localStorage (`lms_token`, `lms_user`)
- **Shared Auth Module** (`lms-microservices/shared/common/authentication.py`):
  - `JWTAuthentication` — Django Ninja auth backend
  - `roles_required(roles)` — Decorator for role-based access

### 7.3 Role Hierarchy

```
ADMIN ─────── Full system access
  │
COORDINATOR ── Teacher management, deposits, transfers
  │
TEACHER ────── Course content, assignments, attendance
  │
STUDENT ────── Course enrollment, assignments, certificates
```

### 7.4 Security Features

- **Rate Limiting:** Login attempts (5 attempts, 5-minute lockout) via Redis
- **Password Hashing:** Django's PBKDF2
- **Forced Password Change:** `must_change_password` flag for first-login reset
- **OTP Verification:** Email-based OTP for password changes
- **Soft Deletes:** `is_deleted` flag on all major models
- **Audit Logging:** `AdminActionLog` in every service

---

## 8. Database Schema

Each microservice has its own PostgreSQL database with isolated schema:

| Database | Service | Tables |
|---|---|---|
| `auth_db` | Auth Service | `users_user`, `users_student`, `users_studentacademicrecord`, `users_guardianinfo`, `users_residentialinfo`, `users_teacher`, `users_teacheraccounting`, `users_receiptcode`, `users_passwordresettoken`, `users_studenttransferhistory`, `users_adminactionlog`, `users_rolepermission` |
| `course_db` | Course Service | `courses_course`, `courses_specialization`, `courses_scheduledclass`, `courses_room`, `courses_assignment`, `courses_submission`, `courses_attendance`, `courses_studentcourseprogress`, `courses_courseregistrationhistory`, `courses_studentdeposit`, `courses_contentcompletion`, `courses_courserating`, `batches_batch`, `batches_enrollment`, `batches_teacerassignment`, `batches_interview` |
| `admission_db` | Admission Service | `tests_entrancelead`, `tests_test`, `tests_question`, `tests_testattempt`, `tests_interview`, `tests_receiptcode` |
| `notification_db` | Notification Service | `notifications_notificationbroadcast`, `notifications_notificationdelivery` |
| `certification_db` | Certification Service | `certifications_certification` |
| `content_db` | Content Service | `content_module`, `content_lesson`, `content_contentitem`, `content_usercontentprogress` |

---

## 9. Key Workflows

### 9.1 Student Registration (with Entrance Test)

```
1. Student visits /register (ait_fe)
2. Fills personal info → selects specialization/course/session
3. POST /api/admission/lead/ → creates EntranceLead (status: pending)
4. POST /api/admission/check-requirement/ → if test required, redirect to test
5. Student takes test → POST /api/tests/submit/
6. Auto-evaluated: if score ≥ passing_marks → status: passed
7. Student receives deposit instructions → pays at office → gets Receipt Code
8. Student enters Receipt Code → POST /api/auth/students/verify-receipt-code/
9. System verifies code, creates User + Student profiles, enrolls in course
10. Student redirected to Lms_fe dashboard (port 3001)
```

### 9.2 Direct Admission (No Test)

```
1. Student fills registration form → POST /api/admission/lead/
2. POST /api/admission/check-requirement/ → test NOT required
3. Student sees payment instructions → pays deposit → gets Receipt Code
4. Student enters Receipt Code → account created → redirected to LMS
```

### 9.3 Enrollment Flow

```
1. Admin creates ReceiptCode in auth-service (or admission-service)
2. Student enters code → Auth Service verifies via Admission Service
3. On verification: User+Student created, enrolled in course-service
4. RabbitMQ event `student.enrolled` published
5. Course Service syncs student profile back to Auth Service
```

### 9.4 Certificate Generation

```
1. Admin triggers certificate generation → POST /api/certifications/generate/
2. Certification Service fetches student name (Auth) + course details (Course)
3. Generates PDF with ReportLab + QR code with qrcode library
4. Returns certificate with unique verification_code UUID
5. Public can verify at /verify-certificate or via GET /api/certifications/verify/{code}/
```

### 9.5 Notification Broadcasting

```
1. Admin/Teacher creates broadcast → POST /api/notifications/broadcasts/
2. Notification Service resolves recipients (by role, course, class, or all)
3. Fetches user list from Auth Service, enrollment list from Course Service
4. Bulk-creates NotificationDelivery records for each recipient
5. Students/Teachers see notifications in their dashboard via GET /deliveries/
```

---

## 10. Inter-Service Communication

### 10.1 HTTP REST (Synchronous)

```
Auth Service ────→ Admission Service: Verify lead, lookup email, mark converted
Auth Service ────→ Course Service: Enroll student, fetch classes
Course Service ──→ Auth Service: Sync student profile
Admission Svc ───→ Auth Service: Check user exists
Admission Svc ───→ Course Service: Create enrollment after test pass
Certification ───→ Auth Service: Fetch student name
Certification ───→ Course Service: Fetch course/enrollment data
Notification ────→ Auth Service: Fetch users by role
Notification ────→ Course Service: Fetch enrollments/classes/students
```

### 10.2 RabbitMQ (Asynchronous)

- **Event:** `student.enrolled`
- **Publisher:** Auth Service
- **Consumers:** Course Service (and potentially other services)
- **Exchange:** Topic exchange with routing keys
- **Client:** `RabbitMQClient` in `shared/common/rabbitmq_client.py`

### 10.3 Service Client

The `ServiceClient` in `shared/common/service_client.py` provides:
- HTTP client wrapper for inter-service calls
- Exponential backoff retry logic
- Configurable timeout
- Error handling with custom exceptions

---

## 11. Deployment

### 11.1 Docker Compose (Development)

```bash
# Start all services
docker compose up -d

# Start backend services only
cd lms-microservices
docker compose up -d

# View logs
docker compose logs -f
docker compose logs -f auth-service

# Stop all
docker compose down

# Rebuild and restart
docker compose up -d --build
```

### 11.2 Infrastructure Containers

| Container | Image | Purpose |
|---|---|---|
| `postgres-main` | postgres:15 | Shared database (production) |
| `auth-db`, `course-db`, etc. | postgres:15 | Per-service databases (dev) |
| `redis` | redis:7 | Caching & session management |
| `rabbitmq` | rabbitmq:3-management | Message queue |
| `nginx` | nginx:alpine | Reverse proxy (production) |

### 11.3 Service Containers

| Service | Base Image | Port |
|---|---|---|
| `api-gateway` | python:3.11-slim | 8000 |
| `auth-service` | python:3.11-slim | 8001 |
| `course-service` | python:3.11-slim | 8002 |
| `admission-service` | python:3.11-slim | 8003 |
| `notification-service` | python:3.11-slim | 8004 |
| `certification-service` | python:3.11-slim | 8005 |
| `content-service` | python:3.11-slim | 8006 |
| `ait-frontend` | node:18-alpine | 3000 |
| `lms-frontend` | node:18-alpine | 3001 |

### 11.4 Production Deployment

Uses GitHub Actions (`.github/workflows/production-deploy.yml`):
- Builds and pushes Docker images
- Deploys to production server
- Runs migrations
- Health check verification

### 11.5 Environment Variables

Key environment variables (in root `.env`):
```
JWT_SECRET_KEY=your-production-secret-key
DATABASE_URL=postgresql://user:password@host:5432/dbname
REDIS_URL=redis://redis:6379/0
RABBITMQ_URL=amqp://lms_user:lms_password@rabbitmq:5672/
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-email
EMAIL_HOST_PASSWORD=your-app-password
```

---

## 12. Development Guide

### 12.1 Local Setup

**Backend:**
```bash
cd lms-microservices/services/auth-service
python -m venv venv
venv\Scripts\activate    # Windows
source venv/bin/activate # Mac/Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8001
```

**Frontend:**
```bash
cd ait_fe
npm install
npm run dev     # Port 3000

cd Lms_fe
npm install
npm run dev     # Port 3001
```

### 12.2 Common Commands

```bash
# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Create admin user
python manage.py createsuperuser

# Run tests
pytest

# Collect static files
python manage.py collectstatic
```

### 12.3 Code Conventions

- **Service Layer Pattern:** Business logic in `services.py`, not views/routers
- **Schema Validation:** Django Ninja `Schema` (Pydantic) for all request/response validation
- **Error Handling:** Custom exceptions in `shared/common/exceptions.py`
- **Logging:** Structured logging with service identification
- **Testing:** PyTest with per-service `pytest.ini`
- **Pre-commit:** `.pre-commit-config.yaml` with linting hooks

---

## 13. Security

| Measure | Implementation |
|---|---|
| **JWT Authentication** | Access + refresh tokens, short-lived access tokens |
| **Role-Based Access** | `roles_required` decorator on all protected endpoints |
| **Rate Limiting** | Login attempt limits (Redis-based) |
| **Password Hashing** | Django's PBKDF2 with SHA256 |
| **Input Validation** | Pydantic/Zod schemas on all endpoints |
| **SQL Injection** | Prevented by Django ORM |
| **XSS** | React's default escaping, Content Security Policy |
| **CORS** | Configured per-service for frontend origins |
| **Audit Logging** | `AdminActionLog` tracks all admin changes |
| **Soft Delete** | `is_deleted` flag prevents data loss |
| **Environment Secrets** | `.env` files for all sensitive config |

---

## 14. Troubleshooting

### Services not starting
```bash
docker compose logs          # Check all logs
docker compose restart <svc> # Restart specific service
```

### Database issues
```bash
docker exec <service> python manage.py migrate
docker compose down -v && docker compose up -d  # Fresh start
```

### Port conflicts
```bash
netstat -ano | findstr :8001  # Windows
lsof -i :8001                 # Mac/Linux
```

### Frontend build errors
```bash
rm -rf node_modules package-lock.json
npm install
```

### Common issues
- **"No module named 'shared'"**: Ensure shared directory is mounted in Docker or on PYTHONPATH
- **JWT expired**: Refresh token or re-login
- **Database connection refused**: Check PostgreSQL is running and credentials in `.env`
- **Cross-origin errors**: Verify CORS settings in each service's Django settings

---

## Appendix: Quick Reference

### Port Map

| Service | Port |
|---|---|
| API Gateway | 8000 |
| Auth Service | 8001 |
| Course Service | 8002 |
| Admission Service | 8003 |
| Notification Service | 8004 |
| Certification Service | 8005 |
| Content Service | 8006 |
| AIT Portal (Frontend) | 3000 |
| LMS Dashboard (Frontend) | 3001 |
| RabbitMQ Management | 15672 |
| PostgreSQL (dev) | 5432-5438 |

### Access Points

| URL | Description |
|---|---|
| http://localhost:3000 | AIT Public Website |
| http://localhost:3001 | LMS Dashboard |
| http://localhost:8000 | API Gateway |
| http://localhost:8001/admin | Auth Admin |
| http://localhost:8002/admin | Course Admin |
| http://localhost:8003/admin | Admission Admin |
| http://localhost:15672 | RabbitMQ UI (lms_user / lms_password) |

### Service Dependencies

```
Auth Service       → PostgreSQL, Redis, RabbitMQ
Course Service     → PostgreSQL, Redis
Admission Service  → PostgreSQL, Redis
Notification Svc   → PostgreSQL (depends on Auth + Course for API calls)
Certification Svc  → PostgreSQL (depends on Auth + Course for API calls)
Content Service    → PostgreSQL (depends on Course for course_id validation)
API Gateway        → All services (proxies requests)
```
