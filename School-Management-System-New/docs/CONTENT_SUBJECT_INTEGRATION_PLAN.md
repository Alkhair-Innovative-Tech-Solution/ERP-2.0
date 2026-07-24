# Content Management & Subject Service — Integration Plan
**Target Project:** `SMS/` (School Management System)  
**Source Reference:** `AIT-LMS/` (LMS microservices — adapted, not copied as-is)  
**Date:** 2026-05-22

---

## 0. Golden Rule

> **SMS ka structure, patterns aur multi-tenancy SABSE PEHLE hai.**  
> LMS ka code sirf reference hai — usse SMS ke pattern mein dhaal ke laana hai.  
> Koi bhi LMS-specific cheez (Django Ninja, LMS-only models, flat auth) seedha nahi aayegi.

---

## 1. What Exists — Quick Reference

### SMS Current Services (ports)
| Service | Port | DB |
|---|---|---|
| auth-service | 8001 | postgres-auth |
| org-service | 8002 | postgres-org |
| campus-service | 8003 | postgres-campus |
| staff-service | 8004 | postgres-staff |
| student-service | 8005 | postgres-student |
| attendance-service | 8006 | postgres-attendance |
| result-service | 8007 | postgres-result |
| fees-service | 8008 | postgres-fees |
| timetable-service | 8009 | postgres-timetable |
| notification-service | 8010 | postgres-notification |
| support-service | 8011 | postgres-support |

### SMS Hierarchy (campus-service)
```
Organization → Campus → Level → Grade → ClassRoom (Grade + Section + Shift)
```

### SMS Multi-Tenancy Pattern
- Every model has `organization = ForeignKey('users.Organization', ...)`  
- Every model uses `objects = OrganizationManager()` (auto-filters by org from JWT)  
- Auth: `ServiceJWTAuthentication` (stateless, no DB hit) from `ams_shared`  
- Middleware: `OrganizationMiddleware` sets context vars per request  
- JWT payload contains: `user_id, org_id, role, campus_id`

### LMS Source Services
| LMS Service | What it does |
|---|---|
| `course-service` | Course, ScheduledClass, Assignment, Submission, Attendance (LMS-specific) |
| `content-service` | Module → Lesson → ContentItem, UserContentProgress |
| `Lms_fe/` | Next.js dashboard: teacher course content mgmt, student course view, assignments |

---

## 2. What We Are Building

### Service 1: `subject-service` (Port: 8012)
**What it is:** LMS `course-service` ko school ke liye adapt karna.  
- Course → **Subject** (e.g., Math, Science, Urdu)  
- Specialization → **Grade/ClassRoom** (already in campus-service)  
- ScheduledClass → already handled by **timetable-service** (drop it)  
- Assignment + Submission → **keep these** (core feature)  
- LMS fee models (FeeStructure, StudentDeposit etc.) → **drop** (already in fees-service)

### Service 2: `content-service` (Port: 8013)
**What it is:** LMS `content-service` ko SMS mein port karna (minimal changes).  
- Module → Lesson → ContentItem hierarchy **preserved**  
- `course_id` → `subject_id` (rename FK reference only)  
- `UserContentProgress` → `StudentContentProgress`  
- Multi-tenancy + DRF added

### Frontend Additions (SMS `/frontend`)
- **Teacher portal** — subject content management, assignment creation/grading  
- **Student portal** — my subjects, content viewer, assignment submission  

---

## 3. Architecture Diagram

```
                        ┌─────────────────────────────────────────┐
                        │              API Gateway (nginx)         │
                        └────┬────────┬───────┬────────┬──────────┘
                             │        │       │        │
                        8001  │   8003 │  8012 │   8013 │  8005...
                          auth│ campus │subject│content │ (others)
                             │        │       │        │
                    ┌────────┴┐ ┌─────┴┐ ┌───┴──┐ ┌───┴───┐
                    │  auth   │ │campus│ │subject│ │content│
                    │service  │ │service│ │service│ │service│
                    └─────────┘ └──────┘ └───┬───┘ └───┬───┘
                                              │ HTTP     │ HTTP
                                              └────┬─────┘
                                                   │ campus-service
                                                   │ (get grades/classrooms)

Frontend (Next.js :3000)
  Teacher:  /teacher/subjects, /teacher/subjects/[id]/content, /teacher/assignments
  Student:  /student/subjects, /student/subjects/[id], /student/assignments
```

