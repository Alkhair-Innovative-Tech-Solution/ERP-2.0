# Database Design

## **Database Design — Help Desk Management System**

**Version:** 1.0  
**Prepared by:** Development Team  
**Date:** December 2025  
**Last Updated:** December 2025

---

## **1. Purpose of This Document**

This document provides a comprehensive database design for the Help Desk Management System (HDMS), including Entity Relationship Diagrams (ERD), model relationships, database indexes, and migration strategy.

**Note:** HDMS uses a **microservices architecture** with a **shared PostgreSQL database** (initially). All services (User Service, Ticket Service, Communication Service, File Service) connect to the same database instance. This allows for simpler MVP deployment while maintaining the flexibility to migrate to database-per-service architecture in the future if needed.

**Database Connection:**
- All services connect to the same PostgreSQL instance via connection string
- PgBouncer is used for connection pooling
- UUID-based primary keys are used for all models to enable future database-per-service migration
- Foreign key relationships exist within the shared database
- For detailed migration strategy, see [13-Database-Migration-Strategy.md](../13-Database-Migration-Strategy.md)

---

## **2. Entity Relationship Diagram (ERD)**

### **2.1 Complete ERD Overview**

```mermaid
erDiagram
    User ||--o{ Ticket : creates
    User ||--o{ Ticket : assigned_to
    User }o--o{ Department : belongs_to
    User ||--o{ ChatMessage : sends
    User ||--o{ Notification : receives
    User ||--o{ TicketParticipant : participates
    User ||--o{ Approval : requests
    User ||--o{ Approval : approves
    User ||--o{ AuditLog : performs
    
    Department ||--o{ Ticket : receives
    Department ||--o{ User : contains
    Department ||--o{ SubTicket : receives
    
    Ticket ||--o{ SubTicket : has
    Ticket ||--o{ Attachment : contains
    Ticket ||--o{ ChatMessage : contains
    Ticket ||--o{ TicketParticipant : has
    Ticket ||--o{ Approval : requires
    Ticket ||--o{ TicketAuditLog : tracks
    Ticket ||--o{ Notification : generates
    
    SubTicket }o--|| Ticket : parent
    SubTicket }o--|| Department : assigned_to
    
    ChatMessage }o--|| Ticket : belongs_to
    ChatMessage }o--|| User : sent_by
    
    TicketParticipant }o--|| Ticket : belongs_to
    TicketParticipant }o--|| User : user
    
    Attachment }o--|| Ticket : attached_to
    
    Approval }o--|| Ticket : for_ticket
    Approval }o--|| User : requested_by
    Approval }o--|| User : approved_by
    
    Notification }o--|| User : for_user
    Notification }o--o| Ticket : related_to
    
    AuditLog }o--o| User : performed_by
    AuditLog }o--o| Ticket : related_to
    
    SLATemplate ||--o{ Ticket : defines
```

### **2.2 Core Entities Detail**

#### **User Entity**
- **Primary Key:** `id` (UUID)
- **Unique Constraints:** `employee_code` (unique)
- **Service:** User Service
- **Relationships:**
  - One-to-Many: Creates tickets (requestor)
  - One-to-Many: Assigned tickets (assignee)
  - Many-to-One: Belongs to Department
  - One-to-Many: Sends chat messages
  - One-to-Many: Receives notifications
  - Many-to-Many: Participates in tickets (via TicketParticipant)
  - One-to-Many: Requests approvals
  - One-to-Many: Approves requests
  - One-to-Many: Performs audit actions

#### **Department Entity**
- **Primary Key:** `id` (UUID)
- **Service:** User Service
- **Relationships:**
  - One-to-Many: Receives tickets
  - One-to-Many: Contains users
  - One-to-Many: Receives sub-tickets

#### **Ticket Entity**
- **Primary Key:** `id` (UUID)
- **Service:** Ticket Service
- **Relationships:**
  - Many-to-One: Created by User (requestor)
  - Many-to-One: Assigned to User (assignee/department head)
  - Many-to-One: Assigned to Department
  - One-to-Many: Has sub-tickets
  - One-to-Many: Has attachments
  - One-to-Many: Has chat messages
  - One-to-Many: Has participants (via TicketParticipant)
  - One-to-Many: Requires approvals
  - One-to-Many: Has audit logs
  - One-to-Many: Generates notifications

