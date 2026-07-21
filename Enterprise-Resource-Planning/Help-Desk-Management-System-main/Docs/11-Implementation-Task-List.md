# HDMS Implementation Task List - Priority Based

**Version:** 2.0  
**Created:** December 2025  
**Last Updated:** December 2025 (Microservices Architecture)  
**Purpose:** Step-by-step implementation guide with priorities, tech stack, and connections

**Architecture:** Microservices with Docker - The system is divided into 5 independent services, each running in its own Docker container.

---

## **🔧 Spec Kit Workflow - How to Use This Document**

### **Overview**
This document contains detailed tasks. Use **Spec Kit** to implement each task systematically. Spec Kit helps you:
- Create feature specifications
- Generate implementation plans
- Break down tasks into actionable steps
- Implement code with proper context

### **Step-by-Step Workflow for Each Task**

#### **Step 1: Create Feature Specification**
**Location:** Run in project root directory (`D:\HDMS\`)

```powershell
# Open PowerShell in project root
cd D:\HDMS

# Create new feature (replace with task name)
.specify/scripts/powershell/create-new-feature.ps1 "Task 1.2: Database Infrastructure Setup"
```

**Output:** Creates `specs/001-database-infrastructure-setup/spec.md`

---

#### **Step 2: Fill Specification File**
**Location:** `specs/[###-feature-name]/spec.md`

**What to do:**
1. Open the generated `spec.md` file
2. Copy the **"What to do"** section from the task below
3. Copy the **"Tech Stack"** section
4. Copy the **"Files to create"** section
5. Add user stories based on task requirements

**Example for Task 1.2:**
```markdown
## User Scenarios & Testing

### User Story 1 - Database Connection (Priority: P1)
**Why**: All services need database access to function

**Acceptance Scenarios**:
1. **Given** Docker Compose is running, **When** I start any service, **Then** it connects to PostgreSQL successfully
2. **Given** Redis is running, **When** service starts, **Then** it connects to Redis for caching

## Requirements

### Functional Requirements
- **FR-001**: System MUST set up PostgreSQL 16 in Docker Compose
- **FR-002**: System MUST set up Redis 7 for cache, queue, and channel layer
- **FR-003**: All 5 services MUST connect to shared PostgreSQL database
- **FR-004**: Services MUST configure Redis connections (cache: 6379/0, Celery: 6379/2, Channels: 6379/1)
```

---

#### **Step 3: Generate Implementation Plan**
**Location:** Cursor IDE Chat (or your AI assistant)

**Command:**
```
/speckit.plan
```

**What it does:**
- Reads your `spec.md` file
- Analyzes the project structure
- Generates `plan.md` with technical approach
- Creates `research.md` with technology research
- Suggests data models and architecture

**Context it uses:**
- Current project structure (`services/`, `docker-compose.yml`)
- Existing code in services
- `.specify/memory/constitution.md` (project principles)
- Tech stack from spec.md

---

#### **Step 4: Generate Task List**
**Location:** Cursor IDE Chat

**Command:**
```
/speckit.tasks
```

**What it does:**
- Reads `plan.md` and `spec.md`
- Breaks down implementation into actionable tasks
- Creates `tasks.md` with checkboxes
- Organizes tasks by user story and priority
- Identifies parallel work opportunities

**Output:** `specs/[###-feature-name]/tasks.md`

---

#### **Step 5: Implement**
**Location:** Cursor IDE Chat

**Option A - Full Automation:**
```
/speckit.implement
```
This will implement all tasks automatically.

**Option B - Manual Implementation:**
1. Open `tasks.md` file
2. Work through tasks one by one
3. Check off completed tasks
4. Test after each user story

---

### **Quick Reference: Spec Kit Commands**

| Command | Location | Purpose | Input Context |
|---------|----------|---------|---------------|
| `create-new-feature.ps1` | PowerShell (project root) | Create feature spec | Task name from this doc |
| `/speckit.plan` | Cursor Chat | Generate technical plan | spec.md file |
| `/speckit.tasks` | Cursor Chat | Generate task list | plan.md + spec.md |
| `/speckit.implement` | Cursor Chat | Auto-implement code | tasks.md |
| `/speckit.clarify` | Cursor Chat | Ask questions about unclear requirements | spec.md |

---

### **Context Sources for Spec Kit**

When you run Spec Kit commands, it automatically uses:

1. **Project Structure:**
   - `services/` directory structure
   - Existing Docker Compose files
   - Current code in services

2. **Constitution File:**
   - `.specify/memory/constitution.md` - Project principles and rules

3. **Documentation:**
   - This Implementation Task List
   - Technical Architecture docs
   - Database Design docs

4. **Existing Code:**
   - Models, APIs, settings already implemented
   - Shared code in `services/shared/`

---

### **Example: Complete Workflow for Task 1.2**

```powershell
# Step 1: Create feature
cd D:\HDMS
.specify/scripts/powershell/create-new-feature.ps1 "Database Infrastructure Setup"

# Step 2: Edit spec.md
# Open: specs/001-database-infrastructure-setup/spec.md
# Copy "What to do", "Tech Stack", "Files to create" from Task 1.2 below
# Add user stories

# Step 3: Generate plan (in Cursor Chat)
/speckit.plan

# Step 4: Generate tasks (in Cursor Chat)
/speckit.tasks

# Step 5: Implement (in Cursor Chat)
/speckit.implement
```

---

### **Important Notes**

1. **One Task = One Feature:** Each task in this document should be a separate Spec Kit feature
2. **Copy Task Details:** Always copy "What to do", "Tech Stack", and "Files to create" to spec.md
3. **Check Dependencies:** Review "Connections" section to understand task dependencies
4. **Test After Each Story:** Spec Kit organizes by user stories - test each independently
5. **Update Status:** Mark tasks as complete in this document after implementation

### **Task Template Pattern**

Every task in this document follows this structure. When using Spec Kit:

1. **Read the task** - Understand "What to do", "Tech Stack", "Connections"
2. **Create feature** - Use PowerShell script with task name
3. **Fill spec.md** - Copy relevant sections from task
4. **Use Spec Kit prompt** - Copy the prompt from "Spec Kit Usage" section (if available) or create your own
5. **Generate & Implement** - Use `/speckit.plan`, `/speckit.tasks`, `/speckit.implement`

**Note:** Some tasks may have "Spec Kit Usage" section with ready-to-use prompts. For tasks without this section, follow the workflow above and create your own prompt based on "What to do" section.

---

## **📋 Task Categories Overview**

1. **Foundation Setup** (Must do first - infrastructure)
2. **Database & Models** (Core data structure)
3. **Authentication & Users** (Security foundation)
4. **Core Ticket System** (Main functionality)
5. **Real-time Features** (Chat, Notifications)
6. **File Management** (Attachments, Security)
7. **Advanced Features** (Approvals, SLA, Analytics)
8. **Testing & Deployment** (Quality assurance)

---

## **🚀 PHASE 1: FOUNDATION SETUP**

### **Task 1.1: Microservices Structure Setup**
**Priority:** 🔴 CRITICAL (Must do first)  
**Estimated Time:** 4-6 hours

**What to do:**
- Create microservices folder structure (`services/`)
- Set up 5 service directories:
  - `user-service/` - Django project for authentication and user management
  - `ticket-service/` - Django project for tickets and approvals
  - `communication-service/` - Django project for chat and notifications
  - `file-service/` - Django project for file uploads and processing
  - `frontend-service/` - Next.js project
- Create `shared/` directory for common code (BaseModel, clients)
- Set up Docker Compose configuration
- Configure Nginx API Gateway
- Set up `.env.example` files for each service

**Tech Stack:**
- Django 5.x (Python 3.12+) - 4 services
- Next.js 15 (TypeScript) - 1 service
- Docker, Docker Compose
- Nginx (API Gateway)
- Git for version control

**Connections:**
- Connects to: Nothing (foundation)
- Required for: Everything else

**Files to create:**
- `services/user-service/src/core/` (settings, urls, wsgi)
- `services/user-service/src/apps/` (users, departments)
- `services/ticket-service/src/core/` (settings, urls, wsgi, clients)
- `services/ticket-service/src/apps/` (tickets, approvals)
- `services/communication-service/src/core/` (settings, asgi, urls, wsgi, clients)
- `services/communication-service/src/apps/` (chat, notifications)
- `services/file-service/src/core/` (settings, urls, wsgi, celery, clients)
- `services/file-service/src/apps/` (files)
- `services/frontend-service/src/` (Next.js structure)
- `services/shared/core/` (BaseModel, clients)
- `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`
- `nginx/conf.d/api-gateway.conf`

---

### **Task 1.2: Database & Infrastructure Setup**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 2-3 hours

**What to do:**
- Set up PostgreSQL 16 in Docker Compose (shared database)
- Set up Redis in Docker Compose (cache and queue)
- Configure database connection for all services
- Set up PgBouncer (connection pooling) - optional for MVP
- Test database connection from each service
- Configure Redis connection for caching and Celery

**Tech Stack:**
- PostgreSQL 16 (shared database)
- Redis 7 (cache, queue, channel layer)
- PgBouncer (optional)
- Django ORM (each service)

**Connections:**
- Connects to: All service settings
- Required for: All models, migrations, caching, queues

**Configuration:**
- Update `DATABASES` in each service's Django settings
- Update `CACHES` and `CELERY_BROKER_URL` in each service
- Create `.env.example` files with database credentials
- Configure Docker Compose volumes for data persistence

**Spec Kit Usage:**
1. **Create Feature:** `.specify/scripts/powershell/create-new-feature.ps1 "Database Infrastructure Setup"`
2. **Fill spec.md:** Copy "What to do", "Tech Stack", and "Configuration" sections above
3. **Use Prompt in Cursor Chat:**
   ```
   /speckit.specify "Task 1.2: Set up PostgreSQL 16 and Redis 7 in Docker Compose for HDMS microservices. Configure database connections for all 5 Django services (user-service, ticket-service, communication-service, file-service). Set up Redis for caching (port 6379/0), Celery broker (port 6379/2), and Django Channels (port 6379/1). Update DATABASES, CACHES, and CELERY_BROKER_URL in each service's Django settings. Add health checks and test connections from each service. Configure Docker Compose volumes for data persistence."
   ```
4. **Generate Plan:** `/speckit.plan`
5. **Generate Tasks:** `/speckit.tasks`
6. **Implement:** `/speckit.implement` or follow tasks.md manually

---

### **Task 1.3: Shared BaseModel & Core Utilities**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 2-3 hours

**Status:** ✅ **VERIFY** - BaseModel already exists in `services/shared/core/models.py`. Verify it has all required features.

**What to do:**
- Create `BaseModel` abstract class in `services/shared/core/models.py`
- Include UUID primary key, soft delete, timestamps
- Create `SoftDeleteManager` and `SoftDeleteQuerySet`
- Create shared HTTP client utilities for inter-service communication
- Set up logging configuration for each service
- Configure each service to import from shared code

**Tech Stack:**
- Django models
- Python uuid module
- Django utils
- HTTP client libraries (requests or httpx)

**Connections:**
- Connects to: All models (they inherit from BaseModel)
- Required for: All database models across all services
- Shared code used by all services

**Files to create:**
- `services/shared/core/models.py` (BaseModel)
- `services/shared/core/clients.py` (HTTP client utilities)
- Update each service's `INSTALLED_APPS` to include shared code path

**Spec Kit Usage:**
1. **Create Feature:** `.specify/scripts/powershell/create-new-feature.ps1 "Shared BaseModel Core Utilities"`
2. **Fill spec.md:** Copy "What to do", "Tech Stack", and "Files to create" sections above
3. **Use Prompt in Cursor Chat:**
   ```
   /speckit.specify "Task 1.3: Create shared BaseModel abstract class in services/shared/core/models.py with UUID primary key, soft delete functionality (is_deleted, deleted_at), timestamps (created_at, updated_at), SoftDeleteManager and SoftDeleteQuerySet. Create shared HTTP client utilities in services/shared/core/clients.py for inter-service communication. Configure each Django service to import from shared code. Set up logging configuration for each service."
   ```
4. **Generate Plan:** `/speckit.plan`
5. **Generate Tasks:** `/speckit.tasks`
6. **Implement:** `/speckit.implement` or follow tasks.md manually

---

## **🗄️ PHASE 2: DATABASE & MODELS**

### **Task 2.1: User Model**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 3-4 hours

**What to do:**
- Create User model inheriting from BaseModel
- Add employee_code (unique, pattern validation)
- Add role field (requestor, moderator, assignee, admin)
- Add is_ceo flag
- Add department ForeignKey
- Add SMS sync fields (sms_user_id, last_sms_sync)
- Create custom authentication backend
- Add indexes

**Tech Stack:**
- Django models
- Django authentication
- Custom validators

**Connections:**
- Connects to: Department model, Authentication system
- Required for: All other models (ForeignKeys)

**Files to create:**
- `backend/apps/users/models.py`
- `backend/apps/users/validators.py` (employee_code pattern)

---

### **Task 2.2: Department Model**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 2 hours

**What to do:**
- Create Department model inheriting from BaseModel
- Add name, code (unique)
- Add head (ForeignKey to User)
- Add active_tickets count (real-time)
- Add total_capacity
- Add queue_enabled flag
- Add indexes

**Tech Stack:**
- Django models

**Connections:**
- Connects to: User model
- Required for: Ticket assignment, User department assignment

**Files to create:**
- `backend/apps/departments/models.py`

---

### **Task 2.3: Ticket Model**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 4-5 hours

**What to do:**
- Create Ticket model inheriting from BaseModel
- Add FSMField for status (django-fsm)
- Add title, description, priority, category
- Add requestor, department, assignee (ForeignKeys)
- Add version field (for optimistic locking)
- Add reopen_count (max 3)
- Add due_at, requires_approval, postponement_reason
- Add FSM transition methods
- Add indexes (composite for common queries)

**Tech Stack:**
- Django models
- django-fsm (state machine)

**Connections:**
- Connects to: User, Department, SubTicket, ChatMessage, Attachment, Approval
- Required for: Core ticket functionality

**Files to create:**
- `backend/apps/tickets/models/ticket.py`
- Install: `pip install django-fsm`

---

### **Task 2.4: SubTicket Model**
**Priority:** 🟡 HIGH  
**Estimated Time:** 2-3 hours

**What to do:**
- Create SubTicket model inheriting from BaseModel
- Add parent_ticket (ForeignKey)
- Add department, assignee (ForeignKeys)
- Add status (FSMField - simplified)
- Add version, reopen_count
- Add FSM transition methods
- Add indexes

**Tech Stack:**
- Django models
- django-fsm

**Connections:**
- Connects to: Ticket, Department, User
- Required for: Multi-department ticket handling

**Files to create:**
- `backend/apps/tickets/models/sub_ticket.py`

---

### **Task 2.5: ChatMessage Model**
**Priority:** 🟡 HIGH  
**Estimated Time:** 2 hours

**What to do:**
- Create ChatMessage model inheriting from BaseModel
- Add ticket (ForeignKey)
- Add sender (ForeignKey to User)
- Add message (TextField)
- Add mentions (JSONField)
- Add attachments (reverse relation)
- Add indexes

**Tech Stack:**
- Django models
- PostgreSQL JSONField

**Connections:**
- Connects to: Ticket, User, Attachment
- Required for: Real-time chat

**Files to create:**
- `backend/apps/chat/models.py`

---

### **Task 2.6: Attachment Model**
**Priority:** 🟡 HIGH  
**Estimated Time:** 2-3 hours

**What to do:**
- Create Attachment model inheriting from BaseModel
- Add file_key (UUID)
- Add original_filename, file_size, mime_type, file_extension
- Add file_path (only set after scan)
- Add scan_status, scan_result, scanned_at
- Add is_processed, processed_at
- Add ticket, chat_message (nullable ForeignKeys)
- Add uploaded_by (ForeignKey)
- Add validation (either ticket OR chat_message)
- Add indexes

**Tech Stack:**
- Django models
- File storage (local initially)

**Connections:**
- Connects to: Ticket, ChatMessage, User
- Required for: File uploads

**Files to create:**
- `backend/apps/tickets/models/attachment.py`

---

### **Task 2.7: Notification Model**
**Priority:** 🟡 HIGH  
**Estimated Time:** 2 hours

**What to do:**
- Create Notification model inheriting from BaseModel
- Add user (ForeignKey - recipient)
- Add ticket (nullable ForeignKey)
- Add type (CharField with choices)
- Add title, message
- Add is_read, read_at
- Add metadata (JSONField)
- Add indexes (composite for unread notifications)

**Tech Stack:**
- Django models

**Connections:**
- Connects to: User, Ticket
- Required for: Real-time notifications

**Files to create:**
- `backend/apps/notifications/models.py`

---

### **Task 2.8: Approval Model**
**Priority:** 🟢 MEDIUM  
**Estimated Time:** 1-2 hours

**What to do:**
- Create Approval model inheriting from BaseModel
- Add ticket (ForeignKey)
- Add approver (ForeignKey to User - CEO/Finance)
- Add status (pending, approved, rejected)
- Add reason, documents (JSONField)
- Add indexes

**Tech Stack:**
- Django models

**Connections:**
- Connects to: Ticket, User
- Required for: Financial approval workflow

**Files to create:**
- `backend/apps/approvals/models.py`

---

### **Task 2.9: AuditLog Model**
**Priority:** 🟡 HIGH  
**Estimated Time:** 2-3 hours

**What to do:**
- Create AuditLog model inheriting from BaseModel
- Add action_type (CREATE, UPDATE, DELETE, REOPEN)
- Add category (TICKET, USER, DEPARTMENT, etc.)
- Add model_name, object_id (UUID)
- Add ticket_id, user_id (nullable ForeignKeys)
- Add old_state, new_state, changes (JSONFields)
- Add reason, timestamp, ip_address
- Make model immutable (no updates/deletes)
- Add indexes (composite for filtering)

**Tech Stack:**
- Django models
- PostgreSQL JSONField

**Connections:**
- Connects to: All models (via signals/middleware)
- Required for: Audit trail

**Files to create:**
- `backend/apps/audit/models.py`

---

### **Task 2.10: TicketParticipant Model**
**Priority:** 🟢 MEDIUM  
**Estimated Time:** 1 hour

**What to do:**
- Create TicketParticipant model (junction table)
- Add ticket, user (ForeignKeys)
- Add joined_at timestamp
- Add unique constraint (ticket, user)
- Add indexes

**Tech Stack:**
- Django models

**Connections:**
- Connects to: Ticket, User
- Required for: Chat participants tracking

**Files to create:**
- `backend/apps/tickets/models/participant.py`

---

### **Task 2.11: SLATemplate Model**
**Priority:** 🟢 MEDIUM  
**Estimated Time:** 1 hour

**What to do:**
- Create SLATemplate model inheriting from BaseModel
- Add name, priority, due_delta (days)
- Add is_active, created_by
- Add indexes

**Tech Stack:**
- Django models

**Connections:**
- Connects to: Ticket (for SLA calculation)
- Required for: SLA tracking

**Files to create:**
- `backend/apps/tickets/models/sla_template.py`

---

### **Task 2.12: Initial Migrations**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 1-2 hours

**What to do:**
- Run `makemigrations` for all apps
- Review migration files
- Test migrations in dev environment
- Create migration rollback plan
- Document migration order

**Tech Stack:**
- Django migrations
- PostgreSQL

**Connections:**
- Connects to: All models
- Required for: Database schema creation

**Commands:**
- `python manage.py makemigrations`
- `python manage.py migrate`

---

## **🔐 PHASE 3: AUTHENTICATION & USERS**

### **Task 3.1: JWT Authentication Setup**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 3-4 hours

**What to do:**
- Install djangorestframework-simplejwt
- Configure JWT settings (access/refresh tokens)
- Create custom User authentication backend
- Create login/logout/refresh endpoints
- Add rate limiting on login (10/min)
- Test authentication flow

**Tech Stack:**
- Django Ninja
- djangorestframework-simplejwt
- Redis (for rate limiting)

**Connections:**
- Connects to: User model
- Required for: All protected endpoints

**Files to create:**
- `backend/apps/users/api.py` (auth endpoints)
- `backend/core/middleware/rate_limiting.py`

---

### **Task 3.2: User Management APIs**
**Priority:** 🟡 HIGH  
**Estimated Time:** 2-3 hours

**What to do:**
- Create user profile endpoint
- Create user list endpoint (Admin only)
- Create user update endpoint
- Add role-based permissions
- Add employee code validation

**Tech Stack:**
- Django Ninja
- Pydantic schemas

**Connections:**
- Connects to: User model, Authentication
- Required for: User management

**Files to create:**
- `backend/apps/users/schemas.py`
- Update `backend/apps/users/api.py`

---

### **Task 3.3: SMS Integration Setup**
**Priority:** 🟢 MEDIUM  
**Estimated Time:** 2-3 hours

**What to do:**
- Create SMS sync client
- Create sync task (Celery)
- Add employee code validation from SMS
- Test sync functionality

**Tech Stack:**
- Django
- Celery
- SMS API client

**Connections:**
- Connects to: User model, External SMS system
- Required for: User data sync

**Files to create:**
- `backend/apps/integrations/sms_sync/client.py`
- `backend/apps/integrations/sms_sync/tasks.py`

---

## **🎫 PHASE 4: CORE TICKET SYSTEM**

### **Task 4.1: Ticket CRUD APIs**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 4-5 hours

**What to do:**
- Create ticket creation endpoint
- Create ticket list endpoint (with filters)
- Create ticket detail endpoint
- Create ticket update endpoint
- Add version validation (optimistic locking)
- Add role-based permissions
- Add pagination

**Tech Stack:**
- Django Ninja
- Pydantic schemas
- Django ORM

**Connections:**
- Connects to: Ticket model, User, Department
- Required for: Core ticket functionality

**Files to create:**
- `backend/apps/tickets/api/routes.py`
- `backend/apps/tickets/schemas.py`

---

### **Task 4.2: Ticket Status Transitions**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 3-4 hours

**What to do:**
- Implement FSM transition methods
- Add status change endpoint
- Add version increment on reopen only
- Add reopen limit validation (max 3)
- Add transaction boundaries
- Add audit logging

**Tech Stack:**
- django-fsm
- Django transactions
- Audit middleware

**Connections:**
- Connects to: Ticket model, AuditLog
- Required for: Ticket lifecycle

**Files to update:**
- `backend/apps/tickets/models/ticket.py` (FSM methods)
- `backend/apps/tickets/api/routes.py` (status endpoints)

---

### **Task 4.3: Ticket Assignment**
**Priority:** 🟡 HIGH  
**Estimated Time:** 2-3 hours

**What to do:**
- Create assign ticket endpoint
- Add department capacity check
- Add queue system (if capacity exceeded)
- Update department active_tickets count
- Send notifications

**Tech Stack:**
- Django Ninja
- Django ORM
- Notifications service

**Connections:**
- Connects to: Ticket, Department, User, Notifications
- Required for: Ticket assignment workflow

**Files to create:**
- `backend/apps/tickets/services/assignment_service.py`

---

### **Task 4.4: SubTicket Management**
**Priority:** 🟡 HIGH  
**Estimated Time:** 3-4 hours

**What to do:**
- Create sub-ticket creation endpoint (Moderator only)
- Create sub-ticket list endpoint
- Add sub-ticket status transitions
- Add moderator notifications on status change
- Add version increment on reopen

**Tech Stack:**
- Django Ninja
- django-fsm
- Notifications

**Connections:**
- Connects to: SubTicket, Ticket, Notifications
- Required for: Multi-department tickets

**Files to create:**
- `backend/apps/tickets/services/subticket_service.py`

---

## **💬 PHASE 5: REAL-TIME FEATURES**

### **Task 5.1: Django Channels Setup**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 3-4 hours

**What to do:**
- Install Django Channels
- Configure ASGI application
- Set up Redis channel layer
- Configure WebSocket routing
- Test WebSocket connection

**Tech Stack:**
- Django Channels
- Redis
- ASGI server (Daphne/Uvicorn)

**Connections:**
- Connects to: Redis, Django settings
- Required for: Real-time chat and notifications

**Files to create:**
- Update `backend/core/asgi.py`
- `backend/apps/chat/routing.py`

---

### **Task 5.2: WebSocket Authentication**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 2-3 hours

**What to do:**
- Implement JWT validation in WebSocket connect
- Add subprotocol header support
- Add permission checks (ticket access)
- Handle connection rejection
- Test authentication

**Tech Stack:**
- Django Channels
- JWT validation

**Connections:**
- Connects to: JWT authentication, User model
- Required for: Secure WebSocket connections

**Files to create:**
- `backend/apps/chat/consumers.py` (connect method)

---

### **Task 5.3: Chat Consumer Implementation**
**Priority:** 🟡 HIGH  
**Estimated Time:** 4-5 hours

**What to do:**
- Create chat consumer (connect, disconnect, receive)
- Implement room/channel groups per ticket
- Add message saving
- Add mention parsing
- Add typing indicators
- Broadcast messages to room
- Handle participant joins/leaves

**Tech Stack:**
- Django Channels
- Redis pub/sub
- PostgreSQL

**Connections:**
- Connects to: ChatMessage, Ticket, User, TicketParticipant
- Required for: Real-time chat

**Files to create:**
- `backend/apps/chat/consumers.py`
- `backend/apps/chat/services.py`

---

### **Task 5.4: Notification System**
**Priority:** 🟡 HIGH  
**Estimated Time:** 3-4 hours

**What to do:**
- Create notification service
- Add notification creation on events
- Add WebSocket push for notifications
- Create notification list endpoint
- Add mark as read endpoint
- Add notification types enum

**Tech Stack:**
- Django Channels
- Django Ninja
- Celery (for scheduled notifications)

**Connections:**
- Connects to: Notification model, WebSocket, Ticket events
- Required for: User notifications

**Files to create:**
- `backend/apps/notifications/services.py`
- `backend/apps/notifications/api.py`
- `backend/apps/notifications/tasks.py` (Celery)

---

## **📎 PHASE 6: FILE MANAGEMENT**

### **Task 6.1: File Upload Endpoint**
**Priority:** 🟡 HIGH  
**Estimated Time:** 3-4 hours

**What to do:**
- Create file upload endpoint
- Add file size validation (500MB server, 250MB frontend)
- Add MIME type validation
- Add file extension whitelist
- Save to temporary location
- Return file_key immediately

**Tech Stack:**
- Django Ninja
- File storage (local)
- Pydantic validation

**Connections:**
- Connects to: Attachment model, Ticket/ChatMessage
- Required for: File attachments

**Files to create:**
- `backend/apps/tickets/api/upload.py`

---

### **Task 6.2: Antivirus Scanning**
**Priority:** 🟡 HIGH  
**Estimated Time:** 3-4 hours

**What to do:**
- Set up antivirus engine (ClamAV or similar)
- Create Celery task for scanning
- Add scan status tracking
- Move to permanent storage if clean
- Delete if infected
- Notify user of scan result

**Tech Stack:**
- Celery
- Antivirus engine (ClamAV)
- File storage

**Connections:**
- Connects to: Attachment model, Celery, File storage
- Required for: File security

**Files to create:**
- `backend/apps/tickets/tasks/scan_file.py`

---

### **Task 6.3: File Processing**
**Priority:** 🟢 MEDIUM  
**Estimated Time:** 3-4 hours

**What to do:**
- Create image conversion task (WebP)
- Create video transcoding task (MP4)
- Add processing status tracking
- Update attachment model after processing

**Tech Stack:**
- Celery
- Pillow (for images)
- FFmpeg (for videos)

**Connections:**
- Connects to: Attachment model, Celery
- Required for: File optimization

**Files to create:**
- `backend/apps/tickets/tasks/process_file.py`

---

## **⚙️ PHASE 7: ADVANCED FEATURES**

### **Task 7.1: Approval Workflow**
**Priority:** 🟢 MEDIUM  
**Estimated Time:** 3-4 hours

**What to do:**
- Create approval request endpoint (Finance only)
- Create approval decision endpoint (CEO/Finance)
- Add approval status checks
- Block ticket progression until approved
- Send notifications

**Tech Stack:**
- Django Ninja
- FSM integration

**Connections:**
- Connects to: Approval model, Ticket, User (CEO)
- Required for: Financial approvals

**Files to create:**
- `backend/apps/approvals/api.py`
- `backend/apps/approvals/services.py`

---

### **Task 7.2: SLA Tracking**
**Priority:** 🟢 MEDIUM  
**Estimated Time:** 2-3 hours

**What to do:**
- Create SLA calculation service
- Add due_at calculation from templates
- Add SLA breach detection
- Create SLA reports endpoint

**Tech Stack:**
- Django ORM
- Date/time calculations

**Connections:**
- Connects to: SLATemplate, Ticket
- Required for: SLA monitoring

**Files to create:**
- `backend/apps/tickets/services/sla_service.py`

---

### **Task 7.3: Audit Logging Middleware**
**Priority:** 🟡 HIGH  
**Estimated Time:** 3-4 hours

**What to do:**
- Create audit middleware
- Hook into model save/delete signals
- Log all database changes
- Add IP address tracking
- Add categorization
- Make logs immutable

**Tech Stack:**
- Django signals
- Django middleware

**Connections:**
- Connects to: All models, AuditLog
- Required for: Audit trail

**Files to create:**
- `backend/apps/audit/middleware.py`
- `backend/apps/audit/signals.py`

---

### **Task 7.4: Caching Implementation**
**Priority:** 🟢 MEDIUM  
**Estimated Time:** 2-3 hours

**What to do:**
- Set up Redis caching
- Implement Cache-Aside pattern
- Add cache keys for common queries
- Add cache invalidation on updates
- Set TTLs (30-60s dynamic, 1h static)

**Tech Stack:**
- Redis
- Django cache framework

**Connections:**
- Connects to: All read-heavy endpoints
- Required for: Performance

**Files to create:**
- `backend/core/cache.py`
- Update services with cache decorators

---

### **Task 7.5: Rate Limiting**
**Priority:** 🟡 HIGH  
**Estimated Time:** 2-3 hours

**What to do:**
- Implement Token Bucket algorithm
- Add role-based limits (requestor: 150/min, Assignee: 250/min)
- Add login endpoint limit (10/min)
- Add rate limit headers
- Return 429 on limit exceeded

**Tech Stack:**
- Redis
- Django middleware

**Connections:**
- Connects to: All API endpoints
- Required for: API protection

**Files to create:**
- `backend/core/middleware/rate_limiting.py`

---

### **Task 7.6: Celery Setup**
**Priority:** 🟡 HIGH  
**Estimated Time:** 2-3 hours

**What to do:**
- Install Celery
- Configure Redis broker
- Set up task queues (high/low priority)
- Create scheduled tasks (reminders, auto-close)
- Set up Celery Flower (monitoring)

**Tech Stack:**
- Celery
- Redis
- Celery Flower

**Connections:**
- Connects to: Redis, All background tasks
- Required for: Async tasks

**Files to create:**
- `backend/core/celery.py`
- `backend/apps/tickets/tasks.py`
- `backend/apps/notifications/tasks.py`

---

## **🎨 PHASE 8: FRONTEND SETUP**

### **Task 8.1: Next.js Project Setup**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 2-3 hours

**What to do:**
- Create Next.js 15 project with TypeScript
- Install Tailwind CSS, ShadCN/UI
- Set up folder structure (app, components, services, etc.)
- Configure environment variables
- Set up API client (Axios)

**Tech Stack:**
- Next.js 15
- TypeScript
- Tailwind CSS
- ShadCN/UI
- Axios

**Connections:**
- Connects to: Backend API
- Required for: Frontend development

**Files to create:**
- `frontend/` structure
- `frontend/services/api/axiosClient.ts`

---

### **Task 8.2: Authentication Flow**
**Priority:** 🔴 CRITICAL  
**Estimated Time:** 3-4 hours

**What to do:**
- Create login page
- Implement JWT token storage
- Create auth store (Zustand)
- Add token refresh logic
- Add protected route guards
- Create logout functionality

**Tech Stack:**
- Next.js
- Zustand
- JWT tokens

**Connections:**
- Connects to: Backend auth API
- Required for: User authentication

**Files to create:**
- `frontend/app/(auth)/login/page.tsx`
- `frontend/store/authStore.ts`
- `frontend/hooks/useAuth.ts`

---

### **Task 8.3: WebSocket Client Setup**
**Priority:** 🟡 HIGH  
**Estimated Time:** 2-3 hours

**What to do:**
- Create WebSocket client (Django Channels compatible)
- Add connection management
- Add reconnection logic
- Add event handlers
- Create socket store (Zustand)

**Tech Stack:**
- Native WebSocket API
- Zustand

**Connections:**
- Connects to: Django Channels backend
- Required for: Real-time features

**Files to create:**
- `frontend/services/socket/socketClient.ts`
- `frontend/hooks/useSocket.ts`

---

## **🧪 PHASE 9: TESTING & DEPLOYMENT**

### **Task 9.1: Unit Tests**
**Priority:** 🟡 HIGH  
**Estimated Time:** 4-5 hours

**What to do:**
- Write model tests
- Write service tests
- Write API endpoint tests
- Achieve 80%+ coverage
- Set up pytest

**Tech Stack:**
- Pytest
- pytest-django

**Connections:**
- Connects to: All backend code
- Required for: Code quality

**Files to create:**
- `backend/apps/*/tests/`

---

### **Task 9.2: Integration Tests**
**Priority:** 🟢 MEDIUM  
**Estimated Time:** 3-4 hours

**What to do:**
- Write end-to-end workflow tests
- Test WebSocket connections
- Test file upload flow
- Test authentication flow

**Tech Stack:**
- Pytest
- Django test client

**Connections:**
- Connects to: Multiple components
- Required for: System reliability

---

### **Task 9.3: Performance Testing**
**Priority:** 🟢 MEDIUM  
**Estimated Time:** 2-3 hours

**What to do:**
- Load test API endpoints
- Stress test WebSocket connections
- Test database query performance
- Optimize slow queries

**Tech Stack:**
- Locust or Apache Bench
- Django Debug Toolbar

**Connections:**
- Connects to: All endpoints
- Required for: Performance validation

---

### **Task 9.4: Deployment Setup**
**Priority:** 🟡 HIGH  
**Estimated Time:** 4-5 hours

**What to do:**
- Set up production database
- Configure production settings
- Set up environment variables
- Configure static file serving
- Set up backup strategy
- Deploy to server

**Tech Stack:**
- PostgreSQL
- Nginx (optional)
- Server (Hostinger/internal)

**Connections:**
- Connects to: All components
- Required for: Production deployment

---

## **📊 SUMMARY: TASK PRIORITIES**

### **🔴 CRITICAL (Must do first):**
1. Project Structure Setup
2. Database Setup
3. BaseModel & Core Utilities
4. User Model
5. Department Model
6. Ticket Model
7. Initial Migrations
8. JWT Authentication Setup
9. Ticket CRUD APIs
10. Ticket Status Transitions
11. Django Channels Setup
12. WebSocket Authentication
13. Next.js Project Setup
14. Authentication Flow

### **🟡 HIGH (Important for MVP):**
1. SubTicket Model
2. ChatMessage Model
3. Attachment Model
4. Notification Model
5. AuditLog Model
6. User Management APIs
7. Ticket Assignment
8. SubTicket Management
9. Chat Consumer Implementation
10. Notification System
11. File Upload Endpoint
12. Antivirus Scanning
13. Audit Logging Middleware
14. Celery Setup
15. WebSocket Client Setup
16. Unit Tests
17. Deployment Setup

### **🟢 MEDIUM (Can do later):**
1. Approval Model
2. TicketParticipant Model
3. SLATemplate Model
4. SMS Integration Setup
5. File Processing
6. Approval Workflow
7. SLA Tracking
8. Caching Implementation
9. Rate Limiting
10. Integration Tests
11. Performance Testing

---

## **🔗 KEY CONNECTIONS MAP**

**Foundation → Everything:**
- BaseModel → All models
- Database → All models
- Authentication → All protected endpoints

**Core Flow:**
- User → Department → Ticket → SubTicket
- Ticket → ChatMessage → Attachment
- Ticket → Notification → WebSocket
- Ticket → Approval → User (CEO)

**Real-time:**
- WebSocket → ChatMessage → Notification
- Celery → Notifications → WebSocket

**Security:**
- Authentication → All APIs
- AuditLog → All models (via signals)
- File Upload → Antivirus → Attachment

---

**Last Updated:** December 2025  
**Next Review:** After Phase 1 completion

