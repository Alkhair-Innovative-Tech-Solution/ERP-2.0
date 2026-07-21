# Technical Architecture

## **Technical Stack Recommendation Document**

### **Help Desk Management System — Idara Al-Khair**

**Version:** 2.0  
 **Prepared by:** Mohammad Ubaid (Project Manager & Technical Lead)  
 **Date:** November 2025  
 **Last Updated:** December 2025 (Architecture Refinements)

---

## **1. Purpose of the Document**

This document provides detailed technical recommendations for building the **Help Desk Management System (HDMS)** for Idara Al-Khair.  
 It outlines the proposed technology stack, tools, and frameworks aligned with project goals, scalability requirements, real-time communication, and future integration potential.

The objective is to ensure **long-term maintainability**, **smooth scalability**, and **rapid MVP development** using reliable, modern, and compatible technologies.

---

## **2. System Overview**

The Help Desk Management System (HDMS) aims to digitize and centralize the internal request workflow of Idara Al-Khair across its departments.  
 It will allow employees to submit, track, and resolve departmental requests through an integrated, role-based web application featuring:

* Centralized **user authentication** integrated with the existing **School Management System (SMS)**.

* Role-based dashboard and analytics for **requestor**, **Moderator**, **Assignee**, and **Admin** roles.

* **Real-time chat and notifications** for each ticket and sub-ticket.

* **AI-based ticket classification and SLA tracking** (for future phases).

* Audit logs, workload visibility, and performance reports.

The solution will be built as a **modular full-stack web application** optimized for internal enterprise use.

---

## **3. Architectural Overview**

### **3.1 Architecture Type**

**Recommended Architecture:** Microservices Architecture with Docker

* **5 Independent Services:** Each service handles a specific domain and runs in its own Docker container.

* **API Gateway:** Nginx routes all requests to appropriate services.

* **Shared Infrastructure:** PostgreSQL (shared initially), Redis (cache/queue), Docker Compose (orchestration).

* **Service Communication:** REST APIs (synchronous), Redis pub/sub (asynchronous), Celery (background tasks).

* **Frontend:** Separate Next.js service that calls API Gateway (never individual services directly).

**Services:**
1. **User Service** (Port 8001) - Authentication, user management, SMS integration, user import
2. **Ticket Service** (Port 8002) - Tickets, sub-tickets, approvals, SLA
3. **Communication Service** (Port 8003, WebSocket 8004) - Chat, notifications, WebSocket
4. **File Service** (Port 8005) - File uploads, antivirus scanning, processing
5. **Frontend Service** (Port 3000) - Next.js web application

**Benefits:**
* Independent deployment and scaling of each service
* Clear service boundaries and responsibilities
* Technology flexibility per service
* Easier maintenance and testing
* Better fault isolation

For detailed microservices architecture, see [12-Microservices-Architecture.md](../12-Microservices-Architecture.md).

---

### **3.2 Core System Layers**

| Layer | Recommended Technology | Purpose |
| ----- | ----- | ----- |
| **Frontend** | Next.js 15 (TypeScript + Tailwind CSS) | Interactive web interface with optimized rendering, route-based layouts, and strong developer tooling. |
| **Backend** | Django 5 + Django Ninja (REST API) | Secure, scalable backend framework with fast API responses and built-in ORM. |
| **Database** | PostgreSQL 16 | Reliable relational database suited for structured organizational data. |
| **Real-time Engine** | Django Channels (WebSocket) | For chat, live ticket updates, and activity indicators. |
| **Authentication** | Centralized with SMS via OAuth2 or JWT | Shared user base using employee code/password verification. |
| **AI Components (Phase 2)** | Python-based AI microservice (FastAPI + scikit-learn) | For ticket categorization, sentiment, and SLA prediction. |
| **Analytics Layer** | Metabase / Superset (Self-hosted) | Interactive dashboards for admins and management. |
| **Caching / Queues** | Redis 7 | For notifications, socket events, and background tasks. |
| **File Storage** | AWS S3 or Cloudflare R2 | For ticket attachments and document uploads. |

---

## **4. Detailed Stack Selection and Rationale**

### **4.1 Frontend Stack**

| Component | Recommendation | Version | Purpose & Justification |
| ----- | ----- | ----- | ----- |
| **Framework** | Next.js | 15.0 | Modern full-stack React framework supporting API routes, SSR/SSG, and app router. Ideal for dashboard-type applications. |
| **Language** | TypeScript | 5.6 | Ensures type safety, better collaboration, and long-term maintainability. |
| **Styling** | Tailwind CSS | 3.4 | Utility-first CSS framework for rapid UI development with a custom palette. |
| **State Management** | Zustand / Redux Toolkit | Latest | Lightweight state management, ideal for ticket and user state handling. |
| **Real-time Client** | Django Channels WebSocket Client | Latest | Native WebSocket client for real-time ticket chat and live updates from Django Channels backend. |
| **UI Components** | shadcn/ui + Lucide React Icons | Latest | Modular, accessible, and customizable design system for consistent UI/UX. |
| **Charts / Analytics UI** | Recharts | Latest | For role-based visualizations (tickets resolved, workload, satisfaction rate). |

**Why Next.js?**

* Easy integration with APIs and WebSocket clients.

* SEO is irrelevant for internal apps → can fully leverage client-side navigation.

* Excellent developer velocity with the **Cursor AI** environment.

---

### **4.2 Backend Stack**

| Component | Recommendation | Version | Purpose & Justification |
| ----- | ----- | ----- | ----- |
| **Framework** | Django | 5.0+ | Mature, secure, and robust backend framework for enterprise-grade apps. |
| **API Layer** | Django Ninja | 1.2+ | High-performance API layer on top of Django using Pydantic-like validation. |
| **Database ORM** | Django ORM | Built-in | Enables clean relational data modeling for departments, tickets, users, and sub-tickets. |
| **Authentication** | JWT + OAuth2 Integration | — | Token-based authentication compatible with SMS employee login. |
| **Real-time Engine** | Django Channels + Redis | — | Native WebSocket handling for ticket chat, online presence, and live updates. |
| **Background Tasks** | Celery + Redis Broker | — | Handles reminders, email notifications, and SLA timers. |
| **AI Hooks (Future)** | FastAPI microservice | 0.115+ | Connects for ML-based classification and recommendation. |

**Why Django Ninja + Channels?**  
 Combines **Django's reliability** with **FastAPI-like performance**, supports async event handling, and scales easily for internal workloads.

