# Microservices Architecture Documentation

**Version:** 2.0  
**Last Updated:** December 17, 2025  
**Purpose:** Complete microservices architecture guide for HDMS

---

## **Architecture Overview**

HDMS is built as a **microservices architecture** with Docker containerization. The system is divided into **4 active services** (user-service is deprecated).

> [!IMPORTANT]
> **user-service is DEPRECATED.** All user and department management is handled by **auth-service** (external to HDMS).

---

## **Service Breakdown**

### **1. Auth Service** (Port: 8000) - **EXTERNAL**
**Location:** `d:\ERP\auth-service`  
**Responsibility:** Authentication, user management, department management, HDMS access grants

**Features:**
- Employee authentication (employee_code + password)
- JWT token generation and refresh
- User CRUD (employees)
- Department CRUD
- HDMS role assignment (requestor, moderator, assignee, admin)

**APIs:**
- `/api/auth/login-hdms` - HDMS-specific login
- `/api/auth/refresh` - Token refresh
- `/api/employees/` - Employee management
- `/api/hdms/grant-access` - Grant HDMS access to employees

**Dependencies:** None (base service, external to HDMS)

---

### ~~**2. User Service** (Port: 8001) - DEPRECATED~~

> [!CAUTION]
> **DO NOT USE user-service.** It has been deprecated. All user and department management is handled by auth-service.

---

### **3. Ticket Service** (Port: 8002)
**Location:** `d:\ERP\HDMS\services\ticket-service`  
**Responsibility:** Ticket management, sub-tickets, approvals, SLA

**Models:**
- Ticket (with FSM)
- SubTicket
- Approval
- AuditLog

**APIs:**
- `/api/tickets/` - Ticket CRUD
- `/api/tickets/{id}/status` - Status transitions
- `/api/tickets/{id}/assign` - Assign ticket
- `/api/tickets/{id}/reject` - Reject ticket
- `/api/tickets/{id}/postpone` - Postpone ticket
- `/api/tickets/{id}/acknowledge` - Acknowledge assignment
- `/api/tickets/{id}/progress` - Update progress
- `/api/tickets/{id}/sla` - Update SLA/due date
- `/api/tickets/{id}/history` - Audit log

**Dependencies:**
- Auth Service (validate users, get user details)

**Database Connection:** Via PgBouncer (6432)

> [!WARNING]
> **DO NOT** store file attachments in ticket-service. All files MUST be uploaded through file-service.

---

### **4. Communication Service** (Port: 8003, WebSocket: 8004)
**Location:** `d:\ERP\HDMS\services\communication-service`  
**Responsibility:** Real-time chat, notifications, WebSocket handling

**Models:**
- ChatMessage
- Notification
- TicketParticipant

**APIs:**
- `/api/chat/{ticket_id}/messages/` - Get/send chat messages
- `/api/notifications/` - Notifications

**WebSocket (PENDING IMPLEMENTATION):**
- `ws://gateway/ws/chat/{ticket_id}/` - Real-time chat
- `ws://gateway/ws/notifications/` - Real-time notifications

**Dependencies:**
- Auth Service (get user details)
- Ticket Service (validate tickets)

**Database Connection:** Via PgBouncer (6432)

**Current Status:**
- ✅ HTTP-based messaging works
- ❌ WebSocket not implemented yet

---

### **5. File Service** (Port: 8005)
**Location:** `d:\ERP\HDMS\services\file-service`  
**Responsibility:** File uploads, antivirus scanning, file processing

**Models:**
- Attachment

**APIs:**
- `/api/files/upload/` - File upload
- `/api/files/{file_key}/` - File details
- `/api/files/{file_key}/download/` - File download
- `/api/files/{file_key}/status/` - Scan/processing status

**Dependencies:**
- Auth Service (validate users)
- Ticket Service (validate tickets, optional)

**Background Tasks:**
- Antivirus scanning (Celery) - future
- Image conversion to WebP (Celery) - future
- Video transcoding to MP4 (Celery) - future

> [!IMPORTANT]
> **ALL HDMS file attachments** (tickets, chat) MUST be processed and stored through file-service.

---

### **6. Frontend Service** (Port: 3000)
**Location:** `d:\ERP\HDMS\services\frontend-service`  
**Responsibility:** Next.js web application

**Configuration:**
- Calls backend services directly (local development)
- Calls API Gateway in production
- WebSocket connects through gateway (when implemented)

**Tech Stack:**
- Next.js 15
- TypeScript
- Tailwind CSS

---

## **Infrastructure Services**

