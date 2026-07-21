# Help Desk Management System (HDMS) - Microservices Architecture

**Version:** 2.1  
**Last Updated:** December 17, 2025  
**Architecture:** Microservices with Docker

---

## **Quick Start**

### **Prerequisites**
- Docker Desktop installed and running
- Docker Compose v2.0+
- Python 3.12+ (for auth-service)
- Node.js 18+ (for frontend development)

### **Development Setup**

1. **Start auth-service (external):**
   ```bash
   cd d:\ERP\auth-service\src
   python manage.py runserver 8000
   ```

2. **Start infrastructure:**
   ```bash
   cd d:\ERP\HDMS
   docker-compose up -d postgres pgbouncer redis
   ```

3. **Start backend services:**
   ```bash
   docker-compose up -d ticket-service communication-service file-service
   ```

4. **Start frontend:**
   ```bash
   cd d:\ERP\HDMS\services\frontend-service
   npm run dev
   ```

### **Access Application**
- **Frontend:** http://localhost:3000
- **Auth Service:** http://localhost:8000
- **Ticket Service:** http://localhost:8002
- **Communication Service:** http://localhost:8003
- **File Service:** http://localhost:8005

For detailed setup, see [SETUP.md](SETUP.md)

---

## **Documentation Index**

### **Core Documentation**
- [01-Project-Charter.md](Docs/01-Project-Charter.md) - Project overview and goals
- [02-Roles-and-Permissions.md](Docs/02-Roles-and-Permissions.md) - Role definitions and permissions
- [03-Technical-Architecture.md](Docs/03-Technical-Architecture.md) - Technical stack and architecture
- [04-Ticket-Lifecycle.md](Docs/04-Ticket-Lifecycle.md) - Ticket status flows and lifecycle
- [05-Workflows-by-Role.md](Docs/05-Workflows-by-Role.md) - Role-based workflows
- [06-API-Specifications.md](Docs/06-API-Specifications.md) - API endpoints and schemas
- [07-Business-Rules.md](Docs/07-Business-Rules.md) - Business rules and constraints
- [08-Project-Deliverables.md](Docs/08-Project-Deliverables.md) - MVP deliverables

### **Database & Models**
- [09-Database-Design.md](Docs/09-Database-Design.md) - ERD and database design
- [10-Models-Decisions.md](Docs/10-Models-Decisions.md) - Model design decisions

### **Implementation**
- [11-Implementation-Task-List.md](Docs/11-Implementation-Task-List.md) - Priority-based task list
- [12-Microservices-Architecture.md](Docs/12-Microservices-Architecture.md) - Microservices architecture details
- [13-Database-Migration-Strategy.md](Docs/13-Database-Migration-Strategy.md) - Migration from monolith to microservices

### **Status**
- [CURRENT-STATUS.md](CURRENT-STATUS.md) - Current development status and priorities

---

## **Microservices Overview**

### **Active Services**
| Service | Port | Description |
|---------|------|-------------|
| **auth-service** | 8000 | Authentication, user/department management (External) |
| **ticket-service** | 8002 | Tickets, status transitions, audit logs |
| **communication-service** | 8003 | Chat, notifications (WebSocket pending) |
| **file-service** | 8005 | File uploads, attachments |
| **frontend-service** | 3000 | Next.js web application |

### **Deprecated**
| Service | Status |
|---------|--------|
| ~~user-service~~ | ❌ DEPRECATED - Use auth-service |

> **Note:** All user and department management is handled by **auth-service**. Do not use user-service.

### **Infrastructure**
- **Database:** PostgreSQL 16 (shared)
- **Connection Pooling:** PgBouncer
- **Cache/Queue:** Redis 7
- **Orchestration:** Docker Compose

---

## **Key Features**

### ✅ Working
- Microservices architecture with Docker
- JWT authentication via auth-service
- Role-based access (Requestor, Moderator, Assignee, Admin)
- Complete ticket lifecycle (FSM-based)
- Ticket assignment and progress tracking
- Audit logging
- PostgreSQL with PgBouncer connection pooling

### ⚠️ In Progress
- Real-time chat (WebSocket implementation pending)
- File attachments via file-service
- Chat UI/UX improvements
- Real-time notifications

### ⏳ Planned (Phase 2)
- Sub-ticket creation
- Approval workflow
- Dashboard analytics
- Email notifications
- CI/CD pipeline

---

## **Tech Stack**

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS
- **Backend:** Django 5, Django Ninja, Django Channels (pending)
- **Database:** PostgreSQL 16 + PgBouncer
- **Cache/Queue:** Redis 7
- **Containerization:** Docker, Docker Compose
- **State Machine:** django-fsm

---

## **Architecture Rules**

1. **user-service is deprecated** - Use auth-service for all user/department data
2. **All files through file-service** - Never store attachments in ticket-service
3. **UUID references** - No ForeignKeys across services
4. **PgBouncer** - Use for ticket-service and communication-service

---

## **Current Priority**

1. Chat UI/UX Improvements
2. WebSocket Implementation
3. File Service Integration
4. UI Polish and Bug Fixes

See [CURRENT-STATUS.md](CURRENT-STATUS.md) for detailed status.

---

**For detailed documentation, see individual documentation files in the [Docs](Docs/) folder.**