---

## 4. Subject Service — Detailed Design

### 4.1 File Structure

```
SMS/microservices/subject-service/
├── Dockerfile                          # Same pattern as campus-service
├── manage.py
├── requirements.txt                    # DRF, simplejwt, ams-shared
├── subject_service/
│   ├── __init__.py
│   ├── settings.py                     # SMS pattern — DRF, ams-shared, multi-tenancy
│   ├── urls.py
│   └── wsgi.py
├── subjects/                           # Core app
│   ├── __init__.py
│   ├── admin.py
│   ├── apps.py
│   ├── models.py                       # Subject, SubjectTeacherAssignment
│   ├── serializers.py
│   ├── views.py                        # DRF ViewSets (NOT Django Ninja)
│   ├── urls.py
│   └── migrations/
├── assignments/                        # Separate app for assignments
│   ├── __init__.py
│   ├── admin.py
│   ├── apps.py
│   ├── models.py                       # Assignment, Submission
│   ├── serializers.py
│   ├── views.py
│   ├── urls.py
│   └── migrations/
└── users/                              # Multi-tenancy boilerplate (copy from campus-service)
    ├── __init__.py
    ├── models.py                       # Organization (mirror)
    ├── managers.py                     # OrganizationManager (copy from campus-service)
    └── middleware.py                   # OrganizationMiddleware (copy from campus-service)
```

### 4.2 Models

#### `subjects/models.py`

```python
# Subject — school subject (Math, Science, Urdu, etc.)
class Subject(models.Model):
    objects = OrganizationManager()
    all_objects = models.Manager()

    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE,
                                      null=True, blank=True, related_name='subjects')
    name = models.CharField(max_length=255)           # "Mathematics"
    subject_code = models.CharField(max_length=20, blank=True, null=True)  # "MATH-7"
    description = models.TextField(blank=True, null=True)
    
    # School hierarchy — FK IDs only (no cross-service DB joins)
    grade_id = models.IntegerField(null=True, blank=True)       # from campus-service
    grade_name = models.CharField(max_length=100, blank=True, null=True)  # denormalized
    campus_id = models.IntegerField(null=True, blank=True)      # from campus-service
    
    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['organization', 'name', 'grade_id']

# SubjectTeacherAssignment — which teacher teaches which subject in which classroom
class SubjectTeacherAssignment(models.Model):
    objects = OrganizationManager()

    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE,
                                      null=True, blank=True)
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='teacher_assignments')
    
    # Teacher (from staff-service — store ID + name, no cross-DB FK)
    teacher_id = models.IntegerField()
    teacher_name = models.CharField(max_length=255, blank=True, null=True)
    
    # Classroom details (from campus-service — store ID + label)
    classroom_id = models.IntegerField(null=True, blank=True)
    classroom_code = models.CharField(max_length=30, blank=True, null=True)  # e.g. "C01-L1-M-G7-A-M"
    
    academic_year = models.CharField(max_length=10, default='2025-26')
    is_active = models.BooleanField(default=True)
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['subject', 'teacher_id', 'classroom_id', 'academic_year']
```

#### `assignments/models.py`

```python
# Assignment — teacher creates for a subject + classroom
class Assignment(models.Model):
    objects = OrganizationManager()
    all_objects = models.Manager()

    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE,
                                      null=True, blank=True, related_name='assignments')
    subject = models.ForeignKey('subjects.Subject', on_delete=models.CASCADE, related_name='assignments')
    
    # Classroom scope (optional — if None, applies to all classrooms of subject)
    classroom_id = models.IntegerField(null=True, blank=True)
    classroom_code = models.CharField(max_length=30, blank=True, null=True)
    
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    instructions = models.TextField(blank=True, null=True)
    assignment_type = models.CharField(max_length=50, default='Individual')
    total_marks = models.IntegerField(default=100)
    due_date = models.DateTimeField(null=True, blank=True)
    is_published = models.BooleanField(default=True)
    attachment = models.FileField(upload_to='assignments/', null=True, blank=True)
    
    # Creator (from JWT token — no DB lookup needed)
    created_by_id = models.IntegerField(null=True, blank=True)
    created_by_name = models.CharField(max_length=255, blank=True, null=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


# Submission — student submits assignment
class Submission(models.Model):
    STATUS_CHOICES = [
        ('SUBMITTED', 'Submitted'),
        ('GRADED', 'Graded'),
        ('LATE', 'Late'),
        ('RETURNED', 'Returned'),
    ]

    objects = OrganizationManager()

    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE,
                                      null=True, blank=True, related_name='submissions')
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    
    # Student (from JWT token)
    student_id = models.IntegerField()
    student_name = models.CharField(max_length=255, blank=True, null=True)
    
    submitted_file = models.FileField(upload_to='submissions/', null=True, blank=True)
    submission_text = models.TextField(blank=True, null=True)
    grade = models.IntegerField(null=True, blank=True)          # marks obtained
    feedback = models.TextField(blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='SUBMITTED')
    submitted_at = models.DateTimeField(auto_now_add=True)
    
    graded_by_id = models.IntegerField(null=True, blank=True)
    graded_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ['assignment', 'student_id']
```