---

### **4.3 Database Design Principles**

**Database:** PostgreSQL 16

**Key Entities:**

* `User` (linked with SMS Employee model)

* `Department`

* `Ticket`

* `SubTicket`

* `ChatMessage`

* `Notification`

* `AuditLog`

* `Priority`, `Status`, `Category`

**Indexes & Relations:**

* Indexed on `department_id`, `assignee_id`, `status`, and `created_at`.

* Foreign key cascades maintain relational integrity.

* JSONB fields can be used for flexible metadata storage (attachments, logs).

**Query Optimization:**
* Django Debug Toolbar for development query analysis
* Slow query logging enabled
* Query analysis before deployment
* Composite indexes for common query patterns (to be added based on query analysis)
* Database indexes will be optimized based on actual query patterns (deferred to implementation phase)

**Query Optimization Strategy:**
* Analyze slow queries using Django Debug Toolbar and PostgreSQL `pg_stat_statements`
* Identify N+1 query problems and use `select_related()` and `prefetch_related()`
* Add composite indexes for frequently filtered/sorted columns
* Use database query analysis tools to identify bottlenecks
* Optimize queries before deployment
* Regular query performance reviews

**Soft Delete Implementation:**
* All deletions are soft deletes (marked as `is_deleted=True`, hidden from UI, retained in DB)
* Applies to tickets, drafts, and all entities

---

### **4.4 Real-Time Communication Layer**

| Component | Purpose | Stack |
| ----- | ----- | ----- |
| **WebSocket Server** | Manages real-time communication between users, moderators, and assignees. | Django Channels + Redis |
| **Client Integration** | Connects users (requestor, Moderator, Assignee) with live updates. | Django Channels WebSocket Client (Native WebSocket) |
| **Use Cases** | Ticket chat, live status updates, typing indicators, sub-ticket creation events, notifications. |  |

**Design Considerations:**

* Each ticket = unique room/channel.

* Sub-tickets automatically join the parent room.

* Admin has silent observer access for auditing.

* **Chat Visibility:** New participants see messages after their join timestamp only. Admin and Moderator can see full chat history.

* Redis pub/sub ensures message delivery at scale.

---

### **4.5 Authentication & Integration**

| Integration | Mechanism | Description |
| ----- | ----- | ----- |
| **SMS Employee Sync** | Shared database or REST bridge | Users from the SMS (Teachers, Principals, Coordinators) are authorized via employee code. |
| **Login System** | JWT-based API auth | Secure token auth via Django Ninja endpoints. |
| **Role Assignment** | Controlled by Helpdesk Admin | Admin can grant access or promote users to new roles. |

**Security Enhancements:**

* Passwords hashed with Argon2.

* Two-Factor Authentication (optional, via email OTP).

* Role-based access is enforced in middleware.

---

### **4.6 Analytics Layer**

| Tool | Purpose | Integration Mode |
| ----- | ----- | ----- |
| **Metabase (Self-hosted)** | Visual analytics dashboards and reports. | PostgreSQL direct read. |
| **Custom Dashboards** | Role-specific ticket metrics in the frontend. | API endpoints serving metrics. |
| **Future** | SLA performance & sentiment analysis via AI. | Through the Django analytics module. |

---

### **4.7 Dev Tools & Utilities**

| Category | Tool | Purpose |
| ----- | ----- | ----- |
| **Version Control** | Git + GitHub | Team collaboration and version tracking. |
| **AI-Powered IDE** | Cursor AI | Accelerated coding, refactoring, and debugging. |
| **Package Management** | npm / pip | Node and Python dependency management. |
| **Linting & Quality** | ESLint + Prettier + Black | Code consistency and readability. |
| **Testing Framework** | Jest (Frontend), Pytest (Backend) | Unit and integration testing. |

---

## **5. Feature-to-Component Mapping**

| Core Feature | Stack Components Involved |
| ----- | ----- |
| Ticket Creation & Management | Django + PostgreSQL + Next.js |
| Real-time Chat | Django Channels + Redis (Native WebSocket) |
| Notifications & Reminders | Celery + Redis + Email APIs |
| Analytics Dashboard | Metabase + Django Ninja APIs |
| SMS User Integration | Django Auth + JWT |
| File Uploads (Attachments) | S3 / R2 + Django Storage |
| Ticket Lifecycle & Workflow | Django ORM Models + Ninja Routers |
| Role-based Access | Django Permissions + Middleware |
| Postponed Ticket Reminder System | Celery Scheduled Tasks + Redis |
| Multi-department Sub-tickets | ORM Relationship + Socket events |

---

## **6. Non-Functional Requirements**

| Category | Target |
| ----- | ----- | ----- |
| **Performance** | <250ms API response time for major routes |
| **Scalability** | Supports 500 concurrent socket connections in MVP |
| **Security** | JWT auth, RBAC, encrypted data at rest |
| **Maintainability** | Modular code structure, component isolation |
| **Usability** | Responsive UI, low learning curve for internal staff |

---

## **7. Future Expansion Compatibility**

| Phase | Future Feature | Planned Stack Extension |
| ----- | ----- | ----- |
| Phase 2 | AI Ticket Classification | FastAPI + scikit-learn + RabbitMQ |
| Phase 3 | Voice Messaging | WebRTC + WebSocket (Django Channels) |
| Phase 4 | SLA Auto-Optimization | TensorFlow Lite / ML Model |
| Phase 5 | Mobile App | React Native uses the same API layer |

---

## **8. API Versioning Strategy**

**Base URL:** `/api/v1/`

**Versioning Approach:**
* All API endpoints use `/api/v1/` prefix
* Future versions will use `/api/v2/`, `/api/v3/`, etc.
* Version is specified in URL path (not headers)
* Deprecated endpoints will be marked but remain functional during transition period
* API versioning is sufficient for deprecation strategy (no separate deprecation headers needed)

**Implementation:**
* Django Ninja routers organized by version
* Version prefix handled at router level
* OpenAPI documentation auto-generated per version

---

## **9. Database Migration Strategy**

**Migration Principles:**
* All schema changes must be done via Django migrations
* Migrations are version-controlled and reviewed before deployment
* Zero-downtime migrations preferred for production

**Rollback Procedures:**
* Each migration includes reverse operation (`migrate app_name previous_migration`)
* Database backups taken before major migrations
* Staging environment validates migrations before production
* Rollback plan documented for each migration

