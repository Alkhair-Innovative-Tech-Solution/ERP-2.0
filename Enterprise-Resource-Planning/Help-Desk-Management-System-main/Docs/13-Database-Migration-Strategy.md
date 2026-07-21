# Database Migration Strategy: Monolith to Microservices

**Version:** 1.0  
**Created:** December 2025

---

## **Migration Overview**

HDMS is migrating from a monolithic architecture to microservices. This document outlines the database migration strategy.

---

## **Phase 1: Shared Database (Current)**

### **Approach:**
- All services use the same PostgreSQL database
- Different table names per service (no conflicts)
- UUID-based references instead of ForeignKeys across services

### **Benefits:**
- Simple migration
- No data duplication
- Easy to query across services
- Fast development

### **Limitations:**
- Services are coupled to database schema
- Cannot scale databases independently
- Schema changes affect all services

### **Implementation:**
- Each service has its own tables:
  - `users`, `departments` (User Service)
  - `tickets`, `sub_tickets`, `approvals` (Ticket Service)
  - `chat_messages`, `notifications`, `ticket_participants` (Communication Service)
  - `attachments` (File Service)

- References use UUIDs:
  ```python
  # Instead of ForeignKey
  requestor_id = models.UUIDField()  # Reference to User
  
  # Service validates via API call
  user_client.get_user(requestor_id)
  ```

---

## **Phase 2: Database Per Service (Future)**

### **Approach:**
- Each service has its own database
- Services communicate only via APIs
- Data replication for read-heavy queries (optional)

### **Benefits:**
- True service isolation
- Independent scaling
- Service-specific optimizations
- Better fault tolerance

### **Challenges:**
- Distributed transactions
- Data consistency
- Cross-service queries
- Increased complexity

### **Migration Steps:**
1. Create separate databases per service
2. Migrate data to respective databases
3. Update service configurations
4. Replace direct DB queries with API calls
5. Implement data synchronization (if needed)

---

## **Current Database Schema**

### **Shared Database: `hdms_db`**

**User Service Tables:**
- `users`
- `departments`

**Ticket Service Tables:**
- `tickets`
- `sub_tickets`
- `approvals`
- `sla_templates`

**Communication Service Tables:**
- `chat_messages`
- `notifications`
- `ticket_participants`

**File Service Tables:**
- `attachments`

---

## **UUID-Based References**

### **Pattern:**
Instead of Django ForeignKeys, use UUIDField:

```python
# Monolith (old)
requestor = models.ForeignKey('users.User', on_delete=models.CASCADE)

# Microservices (new)
requestor_id = models.UUIDField(db_index=True)
```

### **Validation:**
Services validate references via API calls:

```python
# Ticket Service
user_client = UserClient()
if not user_client.validate_user_exists(requestor_id):
    raise ValueError("User not found")
```

---

## **Migration Scripts**

### **Step 1: Create Shared Database**
```sql
CREATE DATABASE hdms_db;
```

### **Step 2: Run Migrations Per Service**
```bash
# User Service
cd services/user-service/src
python manage.py migrate

# Ticket Service
cd services/ticket-service/src
python manage.py migrate

# Communication Service
cd services/communication-service/src
python manage.py migrate

# File Service
cd services/file-service/src
python manage.py migrate
```

### **Step 3: Data Migration (if migrating from existing system)**
- Export data from old system
- Transform data to new schema
- Import into shared database
- Validate data integrity

---

## **Rollback Strategy**

### **If Migration Fails:**
1. Stop all services
2. Restore database backup
3. Revert code changes
4. Restart services

### **Backup Before Migration:**
```bash
pg_dump -U hdms_user hdms_db > backup_before_migration.sql
```

---

## **Data Consistency**

### **Cross-Service References:**
- Validate UUIDs exist before creating records
- Use API calls to fetch related data
- Cache frequently accessed data (Redis)

### **Example:**
```python
# Ticket Service creating ticket
user_client = UserClient()
user_data = user_client.get_user(requestor_id)  # Validate user exists

ticket = Ticket.objects.create(
    requestor_id=requestor_id,
    # ... other fields
)
```

---

## **Future Considerations**

### **Event Sourcing:**
- Store all events in event store
- Rebuild state from events
- Better audit trail

### **CQRS (Command Query Responsibility Segregation):**
- Separate read and write databases
- Optimize for each use case

### **Data Replication:**
- Replicate read-heavy data
- Reduce cross-service calls
- Improve performance

---

**Last Updated:** December 2025


