# Workflows by Role

## **Complete Workflow Scenarios — Help Desk Management System**

This document outlines all workflow scenarios organized by role. For detailed Mermaid diagrams and visual representations, refer to the original comprehensive documentation.

---

## **requestor Workflows**

### **Group A — Ticket Lifecycle & Creation**

#### **A1. Create Ticket**
**Purpose:** requestor files a new problem/request.

**Actors:** requestor, Moderator

**Flow:**
1. Frontend validates form → `POST /api/v1/tickets` with `{title, desc, dept_id, priority, category}`
2. Backend creates `Ticket(status=Submitted)` and `TicketParticipant` for requestor
3. Create `AuditLog(action=create_ticket)`
4. Emit WS `ticket:created` to moderator pool
5. Create `Notification(to=moderator, type=new_ticket)`

**DB Entities:** `Ticket`, `TicketParticipant`, `AuditLog`

**Edge Cases:** Missing required fields → 400; department invalid → 404

---

#### **A2. Save Draft / Resume Draft**
**Purpose:** Save half-composed ticket and submit later.

**Actors:** requestor

**Flow:**
1. `POST /api/v1/tickets` with `is_draft=true`
2. Attachments uploaded to S3 pre-signed URLs; metadata saved
3. No moderator notification until `is_draft=false`
4. Drafts soft-deleted (marked as `is_deleted=True`) after 7 days (not hard deleted)

**DB Entities:** `Ticket(is_draft=True)`, `Attachment`

**Edge Cases:** Stale draft conflicts → warn if newer server version exists

---

#### **A3. Create Ticket with Attachments**
**Purpose:** Handle attachments & virus/size checks.

**Flow:**
1. **Client-Side Validation:**
   - User selects file(s)
   - Frontend validates file size (250MB limit shown to user)
   - Frontend validates file type (PDF, TXT, DOCX, XLSX, MP4, MOV, MKV, AVI, JPG, PNG, GIF)
   - User notified if file exceeds 250MB or invalid type

2. **Upload Request:**
   - Client requests signed URL `POST /api/v1/uploads/request` with file metadata
   - Server validates file size (500MB hard limit) and type
   - Server returns signed URL for S3 direct upload

3. **File Upload:**
   - Client uploads directly to S3 using signed URL
   - Upload progress tracked and displayed to user

4. **File Processing:**
   - After upload, `POST /api/v1/tickets` with `attachments=[keys]`
   - Backend saves file metadata to temporary location
   - Celery task processes file in background:
     - Antivirus scan
     - If infected → immediate deletion + user error message
     - If clean → move to permanent isolated storage
     - Images: Convert to WebP format
     - Videos: Transcode to MP4 (async)
   - File renamed with UUID (original name stored in metadata)
   - All processing logged (user, timestamp, file info, scan results)

5. **Ticket Creation:**
   - Ticket created with attachment references
   - Attachment status: `processing` → `ok` or `failed`
   - If scan fails, notification to requestor and moderator; ticket flagged

**DB Entities:** `Attachment(status=processing/ok/failed)`

**Security:**
* Files saved outside web root
* Random UUID filenames
* Original filename in metadata
* Content-Disposition header on downloads

**Edge Cases:** 
* Upload interrupted → retry token
* Attachment scan failure → auto-remove or quarantine
* File exceeds 500MB → server rejects with error
* Invalid file type → rejected with clear error message

---

#### **A4. Edit Draft → Submit**
**Purpose:** requestor edits and submits draft.

**Flow:**
1. `PATCH /api/v1/tickets/{id}` with updates
2. `PATCH /api/v1/tickets/{id}` with `is_draft=false` to submit
3. Ticket status changes to `Submitted`
4. Moderator notified

**Note:** requestor can only edit **before submission** (cannot edit after)

---

### **Group B — Collaboration & Chat**

#### **B1. Post Comment / Chat Message**
**Purpose:** requestor converses with Moderator/Assignee in ticket chat.

**Actors:** requestor + participants