**Migration Workflow:**
1. Create migration: `python manage.py makemigrations`
2. Review migration file for correctness
3. Test in development environment
4. Validate in staging environment
5. Backup production database
6. Apply migration: `python manage.py migrate`
7. Monitor for issues
8. Rollback if necessary: `python manage.py migrate app_name previous_migration`

**Data Migrations:**
* Complex data transformations handled in separate data migration files
* Data migrations tested with production-like data volumes
* Rollback strategy includes data restoration procedures

---

## **10. Concurrent Update Handling**

**Optimistic Locking:**
* All models include `version` field (IntegerField, auto-incremented on save)
* Client sends current version with update requests
* Server validates version matches before update
* If version mismatch → 409 Conflict error returned
* Client must refresh and retry

**Pessimistic Locking:**
* Used for critical operations (status transitions, approvals)
* Database-level row locks via `select_for_update()`
* Prevents concurrent modifications during critical workflows
* Locks released automatically after transaction commit

**Implementation:**
* Version field added to Ticket, SubTicket, and other critical models
* Middleware validates version on PATCH/PUT requests
* Transaction boundaries defined for critical operations
* Conflict resolution strategy: Last-write-wins with version validation

---

## **11. Secrets Management**

**Development Environment:**
* Environment variables stored in `.env` file (not committed to git)
* `.env.example` template provided for team members
* Python `python-decouple` or `django-environ` for environment variable management
* Secrets include: Database credentials, JWT secret keys, SMS API keys, S3 credentials

**Production Environment:**
* Environment variables managed via deployment platform (Railway, Vercel, AWS)
* Secrets stored securely in platform's secret management system
* No secrets hardcoded in codebase
* Rotation strategy for sensitive keys (JWT secrets, API keys)

**Security:**
* `.env` files excluded from version control (`.gitignore`)
* Different secrets for development, staging, and production
* Regular rotation of production secrets

---

## **12. Audit Log Retention Policy**

**Retention Period:**
* **Active Audit Logs:** 7 years (compliance requirement)
* **Archived Audit Logs:** Indefinite (moved to cold storage after 7 years)

**Archival Strategy:**
* Audit logs older than 7 years moved to archive storage (S3 Glacier or similar)
* Archive process runs monthly via Celery scheduled task
* Archived logs remain accessible but read-only
* Original audit logs marked as archived but not deleted

**Implementation:**
* `AuditLog` model includes `archived_at` timestamp
* Celery task: `archive_old_audit_logs` runs monthly
* Archive storage separate from primary database
* Query optimization: Archived logs excluded from active queries

**Compliance:**
* Audit logs are immutable (no updates or deletes allowed)
* All audit events include: user_id, timestamp, action, before/after state, reason
* Export functionality for compliance audits

---

## **13. Rate Limiting Strategy**

**Rate Limiting Algorithm:** Token Bucket

**Rate Limits by Role:**

| Endpoint | Role | Limit |
| ----- | ----- | ----- |
| `/api/v1/auth/login` | All Users | 10 requests/minute |
| All Endpoints | requestor | 150 requests/minute |
| All Endpoints | Assignee | 250 requests/minute |
| All Endpoints | Moderator | Unlimited |
| All Endpoints | Admin | Unlimited |

**Implementation:**
* Django middleware for rate limiting
* Redis-based token bucket implementation
* Rate limit headers in response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
* 429 Too Many Requests response when limit exceeded

**Per-Endpoint Limits:**
* File upload endpoints: Additional limits (see File Upload Security section)
* WebSocket connections: 10 concurrent connections per user
* Specific endpoints may have custom limits based on resource usage

---

## **14. File Upload Security**

**Size Limits:**
* **Server Limit:** 500MB per file
* **Frontend Limit:** 250MB (user sees this limit)
* **Total per Ticket:** 100MB (sum of all attachments)

**File Type Validation:**
* **Allowed Document Types:** PDF, TXT, DOCX, XLSX
* **Allowed Video Types:** MP4, MOV, MKV, AVI (transcoded to MP4)
* **Allowed Image Types:** JPG, PNG, GIF (converted to WebP)
* MIME type validation on both client and server
* File extension validation (whitelist approach)

**Upload Process:**
1. **Client-Side Validation:**
   - File size check before upload (250MB limit shown to user)
   - File type validation
   - User notified if file too large

2. **Server-Side Validation:**
   - File size validation on receive (500MB hard limit)
   - MIME type verification
   - File extension validation
   - Reject if validation fails

3. **Storage:**
   - Files saved outside web root
   - Random, unique filename generated (UUID-based)
   - Original filename stored in metadata
   - Temporary location for initial storage

4. **Security Scanning:**
   - Antivirus engine scan (background process)
   - If infected → immediate deletion + user error message
   - If clean → move to permanent isolated storage
   - All scan results logged

5. **File Processing:**
   - **Images:** Converted to WebP format (optimization)
   - **Videos:** Transcoded to MP4 (background, async)
   - **Documents:** Sanitized and scanned

6. **Security Headers:**
   - `Content-Disposition: attachment; filename="original_name.pdf"`
   - Secure headers on file downloads

7. **Logging:**
   - All upload attempts logged (user, timestamp, file info)
   - Failed uploads logged with reason
   - Security scan results logged

**Authentication:**
* Only authenticated users can upload
* Role-based upload permissions (if needed)

---

## **15. Database Connection Pooling**

**PgBouncer (External):**
* External PgBouncer instance for connection pooling
* Connection pool size: 25-50 connections (configurable)
* Pool mode: Transaction pooling (recommended for Django)
* Reduces database connection overhead
* Improves performance under high load

**Configuration:**
* Django `DATABASES` setting points to PgBouncer
* PgBouncer forwards to actual PostgreSQL instance
* Connection string: `postgresql://user:pass@pgbouncer-host:6432/dbname`
* Pool size tuned based on application load

**Benefits:**
* Reduced database connection overhead
* Better resource utilization
* Improved scalability
* Connection reuse across requests

---

## **16. Caching Strategy (Cache-Aside Pattern)**

**Cache-Aside Pattern Implementation:**

**How It Works:**
1. **Request Arrives:** App needs data (e.g., "Open Tickets" summary)
2. **Check Cache (Redis):** App queries Redis first
3. **Cache Hit:** Data found in cache → return immediately (fast)
4. **Cache Miss:** Data not in cache → query database → save to Redis → return to user

**Cache Keys Format:**
* **Pattern:** `{module}:{resource}:{filters}:{identifier}`
* **Examples:**
  - `summary:open_tickets:user_id:123:priority:high`
  - `dashboard:summary:user_id:456`
  - `ticket:detail:ticket_id:789`
