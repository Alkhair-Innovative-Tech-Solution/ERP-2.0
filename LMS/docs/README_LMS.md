# AIT Learning Management System (LMS)

## Overview
The AIT LMS is a comprehensive platform designed to manage students, courses, and certifications. It is built using a modern microservices architecture to ensure scalability and maintainability.

## Technology Stack
- **Frontend**: Next.js / React with TailwindCSS.
- **Backend**: Django Microservices (REST Framework).
- **Authentication**: Custom JWT-based auth with PBKDF2 password hashing.
- **Image Processing**: `html2canvas` for dynamic Student ID card generation.
- **Deployment**: Docker Compose with Nginx reverse proxy.

## System Architecture

### 1. auth-service
Handles user registration, login, and profile management.
- **Key Models**: `User`, `Profile`.
- **Auth**: PBKDF2 hashing for database security.

### 2. course-service
Manages the educational content and student progress.
- **Key Models**: `Course`, `Assignment`, `Submission`, `Enrollment`.
- **Features**: Automatic enrollment ingestion via CSV/JSON mapping.

### 3. Lms_fe (Frontend)
The user-facing dashboard for students and admins.
- **Student Dashboard**: Real-time view of courses, assignments, and grades.
- **Student ID Card**: High-fidelity dynamic card generator with 1:1 visual match to reference designs.

## Key Features

### 🆔 High-Fidelity Student IDs
The system extracts exact canvas coordinates and assets from design templates to generate pixel-perfect student identity cards that can be downloaded by students directly from their dashboard.

### 🚀 Production Ready
The system is configured for deployment on `ait.iak.ngo` and `lms.iak.ngo` with secure HTTPS and proper CSRF handling across microservices.

### 📊 Automated Data Sync
Uses `enrollment_mapping.json` to handle complex course naming conventions during data imports, ensuring student records are always accurate.

## Setup & installation
1. Clone the repository: `git clone ...`
2. Configure `.env` files in each service directory.
3. Start the system: `docker-compose up -d --build`.
4. Access the frontend at `http://lms.iak.ngo` (or localhost).

---
*Maintained by the AIT Development Team.*
