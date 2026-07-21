# Models & Relationships Discussion

## **Complete Model List (Expected)**

Based on documentation review, here are ALL expected models:

### **Core Models:**
1. **User** ✅ (Created)
2. **Department** ✅ (Created)
3. **Ticket** ✅ (Partially created - needs review)
4. **SubTicket** ❌ (Not created yet)
5. **Attachment** ❌ (Not created yet)
6. **ChatMessage** ❌ (Not created yet)
7. **TicketParticipant** ❌ (Not created yet)
8. **Notification** ❌ (Not created yet)
9. **Approval** ❌ (Not created yet)
10. **AuditLog** ❌ (Not created yet - two types?)
11. **SLATemplate** ❌ (Not created yet)

---

## **Confusions & Questions to Discuss**

### **1. AuditLog - Two Separate Models?**

**Confusion:** Documentation mentions:
- `TicketAuditLog` (in tickets app) - for ticket-specific audit
- `AuditLog` (in audit app) - for system-wide audit

**Question:** 
- Should we have TWO separate models?
- OR one unified `AuditLog` with optional `ticket_id`?
- What's the difference in purpose?

**My Understanding:**
- `TicketAuditLog`: Only ticket lifecycle changes (status, assignee, priority)
- `AuditLog`: All system actions (user management, department changes, etc.)

**Recommendation:** Keep separate for clarity, but confirm.

---

### **2. TicketParticipant vs ChatMessage Participants**

**Confusion:** 
- `TicketParticipant` tracks who can access ticket chat
- `ChatMessage` has `sender` (ForeignKey to User)
- New participants see messages only after `joined_at` timestamp

**Question:**
- Is `TicketParticipant` a junction table for many-to-many (Ticket ↔ User)?
- Should it track `joined_at` timestamp for chat visibility?
- Who are default participants? (requestor, Assignee, Moderator?)

**My Understanding:**
- `TicketParticipant`: Junction table with `ticket_id`, `user_id`, `joined_at`
- Default participants: requestor, Assignee (when assigned), Moderator (always)
- Chat visibility: Messages after `joined_at` for new participants

**Recommendation:** Confirm this logic.

---

### **3. SubTicket Model Structure**

**Confusion:**
- SubTicket is a separate model OR just a Ticket with `parent_ticket_id`?
- Does SubTicket have its own status lifecycle?
- Can SubTicket have its own sub-tickets? (Documentation says NO - only one level)

**My Understanding:**
- SubTicket is separate model with `parent_ticket` ForeignKey
- SubTicket has same status field as Ticket (but simpler lifecycle)
- NO nested sub-tickets (enforced at model level)

**Recommendation:** Separate model, confirm status lifecycle.

---

### **4. Approval Model - Who Can Approve?**

**Confusion:**
- Only Finance Assignee can REQUEST approval
- CEO/Finance can APPROVE/REJECT
- But CEO is not a User model role - how to identify?

**Question:**
- Is CEO a special User with role=ADMIN or separate field?
- OR is CEO identified by department (e.g., Finance department)?
- How to track who approved (CEO vs Finance)?

**My Understanding:**
- CEO might be a User with special flag or department-based
- Approval model: `requested_by` (Finance Assignee), `approved_by` (CEO/Finance User)
- Need clarification on CEO identification

**Recommendation:** Discuss CEO identification method.

---

### **5. SLATemplate Model**

**Confusion:**
- Documentation mentions SLA templates
- Ticket has `sla_template` ForeignKey
- But where are templates stored?

**Question:**
- Should we create `SLATemplate` model?
- Fields: `name`, `priority`, `due_delta` (days)?
- Who creates templates? (Admin only?)

**My Understanding:**
- `SLATemplate`: Admin-created templates
- Fields: `name`, `priority` (high/medium/low), `due_delta` (integer days)
- Ticket references template to calculate `due_at`

**Recommendation:** Create model, confirm fields.

---

### **6. Internal Task Breakdown (Separate Model?)**

**Confusion:**
- Documentation says: "Department Head can create internal sub-tasks for employees"
- This is SEPARATE from system sub-tickets
- For department-level task management only

**Question:**
- Do we need a separate `InternalTask` model?
- OR is this just a feature for future (not in MVP)?
- How does it relate to Ticket?

**My Understanding:**
- This might be Phase 2 feature
- For MVP, we can skip this model
- Employees are just assigned to tickets for tracking (via TicketParticipant?)

**Recommendation:** Confirm if needed for MVP or defer to Phase 2.

---

### **7. Attachment Model - File Storage**

**Confusion:**
- Attachment belongs to Ticket
- But what about file storage details?
- UUID-based filenames, virus scanning status, file processing status

**Question:**
- Fields needed: `file_path`, `original_filename`, `file_size`, `mime_type`, `scan_status`, `processed`?
- Where are files stored? (S3 key or local path?)
- Should we track processing status (WebP conversion, MP4 transcoding)?

**My Understanding:**
- `Attachment`: `ticket`, `uploaded_by`, `file_key` (UUID), `original_filename`, `file_size`, `mime_type`, `scan_status`, `is_processed`
- Storage: S3 key or local file path
- Processing: Tracked via `is_processed` boolean