#### **SubTicket Entity**
- **Primary Key:** `id` (Auto-increment Integer)
- **Relationships:**
  - Many-to-One: Parent ticket
  - Many-to-One: Assigned to Department

#### **ChatMessage Entity**
- **Primary Key:** `id` (Auto-increment Integer)
- **Relationships:**
  - Many-to-One: Belongs to Ticket
  - Many-to-One: Sent by User

#### **TicketParticipant Entity (Junction Table)**
- **Primary Key:** `id` (Auto-increment Integer)
- **Composite Unique:** `(ticket_id, user_id)`
- **Relationships:**
  - Many-to-One: Belongs to Ticket
  - Many-to-One: User participant

#### **Attachment Entity**
- **Primary Key:** `id` (Auto-increment Integer)
- **Relationships:**
  - Many-to-One: Attached to Ticket

#### **Approval Entity**
- **Primary Key:** `id` (Auto-increment Integer)
- **Relationships:**
  - Many-to-One: For Ticket
  - Many-to-One: Requested by User (Finance Assignee)
  - Many-to-One: Approved by User (CEO/Finance)

#### **Notification Entity**
- **Primary Key:** `id` (Auto-increment Integer)
- **Relationships:**
  - Many-to-One: For User
  - Many-to-One: Related to Ticket (optional)

#### **AuditLog Entity**
- **Primary Key:** `id` (Auto-increment Integer)
- **Relationships:**
  - Many-to-One: Performed by User
  - Many-to-One: Related to Ticket (optional)

#### **SLATemplate Entity**
- **Primary Key:** `id` (Auto-increment Integer)
- **Relationships:**
  - One-to-Many: Defines SLA for Tickets

---

## **3. Model Relationships Documentation**

### **3.1 Foreign Key Relationships**

#### **User Model**
- `department` → ForeignKey to Department (nullable, related_name='members')
- Cascade: SET_NULL on department deletion

#### **Department Model**
- No foreign keys (top-level entity)

#### **Ticket Model**
- `requestor` → ForeignKey to User (related_name='created_tickets', CASCADE)
- `assignee` → ForeignKey to User (nullable, related_name='assigned_tickets', SET_NULL)
- `department` → ForeignKey to Department (related_name='tickets', PROTECT)
- `sla_template` → ForeignKey to SLATemplate (nullable, related_name='tickets', SET_NULL)

#### **SubTicket Model**
- `parent_ticket` → ForeignKey to Ticket (related_name='sub_tickets', CASCADE)
- `department` → ForeignKey to Department (related_name='sub_tickets', PROTECT)

#### **ChatMessage Model**
- `ticket` → ForeignKey to Ticket (related_name='messages', CASCADE)
- `sender` → ForeignKey to User (related_name='sent_messages', CASCADE)

#### **TicketParticipant Model**
- `ticket` → ForeignKey to Ticket (related_name='participants', CASCADE)
- `user` → ForeignKey to User (related_name='ticket_participations', CASCADE)
- UniqueConstraint: `('ticket', 'user')`

#### **Attachment Model**
- `ticket` → ForeignKey to Ticket (related_name='attachments', CASCADE)
- `uploaded_by` → ForeignKey to User (related_name='uploaded_attachments', CASCADE)

#### **Approval Model**
- `ticket` → ForeignKey to Ticket (related_name='approvals', CASCADE)
- `requested_by` → ForeignKey to User (related_name='requested_approvals', CASCADE)
- `approved_by` → ForeignKey to User (nullable, related_name='approved_requests', SET_NULL)

#### **Notification Model**
- `user` → ForeignKey to User (related_name='notifications', CASCADE)
- `ticket` → ForeignKey to Ticket (nullable, related_name='notifications', SET_NULL)