### 4.3 API Endpoints

```
# Subject Management
GET    /api/subjects/                         → list (filtered by org, grade_id)
POST   /api/subjects/                         → create (principal/admin/coordinator)
GET    /api/subjects/{id}/                    → detail
PATCH  /api/subjects/{id}/                    → update
DELETE /api/subjects/{id}/                    → soft delete

# Teacher Assignments
GET    /api/subjects/teacher-assignments/     → list (filter by teacher_id from JWT)
POST   /api/subjects/teacher-assignments/     → assign teacher to subject+classroom
DELETE /api/subjects/teacher-assignments/{id}/→ unassign

# Assignments
GET    /api/assignments/                      → list (teacher sees own, student sees classroom's)
POST   /api/assignments/                      → create (teacher only)
GET    /api/assignments/{id}/                 → detail
PATCH  /api/assignments/{id}/                 → update (teacher/admin)
DELETE /api/assignments/{id}/                 → delete

# Submissions
GET    /api/assignments/{id}/submissions/     → list (teacher sees all, student sees own)
POST   /api/assignments/{id}/submissions/     → student submits
PATCH  /api/assignments/{id}/submissions/{sid}/ → teacher grades
```

---

## 5. Content Service — Detailed Design

### 5.1 File Structure

```
SMS/microservices/content-service/
├── Dockerfile
├── manage.py
├── requirements.txt
├── content_service/
│   ├── __init__.py
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── content/                            # Main app
│   ├── __init__.py
│   ├── admin.py
│   ├── apps.py
│   ├── models.py                       # Module, Lesson, ContentItem, StudentContentProgress
│   ├── serializers.py
│   ├── views.py                        # DRF ViewSets
│   ├── urls.py
│   └── migrations/
└── users/                              # Multi-tenancy boilerplate
    ├── models.py
    ├── managers.py
    └── middleware.py
```

### 5.2 Models

#### `content/models.py`

```python
# Module — Chapter/Unit of a Subject (was: course_id → now: subject_id)
class Module(models.Model):
    objects = OrganizationManager()
    all_objects = models.Manager()

    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE,
                                      null=True, blank=True, related_name='modules')
    subject_id = models.IntegerField()                # FK to subject-service (ID only)
    subject_name = models.CharField(max_length=255, blank=True, null=True)  # denormalized
    title = models.CharField(max_length=255)          # "Chapter 1: Algebra"
    description = models.TextField(blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']


# Lesson — Individual topic within a Module
class Lesson(models.Model):
    objects = OrganizationManager()

    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE,
                                      null=True, blank=True, related_name='lessons')
    module = models.ForeignKey(Module, on_delete=models.CASCADE, related_name='lessons')
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    duration_minutes = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']


# ContentItem — Actual file/link inside a Lesson
class ContentItem(models.Model):
    CONTENT_TYPE_CHOICES = [
        ('VIDEO', 'Video'),
        ('DOCUMENT', 'Document'),
        ('PRESENTATION', 'Presentation'),
        ('LINK', 'External Link'),
        ('IMAGE', 'Image'),
        ('QUIZ', 'Quiz Link'),
    ]

    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE,
                                      null=True, blank=True, related_name='content_items')
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='contents')
    title = models.CharField(max_length=255)
    content_type = models.CharField(max_length=20, choices=CONTENT_TYPE_CHOICES, default='DOCUMENT')
    file = models.FileField(upload_to='content/', blank=True, null=True)
    url = models.URLField(blank=True, null=True)
    is_preview = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']


# StudentContentProgress — which student completed which lesson
class StudentContentProgress(models.Model):
    objects = OrganizationManager()

    organization = models.ForeignKey('users.Organization', on_delete=models.CASCADE,
                                      null=True, blank=True)
    student_id = models.IntegerField()
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name='progress_records')
    is_completed = models.BooleanField(default=False)
    last_accessed = models.DateTimeField(auto_now=True)
    completion_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('student_id', 'lesson')
```