**Recommendation:** Confirm file storage strategy.

---

### **8. Notification Model - Types & Relationships**

**Confusion:**
- Notification can be related to Ticket OR standalone
- Different notification types (status change, mention, approval, etc.)

**Question:**
- Should we have `notification_type` field?
- Enum values: `status_change`, `assignment`, `mention`, `approval_request`, `reminder`, etc.?
- Is `ticket` ForeignKey nullable (for system notifications)?

**My Understanding:**
- `Notification`: `user`, `ticket` (nullable), `type`, `message`, `is_read`, `created_at`
- Types: Enum or CharField with choices

**Recommendation:** Confirm notification types list.

---

### **9. ChatMessage - Mentions & Attachments**

**Confusion:**
- ChatMessage can have mentions (@username)
- ChatMessage can have attachments
- How to store these relationships?

**Question:**
- Mentions: Many-to-Many with User? OR JSONField with user IDs?
- Attachments: ForeignKey from Attachment to ChatMessage? OR separate junction table?
- Should ChatMessage have `mentions` ManyToMany field?

**My Understanding:**
- Mentions: ManyToMany field `mentioned_users` (optional)
- Attachments: ForeignKey from Attachment to ChatMessage (nullable, since attachments can be ticket-level or message-level)

**Recommendation:** Confirm mention storage method.

---

### **10. Ticket Version Field - When to Increment?**

**Confusion:**
- Ticket has `version` field for optimistic locking
- Should version increment on EVERY save? OR only on status changes?
- What about minor updates (progress_percent, notes)?

**Question:**
- Increment on status change only?
- OR increment on any field update?
- How to handle concurrent updates to different fields?

**My Understanding:**
- Version increments on status changes (via FSM transitions)
- Also increments on critical field updates (assignee, priority, department)
- Minor updates (progress notes) might not need version check

**Recommendation:** Discuss version increment strategy.

---

## **Relationship Summary (Current Understanding)**

```
User
├── One-to-Many: created_tickets (as requestor)
├── One-to-Many: assigned_tickets (as assignee)
├── Many-to-One: department (belongs to)
├── One-to-Many: sent_messages (chat messages)
├── One-to-Many: notifications (receives)
├── Many-to-Many: ticket_participations (via TicketParticipant)
├── One-to-Many: requested_approvals (Finance Assignee)
├── One-to-Many: approved_requests (CEO/Finance)
└── One-to-Many: audit_actions (performs)

Department
├── One-to-Many: members (users)
├── One-to-Many: tickets (assigned tickets)
└── One-to-Many: sub_tickets (assigned sub-tickets)

Ticket
├── Many-to-One: requestor (User)
├── Many-to-One: assignee (User, nullable)
├── Many-to-One: department (Department)
├── Many-to-One: sla_template (SLATemplate, nullable)
├── One-to-Many: sub_tickets (child tickets)
├── One-to-Many: attachments (file attachments)
├── One-to-Many: messages (chat messages)
├── One-to-Many: participants (via TicketParticipant)
├── One-to-Many: approvals (approval requests)
├── One-to-Many: audit_logs (ticket-specific audit)
└── One-to-Many: notifications (generated notifications)

SubTicket
├── Many-to-One: parent_ticket (Ticket)
└── Many-to-One: department (Department)

ChatMessage
├── Many-to-One: ticket (Ticket)
├── Many-to-One: sender (User)
├── Many-to-Many: mentioned_users (User, optional)
└── Many-to-One: attachment (Attachment, nullable, if message has attachment)

TicketParticipant (Junction Table)
├── Many-to-One: ticket (Ticket)
├── Many-to-One: user (User)
└── Fields: joined_at (timestamp for chat visibility)

Attachment
├── Many-to-One: ticket (Ticket)
├── Many-to-One: uploaded_by (User)
└── Many-to-One: chat_message (ChatMessage, nullable, if attached to message)

Approval
├── Many-to-One: ticket (Ticket)
├── Many-to-One: requested_by (User - Finance Assignee)
└── Many-to-One: approved_by (User - CEO/Finance, nullable)

Notification
├── Many-to-One: user (User)
└── Many-to-One: ticket (Ticket, nullable)

AuditLog (System-wide)
├── Many-to-One: user (User, nullable)
└── Many-to-One: ticket (Ticket, nullable)

TicketAuditLog (Ticket-specific)
└── Many-to-One: ticket (Ticket)

SLATemplate
└── One-to-Many: tickets (tickets using this template)
```

---

## **Questions for Discussion**

1. **AuditLog:** Two separate models or one unified?
2. **CEO Identification:** How to identify CEO user for approvals?
3. **Internal Tasks:** Needed for MVP or Phase 2?
4. **Chat Attachments:** Separate from ticket attachments or same model?
5. **Version Increment:** On every save or only critical changes?
6. **SLATemplate Fields:** Confirm all required fields
7. **Notification Types:** Complete list of notification types needed
8. **Mentions Storage:** ManyToMany or JSONField?

---

**Next Step:** Let's discuss these confusions, then I'll create a comprehensive ERD visualization before implementing.