#### **AuditLog Model**
- `user` → ForeignKey to User (nullable, related_name='audit_actions', SET_NULL)
- `ticket` → ForeignKey to Ticket (nullable, related_name='audit_logs', SET_NULL)

### **3.2 Cascade Behaviors**

| Relationship | On Delete Behavior | Rationale |
|--------------|-------------------|-----------|
| User → Tickets (requestor) | CASCADE | If user deleted, their tickets should be soft-deleted |
| User → Tickets (assignee) | SET_NULL | Preserve ticket, just remove assignee |
| Department → Tickets | PROTECT | Prevent deletion if tickets exist |
| Ticket → SubTickets | CASCADE | If parent deleted, children should be deleted |
| Ticket → ChatMessages | CASCADE | Messages belong to ticket |
| Ticket → Attachments | CASCADE | Attachments belong to ticket |
| Ticket → Approvals | CASCADE | Approvals belong to ticket |
| User → Notifications | CASCADE | Notifications belong to user |
| User → AuditLogs | SET_NULL | Preserve audit trail even if user deleted |

### **3.3 Related Name Conventions**

All ForeignKey relationships use explicit `related_name`:
- Pattern: `{model_name_lowercase}_set` or descriptive name
- Examples:
  - `User.created_tickets` (tickets where user is requestor)
  - `User.assigned_tickets` (tickets where user is assignee)
  - `Ticket.sub_tickets` (child tickets)
  - `Ticket.messages` (chat messages)
  - `Ticket.participants` (via TicketParticipant)

---

## **4. Database Indexes**

### **4.1 Index Strategy**

Indexes are defined in model `Meta` classes for optimal query performance.

### **4.2 User Model Indexes**

```python
class Meta:
    indexes = [
        models.Index(fields=['employee_code']),  # Unique index
        models.Index(fields=['role']),
        models.Index(fields=['department_id']),
        models.Index(fields=['is_deleted', 'role']),  # Composite for active users by role
    ]
```

### **4.3 Ticket Model Indexes**

```python
class Meta:
    indexes = [
        models.Index(fields=['status']),
        models.Index(fields=['department_id']),
        models.Index(fields=['assignee_id']),
        models.Index(fields=['created_at']),
        models.Index(fields=['priority']),
        models.Index(fields=['status', 'department_id']),  # Composite for department status queries
        models.Index(fields=['assignee_id', 'status']),  # Composite for assignee workload
        models.Index(fields=['requestor_id', 'status']),  # Composite for requestor tickets
        models.Index(fields=['is_deleted', 'status']),  # Composite for active tickets by status
        models.Index(fields=['due_at']),  # For SLA queries
    ]
```

### **4.4 SubTicket Model Indexes**

```python
class Meta:
    indexes = [
        models.Index(fields=['parent_ticket_id']),
        models.Index(fields=['status']),
        models.Index(fields=['department_id']),
        models.Index(fields=['parent_ticket_id', 'status']),  # Composite for parent progress
    ]
```

### **4.5 ChatMessage Model Indexes**

```python
class Meta:
    indexes = [
        models.Index(fields=['ticket_id']),
        models.Index(fields=['created_at']),
        models.Index(fields=['ticket_id', 'created_at']),  # Composite for chat history
        models.Index(fields=['sender_id', 'created_at']),  # Composite for user message history
    ]
```

### **4.6 Notification Model Indexes**

```python
class Meta:
    indexes = [
        models.Index(fields=['user_id']),
        models.Index(fields=['is_read']),
        models.Index(fields=['created_at']),
        models.Index(fields=['user_id', 'is_read']),  # Composite for unread notifications
        models.Index(fields=['user_id', 'created_at']),  # Composite for notification history
    ]
```

### **4.7 AuditLog Model Indexes**

```python
class Meta:
    indexes = [
        models.Index(fields=['user_id']),
        models.Index(fields=['ticket_id']),
        models.Index(fields=['action']),
        models.Index(fields=['created_at']),
        models.Index(fields=['ticket_id', 'created_at']),  # Composite for ticket history
        models.Index(fields=['user_id', 'created_at']),  # Composite for user activity
        models.Index(fields=['action', 'created_at']),  # Composite for action tracking
    ]
```