### 5.3 API Endpoints

```
# Curriculum (read — for students)
GET  /api/content/subjects/{subject_id}/curriculum/  → full Module→Lesson→ContentItem tree
                                                        (includes completion status if student)

# Modules (teacher/admin manage)
GET    /api/content/modules/?subject_id=X             → list modules for a subject
POST   /api/content/modules/                          → create module
PATCH  /api/content/modules/{id}/                     → update
DELETE /api/content/modules/{id}/                     → delete

# Lessons
GET    /api/content/lessons/?module_id=X              → list lessons
POST   /api/content/lessons/                          → create lesson
PATCH  /api/content/lessons/{id}/                     → update
DELETE /api/content/lessons/{id}/                     → delete

# Content Items (file upload)
GET    /api/content/items/?lesson_id=X                → list items
POST   /api/content/items/                            → upload (multipart/form-data)
PATCH  /api/content/items/{id}/                       → update
DELETE /api/content/items/{id}/                       → delete

# Progress (student)
POST   /api/content/progress/                         → mark lesson complete
GET    /api/content/progress/?subject_id=X            → get my progress for a subject
```

---

## 6. Frontend Additions

### 6.1 Teacher Portal Pages

```
frontend/src/app/teacher/
├── subjects/
│   ├── page.tsx              # List of my assigned subjects
│   └── [id]/
│       ├── page.tsx          # Subject overview (classes, stats)
│       └── content/
│           └── page.tsx      # Module/Lesson/ContentItem manager
│                             # (adapted from Lms_fe/teacher/courses/[courseId]/content)
├── assignments/
│   ├── page.tsx              # All my assignments (filter by subject/class)
│   ├── create/
│   │   └── page.tsx          # Create assignment form
│   │                         # (adapted from Lms_fe/teacher/assignments/create)
│   └── [id]/
│       └── page.tsx          # View submissions + grade
│                             # (adapted from Lms_fe/teacher/assignments/[id])
└── students/
    └── page.tsx              # My classroom students (already planned)
```

### 6.2 Student Portal Pages (Expand existing)

```
frontend/src/app/student/
├── subjects/
│   ├── page.tsx              # My subjects list (assigned via classroom)
│   └── [id]/
│       ├── page.tsx          # Subject overview + progress ring
│       └── content/
│           └── page.tsx      # Module tree → click lesson → view content
│                             # (adapted from Lms_fe/student/courses/[id])
├── assignments/
│   ├── page.tsx              # All my assignments (pending/submitted/graded)
│   └── [id]/
│       └── page.tsx          # Assignment detail + submission form
│                             # (adapted from Lms_fe/student/assignments/[id])
```

### 6.3 Admin/Coordinator Pages (Expand existing)

```
frontend/src/app/admin/
└── subjects/
    ├── page.tsx                  # Subjects list (by campus/grade)
    ├── add/page.tsx              # Add subject
    └── teacher-assign/page.tsx  # Assign teacher to subject+classroom

frontend/src/app/coordinator (inside existing coordinator section)
└── subjects/
    └── page.tsx                  # View subjects for their level/campus
```

---

## 7. Infrastructure Changes

### 7.1 docker-compose.yml Additions

