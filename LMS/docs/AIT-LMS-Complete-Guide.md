# AIT Learning Management System (LMS) — Mukammal Documentation

> **Institute:** Al-Khair Institute of Technology (AIT)
> **Public Website:** `ait.iak.ngo`  ·  **LMS Dashboard:** `lms.iak.ngo`
> **Document Version:** 1.0  ·  **Banaya gaya:** June 2026
>
> *Yeh document poore `docs/` folder ki saari files (Architecture, API, Microservices, Guides, Reports aur Reference docs) ka deep analysis karke banaya gaya hai. Iska maqsad yeh hai ke koi bhi banda — chahe technical ho ya non-technical — yeh samajh sake ke AIT-LMS kya hai, kaise kaam karta hai, ismein kitne roles hain, har role kaise kaam karta hai, iske features kya hain, benefits kya hain, aur iska architecture kaisa hai.*

---

## Fehrist (Table of Contents)

1. [LMS Kya Hai? — Aasan Tareeqe Se](#1-lms-kya-hai--aasan-tareeqe-se)
2. [System Kaise Kaam Karta Hai (High-Level Flow)](#2-system-kaise-kaam-karta-hai-high-level-flow)
3. [Roles — Kitne Hain Aur Har Role Kya Karta Hai](#3-roles--kitne-hain-aur-har-role-kya-karta-hai)
4. [Main Features (Tafseel Se)](#4-main-features-tafseel-se)
5. [Architecture — System Ka Naqsha](#5-architecture--system-ka-naqsha)
6. [Backend Microservices (6 Services)](#6-backend-microservices-6-services)
7. [Frontend Applications (2 Websites)](#7-frontend-applications-2-websites)
8. [Authentication & Security](#8-authentication--security)
9. [Database Structure](#9-database-structure)
10. [Important Workflows (Step-by-Step)](#10-important-workflows-step-by-step)
11. [Technology Stack](#11-technology-stack)
12. [Deployment Aur Infrastructure](#12-deployment-aur-infrastructure)
13. [Benefits — Is System Ke Faide](#13-benefits--is-system-ke-faide)
14. [Future Enhancements](#14-future-enhancements)
15. [Quick Reference (Ports & Access Points)](#15-quick-reference-ports--access-points)

---

## 1. LMS Kya Hai? — Aasan Tareeqe Se

**AIT-LMS** ek **full-stack educational platform** hai jo Al-Khair Institute of Technology ke liye banaya gaya hai. Yeh system ek student ki **poori zindagi (lifecycle)** ko manage karta hai — jis lamhe se woh institute mein admission ke liye apply karta hai, lekar us waqt tak jab woh course complete karke **certificate** le leta hai.

Saada lafzon mein: yeh ek aisa software hai jismein **admission, padhai, attendance, assignments, fees, aur certificates** — sab kuch ek hi jagah par online manage hote hain.

### Yeh System Kya Kya Sambhalta Hai?

| Area | Tafseel |
|---|---|
| **Student Admission** | Registration (entrance test ke sath ya direct admission), lead tracking, receipt code verification |
| **Course Management** | Specializations, batches, courses (Beginner/Advanced levels), scheduled classes |
| **Learning Management** | Assignments banana/submit karna, attendance tracking, content delivery (video, PDF, presentations) |
| **Certification** | Automatic certificate generation — QR code aur verification code ke sath |
| **Notifications** | Broadcast aur targeted messages (role/course/class ke hisab se) |
| **Content Delivery** | Course material ek hierarchy mein (Module → Lesson → ContentItem) progress tracking ke sath |
| **Role-Based Dashboards** | Admin, Coordinator, Teacher, aur Student — har ek ke liye alag interface |

**Khulaasa:** AIT-LMS ek "admission se lekar certification tak" ka complete digital solution hai jo institute ke saare academic aur administrative kaam ko automate karta hai.

---

## 2. System Kaise Kaam Karta Hai (High-Level Flow)

System do bare hisson mein bata hua hai:

1. **Public Website (`ait_fe`)** — Yeh aam logon ke liye hai. Yahan log courses dekhte hain, register karte hain, entrance test dete hain, aur certificate verify karte hain.
2. **LMS Dashboard (`Lms_fe`)** — Yeh login karne ke baad ka andar ka system hai jahan Students, Teachers, Coordinators aur Admins apna apna kaam karte hain.

Inn dono ke peeche **6 backend microservices** kaam karte hain, jo ek **API Gateway** ke zariye connect hote hain.

### Ek Student Ka Mukammal Safar (Journey)

```
Courses Browse karna  →  Register (Multi-step form)  →  Entrance Test (agar zaroori ho)
      →  Receipt Code Verification (deposit pay karke)  →  LMS Account ban gaya
      →  LMS mein Login  →  Courses mein Enroll  →  Classes attend karna
      →  Assignments submit karna  →  Attendance check karna
      →  Course complete  →  Certificate hasil karna  →  Alumni ban jana
```

---

## 3. Roles — Kitne Hain Aur Har Role Kya Karta Hai

System mein **kul 6 roles** hain (4 main + 2 extended). Har role ko sirf apna mutalliqa (relevant) menu aur features nazar aate hain — yeh **Role-Based Access Control (RBAC)** kehlata hai.

### Roles Ki Hierarchy

```
ADMIN ─────────── Poore system ka control
  │
COORDINATOR ───── Teachers, deposits, transfers, schedules
  │
TEACHER ───────── Course content, assignments, attendance
  │
STUDENT ───────── Enrollment, assignments, certificates
```

### 3.1 Admin (Sab Se Zyada Ikhtiyaar)
**Kaam:** Poore system ka control. Admin ke paas sab kuch ka access hota hai.
**Dashboard (~19-20 pages):** Users, Courses, Batches, Specializations, Enrollments, Scheduled Classes, Leads, Deposits, Receipt Codes, Transfers, Notifications, Certifications, Certificate Generator, ID Generator, Fee Structures, Branches, Control Panel, Metrics, Settings, Premium Dashboard.
**Khaas kaam:** Naye users banana aur roles assign karna, courses/batches setup karna, fees aur deposits manage karna, certificates generate karna, aur system-wide analytics dekhna.

### 3.2 Coordinator (Academic Operations)
**Kaam:** Academic operations aur staff management.
**Dashboard (~6 pages):** Dashboard, Teachers, Deposits, Transfers, Schedule, Certifications.
**Khaas kaam:** Teachers ko manage karna, class schedules banana, deposits dekhna, student transfers handle karna, aur certifications ki nigraani.

### 3.3 Teacher (Teaching Operations)
**Kaam:** Padhane se mutalliq saare kaam.
**Dashboard (~11-15 pages):** Dashboard, My Courses, Course Detail, Course Content, My Classes, Create Class, Assignments, Create Assignment, Assignment Grade, Attendance, Students, Notifications, Settings.
**Khaas kaam:** Apne courses ka content manage karna, classes banana, **attendance lena (bulk marking)**, assignments banana aur **grade karna**, aur apni class ko notifications bhejna.

### 3.4 Student (Learning Operations)
**Kaam:** Seekhne se mutalliq kaam.
**Dashboard (~8 pages):** Dashboard, My Courses, Course Detail (lectures ke sath), Assignments, Assignment Submit, Attendance, Certificates, ID Card, Notifications.
**Khaas kaam:** Apne courses aur lectures dekhna, assignments submit karna aur grades check karna, attendance dekhna, certificates download karna, aur apna **Student ID Card** dekhna/print karna.

### 3.5 Account Officer (Financial Operations) — Extended
**Kaam:** Financial operations — deposits, receipts, aur leads ka hisab kitab.

### 3.6 TA — Teaching Assistant (Extended)
**Kaam:** Teacher jaisa hi kaam, magar mehdood (limited) scope ke sath.

> **Note:** Poore LMS Dashboard mein **59+ unique pages/routes** hain jo inn roles mein bate hue hain.

---

## 4. Main Features (Tafseel Se)

### 4.1 Admission & Registration System
- **Multi-step Registration:** Personal info → Course selection → Entrance test → Receipt code → Account creation.
- **Entrance Test System:** Online MCQ-based, timed exam jo **automatically evaluate** ho jaata hai (pass/fail passing marks ke hisab se).
- **Direct Admission:** Jin courses mein test zaroori nahi, unke liye seedha payment aur account creation.
- **Resume Registration:** Agar student test pass karke beech mein chhod de, toh email se dobara resume kar sakta hai — test dobara nahi dena padta.
- **Lead Tracking:** Har applicant ek "lead" banta hai jiska status (pending/passed/failed/enrolled) track hota hai.

### 4.2 Receipt Code & Deposit Verification
- Student office mein deposit pay karta hai aur ek **Receipt Code** milta hai.
- Yeh code enter karte hi system verify karke **LMS account bana deta hai** aur course mein enroll kar deta hai.
- Deposit mein **bag** aur **ID card** ki fees bhi track hoti hain (taken/paid/waived/returned).

### 4.3 Course & Content Management
- **Hierarchy:** Specialization → Course (level: Beginner/Advanced) → Scheduled Class.
- **Content delivery:** `Module → Lesson → ContentItem` — jismein videos, PDFs, presentations, links, images, quizzes attach hote hain.
- **Progress Tracking:** Har student ka lesson-by-lesson completion track hota hai.
- **Preview content:** Kuch content enroll hue baghair bhi dekha ja sakta hai.

### 4.4 Attendance System
- **Bulk attendance marking** — teacher ek hi baar mein poori class ki attendance laga sakta hai.
- Per-student attendance statistics aur monthly stats.

### 4.5 Assignments & Grading
- Teachers assignments banate hain (due date, total marks, attachment ke sath).
- Students file ya text submit karte hain.
- Teachers **grade aur feedback** dete hain.

### 4.6 Certification System
- **Automatic certificate generation** — PDF (ReportLab se) + **QR code**.
- Har certificate ka **unique verification code (UUID)** aur certificate number (`CERT-YYYY-XXXXX`).
- Public log `/verify-certificate` par ja kar certificate ki **asliyat verify** kar sakte hain.

### 4.7 Student ID Card Generator
- **High-fidelity (pixel-perfect)** ID cards jo design templates ke exact coordinates se banaye jaate hain.
- Student apne dashboard se direct download kar sakta hai (`html2canvas` technology).

### 4.8 Notification System
- **Broadcast model:** Ek notification banao, system woh **fan-out** karke har recipient tak pahuncha deta hai.
- **Audience types:** ALL / ROLE / COURSE / CLASS / CUSTOM.
- Read/unread tracking ke sath.

### 4.9 Fee Management
- Fee structures (monthly maintenance fee, one-time fee, payment plans).
- Fee records aur payment transactions ka record.
- Financial analytics aur CSV export (e.g. Total Collection, Refunded, Net Revenue).

### 4.10 Multi-Branch Support
- Ek se zyada institute branches ka support — users, courses, classes sab branch ke hisab se.

### 4.11 Transfers & Re-enrollment
- Student ko ek course se doosre course mein transfer karna.
- Alumni (purane students) ko dobara enroll karna.

### 4.12 Audit Logging
- Har service mein `AdminActionLog` — kaun se admin ne kya change kiya, sab record hota hai (Users, Courses, Deposits, Leads sab ke liye).

### 4.13 Data Seeding (Google Sheets Integration)
- Master Google Sheet se **teachers, students, courses, enrollments, aur leads** automatically import hote hain.

---

## 5. Architecture — System Ka Naqsha

System **Microservices Architecture** par bana hai. Iska matlab hai ke har bara feature ek alag, khud-mukhtar (independent) service hai jiska apna database hai.

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
│      Routes: /api/auth/* → :8001, /api/courses/* → :8002, ...      │
└──┬─────────┬──────────┬──────────┬──────────┬──────────┬───────────┘
   ▼         ▼          ▼          ▼          ▼          ▼
┌──────┐ ┌──────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Auth │ │Course│ │Admission│ │Notif.  │ │ Certif.│ │Content │
│:8001 │ │:8002 │ │:8003   │ │:8004   │ │:8005   │ │:8006   │
│Django│ │Django│ │Django  │ │Django  │ │Django  │ │Django  │
└──┬───┘ └──┬───┘ └───┬────┘ └───┬────┘ └───┬────┘ └───┬────┘
   ▼        ▼         ▼          ▼          ▼          ▼
┌──────┐ ┌──────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│auth_ │ │course│ │admiss- │ │notif.  │ │certif. │ │content │
│ db   │ │_db   │ │ion_db  │ │_db     │ │_db     │ │_db     │
└──────┘ └──────┘ └────────┘ └────────┘ └────────┘ └────────┘
                        │
                  ┌─────▼──────┐      ┌──────────┐
                  │   Redis    │      │ RabbitMQ │
                  │ (Caching & │      │  (Async  │
                  │  Sessions) │      │ Messages)│
                  └────────────┘      └──────────┘
```

### Architecture Ke Bunyaadi Usool (Principles)

- **Microservices Isolation:** Har service ka apna database, models aur API hain. Ek service down ho toh baqi chalti rahein.
- **API Gateway Pattern:** Ek single entry point (FastAPI) jo saari requests ko sahi service tak pahuncha deta hai.
- **JWT Authentication:** Stateless auth — access + refresh tokens ke sath.
- **Event-Driven:** RabbitMQ ke zariye services aapas mein async messages bhejti hain (jaise `student.enrolled` event).
- **Profile-First Architecture:** Profiles automatically Django signals ke zariye User objects bana dete hain.

### Architecture Decisions — Kyun Aise Banaya?

| Faisla | Wajah |
|---|---|
| Microservices (Monolith ke bajaye) | Alag concerns, independent scaling, team autonomy |
| Django (services ke liye) | ORM, admin interface, mature ecosystem, migrations |
| Django Ninja | Type-annotated endpoints, Pydantic validation, OpenAPI docs |
| PostgreSQL per service | Data isolation, independent schema evolution |
| RabbitMQ (async) | Reliable message delivery, pub/sub for events |
| JWT (sessions ke bajaye) | Stateless auth, cross-service authentication |
| Do frontends | Alag audiences (public vs authenticated), independent deployment |

---

## 6. Backend Microservices (6 Services)

| # | Service | Port | Framework | Database | Tables | Kaam |
|---|---|---|---|---|---|---|
| 1 | Auth Service | 8001 | Django + Ninja | auth_db | 13 | Authentication, users, profiles |
| 2 | Course Service | 8002 | Django + Ninja | course_db | 20 | Courses, enrollments, attendance, fees |
| 3 | Admission Service | 8003 | Django DRF | admission_db | 7 | Leads, entrance tests |
| 4 | Notification Service | 8004 | Django DRF | notification_db | 2 | Broadcasts, deliveries |
| 5 | Certification Service | 8005 | Django DRF | certification_db | 1 | Certificate generation/verify |
| 6 | Content Service | 8006 | Django + Ninja | content_db | 4 | Course content delivery |
| — | API Gateway | 8000 | FastAPI | — | — | Reverse proxy (no business logic) |

### 6.1 Auth Service (Port 8001)
**Kaam:** Authentication, authorization, profile management. Yeh system ki **identity ki bunyaad** hai.
**Models:** `User`, `Student`, `StudentAcademicRecord`, `GuardianInfo`, `ResidentialInfo`, `Teacher`, `TeacherAttendance`, `ReceiptCode`, `Branch`, `PasswordResetToken`, `StudentTransferHistory`, `AdminActionLog`, `RolePermission`.
**Khaas features:** JWT login/refresh/logout, **OTP system** (email-based), **forced password change** (pehli baar login par), receipt code verification.
**Doosri services se baat:** Admission Service (lead verify), Course Service (enroll), aur RabbitMQ par `student.enrolled` event publish karta hai.

### 6.2 Course Service (Port 8002)
**Kaam:** Course aur academic management — LMS ka **"dil" (heart)**.
**Models:** `Specialization`, `Course`, `ScheduledClass`, `Room`, `StudentCourseProgress`, `CourseRegistrationHistory`, `Assignment`, `Submission`, `Attendance`, `StudentDeposit`, `Batch`, `Enrollment`, `FeeStructure`, `StudentFeeRecord`, `FeePaymentTransaction`, `CourseRating`, waghaira.
**Khaas features:** Course CRUD, enrollment, bulk attendance, assignments + grading, deposits, fee structures, Google Sheets sync.

### 6.3 Admission Service (Port 8003)
**Kaam:** Student admission, lead management, aur entrance testing.
**Models:** `EntranceLead`, `Test`, `Question`, `TestAttempt`, `Interview`, `ReceiptCode`, `Branch`.
**Khaas features:** Lead generation, entrance test (auto-evaluation), direct admission support, resume registration. Questions mein images aur multiple correct answers ka support bhi hai.

### 6.4 Notification Service (Port 8004)
**Kaam:** Broadcast aur targeted notifications.
**Models:** `NotificationBroadcast`, `NotificationDelivery`.
**Khaas features:** Broadcast-first model with fan-out delivery. Email/SMS alerts (RabbitMQ consumer ke zariye). Auth Service se users aur Course Service se enrollments fetch karta hai.

### 6.5 Certification Service (Port 8005)
**Kaam:** Certificate generation aur verification.
**Models:** `Certification`.
**Khaas features:** PDF + QR code generation, unique verification code, public verification, course-completion webhook.

### 6.6 Content Service (Port 8006)
**Kaam:** Structured hierarchy ke sath course content delivery.
**Models:** `Module`, `Lesson`, `ContentItem`, `UserContentProgress`.
**Khaas features:** Curriculum API (nested tree), progress tracking, preview/enrolled-only access control, 100% Pydantic schema validation.

### 6.7 API Gateway (Port 8000)
**Technology:** FastAPI + httpx. **Koi business logic nahi** — sirf requests ko URL prefix ke hisab se sahi service tak proxy karta hai.

**Route Table (mukhtasar):**
| URL Prefix | Service | Port |
|---|---|---|
| `/api/auth/*`, `/api/student/*` | Auth | 8001 |
| `/api/courses/*` | Course | 8002 |
| `/api/admission/*`, `/api/tests/*` | Admission | 8003 |
| `/api/notifications/*` | Notification | 8004 |
| `/api/certifications/*` | Certification | 8005 |
| `/api/content/*`, `/media/content/*` | Content | 8006 |
| `/media/*` (default) | Course | 8002 |

---

## 7. Frontend Applications (2 Websites)

### 7.1 `ait_fe` — Public Website (Port 3000)
**Maqsad:** Aam logon ke liye public-facing website (`ait.iak.ngo`).
**Tech:** Next.js 16 (App Router), TypeScript, Tailwind CSS, shadcn/ui, Zustand, React Query, Framer Motion, Chart.js.
**Pages (~15):** Home, About, Contact, Courses, Course Detail, Register (multi-step), Entrance Test, Enrollment Status, How to Apply, Tests, Test Result, Verify Certificate, Admin Receipt Codes.
**API Integration:** Next.js **server-side API route proxies** (Backend-for-Frontend / BFF pattern). Tokens **HTTP-only cookies** mein store hote hain.
**SSO Bridge:** Ek `lms_bridge_token` cookie set karta hai taake user `Lms_fe` mein automatically login ho jaye (cross-subdomain).

### 7.2 `Lms_fe` — LMS Dashboard (Port 3001)
**Maqsad:** Login ke baad ka role-based dashboard (`lms.iak.ngo`).
**Tech:** Next.js 16 (App Router), TypeScript, Tailwind CSS, **Axios**, Recharts, jsPDF, html2canvas.
**Pages:** 59+ pages — Admin (~20), Coordinator (~6), Teacher (~11), Student (~8), aur utility pages (login, register, password recovery, etc.).
**API Integration:** **Axios** with request/response interceptors. Token `localStorage('lms_token')` mein. **10-minute idle timeout** par auto-logout.
**API Modules (`lib/api.ts`, ~1230 lines):** `authAPI`, `courseAPI`, `contentAPI`, `batchAPI`, `attendanceAPI`, `assignmentAPI`, `submissionAPI`, `notificationAPI`, `userAPI`, `certificateAPI`, `enrollmentAPI`, `receiptAPI`, `admissionAPI`, `rolePermissionAPI`, waghaira.

---

## 8. Authentication & Security

### JWT Authentication Flow
```
User → Login Page → email + password submit
  → Auth Service credentials verify karta hai → JWT issue (access + refresh)
  → Token store (ait_fe = cookie / Lms_fe = localStorage)
  → Role-based dashboard par redirect
  → Expiry par auto-refresh
  → Logout → tokens clear → login par wapas
```

### Token Details
- **Access Token:** Short-lived (default 30 min), ismein `user_id`, `email`, `role` hota hai.
- **Refresh Token:** Long-lived (24h / 7d). Algorithm: **HS256**.

### Security Features
| Measure | Implementation |
|---|---|
| JWT Authentication | Access + refresh tokens, short-lived access |
| Role-Based Access | `roles_required` decorator har protected endpoint par |
| Rate Limiting | 5 login attempts, 5-min lockout (Redis-based) |
| Password Hashing | Django PBKDF2 + SHA256 |
| Forced Password Change | `must_change_password` flag (first login) |
| OTP Verification | Email-based OTP password changes ke liye |
| Soft Deletes | `is_deleted` flag — data kabhi delete nahi hota |
| Audit Logging | `AdminActionLog` har service mein |
| Idle Timeout | 10-min inactivity par auto-logout (Lms_fe) |
| Input Validation | Pydantic (backend) + Zod (frontend) schemas |
| SQL Injection | Django ORM se prevent |
| XSS | React default escaping + CSP |
| CORS | Har service mein frontend origins ke liye configured |

---

## 9. Database Structure

Har microservice ka **apna alag PostgreSQL database** hai (data isolation ke liye):

| Database | Service | Tables |
|---|---|---|
| `auth_db` | Auth | 13 — users, students, teachers, receipt codes, branches, etc. |
| `course_db` | Course | 20 — courses, enrollments, attendance, assignments, fees, batches |
| `admission_db` | Admission | 7 — leads, tests, questions, attempts, interviews |
| `notification_db` | Notification | 2 — broadcasts, deliveries |
| `certification_db` | Certification | 1 — certifications |
| `content_db` | Content | 4 — modules, lessons, content items, progress |

### Auto-Generated IDs (Naming Conventions)
- **Student ID:** `AIT-BRANCH-YYYY-CODE-XXXX`
- **Roll Number:** `AIT-YEAR-CODE-SEC-XXXX`
- **Certificate Number:** `CERT-YYYY-XXXXX`
- **Verification Code:** UUID (har certificate ke liye unique)

---

## 10. Important Workflows (Step-by-Step)

### 10.1 Registration with Entrance Test
```
1. Student /register par jaata hai (ait_fe)
2. Personal info bharta hai → specialization/course select
3. POST /api/admission/lead/ → EntranceLead banta hai (status: pending)
4. POST /api/admission/check-requirement/ → agar test zaroori, test par redirect
5. Student test deta hai → POST /api/tests/submit/
6. Auto-evaluation: score ≥ passing_marks → status: passed
7. Deposit instructions milti hain → office mein pay → Receipt Code milta hai
8. Receipt Code enter → POST /api/auth/students/verify-receipt-code/
9. System verify karta hai, User + Student profile banata hai, course mein enroll
10. Lms_fe dashboard par redirect (port 3001)
```

### 10.2 Direct Admission (Bina Test)
```
1. Registration form bharta hai → lead banta hai
2. check-requirement → test zaroori NAHI
3. Seedha payment instructions → deposit pay → Receipt Code
4. Code enter → account ban gaya → LMS par redirect
```

### 10.3 Enrollment Flow (Event-Driven)
```
1. Admin Receipt Code banata hai (auth/admission service mein)
2. Student code enter karta hai → Auth Service verify karta hai
3. User + Student create, course-service mein enroll
4. RabbitMQ event `student.enrolled` publish hota hai
5. Course Service student profile wapas Auth Service mein sync karta hai
```

### 10.4 Certificate Generation
```
1. Admin certificate trigger karta hai → POST /api/certifications/generate/
2. Cert Service student name (Auth) + course details (Course) fetch karta hai
3. ReportLab se PDF + qrcode library se QR code banta hai
4. Unique verification_code (UUID) ke sath certificate ready
5. Public /verify-certificate par verify kar sakta hai
```

### 10.5 Notification Broadcasting
```
1. Admin/Teacher broadcast banata hai → POST /api/notifications/broadcasts/
2. Notification Service recipients resolve karta hai (role/course/class/all)
3. Auth Service se users, Course Service se enrollments fetch
4. Har recipient ke liye NotificationDelivery record bulk-create
5. Students/Teachers apne dashboard mein dekhte hain
```

---

## 11. Technology Stack

### Backend
| Technology | Version | Maqsad |
|---|---|---|
| Python | 3.11+ | Runtime |
| Django | 5.0.6 | Web framework |
| Django Ninja | 1.1+ | Type-annotated APIs (Pydantic) |
| Django REST Framework | 3.14 | REST APIs (notifications, certifications) |
| FastAPI | — | API Gateway |
| PostgreSQL | 15 | Database (6 databases) |
| Redis | 7 | Caching, sessions, rate limiting |
| RabbitMQ | 3 | Async message queue |
| Gunicorn | 22 | WSGI server |
| httpx | — | Async HTTP client (gateway) |
| ReportLab | — | PDF generation (certificates) |
| Pillow | 10.2 | Image processing |
| Google API Client | 2.122 | Google Sheets integration |
| SimpleJWT / PyJWT | — | JWT auth |
| Pika | 1.3 | RabbitMQ client |

### Frontend
| Technology | ait_fe (Public) | Lms_fe (Dashboard) |
|---|---|---|
| Framework | Next.js 16 | Next.js 16 |
| Language | TypeScript 5 | TypeScript 5 |
| Styling | Tailwind CSS 3.3 | Tailwind CSS 3.6 |
| UI | shadcn/ui + Radix | shadcn/ui |
| State | Zustand 5 | — |
| Server State | TanStack Query 5 | — |
| HTTP | — | Axios 1.6 |
| Charts | Chart.js 4.5 | Recharts 2.12 |
| Animation | Framer Motion 12 | — |
| Forms | React Hook Form + Zod | — |
| PDF / ID | — | jsPDF 4, html2canvas 1.4 |

### Infrastructure
| Tool | Maqsad |
|---|---|
| Docker / Docker Compose | Containerization & orchestration (15 containers) |
| Nginx | Reverse proxy (production) |
| GitHub Actions | CI/CD (self-hosted runner) |

---

## 12. Deployment Aur Infrastructure

### Containers (Docker Compose)
- **Infrastructure:** PostgreSQL (postgres-main), Redis, RabbitMQ, Nginx.
- **Backend:** API Gateway + 6 services (python:3.11-slim).
- **Frontend:** ait-frontend (3000), lms-frontend (3001) — node:18-alpine.

### Production Setup
- **Domains:** `ait.iak.ngo` (public) aur `lms.iak.ngo` (dashboard).
- **Nginx** reverse proxy ke zariye routing.
- **HTTPS** aur proper CSRF handling.
- **CI/CD:** GitHub Actions (`production-deploy.yml`) — images build/push, deploy, migrations, health checks.

### Common Commands
```bash
docker compose up -d --build          # Sab kuch start karna
docker compose logs -f auth-service   # Logs dekhna
docker compose exec auth-service python manage.py migrate   # Migrations
docker compose up -d --scale auth-service=3   # Horizontal scaling
```

### Data Seeding Pipeline (Google Sheets)
```
1. seed_teachers_from_sheet.py    → Auth → Teachers
2. import_academic_structure.py   → Course → Specializations, Courses, Sections
3. seed_students_from_master.py   → Auth → Students + Receipt Codes
4. ingest_enrollments.py          → Course → Enrollments + Deposits
5. seed_leads_from_sheet.py       → Admission → Entrance Leads
```

---

## 13. Benefits — Is System Ke Faide

### Institute Ke Liye
- **Mukammal Automation:** Admission se certification tak sab kuch online — manual paperwork khatam.
- **Centralized Data:** Saari student, course, fee aur attendance ki maloomat ek jagah.
- **Financial Transparency:** Deposits, fees, refunds, aur net revenue ka real-time hisab (CSV export ke sath).
- **Audit Trail:** Har admin action log hota hai — accountability barhti hai.
- **Multi-Branch:** Ek hi system se kai branches manage.

### Students Ke Liye
- **Aasaan Online Registration** aur entrance test — ghar baithe.
- **24/7 Access:** Courses, lectures, assignments, attendance, certificates kabhi bhi dekho.
- **Digital ID Card aur Certificate** — direct download.
- **Transparency:** Apni attendance aur grades khud dekh sakte hain.

### Teachers & Staff Ke Liye
- **Bulk Attendance** aur asaan grading — waqt ki bachat.
- **Content Management** apne haath mein.
- **Targeted Notifications** apni class ko.

### Technical Benefits
- **Scalability:** Microservices alag-alag scale ho sakti hain (load ke hisab se).
- **Reliability:** Ek service down ho toh baqi chalti rahein.
- **Security:** JWT, RBAC, rate limiting, audit logs, soft deletes.
- **Maintainability:** Har service alag — naye features add karna asaan.

---

## 14. Future Enhancements

| Feature | Priority | Tafseel |
|---|---|---|
| Mobile App | High | React Native — student access ke liye |
| Payment Gateway | High | Online fees (Stripe / Easypaisa / JazzCash) |
| Backup / DR | High | Automated DB backups, disaster recovery |
| Live Classes | Medium | Video conferencing (Zoom / Meet API) |
| Chat System | Medium | Student-Teacher direct messaging |
| Timetable | Medium | Visual calendar view |
| Advanced Analytics | Medium | ML-based performance prediction |
| Multi-language | Low | Urdu/English interface toggle |

---

## 15. Quick Reference (Ports & Access Points)

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
| AIT Public Website | 3000 |
| LMS Dashboard | 3001 |
| RabbitMQ Management | 15672 |
| PostgreSQL (dev) | 5432-5438 |

### Access Points
| URL | Description |
|---|---|
| `http://localhost:3000` | AIT Public Website |
| `http://localhost:3001` | LMS Dashboard |
| `http://localhost:8000` | API Gateway |
| `http://localhost:8001/admin` | Auth Admin Panel |
| `http://localhost:15672` | RabbitMQ UI |
| `https://ait.iak.ngo` | Production — Public |
| `https://lms.iak.ngo` | Production — Dashboard |

---

## Khulaasa (Conclusion)

AIT-LMS ek **enterprise-grade, microservices-based educational platform** hai jo Al-Khair Institute of Technology ke poore academic aur administrative nizaam ko digital aur automate karta hai. Iska **6-service backend**, **2-frontend architecture**, **4+ roles ka RBAC system**, aur **admission-se-certification tak ka complete workflow** ise ek mazboot, scalable aur secure solution banata hai.

Yeh document `docs/` folder ki tamaam files ka nichod (summary) hai — ab koi bhi naya developer, manager ya stakeholder sirf yeh ek file parh kar poore system ko samajh sakta hai.

---

> **Document Banaya Gaya:** June 2026
> **Source:** `docs/` folder ki 13 files ka deep analysis
> **Maintained by:** AIT Development Team