* Keys must be specific to avoid cache collisions
* Each user/role gets unique cache keys when data differs

**TTLs (Time To Live):**

| Data Type | TTL | Reason |
| ----- | ----- | ----- |
| Dynamic Data (Open ticket count, Chat status) | 30-60 seconds | Changes frequently |
| Static Data (System settings) | 1 hour | Rarely changes |
| User-specific dashboards | 60 seconds | Personalized data |
| Department metrics | 2 minutes | Moderate update frequency |

**Cache Invalidation:**
* **Automatic:** TTL expiration (Redis auto-deletes expired keys)
* **Manual:** Invalidation on data updates
* **Pattern:** When ticket status changes → `DEL summary:open_tickets:*`
* **Example:** Ticket closed → invalidate all related cache keys
* Next request will cache miss → fetch fresh data → update cache

**Invalidation Triggers:**
* Ticket status change → invalidate ticket-related caches
* User assignment → invalidate dashboard caches
* Department update → invalidate department-related caches
* Cache invalidation happens immediately after database update

**Cache Implementation:**
* Redis used for caching
* Django cache framework with Redis backend
* Cache decorators for frequently accessed views
* Manual cache invalidation in service layer

---

## **17. State Machine Implementation (django-fsm)**

**Library:** `django-fsm` (Django Finite State Machine)

**Purpose:**
* Enforce valid status transitions
* Prevent invalid state changes
* Track state history
* Validate transitions based on business rules

**Implementation:**
* Ticket model uses `FSMField` for status
* Transition methods decorated with `@transition`
* State machine validates transitions before allowing changes
* Invalid transitions raise exceptions

**Benefits:**
* Type-safe status transitions
* Business rule enforcement at model level
* Clear state transition documentation
* Prevents invalid status changes

**Example:**
```python
from django_fsm import FSMField, transition

class Ticket(models.Model):
    status = FSMField(default='draft')
    
    @transition(field=status, source='draft', target='submitted')
    def submit(self):
        # Business logic here
        pass
```

---

## **18. Soft Delete Queryset Pattern**

**Implementation:**
* Custom Manager and QuerySet for soft-deleted records
* Auto-filters `is_deleted=True` records from default queries
* Explicit `.deleted()` queryset for accessing deleted records
* `.with_deleted()` for accessing all records (Admin only)

**Pattern:**
```python
class SoftDeleteQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_deleted=False)
    
    def deleted(self):
        return self.filter(is_deleted=True)

class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model).active()
    
    def deleted(self):
        return SoftDeleteQuerySet(self.model).deleted()
    
    def with_deleted(self):
        return SoftDeleteQuerySet(self.model)
```

**Benefits:**
* Prevents accidental access to deleted records
* Consistent soft delete behavior across models
* Easy to query deleted records when needed
* No need to add `is_deleted=False` to every query

---

## **19. Transaction Strategy**

**Transaction Boundaries:**
* Complex operations wrapped in `@transaction.atomic` decorator
* Database transactions ensure data consistency
* Rollback on exceptions maintains data integrity

**Critical Operations (Always Use Transactions):**
* Status transitions (with version checking)
* Sub-ticket creation (parent-child relationships)
* Approval workflows (multiple model updates)
* Reassignment (removing old, adding new assignee)
* File upload processing (multiple steps)

**Implementation:**
```python
from django.db import transaction

@transaction.atomic
def assign_ticket(ticket_id, assignee_id):
    # All database operations in this function are atomic
    # Rollback on any exception
    pass
```

**Nested Transactions:**
* Django supports nested transactions (savepoints)
* Outer transaction rollback affects all nested transactions
* Useful for complex workflows with multiple steps

**Rollback Handling:**
* Exceptions trigger automatic rollback
* Error messages returned to client
* Audit logs record failed attempts
* No partial updates on failure

---

## **20. WebSocket Authentication**

**Authentication Method:**
* JWT token passed via subprotocol header during WebSocket upgrade
* Alternative: JWT in connection query string (less secure, fallback)
* Token validated before connection accepted
* Invalid tokens → connection rejected

**Implementation:**
* Django Channels consumer validates JWT on connect
* User extracted from token
* Permission check for ticket access
* Connection accepted only if user has access

**Security:**
* Token validation on every connection
* No token → connection rejected
* Expired token → connection rejected
* User must re-authenticate to reconnect

**Connection Flow:**
1. Client initiates WebSocket connection with JWT token
2. Server validates token during upgrade handshake
3. If valid → connection accepted, user added to channel group
4. If invalid → connection rejected with error message

---

## **21. Message Queue Strategy (Celery)**

**Queue Configuration:**
* **High Priority Queue:** Urgent notifications, SLA alerts
* **Low Priority Queue:** Background tasks, reports, analytics
* **Default Queue:** General tasks

**Task Priorities:**
* High: Real-time notifications, SLA breaches
* Medium: Email notifications, reminders
* Low: Analytics, reports, data exports

**Retry Strategy:**
* Maximum 3 retries for failed tasks
* Exponential backoff between retries
* Dead-letter queue for permanently failed tasks
* Admin notification for dead-letter tasks

**Monitoring:**
* Celery Flower for task monitoring
* Task success/failure rates tracked
* Queue length monitoring
* Alert on queue backlog

**Task Examples:**
* Postponed ticket reminders (every 3 days)
* Auto-close countdown (3 days after resolved)
* Email notifications
* File processing (virus scan, transcoding)
* Audit log archival

---

## **22. Database Backup Strategy**

**Backup Schedule:**
* **Full Backup:** Daily (automated, during low-traffic hours)
* **Transaction Log Backup:** Every 15-30 minutes (WAL archiving)
* **Backup Retention:** 30 days for full backups, 7 days for transaction logs

**Backup Storage:**
* Backups stored in separate location (S3 or external storage)
* Encrypted backups for security
* Backup verification (test restore monthly)

**Recovery Procedures:**
* Point-in-time recovery possible with transaction logs
* Recovery time objective (RTO): 4 hours
* Recovery point objective (RPO): 15-30 minutes (transaction log interval)

**Automation:**
* PostgreSQL `pg_dump` for full backups
* WAL archiving for transaction logs
* Celery scheduled task for backup coordination
* Backup success/failure notifications to Admin

**Testing:**
* Monthly restore tests to verify backup integrity
* Disaster recovery drill quarterly
* Backup restoration documented and tested