```yaml
# Add to postgres services:
postgres-subject:
  image: postgres:15-alpine
  container_name: ams_db_subject
  environment:
    POSTGRES_DB: subject_db
    POSTGRES_USER: subject_user
    POSTGRES_PASSWORD: ${SUBJECT_DB_PASS:-subject_pass}
  volumes:
    - postgres_subject:/var/lib/postgresql/data

postgres-content:
  image: postgres:15-alpine
  container_name: ams_db_content
  environment:
    POSTGRES_DB: content_db
    POSTGRES_USER: content_user
    POSTGRES_PASSWORD: ${CONTENT_DB_PASS:-content_pass}
  volumes:
    - postgres_content:/var/lib/postgresql/data

# Add to microservices:
subject-service:
  build:
    context: .
    dockerfile: microservices/subject-service/Dockerfile
  container_name: ams_subject
  ports:
    - "8012:8012"
  environment:
    <<: *common-env
    SECRET_KEY: ${AUTH_SECRET_KEY:-auth-secret-change-me}
    DB_HOST: postgres-subject
    DB_NAME: subject_db
    DB_USER: subject_user
    DB_PASSWORD: ${SUBJECT_DB_PASS:-subject_pass}
    REDIS_URL: redis://redis:6379/12
    CAMPUS_SERVICE_URL: http://campus-service:8003
    STUDENT_SERVICE_URL: http://student-service:8005
    STAFF_SERVICE_URL: http://staff-service:8004

content-service:
  build:
    context: .
    dockerfile: microservices/content-service/Dockerfile
  container_name: ams_content
  ports:
    - "8013:8013"
  environment:
    <<: *common-env
    SECRET_KEY: ${AUTH_SECRET_KEY:-auth-secret-change-me}
    DB_HOST: postgres-content
    DB_NAME: content_db
    DB_USER: content_user
    DB_PASSWORD: ${CONTENT_DB_PASS:-content_pass}
    REDIS_URL: redis://redis:6379/13
    SUBJECT_SERVICE_URL: http://subject-service:8012

# Add to volumes:
  postgres_subject:
  postgres_content:
```

### 7.2 Nginx Gateway Additions

```nginx
# Add inside the nginx.conf upstream + location blocks:

upstream subject_service { server subject-service:8012; }
upstream content_service { server content-service:8013; }

location /api/subjects/ {
    proxy_pass http://subject_service;
    include /etc/nginx/proxy_params;
}
location /api/assignments/ {
    proxy_pass http://subject_service;
    include /etc/nginx/proxy_params;
}
location /api/content/ {
    proxy_pass http://content_service;
    include /etc/nginx/proxy_params;
}
```

---

## 8. What to TAKE from LMS and What to DROP

### From `lms-microservices/services/content-service/`
| File | Action | Notes |
|---|---|---|
| `content/models.py` | **Adapt** | Add `organization` FK, rename `course_id`→`subject_id`, use `OrganizationManager` |
| `content/router.py` | **Rewrite** | Switch from Django Ninja Router → DRF ViewSets |
| `content/schemas.py` | **Rewrite** | Ninja Schema → DRF Serializers |
| `content/admin.py` | **Copy + minor tweaks** | Register models in Django admin |
| `content_service/settings.py` | **Rewrite** | Use SMS settings template |
| `requirements.txt` | **Replace** | Use SMS requirements template (DRF, ams-shared etc.) |

### From `lms-microservices/services/course-service/courses/`
| Model/File | Action | Notes |
|---|---|---|
| `Course` model | **Adapt → Subject** | Drop Specialization FK, add grade_id/campus_id, add org FK + OrganizationManager |
| `Assignment` model | **Adapt** | Drop course-specific fields, add org FK, add classroom_id |
| `Submission` model | **Adapt** | Add org FK |
| `ScheduledClass` | **DROP** | Timetable-service already handles this |
| `Room` | **DROP** | Campus-service already handles this |
| `Branch` | **DROP** | Campus-service already handles this |
| `Specialization` | **DROP** | Grade/Level in campus-service replaces this |
| `StudentDeposit` | **DROP** | Fees-service handles this |
| `FeeStructure` | **DROP** | Fees-service handles this |
| `StudentFeeRecord` | **DROP** | Fees-service handles this |
| `FeePaymentTransaction` | **DROP** | Fees-service handles this |
| `CourseRating` | **DROP** | Not needed for school |
| `AdminActionLog` | **DROP** | Separate concern |
| `ContentCompletion` | **DROP** | Content-service handles progress |
| `router.py` (Ninja) | **Rewrite → DRF** | All endpoints rewritten as DRF ViewSets |
| `schemas.py` (Ninja) | **Rewrite → DRF** | Ninja Schema → DRF Serializer |

