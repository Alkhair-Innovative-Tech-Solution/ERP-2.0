# Daily Work Report (May 18 - June 11, 2026)

---

## May 19 (Tue)
- **User Profile Completion Workflow**: Profile completion flow for users
- **Docker Host Networking**: Added host networking to all microservices in docker-compose

---

## May 20 (Wed)
- **Multi-Branch Support**: Branch support across all core services
- **User Roles**: Role definitions and management
- **Admin Dashboards**: Admin panel dashboard pages

---

## May 21 (Thu)
- **Certificate Generation Backend**: Backend service for automated certificate generation
- **Certificate Management UI**: Frontend components for certificate management

---

## May 25 (Mon)
- **Deposit Management System**: Full deposit system (transaction tracking, ledger tables, admin enrollment workflows)
- **Startup Scripts**: Deployment configs and startup scripts for all microservices
- **Requirements Files**: requirements.txt for all 6 services
- **GitHub Actions**: CI/CD workflows for SSH deployment and self-hosted runner

---

## June 1 (Mon)
### Frontend
- **Professional Deposit Report**: Admin deposits page with financial summary cards (Total Collection PKR 4,026K, Refunded, Net Revenue, Active/Returned), course-wise breakdown table, CSV export
- **ReportSummaryCards.tsx** and **CourseBreakdownTable.tsx** components
- **Teacher Portal Fixes**:
  - Grading was completely broken — fixed submissionAPI.grade() args
  - Assignment creation: type→assignment_type, assigned_by→created_by_id, added is_published
  - score=0 was incorrectly filtered as ungraded
  - Attendance avatar color ternary bug
  - Assignments list getSubmissionStats call
  - Content management: wired delete buttons, added Add Item modal
- **Courses Component**: User dashboard course list with links

### Backend
- Added CORS_ALLOW_ALL_ORIGINS=True to all 6 services
- Added auto-install requirements in start.py for all services
- Fixed cert import script (BOM encoding corruption)
- Fixed student import (requests import at module level)

### Data Restructuring
- Moved mapping JSONs from seed_data/ to service roots
- Updated all seed scripts to use new file paths

---

## June 3 (Wed)
### Admission Service
- **Question Type**: Added question_type field with choices
- **Images Support**: Added image fields for questions and options (A, B, C, D)
- **Order Field**: Added order field for display ordering
- **Correct Answers**: Added correct_answers field for multiple correct answers

### Auth Service
- **Google Sheets Seeding**: Unified seeding from master sheet (students + leads)
- **Student/Lead Classification**: Classification and enrollment mapping
- **Receipt Code Generation**: Receipt code generation + admission service sync

### Course Service
- **Additional Teachers**: Added additional_teacher_ids field to ScheduledClass model

---

## June 4 (Thu)
- **Certificate Dashboard**: Coordinator portal certificate generation dashboard
- **Certificate Management Pages**: Full certificate management UI

---

## June 10 (Wed)
### Frontend
- **Teacher Content Navigation**: Topic/module headers now link to content management page
- **Add Materials Button**: Added alongside "Create Assignment" in Classwork tab
- **Assignment Creation Fix**: Prevent sending "undefined" string for assignment_type/is_published in FormData
- **Teacher Students Page**: Fixed course complete API, A-Z sorting
- **Teacher Grading Fixes**: Submission ID guard, score=0 stats, graded=0 hardcoded
- **Teacher Attendance**: Fixed race condition in fetchStudents/fetchAttendance
- **Student Certificate Download**: Fixed wrong token key
- **Student Assignments**: Text-only submission validation, search wiring, due_date NaN fix
- **Student Settings Page**: New page with Profile + Security tabs
- **Corrupted Turbopack Cache**: Cleared .next/ folder (fixed 500/404 errors on all routes)

### Backend
- **Course-Service Container**: Was created under wrong compose project causing network isolation — fixed
- **Auth-Service**: Was deleted during compose chaos — recreated
- **Course Submission Endpoint**: Changed to accept multipart form-data instead of JSON
- **Assignment Create API**: Fixed due_date type mismatch
- **Submission API**: Fixed File | null type

---

## June 11 (Thu)
### Authentication Fix (DRF vs Ninja Conflict)
- **Problem**: `JWTAuthentication.authenticate()` returned a bare `user` object, but Django REST Framework expects a `(user, auth)` tuple
- **Impact**: Identity card endpoint and other DRF-based views threw `TypeError: cannot unpack non-iterable User object`
- **Fix**:
  - `authenticate()` → now returns `(user, None)` (for DRF)
  - `__call__()` → unwraps the tuple, returns just user (for Ninja)
  - Applied to both copies:
    - `lms-microservices/shared/common/authentication.py` (volume-mounted, live)
    - `lms-microservices/services/auth-service/shared/common/authentication.py` (Docker build context)

### Container Network Fixes
- **postgres-auth**: Old container conflicted on port 5432 (postgres-main already bound)
- **Fix**: Recreated auth-service using root docker-compose.yml which uses single postgres-main instance
- **DATABASE_URL**: Fixed from `postgresql://...@postgres-auth:5432/auth_db` → `postgresql://...@postgres-main:5432/auth_db`

### Final Status (June 11)
- **Project**: `ait-lms` compose project — 10 services created, 2 exited, 10 running
- **All microservices**: Connected to correct network and database
- **Authentication**: Working for both DRF and Ninja endpoints
- **Frontend**: Turbopack cache cleared, all routes accessible

---

## Summary (May 18 - June 11, 2026)
| Category | Count |
|----------|-------|
| **Commits** | 13 |
| **Services Affected** | 7 (auth, course, admission, certification, notification, api-gateway, frontend) |
| **Bug Fixes** | 20+ |
| **New Features** | 15+ |
| **Infrastructure** | Docker, CI/CD, Networking |