### **4.8 TicketParticipant Model Indexes**

```python
class Meta:
    indexes = [
        models.Index(fields=['ticket_id']),
        models.Index(fields=['user_id']),
        models.Index(fields=['joined_at']),
        models.Index(fields=['ticket_id', 'joined_at']),  # Composite for participant timeline
    ]
```

### **4.9 Attachment Model Indexes**

```python
class Meta:
    indexes = [
        models.Index(fields=['ticket_id']),
        models.Index(fields=['uploaded_by_id']),
        models.Index(fields=['created_at']),
    ]
```

### **4.10 Approval Model Indexes**

```python
class Meta:
    indexes = [
        models.Index(fields=['ticket_id']),
        models.Index(fields=['requested_by_id']),
        models.Index(fields=['status']),
        models.Index(fields=['created_at']),
    ]
```

---

## **5. Initial Migrations Plan**

### **5.1 Migration Strategy**

1. **Initial Migration Sequence:**
   - Migration 0001: Create User and Department models
   - Migration 0002: Create Ticket model
   - Migration 0003: Create SubTicket model
   - Migration 0004: Create ChatMessage and TicketParticipant models
   - Migration 0005: Create Attachment model
   - Migration 0006: Create Approval model
   - Migration 0007: Create Notification model
   - Migration 0008: Create AuditLog model
   - Migration 0009: Create SLATemplate model
   - Migration 0010: Add all indexes

2. **Rollback Procedures:**
   - Each migration includes reverse operations
   - Database backup before major migrations
   - Staging validation before production
   - Rollback command: `python manage.py migrate app_name previous_migration`

3. **Data Migrations (if needed):**
   - Initial department data
   - Initial SLA templates
   - Admin user creation

### **5.2 Migration Commands**

```bash
# Create migrations
python manage.py makemigrations

# Review migration files
# Edit if needed

# Test in development
python manage.py migrate

# Validate in staging
python manage.py migrate --check

# Production deployment
python manage.py migrate

# Rollback if needed
python manage.py migrate app_name previous_migration
```

---

## **6. Database Connection Pooling (PgBouncer)**

### **6.1 PgBouncer Configuration**

See `backend/config/pgbouncer.ini` for detailed configuration.

### **6.2 Django Settings**

Django `DATABASES` setting points to PgBouncer:
- Connection string: `postgresql://user:pass@pgbouncer-host:6432/dbname`
- Pool mode: Transaction pooling (recommended for Django)
- Pool size: 25-50 connections (configurable)

---

## **7. Model Field Standards**

### **7.1 Common Fields**

All models include:
- `id`: Auto-increment primary key
- `created_at`: DateTimeField (auto_now_add=True)
- `updated_at`: DateTimeField (auto_now=True)
- `is_deleted`: BooleanField (default=False) for soft delete
- `version`: IntegerField (default=1) for optimistic locking (where applicable)

### **7.2 Timestamp Fields**

- All timestamps use `DateTimeField` with timezone support
- `created_at`: Set on creation, never updated
- `updated_at`: Updated on every save
- `deleted_at`: Set when soft deleted (optional, can use `is_deleted` flag)

### **7.3 Soft Delete Pattern**

- All models use `is_deleted` BooleanField
- Custom Manager filters `is_deleted=False` by default
- `.deleted()` queryset for accessing deleted records
- `.with_deleted()` for accessing all records (Admin only)

---

## **8. Summary**

This database design provides:

- **Clear Entity Relationships:** Well-defined foreign keys and relationships
- **Optimal Indexing:** Composite indexes for common query patterns
- **Soft Delete Support:** Consistent soft delete pattern across all models
- **Audit Trail:** Comprehensive audit logging
- **Scalability:** Indexed for performance at scale
- **Data Integrity:** Proper cascade behaviors and constraints

The design follows Django best practices and supports all business rules defined in the project documentation.

---

**Next Steps:**
1. Implement Django models based on this design
2. Create initial migrations
3. Set up PgBouncer configuration
4. Test database schema in development environment