**Flow:**
1. WebSocket `chat:send` to room `ticket:{id}` with message payload
2. Server validates membership, saves `ChatMessage` in DB, emits `chat:message` to room
3. If message contains `@mention(user)`, create `Notification` for mentioned user
4. Audit the message send event

**DB Entities:** `ChatMessage`, `Notification`, `AuditLog`

**Edge Cases:** Removed user tries to send → 403; message too long → reject

---

#### **B2. requestor Added/Removed from Ticket Chat**
**Purpose:** Admin/Moderator adjusts participants; requestor gains/loses visibility.

**Flow:**
1. Moderator calls `/api/tickets/{id}/participants/add` or `/remove`
2. Backend updates `TicketParticipant`, emits `chat:participant_added` or `chat:participant_removed`
3. If removed, client receives WS event and hides chat/blocks send
4. Audit log records who added/removed and reason

**Edge Cases:** Removed user tries to reconnect → reject; privacy concerns → admin audit

---

### **Group C — Status Changes & Resolution**

#### **C1. Assignee Marks Completed → requestor Verifies & Marks Resolved**
**Purpose:** Ensure requestor confirmation before final close.

**Flow:**
1. Assignee sets status `Completed` → notify requestor via WS & email
2. requestor opens details and clicks **Resolve** or **Request Rework**
   - If **Resolve**: `PATCH /api/v1/tickets/{id}/resolve_by_requestor` → status `Resolved`
   - If **Request Rework**: comment + status `Reopened`/`In_Progress`
3. Moderator verifies, then `Closed`

**DB Entities:** `Ticket.history`, `AuditLog`

**Edge Cases:** requestor doesn't respond → auto-verify after 3 days (configurable)

---

#### **C2. requestor Reopens a Closed Ticket**
**Purpose:** If result unsatisfactory.

**Flow:**
1. requestor clicks `Reopen` and provides reason → creates `ReopenRequest`
2. Backend validates (max 2 reopens), requires Moderator approval
3. If approved, Ticket transitions to `Reopened` and version increments (Ticket V2)
4. Assignee receives notification and works on rework

**DB Entities:** `Ticket` (version), `AuditLog`

**Edge Cases:** Max 2 reopens enforcement (system rejects further reopen requests automatically)

---

### **Group D — Visibility & Reporting**

#### **D1. requestor Views Personal Dashboard**
**Purpose:** See own tickets, stats, drafts.

**Flow:**
1. **Cache Check:**
   - Frontend requests dashboard data
   - Backend checks Redis cache first (cache key: `dashboard:summary:user_id:{id}`)
   - If cache hit → return cached data immediately (fast)

2. **Cache Miss:**
   - If cache miss → query database
   - `GET /api/v1/users/{id}/tickets?filters...` with pagination
   - Backend returns tickets + small aggregated metrics (average resolution time, open count)
   - Data saved to Redis cache (TTL: 60 seconds)
   - Return data to user

3. **Cache Invalidation:**
   - When ticket status changes → invalidate cache: `DEL dashboard:summary:user_id:{id}`
   - Next request will fetch fresh data

**DB Entities:** `Ticket`, materialized views for aggregates

**Performance:** 
* Cache summaries in Redis (TTL: 60 seconds for user dashboards)
* Cache invalidation on ticket updates
* Avoid heavy queries per request

---

## **Moderator Workflows**

### **Group A — Review & Assignment**

#### **A1. Review & Approve Incoming Ticket**
**Purpose:** Every ticket first lands in Moderator's Review Queue.

**Flow:**
1. Moderator reviews ticket validity and correctness
2. If valid → assigns to appropriate department head
3. If incomplete → rejects or requests clarification from requestor
4. All actions logged in audit trail

**Actions:**
- Approve & Assign
- Reject (end of lifecycle)
- Request Clarification

---

#### **A2. Reject Ticket**
**Purpose:** Moderator can reject any ticket before assignment.

**Flow:**
1. Moderator clicks 'Reject'
2. Enter reason (optional if system-detected duplicates)
3. Ticket status = `Rejected` (end of lifecycle, cannot be reopened)
4. Notify requestor
5. Audit log entry

---

#### **A3. Assign Ticket to Department Head**
**Purpose:** Moderator selects department based on category.