### From `Lms_fe/` (Frontend)
| LMS Page | Target SMS Page | Adaptation Needed |
|---|---|---|
| `teacher/courses/[courseId]/content/page.tsx` | `teacher/subjects/[id]/content/page.tsx` | `courseId→subjectId`, `course_id→subject_id` in API calls, SMS API base URL |
| `teacher/assignments/create/page.tsx` | `teacher/assignments/create/page.tsx` | Subject selector (not course), classroom selector added, SMS auth token |
| `teacher/assignments/[id]/page.tsx` | `teacher/assignments/[id]/page.tsx` | Subject reference, SMS auth |
| `student/courses/[id]/page.tsx` | `student/subjects/[id]/page.tsx` | Subject context, SMS auth, SMS theme |
| `student/assignments/page.tsx` | `student/assignments/page.tsx` | Subject reference, SMS auth |
| `student/assignments/[id]/page.tsx` | `student/assignments/[id]/page.tsx` | Submission form, SMS auth |

---

## 9. Step-by-Step Implementation Order

### Phase 1 — Backend: Subject Service
```
Step 1.1  Create folder structure: SMS/microservices/subject-service/
Step 1.2  Copy users/ (OrganizationManager, middleware) from campus-service
Step 1.3  Write subjects/models.py   (Subject, SubjectTeacherAssignment)
Step 1.4  Write assignments/models.py (Assignment, Submission)
Step 1.5  Write serializers.py for both apps
Step 1.6  Write views.py (DRF ModelViewSet + custom actions)
Step 1.7  Write urls.py and subject_service/urls.py
Step 1.8  Write subject_service/settings.py  (SMS template)
Step 1.9  Write Dockerfile (copy campus-service Dockerfile pattern)
Step 1.10 Write requirements.txt
Step 1.11 Run migrations locally, test with curl
```

### Phase 2 — Backend: Content Service
```
Step 2.1  Create folder structure: SMS/microservices/content-service/
Step 2.2  Copy users/ from campus-service
Step 2.3  Adapt content/models.py from LMS (add org FK, rename subject_id)
Step 2.4  Write DRF serializers.py (replace Ninja schemas)
Step 2.5  Write DRF views.py (replace Ninja router)
Step 2.6  Write urls.py
Step 2.7  Write content_service/settings.py
Step 2.8  Write Dockerfile + requirements.txt
Step 2.9  Run migrations locally, test with curl
```

### Phase 3 — Infrastructure
```
Step 3.1  Add postgres-subject, postgres-content to docker-compose.yml
Step 3.2  Add subject-service, content-service to docker-compose.yml
Step 3.3  Add nginx routes for /api/subjects/, /api/assignments/, /api/content/
Step 3.4  Add env vars to SMS/.env
Step 3.5  docker compose up --build — verify all services healthy
```

### Phase 4 — Frontend: Teacher Portal
```
Step 4.1  Create /teacher/subjects/page.tsx
           → GET /api/subjects/?teacher_id=me (from JWT)
Step 4.2  Create /teacher/subjects/[id]/page.tsx
           → GET /api/subjects/{id}/ + assignment count
Step 4.3  Create /teacher/subjects/[id]/content/page.tsx
           → Adapted from Lms_fe/teacher/courses/[courseId]/content/page.tsx
           → Module accordion + Lesson list + ContentItem upload
Step 4.4  Create /teacher/assignments/page.tsx
           → List assignments grouped by subject
Step 4.5  Create /teacher/assignments/create/page.tsx
           → Subject dropdown + classroom dropdown + form fields
Step 4.6  Create /teacher/assignments/[id]/page.tsx
           → Submission list + grade form (adapted from LMS)
```

### Phase 5 — Frontend: Student Portal
```
Step 5.1  Create /student/subjects/page.tsx
           → GET /api/subjects/?classroom_id=student.classroom_id
Step 5.2  Create /student/subjects/[id]/page.tsx
           → Subject info + progress bar
Step 5.3  Create /student/subjects/[id]/content/page.tsx
           → GET /api/content/subjects/{id}/curriculum/ (with progress)
           → Expandable module → lesson → content item viewer
Step 5.4  Create /student/assignments/page.tsx
           → Pending / submitted / graded tabs
Step 5.5  Create /student/assignments/[id]/page.tsx
           → View assignment + submission form (file + text)
```