---

## **23. Observability (Future Implementation)**

**Structured Logging:**
* JSON-formatted logs for easy parsing
* Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
* Context included: user_id, request_id, timestamp, action
* Centralized log aggregation (future: ELK stack or similar)

**Metrics:**
* Application metrics: Request rate, response times, error rates
* Business metrics: Ticket creation rate, resolution time, SLA breaches
* System metrics: CPU, memory, database connections
* Metrics exported to monitoring system (future: Prometheus + Grafana)

**Distributed Tracing:**
* Request tracing across services
* Trace IDs for request correlation
* Performance bottleneck identification
* Future implementation with OpenTelemetry

**Note:** Observability infrastructure deferred to production phase. Development focuses on core functionality.

**Future Consideration - Event Sourcing:**
* Event sourcing can be implemented for comprehensive audit trail and event replay
* All state changes stored as events
* Enables time-travel debugging and complete history reconstruction
* Consider for Phase 2+ if audit requirements become more complex

---

## **24. Security Enhancements**

**Security Headers:**
* **Content-Security-Policy (CSP):** Restrict resource loading
* **Strict-Transport-Security (HSTS):** Force HTTPS
* **X-Frame-Options:** Prevent clickjacking
* **X-Content-Type-Options:** Prevent MIME sniffing
* Headers configured in Django middleware

**JWT Refresh Token Rotation:**
* Refresh tokens rotated on each use
* Old refresh token invalidated when new one issued
* Prevents token reuse attacks
* Token blacklist for revoked tokens

**Input Sanitization:**
* HTML sanitization for user-generated content (chat messages)
* XSS prevention via content sanitization
* SQL injection prevention via Django ORM (parameterized queries)
* File content validation (not just extension/MIME type)

**Rate Limiting on Auth Endpoints:**
* Login endpoint: 10 requests/minute (prevents brute force)
* Refresh token endpoint: Rate limited
* Failed login attempts logged
* Account lockout after multiple failed attempts (future)

---

## **25. Testing Strategy**

**Test Coverage Target:** 80%+ code coverage

**Unit Tests:**
* Model tests (validations, methods)
* Service layer tests (business logic)
* API endpoint tests (request/response)
* Test framework: Pytest + pytest-django

**Integration Tests:**
* End-to-end workflow tests
* Database transaction tests
* WebSocket connection tests
* External service integration tests (mocked)

**Performance Testing:**
* Load testing for API endpoints
* Stress testing for WebSocket connections
* Database query performance tests
* Tools: Locust, Apache Bench, or similar

**Security Testing:**
* Authentication/authorization tests
* Input validation tests
* SQL injection tests
* XSS prevention tests
* Security scanning tools (future)

**Test Execution:**
* Tests run in CI/CD pipeline
* Coverage reports generated
* Failed tests block deployment
* Regular test maintenance and updates

---

## **26. Summary**

This technical stack ensures:

* **Rapid MVP delivery** using familiar, robust frameworks.

* **Scalability** for future AI and analytics extensions.

* **Interoperability** with existing Idara systems (SMS).

* **Clarity and maintainability** for both experienced and new developers.

✅ *Recommendation:* Begin development with **Next.js 15 + Django Ninja + PostgreSQL + Redis** foundation.  
 Add **Django Channels WebSocket chat integration** and **Metabase analytics** after MVP validation.

---

# Frontend Architecture

# **Final Frontend Architecture**

**Tech Stack:**

* **Next.js 15 (App Router)**

* **TypeScript**

* **TailwindCSS + ShadCN/UI**

* **Django Channels WebSocket Client** (real-time chat, notifications)

* **TanStack Query / React Query** (data fetching & caching)

* **Zustand** (global state for session, role, notifications)

* **Axios** (API client with interceptors)

---

##  **Folder Hierarchical Diagram**