**Flow:**
1. **Transaction Start:**
   - Operation wrapped in `@transaction.atomic`
   - Pessimistic lock on ticket: `Ticket.objects.select_for_update().get(id=ticket_id)`
   - Version check (optimistic locking)

2. **Assignment Process:**
   - Moderator selects department based on category
   - System checks department availability (active tickets, staff load)
   - Moderator can override priority or SLA while assigning
   - Ticket assigned to department head
   - Ticket status = `Assigned`
   - Version incremented

3. **Notifications & Cache:**
   - Only the Department Head receives assignment notification
   - Cache invalidation: `DEL dashboard:summary:*` (all user dashboards)
   - Cache invalidation: `DEL summary:open_tickets:*` (department summaries)

4. **Transaction Commit:**
   - All changes committed atomically
   - Rollback on any exception

**API:** `POST /api/v1/moderator/tickets/{id}/assign`

**Transaction Handling:**
* All assignment operations atomic
* Rollback on failure
* Audit log records assignment

---

#### **A4. Undo Last Action**
**Purpose:** Moderator can undo the last action (Reject, Assign, Postpone).

**Flow:**
1. Moderator selects ticket & confirms undo
2. System fetches previous snapshot
3. Restores ticket to exact previous state (status, assignee, participants, chat connections, SLA)
4. Audit retains both entries: "Action" and "Undo"

**Note:** Only available within **15 minutes** of performing the action

---

#### **A5. Split Ticket into Sub-Tickets**
**Purpose:** Moderator determines that one request spans multiple departments.

**Flow:**
1. Moderator chooses 'Split Ticket'
2. Creates multiple sub-tickets (child level only — no nesting)
3. Each child is assigned to the relevant department
4. Parent depends on their completion
5. Parent ticket progress auto-updates as child tickets close

**API:** `POST /api/v1/tickets/{parent_id}/split`

**Note:** **ONLY Moderator** can create sub-tickets

---

#### **A6. Reassign Ticket**
**Purpose:** If Moderator feels the department is overloaded or ticket misrouted.

**Flow:**
1. Moderator clicks 'Reassign'
2. Select new department head
3. Remove old department's access first
4. Assign to new department
5. Notify all participants
6. Audit log: Reassignment

**API:** `PATCH /api/v1/moderator/tickets/{id}/reassign`

---

#### **A7. Postpone Ticket**
**Purpose:** Moderator can postpone ticket with reason.

**Flow:**
1. Moderator clicks Postpone
2. Enter reason (required) and set reminder interval (default 3 days)
3. Ticket status = `Postponed`
4. Visible in department dashboards as Postponed
5. Celery task sends reminder every 3 days until ticket closed or restarted
6. Moderator can restart anytime

**API:** `PATCH /api/v1/moderator/tickets/{id}/postpone`

**Note:** Reminders stop immediately when ticket is restarted

---

### **Group B — Collaboration & Chat**

#### **B1. Moderator Joins Ticket Chat Automatically**
**Purpose:** Whenever a ticket is created or assigned, moderator becomes automatic participant.

**Flow:**
1. Ticket created by requestor
2. Chat room auto-created
3. Participants added → requestor + Moderator
4. Moderator has full read/write access
5. Can see full chat history (unlike new participants)

---

#### **B2. Moderator Adds/Removes Participants**
**Purpose:** Moderator can add or remove department heads or assignees from ticket chat.

**Flow:**
1. Moderator opens chat controls
2. Choose user to add/remove
3. If Add: Grant access + join room
4. If Remove: Revoke access + user loses message history
5. Notify all participants
6. Audit log updated

**API:** 
- `POST /api/v1/tickets/{id}/participants/add`
- `POST /api/v1/tickets/{id}/participants/remove`

---

#### **B3. Moderator Manages Sub-Ticket Chats**
**Purpose:** When Moderator creates a sub-ticket, linked chat is spawned automatically.

**Flow:**
1. Sub-ticket created
2. Auto-join participants to parent chat
3. Sub-ticket users see messages after their join timestamp
4. Moderator monitors both parent + child chats from unified dashboard

