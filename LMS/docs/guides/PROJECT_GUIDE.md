# AIT LMS Project Guide: A to Z Structure & Navigation 🚀

Welcome to the **AIT LMS Master Guide**. This document serves as a developer's map to the entire ecosystem, explaining where every piece of logic resides and how to modify it.

---

## 🏗️ 1. Architecture Overview

The system is built using a **Microservices Architecture**:
*   **Frontend**: Next.js (located in `Lms_fe/` and `ait_fe/`)
*   **Backend**: Multiple Python/Django services (located in `lms-microservices/services/`)
*   **API Gateway**: A FastAPI-based entry point that routes all requests to the correct service.
*   **Communication**: Services talk via REST APIs and use **RabbitMQ** for asynchronous tasks (like sending emails).
*   **Storage**: Each service has its own **PostgreSQL** database. **Redis** is used for caching and session management.

---

## 📂 2. Backend Services Map (`lms-microservices/services/`)

Each folder inside `services/` is a semi-independent application. Here is what they do:

### 🔐 Auth Service (`/auth-service`)
*   **Purpose**: Manages Users, Roles, Logins, and Admission Receipt Codes.
*   **Primary Files**:
    *   `users/models.py`: Defines `User`, `Profile`, and `ReceiptCode` database structures.
    *   `users/router.py`: Handles API logic for signup, login, and managing receipt codes.
    *   `users/schemas.py`: Rules for what data the API expects (e.g., email format).

### 🎓 Course Service (`/course-service`)
*   **Purpose**: The "Heart" of the LMS. Handles Curricula, Classes, Attendance, and Deposits.
*   **Primary Files**:
    *   `courses/models.py`: Defines `Course`, `Specialization`, `ScheduledClass`, `StudentDeposit`, and `Attendance`.
    *   `courses/router.py`: API logic for creating courses, enrolling students, and processing financial deposits.
    *   `courses/services.py`: Complex business logic (like automatic status updates).

### 📝 Admission Service (`/admission-service`)
*   **Purpose**: Handles Lead Generation (Applicants) and Entrance Exams.
*   **Primary Files**:
    *   `tests/models.py`: Defines `EntranceLead` (Lead details) and `TestAttempt`.
    *   `tests/views.py`: API logic for lead management and archiving.

### 📧 Notification Service (`/notification-service`)
*   **Purpose**: Sends Emails and SMS alerts.
*   **Primary Files**:
    *   `notifications/services.py`: Logic for formatting and sending messages.
    *   `start.py`: The RabbitMQ consumer that listens for "send email" signals from other services.

### 📁 Content & Certification Services
*   **Content**: `content/models.py` (Videos, PDFs, Assignments files).
*   **Certification**: `certificates/models.py` (LMS IDs and dynamic Certificate generation).

---

## 🎨 3. Frontend Dashboard Map (`Lms_fe/`)

The frontend is divided into roles. Look inside `app/(dashboard)/` for these folders:

*   **Admin (`/admin`)**: Full authority dashboard.
    *   `users/page.tsx`: Manage all users (Active/Archived).
    *   `courses/page.tsx`: Manage curriculum and specs.
    *   `deposits/page.tsx`: Financial transaction registry.
    *   `receipt-codes/page.tsx`: Validate and edit admission tokens.
*   **Coordinator (`/coordinator`)**: Staff management and operational tools.
*   **Teacher (`/teacher`)**: Attendance, Assignment grading, and Course content.
*   **Student (`/student`)**: My Courses, ID Card, Attendance, and Certificates.

### 🔌 API Integration (`Lms_fe/lib/api.ts`)
This is the **most important file** for frontend changes. It contains all the functions that fetch data from the backend microservices. If you change a backend URL, you update it here.

---

## 🛠️ 4. Common Modification Scenarios

### "I want to add a new field to a student's profile"
1.  **Backend**: Open `auth-service/users/models.py` and add the field to the `Profile` model.
2.  **Migration**: Run `makemigrations` and `migrate` inside the auth-service container.
3.  **Frontend**: Update the `User` interface in `Lms_fe/lib/api.ts` to include the new field.

### "I want to change the look of the Admin Users page"
1.  Go to `Lms_fe/app/(dashboard)/admin/users/page.tsx`.
2.  Modify the Tailwind CSS classes or the layout structure.

### "I want to add a new status to leads (e.g., 'Contact Later')"
1.  **Backend**: Find the `STATUS_CHOICES` in `admission-service/tests/models.py`.
2.  **Frontend**: Update the UI status badges in `Lms_fe/app/(dashboard)/admin/leads/page.tsx` (if applicable).

---

## 🌐 5. Deployment & Environment

*   **Global Config**: `.env` file at the root controls the URLs and Secret Keys.
*   **Orchestration**: `docker-compose.yml` (root) brings up the databases and shared infra.
*   **Service Stack**: `lms-microservices/docker-compose.yml` brings up all 7 backend services.

---

> [!TIP]
> **Pro Tip**: Always check the **Audit Logs** (`AdminActionLog` model) in each service to see which admin made what change. This is global for Users, Courses, Deposits, and Leads.
