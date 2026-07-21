# Project Deliverables

## **PROJECT DELIVERABLES — *Help Desk Management System (MVP)***

**Last Updated:** December 17, 2025

The deliverables represent the tangible system components to be developed, tested, and deployed during the MVP phase.

---

### **System Deliverables**

| Category | Deliverable | Description | Status |
| ----- | ----- | ----- | ----- |
| **1. Authentication Module** | Centralized Employee Login | Integration with auth-service for shared employee credentials. | ✅ Complete |
|  | Role & Access Control | Admin can authorize employees for HDMS access (requestor, moderator, assignee, admin). | ✅ Complete |
| **2. Ticketing System** | Ticket Creation & Tracking | Department-wise request creation with status updates. | ✅ Complete |
|  | Ticket Status Transitions | FSM-based status management (draft → submitted → ... → closed). | ✅ Complete |
|  | Ticket Assignment | Moderator can assign tickets to departments/assignees. | ✅ Complete |
|  | Progress Tracking | Assignees can update progress percentage. | ✅ Complete |
|  | Linked/Sub-Tickets | Support multi-department workflows under a single parent ticket. | ⏳ Phase 2 |
|  | Chat System | Discussion area for all users involved in a ticket. | ⚠️ HTTP only (WebSocket pending) |
|  | File Attachments | Upload supporting documents via file-service. | ⚠️ Integration pending |
| **3. Workflow Automation** | Approval Hierarchy | Configurable approval routes (Department Head → CEO → Accounts). | ⏳ Phase 2 |
|  | Ticket States & Transitions | Defined states: Draft, Submitted, Pending, Under_Review, Assigned, In_Progress, etc. | ✅ Complete |
| **4. Dashboard & Analytics** | Department Dashboard | Each department sees its open, pending, and resolved tickets. | ⚠️ Basic (needs polish) |
|  | CEO/Management Dashboard | Organization-level ticket overview and insights. | ⏳ Phase 2 |
| **5. Notification System** | Real-Time Alerts | Notify users on ticket updates, approvals, or assignments. | ⏳ WebSocket pending |
| **6. Integration Layer** | Auth Service Integration | Employee and department data from auth-service. | ✅ Complete |
|  | ~~SMS Integration API~~ | ~~Sync from external SMS system~~ | N/A (handled by auth-service) |
| **7. Deployment Setup** | Local Development | Docker Compose orchestration for all services. | ✅ Complete |
|  | Production Deployment | Cloud deployment configuration. | ⏳ Phase 2 |
| **8. Documentation** | Architecture Documentation | Microservices architecture and API documentation. | ✅ Complete |

---

### **Current MVP Status**

At the current stage, HDMS has a **functional core ticketing system** capable of:

* ✅ Handling ticket lifecycle from draft to closed
* ✅ Role-based access (requestor, moderator, assignee, admin)
* ✅ Ticket assignment and progress tracking
* ✅ Audit logging of all actions
* ⚠️ Chat messaging (HTTP-based, WebSocket pending)
* ⚠️ File attachments (file-service integration pending)

---

### **MVP Features Checklist**

#### **Core Features**
- [x] Role-based authentication (requestor, Moderator, Assignee, Admin)
- [x] Ticket creation and submission
- [x] Draft saving
- [x] Ticket assignment to departments
- [x] Status tracking and transitions (FSM)
- [x] Progress percentage updates
- [x] SLA/Due date management
- [x] Ticket acknowledgment
- [x] Audit logging
- [ ] Real-time chat system (WebSocket)
- [ ] File attachments via file-service
- [ ] Sub-ticket creation (Moderator only)
- [ ] Approval workflow (Finance → CEO)
- [ ] Postponement with reminders
- [ ] Auto-close functionality
- [ ] Reopen capability (max 2 times)
- [ ] Real-time notifications

#### **Dashboard Features**
- [x] Department dashboard (basic)
- [ ] CEO/Management dashboard
- [ ] Personal analytics (requestor)
- [ ] Department metrics (Assignee)
- [ ] System-wide analytics (Admin/Moderator)

#### **Integration Features**
- [x] Auth-service authentication
- [x] Employee data from auth-service
- [x] Department data from auth-service

---

### **Out of Scope (Phase 2 and Later)**

These will be part of **Phase 2** or later versions:

* Sub-ticket creation and management
* Approval workflow (Finance/CEO)
* Postponement with automatic reminders
* Auto-close after 3 days
* AI-powered ticket classification and priority tagging
* SLA tracking and automated escalation
* Voice-based ticket interaction
* Requestor satisfaction surveys
* Organization-wide analytics dashboard
* Mobile application version
* Advanced reporting and exports
* Custom workflow builder
* Email notifications
* CI/CD pipeline

---

### **Technical Deliverables**

#### **Architecture**
- [x] Microservices architecture with Docker
- [x] 4 active services (auth-service, ticket-service, communication-service, file-service, frontend-service)
- [ ] ~~User-service~~ - **DEPRECATED** (use auth-service)
- [x] Shared PostgreSQL database (via PgBouncer)
- [x] Docker Compose orchestration
- [x] Shared BaseModel for consistency

#### **Frontend**
* Next.js 15 application with TypeScript
* Role-based routing and layouts
* Ticket list and detail views
* Chat interface (needs UI polish)
* Dashboard components (basic)
* Responsive design (needs improvement)

#### **Backend**
* Django 5 + Django Ninja API
* PostgreSQL database with PgBouncer connection pooling
* Django Channels for WebSockets (pending implementation)
* Celery for background tasks (pending)
* Redis for caching and queues
* django-fsm for state machine implementation
* Audit logging

#### **Infrastructure**
* Docker Compose for local development
* PostgreSQL 16 + PgBouncer
* Redis 7
* Environment-based configuration

---

### **Documentation Deliverables**

* ✅ Architecture documentation (Microservices Architecture)
* ✅ Database schema documentation
* ✅ Ticket lifecycle documentation
* ✅ Roles and permissions documentation
* ✅ Business rules documentation
* [ ] API documentation (OpenAPI/Swagger)
* [ ] Deployment guide
* [ ] User guides (per role)
* [ ] Developer onboarding guide

---

### **Priority for Next Sprint**

1. **Chat UI/UX Improvements**
   - Unified, responsive chat component
   - User-friendly message input
   - Consistent layout across all roles

2. **WebSocket Implementation**
   - Django Channels setup
   - Real-time chat messaging
   - Real-time notifications

3. **File Service Integration**
   - Route all attachment uploads through file-service
   - Remove file handling from ticket-service
   - UI integration for file uploads

4. **UI/UX Polish**
   - Fix known UI bugs
   - Consistent styling
   - Better loading states and error handling

---

### **Success Metrics (for Phase 1 Completion)**

The MVP will be considered successful if:

* ✅ Core ticket workflow operates end-to-end
* ✅ All status transitions work correctly
* ⏳ Real-time chat works via WebSocket
* ⏳ Attachments upload via file-service
* ⏳ UI is polished and user-friendly
* ⏳ All roles can complete their primary workflows

---

**Environment:** Local Development  
**CI/CD:** Not configured  
**Timeline:** ASAP
