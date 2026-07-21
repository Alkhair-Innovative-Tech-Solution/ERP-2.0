# AIT LMS - Project Documentation & Architecture Report

This document provides a comprehensive overview of the **AIT Learning Management System (LMS)**. It is designed to help developers understand the system architecture, service communication, and the implementation details of key features.

---

## 1. System Architecture
The project follows a **Microservices Architecture** with a decoupled **Next.js Frontend**.

- **Frontend**: Next.js 14+ (App Router)
- **Backend**: Django (Ninja API Framework)
- **Database**: PostgreSQL (Dockerized)
- **Communication**: REST API (Service-to-Service and Client-to-Service)
- **Authentication**: JWT (JSON Web Tokens)

---

## 2. Backend Services (`lms-microservices`)

### A. Auth Service (`auth-service`)
Responsible for user identity, roles, and security.
- **Port**: `8001`
- **Key Models**:
    - `User`: Custom user model with roles (`STUDENT`, `TEACHER`, `COORDINATOR`, `ADMIN`).
    - `Student`: Extended profile for students (Gender, WhatsApp, Study status).
- **Key Features**:
    - **JWT Auth**: Login, Token refresh, and Logout.
    - **OTP System**: Email-based OTP for registration and password recovery.
    - **Forced Password Reset**: A flag `must_change_password` that redirects users to a reset page on their first login.

### B. Course Service (`course-service`)
Responsible for academic management and course data.
- **Port**: `8002`
- **Key Models**:
    - `Specialization`: Departments (e.g., AI, Web Dev).
    - `Course`: Individual subjects with levels.
    - `ScheduledClass`: Specific sections with timing and instructors.
- **Key Features**:
    - **Google Sheets Sync**: Management commands to import courses and sessions.
    - **Instructor Sync**: Cross-service mapping that links courses to auth users.

### C. Content Service (`content-service`)
Handles academic content delivery with a structured hierarchy.
- **Port**: `8003`
- **Architecture**: **Module -> Lesson -> ContentItem**
- **Key Models**:
    - `Module`: Chapters/Sections of a course.
    - `Lesson`: Individual learning units within a module.
    - `ContentItem`: Actual assets (Videos, PDFs, Links) attached to a lesson.
    - `UserContentProgress`: Tracks student completion status per lesson.
- **Key Features**:
    - **Curriculum API**: Fetches a nested structure of the entire course.
    - **Progress Tracking**: Real-time tracking of student learning progress.
    - **Access Control**: Built-in support for "Preview" content and enrolled-only access.
    - **Validation**: 100% Pydantic Schema-based validation for all endpoints.

---

## 3. Detailed Frontend Structure & Pages (`Lms_fe`)

Built with **Next.js**, **TypeScript**, and **Tailwind CSS**.

### Core Structure & Pages:
- `app/`: Next.js App Router.
    - `(auth)/`: Authentication Flow (Login, Register, Reset).
    - `(dashboard)/`: Protected Pages (Role-based).
        - `admin/`: Management and Generators.
        - `teacher/`: My Classes, Attendance, Assignments.
        - `student/`: My Dashboard, Courses, ID Card.
- `components/premium/`: Premium UI components (Sidebar, Navbar, Cards).

---

## 4. Detailed Backend Folder Structure (`lms-microservices`)

### A. Auth Service (`services/auth-service`)
- `users/models.py`: Database tables for `User` and `Student`.
- `users/router.py`: API endpoints for identity.

### B. Course Service (`services/course-service`)
- `courses/models.py`: Academic structures.
- `courses/management/`: Sync scripts for Google Sheets.

### C. Content Service (`services/content-service`)
- `content/models.py`: Module/Lesson hierarchy.
- `content/router.py`: Curriculum delivery and progress tracking.

---

## 5. Key Workflows for Developers

### Data Import & Sync
1. **Import Courses**: `docker exec course-service python manage.py import_courses`
2. **Repair Instructor IDs**: `docker exec course-service python repair_instructors.py`

### Authentication Flow
1. User logs in -> Receives tokens.
2. If `must_change_password` is `True`, redirect to reset page.

---

## 6. Deployment & Configuration
- **Start Services**: `docker-compose up -d --build`
- **Migrations**: `docker exec <service_name> python manage.py migrate`

---

## 7. Developer Best Practices
- **Service Isolation**: Always use defined APIs for communication.
- **Schema Validation**: Use Django Ninja's `Schema` for all validations.
- **UI Consistency**: Use `components/premium` for all dashboard pages.

---

## 8. Project Statistics & Page Summary

The AIT LMS is a large-scale application comprising over **59 unique pages/routes**.

### Page Count by Role:
| Role / Category | Page Count | Key Features |
| :--- | :---: | :--- |
| **Admin Portal** | 19 | Control Panel, User/Course Management, Generators. |
| **Teacher Portal** | 15 | My Classes, Attendance, Assignment Management. |
| **Student Portal** | 8 | My Courses, Dashboard, ID Card, Attendance. |
| **Coordinator Portal** | 6 | Teacher Scheduling, Deposits, Transfers. |
| **Auth & System** | 11 | Login, Register, OTP, Password Recovery. |
| **Total** | **59** | |

### Architectural Health:
- **Microservices Isolation**: 100%
- **Frontend Strategy**: Next.js 14 App Router.
- **Content Hierarchy**: Module -> Lesson -> ContentItem (Refactored).

---
*Documentation Version: 1.3.0*
*Last Updated: 2026-04-26*
