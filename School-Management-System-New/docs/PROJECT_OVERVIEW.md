# School Management System (SMS) — Project Overview

> A cloud-based, multi-tenant **Academic Management System (AMS/SMS)** that runs an
> entire school network — students, staff, attendance, fees, results and
> communication — from a single, secure platform.
>
> Built on a modern **microservices architecture** with an AI assistant and
> **face-recognition biometric attendance**. Currently live across multiple
> school campuses and designed to scale to hundreds.

---

## 1. What Is This Project?

The School Management System (SMS) is a complete **digital operating system for
schools**. It replaces the scattered registers, Excel sheets, manual attendance
machines and WhatsApp groups that most schools rely on, with one unified web
application.

A single deployment can serve **many organizations (schools)** at once — this is
a true **multi-tenant SaaS** product. Each school gets its own isolated data,
its own admins, campuses, staff and students, while the software house manages
one central platform for everyone.

From a student marking attendance on a face-recognition machine, to a teacher
entering exam marks, to a parent paying fees online, to the principal approving
results — every daily school activity flows through this one system in
**near real-time**.

**In one line:** *SMS digitizes and automates the complete academic and
administrative lifecycle of a school — admissions to attendance to exams to
fees to reporting.*

---

## 2. The Problem It Solves

Traditional schools struggle with:

- Manual, paper-based **attendance** that is slow and easy to fake.
- **Fees** tracked in registers — no clear record of who paid, who is pending.
- **Exam results** calculated by hand, with errors and no central history.
- No single view for management — data is spread across people and files.
- Poor **communication** between admin, teachers, students and parents.
- No **audit trail** — hard to know who changed what and when.

SMS solves all of this with a single source of truth, automation, role-based
access, and real-time reporting.

---

## 3. Key Features (Main Highlights)

| # | Feature | What It Does |
|---|---------|--------------|
| 1 | **Multi-Tenant SaaS** | One platform serves many schools; each school's data is fully isolated. |
| 2 | **Face-Recognition Attendance** | Integration with **FoxFace AI / ZKTeco** biometric machines — a face scan instantly marks attendance, no manual entry. |
| 3 | **Staff & Student Attendance** | Daily attendance with shift handling, late detection, and live sync to the dashboard. |
| 4 | **Fees Management** | Fee structures, invoices, online & manual payments, pending/paid tracking, and receipts. |
| 5 | **Exam Results & Report Cards** | Marks entry, automatic grade calculation, multi-level approval, and printable report cards. |
| 6 | **Timetable Management** | Class and shift timetables, period scheduling, and teacher allocation. |
| 7 | **Subjects & Assignments** | Subject setup, learning content, and teacher-issued assignments. |
| 8 | **AI Chat Assistant** | Built-in AI (Google Gemini) lets admins ask questions in plain language — *"how many students in campus A?"* — and get instant answers from live data. |
| 9 | **Role-Based Dashboards** | Every role logs into a tailored dashboard showing only what is relevant to them. |
| 10 | **Notifications System** | Real-time alerts and announcements across the school network. |
| 11 | **Requests & Complaints** | Built-in workflow for staff/student requests and complaint handling with approvals. |
| 12 | **Audit & Monitoring** | Full audit logs and a dedicated auditor role for transparency and compliance. |
| 13 | **Form Builder** | Admins can create custom forms/fields without developer help. |
| 14 | **Subscription & Billing** | Plans, billing and feature management for each school (SaaS monetization). |
| 15 | **Behaviour & Student Status** | Track student behaviour records, promotions, transfers and status changes. |

---

## 4. User Roles & How Each One Works

The system is built around **role-based access control (RBAC)**. Each user is
assigned a role, and the system shows them a custom dashboard with only the
features and data they are allowed to use. Permissions are configurable per
organization.

### 4.1 Super Admin (Platform Owner)
- The **highest authority** — this is the software house / platform operator.
- Creates and manages **organizations (schools)** on the platform.
- Manages **subscription plans, billing and system-wide versions**.
- Oversees every tenant from a central control panel.

### 4.2 Organization Admin (School Admin)
- The **owner/head of a single school** on the platform.
- Manages **campuses, classes, staff, teachers, principals, coordinators and students**.
- Configures **fee structures, subjects, timetables and permissions**.
- Has full control over their organization's data — but cannot see other schools.
- Access to **monitoring, billing, notifications and the form builder**.

### 4.3 Principal
- Head of a **campus**.
- **Approves exam results** before they are finalized.
- Manages **shift timings and timetable settings**.
- Handles **requests and approvals** at the campus level.

### 4.4 Teacher Coordinator (Coordinator)
- A senior teacher who supervises a group of teachers/classes.
- **Reviews attendance** and **approves results** at the first level.
- Manages **teacher and student lists**, timetables, and **requests/complaints**.
- Acts as the bridge between teachers and the principal.

### 4.5 Teacher
- Front-line staff who run the classroom.
- Mark **student attendance**, enter **exam marks**, and create **assignments**.
- Manage their **profile** and view their assigned classes/subjects.

### 4.6 Student
- The end learner.
- Views their **attendance, results, subjects and assignments**.
- **Pays fees online** and tracks payment history.
- Personal dashboard with all academic information.

### 4.7 Accounts Officer
- Finance-focused role.
- Handles **fees, payments and financial records** for the school.

### 4.8 Auditor
- Independent **oversight and compliance** role.
- Read-only access to **attendance, fees, results, staff, students, transfers and reports**.
- Reviews **issues** and verifies that records are accurate — ensures transparency.

### 4.9 Donor
- A **sponsor/donor** role for schools funded by donations.
- Can view relevant impact and reporting data for the students/programs they support.