### **PostgreSQL** (Port: 5432)
- Shared database for HDMS services
- Database: `hdms_db`
- Each service uses different table prefixes

### **PgBouncer** (Port: 6432)
- Connection pooling for PostgreSQL
- Used by: ticket-service, communication-service
- Pool mode: transaction

### **Redis** (Port: 6379)
- Database 0: Caching
- Database 1: Communication Service channel layer (Django Channels)
- Database 2: Celery broker (File Service)

### **Nginx API Gateway** (Port: 80) - Production Only
- Routes all API requests to appropriate services
- Handles WebSocket upgrades
- CORS configuration

---

## **Service Communication**

### **Synchronous Communication (REST)**
- Services communicate via HTTP REST APIs
- Auth-service provides user/department data
- JWT tokens passed in Authorization header

### **Service Endpoints (Development)**
```
Auth Service:    http://localhost:8000
Ticket Service:  http://localhost:8002
Comm Service:    http://localhost:8003
File Service:    http://localhost:8005
Frontend:        http://localhost:3000
```

### **Frontend API Calls**
- Frontend calls backend services via axios client
- Base URLs configured in environment variables
- Mock data fallback available for development

---

## **Database Strategy**

### **Current: Shared Database**
- All HDMS services use same PostgreSQL database
- Different table names per service
- UUID-based references (not ForeignKeys across services)

### **Table Ownership**
| Service | Tables |
|---------|--------|
| ticket-service | tickets, approvals, audit_logs |
| communication-service | chat_messages, notifications, ticket_participants |
| file-service | attachments |

### **Cross-Service References**
- Use UUID fields, not ForeignKeys
- Example: `requestor_id` (UUID) references auth-service user
- Example: `ticket_id` (UUID) in chat_messages references ticket-service

---

## **Development Setup**

### **Start Services**

```bash
# 1. Start auth-service (external)
cd d:\ERP\auth-service\src
python manage.py runserver 8000

# 2. Start infrastructure
cd d:\ERP\HDMS
docker-compose up -d postgres pgbouncer redis

# 3. Start backend services
docker-compose up -d ticket-service communication-service file-service

# 4. Start frontend
cd d:\ERP\HDMS\services\frontend-service
npm run dev
```

### **Run Migrations**
```bash
# Ticket Service
docker-compose exec ticket-service python manage.py migrate

# Communication Service
docker-compose exec communication-service python manage.py migrate

# File Service
docker-compose exec file-service python manage.py migrate
```

---

## **Environment Variables**

See [environment-variables.md](environment-variables.md) for complete list.

Key variables:
- `DATABASE_URL` - PostgreSQL connection
- `PGBOUNCER_URL` - PgBouncer connection
- `REDIS_URL` - Redis connection
- `AUTH_SERVICE_URL` - Auth service base URL
- `JWT_SECRET_KEY` - JWT secret (must match auth-service)

---

## **File Structure**

```
d:\ERP\
├── auth-service/           # External auth service
│   └── src/
│       ├── authentication/ # JWT, login
│       ├── employees/      # User management
│       └── permissions/    # HDMS access grants
│
└── HDMS/
    ├── services/
    │   ├── ticket-service/
    │   │   └── src/
    │   │       └── apps/
    │   │           ├── tickets/    # Ticket CRUD, FSM
    │   │           ├── approvals/  # Approval workflow
    │   │           └── audit/      # Audit logging
    │   │
    │   ├── communication-service/
    │   │   └── src/
    │   │       └── apps/
    │   │           ├── chat/          # Chat messages
    │   │           └── notifications/ # Notifications
    │   │
    │   ├── file-service/
    │   │   └── src/
    │   │       └── apps/
    │   │           └── files/     # Attachments
    │   │
    │   ├── frontend-service/
    │   │   └── src/
    │   │       ├── app/           # Next.js pages
    │   │       ├── components/    # React components
    │   │       └── services/api/  # API clients
    │   │
    │   └── shared/               # Shared code
    │       └── core/
    │           ├── models.py     # BaseModel
    │           └── clients.py    # HTTP clients
    │
    │   ~~├── user-service/~~     # DEPRECATED
    │
    └── Docs/                     # Documentation
```

---

## **Key Architecture Rules**

1. **No user-service** - Use auth-service for all user/department data
2. **All files through file-service** - Never store attachments elsewhere
3. **UUID references** - No ForeignKeys across services
4. **PgBouncer for pooling** - ticket-service and communication-service use PgBouncer
5. **Auth via auth-service** - All authentication flows through external auth-service

---

**Last Updated:** December 17, 2025