---

### **Group C — Status Management**

#### **C1. Moderator Reopens a Closed Ticket**
**Purpose:** For investigation or audit.

**Flow:**
1. Moderator selects 'Reopen' on closed ticket
2. System creates new version (Ticket V2) with same ID
3. Moderator adds reason & timestamp
4. Ticket assigned back to department
5. requestor notified automatically
6. Only last involved participants rejoin automatically
7. Old messages archived (new chat starts from zero)

---

#### **C2. Moderator Closes Ticket**
**Purpose:** Final verification and closure.

**Flow:**
1. requestor confirms resolution (or auto-close after 3 days)
2. Moderator verifies resolution quality
3. If acceptable, mark ticket `Closed`
4. If parent ticket, can force-close all children simultaneously
5. If issues remain, reopens or reassigns

**API:** `PATCH /api/v1/moderator/tickets/{id}/close`

---

## **Assignee Workflows**

### **1. Receive Assignment**
**Purpose:** Department Head receives and acknowledges ticket assignment.

**Actors:** Assignee (Department Head), Moderator, requestor

**Flow:**
1. System creates `Assignment` record, sets `Ticket.status = Assigned`
2. Assignee receives real-time notification (WS) and in-app notification
3. Assignee opens ticket details and clicks **Acknowledge**
4. Backend marks `assignment.acknowledged_by = assignee_id`, `assignment.acknowledged_at = now`

**API:** `PATCH /api/v1/tickets/{id}/acknowledge`

**Edge Cases:** Assignee unresponsive — moderator may reassign after policy time

---

### **2. Start Work (Move to In Progress)**
**Purpose:** Assignee begins working on ticket.

**Flow:**
1. Assignee clicks **Start Work**
2. `PATCH /api/v1/tickets/{id}/status` with `in_progress`
3. Ticket `status` becomes `In_Progress`, `started_at` recorded
4. Add `TicketParticipant` entries for any department staff (optional, for acknowledgment)

**API:** `PATCH /api/v1/tickets/{id}/status`

**Background Tasks:** Start SLA timers based on `due_at`

---

### **3. Update Progress / Partial Completion**
**Purpose:** Work ongoing; need to update status or steps done.

**Flow:**
1. Assignee updates `progress_percent` or `progress_notes`
2. Optionally attach files or interim deliverables
3. System logs partial update; notifies Moderator and requestor

**API:** `PATCH /api/v1/tickets/{id}/progress`

**Edge Cases:** Progress >100% validation; attachments size

---

### **4. Request Moderator to Create Sub-Ticket**
**Purpose:** Assignee finds dependency on another department.

**Flow:**
1. Assignee posts chat message flagged as `request_subticket` describing need
2. System creates `SubTicketRequest` record, notifies Moderator
3. Moderator reviews and creates sub-ticket(s) if approved
4. Sub-ticket participants auto-join parent chat

**API:** `POST /api/v1/subticket-requests`

**Note:** Assignee **cannot create sub-ticket directly** — must request via Moderator

---

### **5. Create Approval Request (Finance → CEO)**
**Purpose:** Ticket requires high-level approval (payment, sensitive procurement).

**Actors:** Assignee (usually Finance Head), CEO, Moderator, requestor

**Flow:**
1. Finance Assignee marks ticket `requires_approval = true` and creates `ApprovalRequest`
2. System notifies CEO (or delegate) with approval request
3. CEO approves or rejects
4. If approved → sub-ticket or ticket transitions accordingly
5. If rejected → assignee and moderator notified for rework

**API:** `POST /api/v1/approvals`

**Note:** **Only Finance Assignee** can raise an approval request

---

### **6. Mark Completed / Submit for requestor Verification**
**Purpose:** Assignee believes task is complete.

**Flow:**
1. **Transaction Start:**
   - Operation wrapped in `@transaction.atomic`
   - Pessimistic lock on ticket
   - Version check (optimistic locking)

2. **Completion Process:**
   - Assignee sets `status = Completed` and adds completion notes + attachments
   - Version incremented
   - System notifies requestor to verify
   - `status` moves to `Resolved` (pending requestor confirmation)