### Phase 6 — Frontend: Admin/Coordinator
```
Step 6.1  Admin: /admin/subjects/page.tsx  (create/list subjects by grade)
Step 6.2  Admin: /admin/subjects/teacher-assign/page.tsx
           → Select subject + teacher + classroom → POST teacher assignment
Step 6.3  Coordinator: /coordinator/subjects/page.tsx  (view only, their level)
```

---

## 10. Key Design Decisions & Rules

### 10.1 No Cross-Service DB Joins
- subject-service stores `teacher_id` (int) + `teacher_name` (varchar) — NO FK to staff-service DB
- subject-service stores `grade_id` (int) + `grade_name` (varchar) — NO FK to campus-service DB
- content-service stores `subject_id` (int) + `subject_name` (varchar) — NO FK to subject-service DB
- If you need fresh data from another service → HTTP call via `requests` or return the ID and let frontend fetch

### 10.2 Authentication (SMS Pattern)
```python
# In views.py — always use SMS auth, not LMS JWTAuth
from ams_shared.jwt.validator import ServiceJWTAuthentication

class SubjectViewSet(viewsets.ModelViewSet):
    authentication_classes = [ServiceJWTAuthentication]
    permission_classes = [IsAuthenticated]
```

### 10.3 Multi-Tenancy (SMS Pattern)
```python
# Always filter by organization from JWT
def get_queryset(self):
    return Subject.objects.all()  # OrganizationManager auto-filters by org_id from JWT

# Always set organization on create
def perform_create(self, serializer):
    org_id = getattr(self.request.user, 'org_id', None)
    org = Organization.all_objects.filter(pk=org_id).first()
    serializer.save(organization=org)
```

### 10.4 File Upload (Media Storage)
- Same as LMS: `MEDIA_ROOT` pointing to volume-mounted directory
- In production: consider MinIO (already in SMS docker-compose at port 9200)
- `ContentItem.file` and `Submission.submitted_file` use `FileField(upload_to=...)`

### 10.5 Role-Based Access
| Role | Subject | Content | Assignments | Submissions |
|---|---|---|---|---|
| superadmin | Full CRUD | Full CRUD | Full CRUD | Full CRUD |
| admin | Create + Read for their org | Full CRUD | Read | Read |
| principal | Read for their campus | Read | Read | Read |
| coordinator | Read for their level | Read | Read | Read |
| teacher | Read assigned subjects | Create/Update/Delete own | Create/Update own | Read + Grade |
| student | Read their subjects | Read published only | Read + Submit | Read own |

---

## 11. LMS Code That Can Be Reused (Reference Only)

These LMS files contain logic useful as reference — but must be rewritten for SMS patterns:

```
AIT-LMS/Lms_fe/app/(dashboard)/teacher/courses/[courseId]/content/page.tsx
  → Content upload UI with module/lesson tree — adapt for subjects

AIT-LMS/Lms_fe/app/(dashboard)/student/courses/[id]/page.tsx
  → Student curriculum view with progress — adapt for subjects

AIT-LMS/Lms_fe/app/(dashboard)/teacher/assignments/create/page.tsx
  → Assignment creation form — adapt field names

AIT-LMS/Lms_fe/app/(dashboard)/student/assignments/[id]/page.tsx
  → Submission form — reuse logic, change API base URL
```

---

## 12. Environment Variables to Add to SMS/.env

```bash
# Subject Service
SUBJECT_DB_PASS=subject_pass

# Content Service
CONTENT_DB_PASS=content_pass
```

---

## 13. Summary

| | LMS Source | SMS Target | Change |
|---|---|---|---|
| Framework (API) | Django Ninja | **DRF (ViewSets)** | Rewrite all routers/schemas |
| Auth | Custom JWTAuth (inline) | **ams_shared ServiceJWTAuthentication** | Replace |
| Multi-tenancy | None | **OrganizationManager + Middleware** | Add to every model |
| Course → | Course (Specialization-based) | **Subject (Grade/ClassRoom-based)** | Model redesign |
| ScheduledClass → | Complex scheduling | **Dropped** (timetable-service) | Remove |
| Fee models → | Inside course-service | **Dropped** (fees-service exists) | Remove |
| Content hierarchy | Module→Lesson→ContentItem | **Same**, course_id→subject_id | Minimal change |
| Frontend | LMS Lms_fe (standalone) | **SMS frontend** integrated | API URLs + auth token |