`frontend/`  
`├─ app/`  
`│  ├─ (auth)/`  
`│  │  ├─ login/page.tsx`  
`│  │  ├─ register/page.tsx         # future expansion if needed`  
`│  │  └─ forgot-password/page.tsx`  
`│  │`  
`│  ├─ (roles)/`  
`│  │  ├─ [role]/`  
`│  │  │  ├─ layout.tsx             # role-based layout (sidebar + navbar)`  
`│  │  │  ├─ profile/page.tsx`  
`│  │  │  ├─ notifications/page.tsx`  
`│  │  │  ├─ dashboard/page.tsx`  
`│  │  │  ├─ requests/page.tsx`  
`│  │  │  ├─ request-detail/[id]/page.tsx`  
`│  │  │  └─ new-request/page.tsx`  
`│  │  │`  
`│  │  ├─ admin/`  
`│  │  │  ├─ users/page.tsx`  
`│  │  │  ├─ settings/page.tsx`  
`│  │  │  ├─ reports/page.tsx`  
`│  │  │  └─ analytics/page.tsx`  
`│  │  │`  
`│  │  ├─ moderator/`  
`│  │  │  ├─ review/[id]/page.tsx`  
`│  │  │  ├─ assigned-tickets/page.tsx`  
`│  │  │  ├─ reassign/[id]/page.tsx`  
`│  │  │  ├─ create-subtickets/page.tsx`  
`│  │  │  └─ ticket-pool/page.tsx`  
`│  │  │`  
`│  │  ├─ assignee/`  
`│  │  │  ├─ tasks/page.tsx`  
`│  │  │  ├─ task-detail/[id]/page.tsx`  
`│  │  │  └─ reports/page.tsx`  
`│  │`  
`│  ├─ layout.tsx                    # root layout (login layout / public)`  
`│  ├─ page.tsx                      # landing (if needed)`  
`│  └─ not-found.tsx                 # custom 404 page`  
`│`  
`├─ components/`  
`│  ├─ layout/`  
`│  │  ├─ Navbar.tsx`  
`│  │  ├─ Sidebar.tsx`  
`│  │  ├─ RoleGuard.tsx`  
`│  │  └─ PageWrapper.tsx`  
`│  │`  
`│  ├─ common/`  
`│  │  ├─ AnalyticsCard.tsx`  
`│  │  ├─ PriorityBadge.tsx`  
`│  │  ├─ StatusTag.tsx`  
`│  │  ├─ ActionButtons.tsx`  
`│  │  ├─ TicketTimeline.tsx`  
`│  │  └─ TicketChat.tsx`  
`│  │`  
`│  ├─ ui/`  
`│  │  ├─ Button.tsx`  
`│  │  ├─ Input.tsx`  
`│  │  ├─ Select.tsx`  
`│  │  ├─ TextArea.tsx`  
`│  │  ├─ Modal.tsx`  
`│  │  ├─ DataTable.tsx`  
`│  │  ├─ SkeletonLoader.tsx`  
`│  │  └─ Toast.tsx`  
`│  │`  
`│  ├─ modals/`  
`│  │  ├─ AssignTicketModal.tsx`  
`│  │  ├─ ConfirmModal.tsx`  
`│  │  ├─ ReassignModal.tsx`  
`│  │  └─ SplitTicketModal.tsx`  
`│  │`  
`│  ├─ notifications/`  
`│  │  ├─ DynamicNotifications.tsx`  
`│  │  └─ NotificationCard.tsx`  
`│  │`  
`│  ├─ profile/`  
`│  │  └─ DynamicProfile.tsx`  
`│  │`  
`│  └─ charts/`  
`│     ├─ TicketVolumeChart.tsx`  
`│     ├─ DepartmentLoadChart.tsx`  
`│     └─ PriorityTrendChart.tsx`  
`│`  
`├─ hooks/`  
`│  ├─ useAuth.ts`  
`│  ├─ useSocket.ts`  
`│  ├─ useNotifications.ts`  
`│  ├─ useTicketActions.ts`  
`│  └─ useModal.ts`  
`│`  
`├─ store/`  
`│  ├─ authStore.ts`  
`│  ├─ notificationStore.ts`  
`│  ├─ ticketStore.ts`  
`│  └─ uiStore.ts`  
`│`  
`├─ services/`  
`│  ├─ api/`  
`│  │  ├─ axiosClient.ts`  
`│  │  ├─ ticketService.ts`  
`│  │  ├─ userService.ts`  
`│  │  ├─ analyticsService.ts`  
`│  │  └─ notificationService.ts`  
`│  │`  
`│  └─ socket/`  
`│     ├─ socketClient.ts`  
`│     └─ eventHandlers.ts`  
`│`  
`├─ lib/`  
`│  ├─ constants.ts`  
`│  ├─ helpers.ts`  
`│  ├─ validation.ts`  
`│  ├─ theme.ts`  
`│  └─ rbac.ts                    # role-based access utilities`  
`│`  
`├─ types/`  
`│  ├─ ticket.ts`  
`│  ├─ user.ts`  
`│  ├─ notification.ts`  
`│  ├─ chat.ts`  
`│  └─ index.ts`  
`│`  
`├─ public/`  
`│  ├─ images/`  
`│  ├─ icons/`  
`│  └─ logos/`  
`│`  
`├─ styles/`  
`│  ├─ globals.css`  
`│  └─ variables.css`  
`│`  
`├─ config/`  
`│  ├─ env.ts`  
`│  ├─ routes.ts`  
`│  ├─ socketEvents.ts`  
`│  └─ permissions.ts`  
`│`  
`├─ tests/`  
`│  ├─ unit/`  
`│  └─ integration/`  
`│`  
`├─ package.json`  
`├─ tsconfig.json`  
`├─ next.config.ts`  
`└─ README.md`

---

# **Folder-by-Folder Purpose and Usage Guide**

###  **`app/`**

Main routing layer (Next.js App Router).

* Each **role folder** defines isolated pages per role.

* Common pages like login, register, and landing are outside.

* `[role]/layout.tsx` defines sidebar/navbar for that role.

🟢 **When to modify:**  
 Add new role sections, dashboards, or ticket details.  
 🛑 **Don't put business logic here** — only UI routing and view rendering.

---

 **`components/`**

Reusable building blocks.

* `layout/` → Layout-related components like Navbar, Sidebar, Guards.

* `common/` → Shared functional widgets (TicketTimeline, Chat, etc.).

* `ui/` → Basic building blocks styled via ShadCN (buttons, inputs, modals).

* `modals/` → Modular popups (assign, split, confirm).

* `notifications/` → Realtime notification UIs.

* `profile/` → User profile widgets.

* `charts/` → All visual analytics components using Recharts.

🟢 **When to modify:**  
 Add reusable visual or interactive UI elements.  
 🛑 **Don't call APIs or business logic directly inside UI components.**

---

 **`hooks/`**

Custom React hooks for side effects or shared logic.

| Hook | Purpose |
| ----- | ----- |
| `useAuth.ts` | Manage authentication, roles, and tokens |
| `useSocket.ts` | Manage socket connection and event listeners |
| `useNotifications.ts` | Fetch + listen for new notifications |
| `useTicketActions.ts` | Centralize all ticket mutation logic |
| `useModal.ts` | Handle modal visibility + states |

🟢 Keeps logic decoupled from UI and easily testable.

---

### **`store/`**

Global state management using **Zustand** (simple and lightweight).  
 Each store handles one slice of the state.

| Store | Purpose |
| ----- | ----- |
| `authStore.ts` | Current user, role, login/logout |
| `notificationStore.ts` | Active notifications |
| `ticketStore.ts` | Tickets cache + active ticket |
| `uiStore.ts` | Sidebar toggle, theme, and modal state |

🟢 **When to modify:**  
 Add new shared states or update the caching strategy.

---

### **`services/`**

API and socket communication layer.

* `api/axiosClient.ts` → Base API setup with interceptors (auth tokens).

* Each `service` file handles related API requests (tickets, users, analytics).

* `socket/` handles real-time setup, event subscriptions, and handlers.

🟢 **When to modify:**  
 Add or modify backend endpoints or real-time event logic.  
 🛑 **Never import services directly into UI components.** Use via hooks.

---

###  **`lib/`**

Utility functions, constants, and configurations.

| File | Purpose |
| ----- | ----- |
| `constants.ts` | Static app constants |
| `helpers.ts` | Reusable formatting or calculation functions |
| `validation.ts` | Zod/Yup validation schemas |
| `theme.ts` | Tailwind theme helpers |
| `rbac.ts` | Role-based access logic |

---

###  **`config/`**

Central config for environment and app-wide settings.

| File | Role |
| ----- | ----- |
| `env.ts` | Environment variables handler |
| `routes.ts` | Centralized route definitions |
| `socketEvents.ts` | All socket event names/constants |
| `permissions.ts` | Role-to-permission mapping |

---

### **`types/`**

TypeScript interfaces and types — **the heart of type safety.**

🟢 Define models like `Ticket`, `User`, `ChatMessage`, etc.  
 🛑 Never import backend models directly — replicate contracts here.