3. **Cache Invalidation:**
   - Invalidate ticket-related caches: `DEL ticket:detail:ticket_id:{id}`
   - Invalidate dashboard caches: `DEL dashboard:summary:*`
   - Invalidate department metrics: `DEL summary:open_tickets:*`

4. **Transaction Commit:**
   - All changes committed atomically

5. **Next Steps:**
   - If requestor confirms (Resolve) → Moderator will verify and close
   - If requestor requests rework → reopened

**API:** `PATCH /api/v1/tickets/{id}/status` with `completed`

**Background Tasks:** Start 3-day auto-close countdown

**Transaction Handling:**
* Status transition atomic
* Cache invalidation after successful update
* Rollback on failure

---

### **7. Postpone Request**
**Purpose:** Assignee cannot proceed due to external dependency.

**Flow:**
1. Assignee requests postpone via chat or `POST /api/v1/tickets/{id}/postpone-request` with reason
2. Moderator reviews and may apply postpone
3. If moderator applies postpone, Celery reminders start every 3 days
4. When restarted, all reminders stop automatically

**API:** `POST /api/v1/tickets/{id}/postpone-request`

---

### **8. Assign Team Members**
**Purpose:** Department Head assigns employees to tickets for acknowledgment/tracking.

**Flow:**
1. Assignee views department workload
2. Selects team members to assign to ticket
3. Team members are system users but don't update tickets
4. All ticket updates must be done by Department Head only

**API:** `POST /api/v1/tickets/{id}/team-members`

**Note:** Team members are for acknowledgment only, not ticket updates

---

## **Admin Workflows**

### **1. Create / Import User from SMS**
**Purpose:** Admin wants to provision a Helpdesk user from the central SMS user store.

**Flow:**
1. Admin opens Import User UI → `POST /api/v1/admin/users/import {employee_code}`
2. Backend calls SMS service: `GET /sms/users/{employee_code}`
3. If SMS returns valid user data, backend creates local `User` record
4. Admin sets initial Helpdesk role (requestor/Assignee/Moderator/Admin)
5. System sends welcome email + in-app notification

**API:** `POST /api/v1/admin/users/import`

---

### **2. Grant Helpdesk Access to SMS User**
**Purpose:** A valid SMS user exists, but not yet authorized for Helpdesk.

**Flow:**
1. Admin chooses user → `PATCH /api/v1/admin/users/{id}` set `helpdesk_authorized = true`
2. System maps roles and creates permission entries
3. Notify user: "Access granted. Login with Employee Code."

**API:** `PATCH /api/v1/admin/users/{id}`

---

### **3. Revoke / Deactivate User**
**Purpose:** Policy violation or offboarding.

**Flow:**
1. Admin disables user: `PATCH /api/v1/admin/users/{id} {active: false}`
2. System invalidates all JWT sessions (blacklist tokens), terminates sockets
3. If SMS is later re-enabled, Admin must re-authorize

**Note:** Soft delete - marks as inactive, retains data

---

### **4. Create / Edit Department & Category**
**Purpose:** Need to add a new department or ticket category.

**Flow:**
1. Admin creates department: `POST /api/v1/admin/departments {name, code, head_id?}`
2. Admin configures categories under departments
3. System updates the mapping used by Moderator during assignment

**API:** 
- `POST /api/v1/admin/departments`
- `PATCH /api/v1/admin/departments/{id}`

**Edge Cases:** Duplicate department codes; deleting department with active tickets must be blocked or re-assigned

---

### **5. Manage SLA Templates & Priority Defaults**
**Purpose:** Organization defines SLA standards.

**Flow:**
1. Admin creates SLA template: `POST /api/v1/admin/sla_templates {name, priority, due_delta}`
2. Templates used by Moderator when assigning default SLA
3. Admin can edit; changes affect future tickets only

**API:** `POST /api/v1/admin/sla_templates`

---

### **6. Run / Schedule SMS Sync**
**Purpose:** Need to sync user updates or bulk import.

