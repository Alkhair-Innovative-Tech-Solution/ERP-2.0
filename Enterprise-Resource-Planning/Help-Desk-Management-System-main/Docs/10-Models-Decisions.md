# Models & Relationships - Final Decisions

## **Decisions Made:**

### **1. AuditLog - Unified Flexible Model** ✅
- **Decision:** One unified `AuditLog` model (flexible for all audit types)
- **Purpose:** Track ALL database changes (create, update, delete) across all models
- **Fields:**
  - `action_type` (CharField: CREATE, UPDATE, DELETE, REOPEN)
  - `category` (CharField: TICKET, USER, DEPARTMENT, APPROVAL, etc.) - for easy filtering
  - `model_name` (CharField: Ticket, User, Department, etc.)
  - `object_id` (UUIDField - ID of changed object)
  - `ticket_id` (ForeignKey, nullable - if related to ticket)
  - `user_id` (ForeignKey, nullable - who performed action)
  - `old_state` (JSONField, nullable - before change)
  - `new_state` (JSONField, nullable - after change)
  - `changes` (JSONField - what fields changed)
  - `reason` (TextField, nullable - why change was made)
  - `timestamp` (DateTimeField - when change occurred)
  - `ip_address` (CharField, nullable - for security audit)
- **Properties:**
  - **Immutable:** No updates or deletes allowed (read-only)
  - **Categorized:** Easy filtering by category + model_name
  - **Flexible:** Can store relevant info for any model/action
  - **Timestamped:** Precise audit trail
- **Location:** `apps/audit/models.py`

### **2. User Model & Employee Code** ✅
- **Decision:** Custom User model (NOT AbstractUser), inherits from BaseModel
- **Employee Code:** 
  - Unique pattern (organization-specific)
  - Separate Department model for department management
  - Employee code validation based on pattern
- **CEO Identification:** `is_ceo` BooleanField in User model
- **Structure:**
  - Inherits from BaseModel (UUID, soft delete, timestamps)
  - `employee_code` (CharField, unique, with pattern validation)
  - `is_ceo` (BooleanField - for financial approvals)
  - `role` (CharField - requestor, moderator, assignee, admin)
  - `department` (ForeignKey to Department)
  - Authentication via employee_code + password

### **3. Internal Tasks** ✅
- **Decision:** Skip for MVP, can add in Phase 2
- **Reason:** Not critical for MVP, adds complexity
- **Note:** Employees can still be tracked via TicketParticipant for acknowledgment

### **4. Chat Attachments & Messages** ✅
- **Decision:** Same `Attachment` model, with nullable `chat_message` ForeignKey
- **Structure:** 
  - `ticket` ForeignKey (required for ticket attachments)
  - `chat_message` ForeignKey (nullable, if attached to chat message)
  - One attachment can be either ticket-level OR message-level
- **Mentions:** JSONField in ChatMessage (flexible, easy to query)
- **Message Deletion:** Soft delete (for audit trail)

### **5. Version Field Increment** ✅
- **Decision:** Increment ONLY on ticket/subticket REOPEN
- **Reopen Limit:** Maximum 3 reopens per ticket/subticket
- **Implementation:** 
  - Version increments only in `reopen()` method
  - Reopen count tracked separately (`reopen_count` field)
  - After 3 reopens, reopen action blocked
- **Note:** Other changes (status, assignee, priority) do NOT increment version

### **6. SubTicket Structure** ✅
- **Decision:** Only parent-child relationship (NO nested sub-tickets)
- **Structure:**
  - `parent_ticket` (ForeignKey to Ticket)
  - `department` (ForeignKey - assigned department)
  - `assignee` (ForeignKey to User - department head)
  - `status` (FSMField - simplified states)
  - `version` (IntegerField - increments on reopen only)
  - `reopen_count` (IntegerField - max 3)
- **Status Impact:**
  - Sub-ticket status does NOT affect parent ticket status
  - Sub-ticket status change → notifies Moderator only
  - Parent ticket status independent of sub-tickets