---

###  **`tests/`**

Unit and integration test structure.

---

# **Developer Onboarding Notes**

| Task | Where to Work |
| ----- | ----- |
| Create a new API call | `services/api/` + add a related hook in `hooks/` |
| Add a new dashboard card | `components/common/` or `components/charts/` |
| Add a new route/page | `app/[role]/` |
| Modify real-time event | `services/socket/eventHandlers.ts` |
| Add reusable modal | `components/modals/` |
| Change access rules | `config/permissions.ts` or `lib/rbac.ts` |

---

# Backend Architecture

# **Backend Architecture — Help Desk Management System (Microservices)**

**Architecture Type:** Microservices with Docker

**Tech Stack Overview:**

* **Language:** Python 3.12+

* **Framework:** Django 5.x (each service is a Django project)

* **API Framework:** Django Ninja (for REST endpoints)

* **WebSockets:** Django Channels (via `daphne` or `uvicorn`)

* **Database:** PostgreSQL 16+ (shared initially, can migrate to database-per-service later)

* **Auth:** JWT (via `djangorestframework-simplejwt`) integrated with SMS users

* **Task Scheduling:** Celery + Redis (for reminders and background tasks)

* **File Storage:** Local FileSystem (development/production initially), AWS S3 or Cloudflare R2 (future)

* **Testing:** Pytest / Django TestCase

* **Containerization:** Docker, Docker Compose

* **API Gateway:** Nginx (routes requests to services)

---

## **📁 Microservices Structure**

The system is divided into **5 independent services**, each with its own Django project structure:

```
services/
├─ user-service/              # Port 8001
│  ├─ Dockerfile
│  ├─ requirements.txt
│  └─ src/
│     ├─ manage.py
│     ├─ core/                 # Settings, URLs, WSGI
│     │  ├─ settings.py
│     │  ├─ urls.py
│     │  └─ wsgi.py
│     └─ apps/
│        ├─ users/             # User model, authentication APIs
│        │  ├─ models.py
│        │  ├─ api.py
│        │  ├─ schemas.py
│        │  └─ services/
│        │     └─ import_service.py
│        └─ departments/       # Department model
│           └─ models.py
│
├─ ticket-service/            # Port 8002
│  ├─ Dockerfile
│  ├─ requirements.txt
│  └─ src/
│     ├─ manage.py
│     ├─ core/
│     │  ├─ settings.py
│     │  ├─ urls.py
│     │  ├─ wsgi.py
│     │  └─ clients/           # Inter-service HTTP clients
│     │     └─ user_client.py
│     └─ apps/
│        ├─ tickets/
│        │  ├─ models/
│        │  │  ├─ ticket.py
│        │  │  └─ sub_ticket.py
│        │  ├─ api.py
│        │  └─ schemas.py
│        └─ approvals/
│           ├─ models.py
│           ├─ api.py
│           └─ schemas.py
│
├─ communication-service/     # Port 8003, WebSocket 8004
│  ├─ Dockerfile
│  ├─ requirements.txt
│  └─ src/
│     ├─ manage.py
│     ├─ core/
│     │  ├─ settings.py
│     │  ├─ asgi.py            # WebSocket entry point
│     │  ├─ urls.py
│     │  ├─ wsgi.py
│     │  └─ clients/
│     │     ├─ user_client.py
│     │     └─ ticket_client.py
│     └─ apps/
│        ├─ chat/
│        │  ├─ models.py
│        │  ├─ consumers.py    # WebSocket consumers
│        │  ├─ routing.py
│        │  ├─ api.py
│        │  └─ schemas.py
│        └─ notifications/
│           ├─ models.py
│           ├─ api.py
│           └─ schemas.py
│
├─ file-service/              # Port 8005
│  ├─ Dockerfile
│  ├─ requirements.txt
│  └─ src/
│     ├─ manage.py
│     ├─ core/
│     │  ├─ settings.py
│     │  ├─ urls.py
│     │  ├─ wsgi.py
│     │  ├─ celery.py          # Celery configuration
│     │  └─ clients/
│     │     ├─ user_client.py
│     │     └─ ticket_client.py
│     └─ apps/
│        └─ files/
│           ├─ models.py
│           ├─ api.py
│           ├─ schemas.py
│           ├─ services/
│           │  └─ upload_service.py
│           └─ tasks.py        # Celery tasks (antivirus, processing)
│
├─ frontend-service/          # Port 3000
│  ├─ Dockerfile
│  ├─ package.json
│  ├─ next.config.ts
│  └─ src/
│     └─ services/
│        ├─ api/
│        │  └─ axiosClient.ts  # Calls API Gateway
│        └─ socket/
│           └─ socketClient.ts # WebSocket client
│
└─ shared/                    # Shared code across services
   └─ core/
      ├─ models.py            # BaseModel (UUID, soft delete, timestamps)
      └─ clients.py           # Shared HTTP client utilities
```

---

## **📁 Individual Service Structure (Example: User Service)**

Each service follows this internal structure (same as monolithic, but isolated):

```
user-service/src/
├─ manage.py
├─ core/
│  ├─ __init__.py
│  ├─ settings.py              # Service-specific settings
│  ├─ urls.py                   # Service routes
│  ├─ wsgi.py
│  └─ clients/                 # HTTP clients for inter-service calls
│     └─ __init__.py
│
└─ apps/
   ├─ users/
   │  ├─ models.py              # User model (inherits from shared BaseModel)
   │  ├─ api.py                 # Django Ninja endpoints
   │  ├─ schemas.py             # Pydantic schemas
   │  ├─ services.py            # Business logic
   │  ├─ signals.py
   │  ├─ admin.py
   │  ├─ tests.py
   │  └─ services/
   │     └─ import_service.py
   │
   └─ departments/
      ├─ models.py
      ├─ api.py
      └─ services.py
```

**Note:** Each service is a **complete Django project** with its own `manage.py`, `settings.py`, and `urls.py`. The folder structure within each service follows the same patterns as a monolithic Django application.

---

# **⚙️ Service-by-Service Breakdown**

### **👤 User Service** (Port 8001)

**Responsibility:** User management, authentication, SMS integration, user import

**Apps:**
- `apps/users/` - User model, authentication APIs, user import
- `apps/departments/` - Department model

**Key Features:**
- JWT authentication (`/api/v1/auth/login`, `/api/v1/auth/refresh`)
- User CRUD operations
- Bulk user import from SMS
- Role management
- Department management