**Flow:**
1. Admin triggers sync: `POST /api/v1/admin/sync/sms?type=full|incremental`
2. Backend enqueues Celery job to call SMS API and upsert users
3. System logs results and sends summary to Admin (created/updated/failed)

**API:** `POST /api/v1/admin/sync/sms`

**Edge Cases:** Rate limits on SMS API, partial failures — retry logic needed

---

### **7. Audit Log Search & Export**
**Purpose:** Compliance request or audit.

**Flow:**
1. Admin queries audit logs via UI: `GET /api/v1/admin/audit?filters...`
2. For exports, Admin requests `POST /api/v1/admin/audit/export {filters, format}`
3. System enqueues background export job (Celery), creates downloadable archive

**API:** 
- `GET /api/v1/admin/audit`
- `POST /api/v1/admin/audit/export`

**Edge Cases:** Large export — use pagination or server-side streaming. PII redaction required.

---

## **Sub-Ticket Lifecycle**

### **Moderator Creates Sub-Ticket**

**Purpose:** Handle cross-departmental tasks by creating linked sub-tickets under a parent ticket.

**Actors:** Moderator (creator/requestor of sub-ticket), Assignee (Dept Head), requestor (from parent ticket)

**Flow:**
1. Moderator reviews main ticket, decides multiple departments are involved
2. Clicks "Add Sub-Ticket"
3. Chooses department, assignee, category, and optional SLA/time limit
4. System creates new ticket record with `type=sub_ticket`, `parent_id=main_ticket_id`
5. Sub-ticket Assignee receives WS + email notification
6. Parent ticket chat auto-updates: "Moderator added Department X (Ticket #SUB123) as sub-ticket"
7. Sub-ticket users (Assignee + related dept members) are added to the parent ticket chat dynamically
8. Sub-ticket behaves as normal ticket (statuses: New → In Progress → Completed)
9. When sub-ticket's status changes, parent ticket's progress = (closed sub-tickets / total sub-tickets)
10. Once all sub-tickets are closed, parent ticket automatically becomes "Ready for Closure"
11. Moderator reviews and closes parent ticket after verifying all departments' resolutions

**DB Entities:** `Ticket` (with `type=sub_ticket`, `parent_id`), `ChatMessage`, `TicketDependency`, `TicketProgress`

**WebSocket Events:** `sub_ticket_created`, `chat_user_added`, `progress_updated`, `ticket_closed`

**Edge Cases:**
- Sub-ticket manually deleted → Remove from chat, recalc progress
- Parent ticket closed early → Force-close open sub-tickets
- Sub-ticket reopens → Parent progress recalculated
- Sub-ticket assignee changed → Update chat participants dynamically

---

## **Note on Detailed Diagrams**

This document provides workflow descriptions and API references. For detailed Mermaid diagrams, sequence diagrams, and visual flowcharts for each scenario, refer to the original comprehensive documentation which includes 194 embedded diagrams covering all scenarios in detail.

---

## **Quick Reference: Key Endpoints by Role**

### **requestor**
- `POST /api/v1/tickets` - Create ticket
- `PATCH /api/v1/tickets/{id}/resolve_by_requestor` - Resolve ticket
- `POST /api/v1/tickets/{id}/reopen` - Request reopen

### **Moderator**
- `POST /api/v1/moderator/tickets/{id}/assign` - Assign ticket
- `POST /api/v1/tickets/{parent_id}/split` - Create sub-tickets
- `PATCH /api/v1/moderator/tickets/{id}/postpone` - Postpone ticket
- `POST /api/v1/moderator/tickets/{id}/undo` - Undo action

### **Assignee**
- `PATCH /api/v1/tickets/{id}/acknowledge` - Acknowledge assignment
- `PATCH /api/v1/tickets/{id}/status` - Update status
- `POST /api/v1/subticket-requests` - Request sub-ticket
- `POST /api/v1/approvals` - Request approval (Finance only)

### **Admin**
- `POST /api/v1/admin/users/import` - Import user
- `POST /api/v1/admin/sync/sms` - Sync SMS users
- `POST /api/v1/admin/departments` - Create department
- `GET /api/v1/admin/audit` - View audit logs