- **Reopen Limit:** Maximum 3 reopens per sub-ticket

### **6.1. SLATemplate Model** ✅
- **Fields:**
  - `name` (CharField)
  - `priority` (ChoiceField: high/medium/low)
  - `due_delta` (IntegerField - days)
  - `is_active` (BooleanField)
  - `created_by` (ForeignKey to User)
  - `created_at`, `updated_at`

### **6.2. Approval Model** ✅
- **Purpose:** Financial ticket approvals only
- **Fields:**
  - `ticket` (ForeignKey to Ticket)
  - `approver` (ForeignKey to User - CEO or Finance head)
  - `status` (CharField: pending, approved, rejected)
  - `reason` (TextField, nullable)
  - `documents` (JSONField - approval documents)
  - `created_at`, `updated_at`
- **Workflow:** Financial tickets require approval before proceeding

### **6.3. Department Model** ✅
- **Fields:**
  - `name` (CharField, unique)
  - `code` (CharField, unique)
  - `head` (ForeignKey to User - department head)
  - `active_tickets` (IntegerField - real-time count)
  - `total_capacity` (IntegerField)
  - `queue_enabled` (BooleanField - if capacity exceeded)
- **Updates:** Real-time update of `active_tickets` count
- **Queue System:** If capacity exceeded, new tickets queued (not rejected)

### **7. Notification Types** ✅
- **Types (Enum):**
  - `TICKET_CREATED`
  - `TICKET_ASSIGNED`
  - `TICKET_STATUS_CHANGED`
  - `TICKET_MENTIONED` (user mentioned in chat)
  - `APPROVAL_REQUESTED` (financial tickets only)
  - `APPROVAL_DECISION`
  - `TICKET_POSTPONED`
  - `TICKET_REMINDER` (postponed ticket reminder)
  - `AUTO_CLOSE_REMINDER`
  - `TICKET_REOPENED`
  - `SUBTICKET_CREATED`
  - `SUBTICKET_STATUS_CHANGED` (notifies moderator only)
  - `MESSAGE_RECEIVED` (new chat message)
- **Fields:**
  - `user` (ForeignKey - recipient)
  - `ticket` (ForeignKey, nullable)
  - `type` (CharField with choices)
  - `title` (CharField)
  - `message` (TextField)
  - `is_read` (BooleanField)
  - `read_at` (DateTimeField, nullable)
  - `metadata` (JSONField, optional - for extra data)
  - `created_at`
- **Delivery:** WebSocket push (real-time)
- **Storage:** 7 years (compliance best practice)

### **8. File Storage & Security** ✅
- **Storage:** Local file storage (development & production initially)
- **Upload Flow:**
  1. File uploaded to temporary location
  2. Background Celery task: Antivirus scan
  3. If clean → move to permanent storage
  4. If infected → delete immediately + notify user
- **Fields in Attachment:**
  - `file_key` (UUID - unique identifier)
  - `original_filename` (CharField)
  - `file_size` (IntegerField - bytes)
  - `mime_type` (CharField)
  - `file_path` (CharField - local path, only set after scan passes)
  - `scan_status` (CharField: pending/clean/infected)
  - `scan_result` (TextField - scan details)
  - `scanned_at` (DateTimeField - when scan completed)
  - `is_processed` (BooleanField - WebP/MP4 conversion done)
  - `uploaded_by` (ForeignKey to User)
  - `ticket` (ForeignKey, nullable if chat attachment)
  - `chat_message` (ForeignKey, nullable)
- **Important:** File permanently saved ONLY after antivirus scan passes

### **9. Universal Model Standards** ✅
- **Decision:** ALL models must have:
  1. **UUID Primary Key:** `id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)`
  2. **Soft Delete:** 
     - `is_deleted = models.BooleanField(default=False, db_index=True)`
     - `deleted_at = models.DateTimeField(null=True, blank=True)`
     - `SoftDeleteManager` and `SoftDeleteQuerySet` for filtering
  3. **Timestamps:**
     - `created_at = models.DateTimeField(auto_now_add=True)`
     - `updated_at = models.DateTimeField(auto_now=True)`
  4. **Soft Delete Methods:**
     - `soft_delete()` method
     - `restore()` method