**Inter-Service Communication:**
- No dependencies (base service)
- Other services call User Service to validate users

---

### **🎫 Ticket Service** (Port 8002)

**Responsibility:** Ticket management, sub-tickets, approvals, SLA

**Apps:**
- `apps/tickets/` - Ticket and SubTicket models, ticket lifecycle APIs
- `apps/approvals/` - Approval workflow for financial tickets

**Key Features:**
- Ticket CRUD operations
- Status transitions (FSM)
- Sub-ticket creation and management
- Approval workflow (Finance/CEO)
- SLA tracking

**Inter-Service Communication:**
- Calls User Service to validate users and get user details
- Uses HTTP clients in `core/clients/user_client.py`

---

### **💬 Communication Service** (Port 8003, WebSocket 8004)

**Responsibility:** Real-time chat, notifications, WebSocket handling

**Apps:**
- `apps/chat/` - ChatMessage model, WebSocket consumers, chat APIs
- `apps/notifications/` - Notification model, notification APIs

**Key Features:**
- Real-time chat via WebSocket (Django Channels)
- Notification management
- Ticket participant management
- Chat visibility rules (new participants see messages after join timestamp)

**Inter-Service Communication:**
- Calls User Service to get user details
- Calls Ticket Service to validate tickets and get ticket details
- Uses HTTP clients in `core/clients/`

**WebSocket Endpoints:**
- `ws://gateway/ws/chat/{ticket_id}/` - Chat WebSocket connection

---

### **📁 File Service** (Port 8005)

**Responsibility:** File uploads, antivirus scanning, file processing

**Apps:**
- `apps/files/` - Attachment model, file upload APIs, Celery tasks

**Key Features:**
- File upload with validation (size, MIME type)
- Antivirus scanning (background Celery task)
- Image conversion to WebP
- Video transcoding to MP4
- Temporary storage before permanent save (after scan passes)

**Inter-Service Communication:**
- Calls User Service to validate users
- Calls Ticket Service to validate tickets
- Uses HTTP clients in `core/clients/`

**Background Tasks (Celery):**
- Antivirus scanning
- Image processing (WebP conversion)
- Video transcoding (MP4)

---

### **🎨 Frontend Service** (Port 3000)

**Responsibility:** Next.js web application

**Key Features:**
- Calls API Gateway (never individual services directly)
- WebSocket client for real-time updates
- All API calls go through `/api/v1/` (API Gateway)

**Configuration:**
- `src/services/api/axiosClient.ts` - Configured to call API Gateway
- `src/services/socket/socketClient.ts` - WebSocket client for API Gateway

---

### **🔗 Shared Code** (`services/shared/`)

**Purpose:** Common code shared across all services

**Components:**
- `core/models.py` - `BaseModel` (UUID primary key, soft delete, timestamps)
- `core/clients.py` - Shared HTTP client utilities

**Usage:**
- All services import `BaseModel` from shared code
- All models inherit from `BaseModel` for consistency

---

# **🧠 Architecture Layers (Microservices)**

## **Request Flow:**

```
Frontend (Next.js) → API Gateway (Nginx) → Service (Django Ninja) → Service Layer → Model Layer → PostgreSQL
                                                      ↓
                                              Inter-Service HTTP Calls
                                                      ↓
                                              Redis (Cache/Queue)
                                                      ↓
                                              Celery (Background Tasks)
```

## **Service Internal Layers (Per Service):**

```
Django Ninja API (Presentation Layer)  
       ↓  
Service Layer (Business Logic)  
       ↓  
Selector Layer (Optimized Queries)  
       ↓  
Model Layer (Data Persistence)  
       ↓  
PostgreSQL (Shared Database)  
       ↓  
Signals / Celery (Async & Event-driven operations)  
       ↓  
Channels (Real-time WebSocket Communication - Communication Service only)
```

## **Inter-Service Communication:**

- **Synchronous:** REST API calls via HTTP clients
- **Asynchronous:** Redis pub/sub for events
- **Background Tasks:** Celery for file processing, scanning, notifications

---

# **⚙️ Recommended Versions & Packages**

| Component | Recommended Version | Notes |
| ----- | ----- | ----- |
| **Python** | 3.12.x | Latest LTS |
| **Django** | 5.0.x | Async-ready |
| **Django Ninja** | 1.1.x | Fast modern API layer |
| **Channels** | 4.1.x | WebSockets support |
| **Redis** | 7.x | Channel layer + Celery broker |
| **Celery** | 5.3.x | Background task processing |
| **PostgreSQL** | 16.x | Production-grade DB |
| **djangorestframework-simplejwt** | 5.x | JWT authentication |
| **drf-spectacular / ninja-extra** | latest | API docs |
| **pytest / pytest-django** | latest | Testing |
| **django-cors-headers** | latest | Cross-origin (for frontend) |
| **django-storages** | latest | For attachment handling (optional S3) |
| **django-fsm** | latest | State machine for ticket status transitions |
| **python-decouple** / **django-environ** | latest | Environment variable management |
| **django-debug-toolbar** | latest | Query analysis and debugging (development) |

---

#  **Developer Onboarding Notes**

## **Microservices Development:**

| Task | Where to Work |
| ----- | ----- |
| Add a new endpoint | `apps/*/api.py` in the respective service |
| Add a background task | `apps/*/tasks.py` (Celery) in File Service |
| Modify business logic | `apps/*/services/*.py` in respective service |
| Create an optimized query | `apps/*/selectors.py` (if needed) |
| Add WebSocket feature | `apps/chat/consumers.py` in Communication Service |
| Add inter-service call | `core/clients/*_client.py` in respective service |
| Add a new model | `apps/*/models.py` (inherits from `shared.core.models.BaseModel`) |
| Update shared code | `services/shared/core/models.py` or `clients.py` |

## **Service-Specific Notes:**

- **User Service:** Base service, no dependencies on other services
- **Ticket Service:** Calls User Service for user validation
- **Communication Service:** Calls User Service and Ticket Service
- **File Service:** Calls User Service and Ticket Service, has Celery workers
- **Frontend Service:** Only calls API Gateway, never individual services

## **Docker Commands:**

```bash
# Start all services
docker-compose up

# Start specific service
docker-compose up user-service

# View logs
docker-compose logs -f ticket-service

# Run migrations in a service
docker-compose exec ticket-service python manage.py migrate
```

For detailed microservices setup, see [12-Microservices-Architecture.md](../12-Microservices-Architecture.md). |