> **Note:** Permissions are dynamic — the Organization Admin can switch features
> on or off per role, so the system adapts to each school's structure.

---

## 5. Benefits of the System

### For School Owners / Management
- **One platform for the entire school** — no more scattered tools.
- **Real-time visibility** into attendance, fees and results across all campuses.
- **Reduced manual work** and human error through automation.
- **Better revenue tracking** with clear fee and billing records.

### For Staff (Teachers, Coordinators, Principals)
- **Less paperwork** — attendance, marks and approvals are all digital.
- **Clear workflows** with multi-level approvals.
- **Instant access** to class, student and timetable data.

### For Students & Parents
- **Transparency** — attendance, results and fees available anytime.
- **Online fee payment** — convenient and trackable.
- **Faster communication** through notifications.

### For the Software House (You)
- **SaaS revenue model** — sell subscriptions to many schools from one codebase.
- **Scalable** — microservices let you grow to hundreds of schools.
- **Modern, sellable tech stack** that stands out in a portfolio.

---

## 6. Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Next.js 16, React 19 (modern, fast, responsive web app) |
| **Backend** | Python **Django** REST microservices (Daphne / ASGI) |
| **Architecture** | **Microservices** — independent, individually scalable services |
| **API Gateway** | Nginx + JWT verification, routing and rate limiting |
| **Databases** | **PostgreSQL** — a separate database per service (data isolation) |
| **Caching / Realtime** | **Redis** (cache + WebSocket channels) |
| **Message Bus** | **RabbitMQ** for async inter-service events |
| **File Storage** | **MinIO** (S3-compatible object storage) |
| **AI** | **Google Gemini** (function-calling chat assistant) |
| **Biometrics** | **FoxFace AI / FOXit** & ZKTeco face-recognition devices |
| **DevOps** | **Docker**, Docker Compose, designed for **Kubernetes** |

---

## 7. System Architecture (How It's Built)

The platform follows a **microservices architecture** — instead of one large
application, the system is split into many small, independent services. Each
service owns its own database and can be scaled, updated or restarted on its own
without bringing down the rest of the system.

```
   Browser / Mobile / Face-Recognition Device
                     │
            Nginx Ingress (SSL)
                     │
              API Gateway  ← JWT verify | routing | rate limit
                     │
   ┌────────┬────────┬────────┬────────┬────────┬────────┐
  Auth    Org     Campus   Staff   Student  Attendance  ...
  Service Service Service  Service Service   Service
   │        │        │        │        │         │
   └──────── RabbitMQ message bus (async events) ────────┘
                     │
   PostgreSQL (per-service DB) | Redis | MinIO (files)
```

### The Microservices
The platform is composed of focused services, each handling one domain:

| Service | Responsibility |
|---------|----------------|
| **Auth Service** | Login, users, roles, permissions, JWT tokens |
| **Org Service** | Organizations, subscriptions, billing, plans |
| **Campus Service** | Campuses and classes |
| **Staff Service** | Teachers, coordinators, principals |
| **Student Service** | Students, behaviour, status, transfers |
| **Attendance Service** | Attendance + biometric (FoxFace) sync |
| **Fees Service** | Fee structures, invoices, payments |
| **Result Service** | Exam marks, grades, report cards |
| **Subject Service** | Subjects and assignments |
| **Timetable Service** | Class and shift timetables |
| **Content Service** | Learning content |
| **Notification Service** | Real-time alerts and announcements |
| **Support Service** | Requests, complaints, issues |
| **AI Service** | Natural-language AI chat assistant |
| **Frontend Service** | Next.js web application |
| **Gateway** | Central API gateway / routing |

### Why Microservices?
- **Resilience:** if one service has an issue, the rest keep running.
- **Independent scaling:** scale only the busy service (e.g. attendance) instead
  of the whole app.
- **Faster, safer deployments:** update one service without restarting everything.
- **Clean data isolation:** each service has its own database.

---

## 8. Highlight: Face-Recognition Attendance

One of the standout features is **biometric face-recognition attendance**. The
system integrates with **FoxFace AI (FOXit)** and ZKTeco devices installed at the
school. When a staff member or student scans their face on the machine:

1. The device sends the event to the platform in real-time (HTTP push / MQTT).
2. The Attendance Service identifies the person and resolves their shift.
3. Attendance is marked automatically and appears on dashboards instantly.

This removes manual attendance entirely, prevents proxy/fake attendance, and
works across many schools as a managed SaaS fleet.

---

## 9. Highlight: Built-In AI Assistant

The platform includes an **AI Chat Assistant** powered by **Google Gemini** with
function-calling. Admins can simply type questions in plain language such as:

- *"How many students are enrolled in Campus A?"*
- *"Show me today's teacher attendance."*

The AI translates the question into a secure data query, fetches live results
from the system, and replies in natural language — making the platform feel
modern and effortless to use.

---

## 10. Project Summary (For Presentation)

> **School Management System (SMS)** is a multi-tenant SaaS platform that runs an
> entire school network from one place. Built on a scalable microservices
> architecture (Django + Next.js), it automates attendance (including
> **face-recognition biometrics**), fees, exams, timetables and communication.
> With **9 distinct user roles**, real-time dashboards, an **AI assistant**, and
> full audit logging, it gives schools a single, secure, modern digital platform —
> and gives the software house a scalable, recurring-revenue SaaS product.

**Tech at a glance:** Next.js · React · Django Microservices · PostgreSQL ·
Redis · RabbitMQ · MinIO · Docker/Kubernetes · Google Gemini AI · Biometric
Face Recognition.

---

*Document generated for portfolio / website presentation purposes.*