- **Best Practice Analysis:**
  - ✅ **UUID Primary Keys:**
    - **Pros:** 
      - No sequential ID exposure (security)
      - Better for distributed systems
      - No ID collision in multi-database setups
      - Can generate IDs client-side before saving
    - **Cons:**
      - Slightly larger storage (16 bytes vs 4/8 bytes)
      - Slightly slower indexing (but negligible in modern DBs)
      - Can't use simple integer joins
    - **Verdict:** ✅ **BEST PRACTICE** for enterprise systems, especially with audit/compliance requirements
  
  - ✅ **Soft Delete:**
    - **Pros:**
      - Data recovery capability
      - Audit trail preservation
      - Referential integrity maintained
      - Can track deletion history
      - Compliance requirements (GDPR, financial regulations)
    - **Cons:**
      - Extra storage (deleted records stay in DB)
      - Need to filter `is_deleted=False` everywhere
      - Can cause confusion if not properly managed
      - Need archival strategy for old deleted records
    - **Verdict:** ✅ **BEST PRACTICE** for enterprise systems, especially with:
      - Compliance requirements (7-year audit retention)
      - Data recovery needs
      - Audit trail requirements
      - Financial/legal data
  
  - ⚠️ **Considerations:**
    - Need proper indexes on `is_deleted` fields
    - Need composite indexes like `(is_deleted, status)` for common queries
    - Need archival strategy (move old deleted records to archive table)
    - Need to update all queries to use `SoftDeleteManager` by default
    - ForeignKey relationships should use `on_delete=models.SET_NULL` or `PROTECT` for soft-deleted records

- **Implementation Pattern:**
```python
import uuid
from django.db import models
from django.utils import timezone

class SoftDeleteQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_deleted=False)
    def deleted(self):
        return self.filter(is_deleted=True)
    def with_deleted(self):
        return self.all()

class SoftDeleteManager(models.Manager):
    def get_queryset(self):
        return SoftDeleteQuerySet(self.model, using=self._db).active()
    def deleted(self):
        return SoftDeleteQuerySet(self.model, using=self._db).deleted()
    def with_deleted(self):
        return SoftDeleteQuerySet(self.model, using=self._db).with_deleted()

class BaseModel(models.Model):
    """Abstract base model with UUID, soft delete, and timestamps."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    objects = SoftDeleteManager()
    
    class Meta:
        abstract = True
    
    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])
    
    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=['is_deleted', 'deleted_at'])

# All models inherit from BaseModel
class Ticket(BaseModel):
    title = models.CharField(max_length=500)
    # ... other fields
```

---

## **Complete Model List (Final):**

1. ✅ User (with `is_ceo` flag)
2. ✅ Department
3. ✅ Ticket (with FSM, version field)
4. ⏳ SubTicket
5. ⏳ Attachment
6. ⏳ ChatMessage
7. ⏳ TicketParticipant
8. ⏳ Notification
9. ⏳ Approval
10. ⏳ AuditLog (unified)
11. ⏳ SLATemplate

---

## **Next Steps:**
1. ✅ Create `BaseModel` abstract class with UUID, soft delete, timestamps
2. ✅ All models inherit from `BaseModel`
3. ✅ Add `is_ceo` to User model
4. ✅ Implement proper relationships
5. ✅ Add all indexes (including composite indexes for soft delete queries)
6. ✅ Create comprehensive ERD visualization

## **Model Standards Checklist:**
Every model must have:
- [x] UUID primary key (`id`)
- [x] `is_deleted` BooleanField with index
- [x] `deleted_at` DateTimeField (nullable)
- [x] `created_at` DateTimeField (auto_now_add)
- [x] `updated_at` DateTimeField (auto_now)
- [x] `SoftDeleteManager` as default manager
- [x] `soft_delete()` method
- [x] `restore()` method
- [x] Proper indexes (including composite for common queries)


