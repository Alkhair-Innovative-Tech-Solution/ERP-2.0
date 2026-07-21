# Business Rules

## **Consolidated Business Rules — Help Desk Management System**

This document consolidates all business rules, validation rules, constraints, and edge cases for the HDMS system.

**Architecture Note:** HDMS uses a **microservices architecture**. Business rules are enforced within each service, and inter-service validation is performed via HTTP API calls. For example, when Ticket Service needs to validate a user, it calls User Service's API. This ensures service boundaries are respected while maintaining data consistency.

---

## **1. Sub-Ticket Creation Rules**

### **1.1 Creation Authority**
* **ONLY Moderator** can create sub-tickets
* **Assignee** can request sub-tickets via chat with `request_subticket` flag
* **requestor** cannot request sub-tickets

### **1.2 Sub-Ticket Structure**
* No nested sub-tickets allowed (only parent-child, one level)
* Parent ticket = main request
* Child tickets = departmental dependencies
* All sub-tickets are equal-level children under the same parent

### **1.3 Parent-Child Relationships**
* Parent ticket automatically depends on all its sub-tickets (cannot close until all are resolved)
* If parent closed manually → all child tickets auto-close too
* Child closures auto-update parent progress (e.g., 2/3 done → 66%)
* Parent ticket progress = (closed sub-tickets / total sub-tickets)

### **1.4 SLA — Parent Inherits from Children**
* Each sub-ticket has its own independent SLA (set by Moderator at creation)
* **Parent SLA = max(all sub-ticket due_at)** — dynamically recalculated as sub-tickets close
* Requestor sees parent SLA only — internal sub-ticket SLAs not shown
* Example: IT=Day3, Admin=Day5, Procurement=Day7 → Parent shows Day7
* As sub-tickets close, parent SLA recalculates: max(remaining sub-ticket due dates)

### **1.5 Requestor Visibility of Sub-Tickets**
* Requestor sees sub-tickets on parent ticket detail — limited view only:
  - Department name
  - Status (pending / in progress / complete)
  - Overall progress percentage
* Requestor **cannot see:** sub-ticket chat, assignee name, description, internal details

### **1.6 Sub-Ticket Chat Rules**
* **Parent chat:** Requestor + Moderator (default participants)
* **Sub-ticket chat:** Moderator + Assignee (default participants)
* Moderator can add/remove anyone from any chat at any time (existing rule §7.2 applies)
* Requestor is NOT added to sub-ticket chats by default

### **1.7 Sub-Ticket Rejection**
* If a sub-ticket is rejected → parent ticket is **blocked** (cannot close)
* Moderator receives an alert immediately
* Moderator must either:
  - Create a replacement sub-ticket for that department, OR
  - Manually resolve the parent (with reason logged in audit)
* Rejected sub-tickets count as unresolved until Moderator takes action

### **1.8 Internal Task Breakdown**
* Department Head can create **internal sub-tasks** for employees (separate from system sub-tickets)
* This is for department-level task management, not system sub-tickets
* Employees are system users but don't update tickets (only Department Head updates)

---

## **2. Ticket Editing Rules**

### **2.1 requestor Editing**
* Can only edit tickets **before submission** (cannot edit after submission)
* Can edit or cancel drafts before final submission

### **2.2 Draft Handling**
* Drafts are **soft-deleted** (marked as `is_deleted=True`) after 7 days
* **Not hard deleted** - data retained in DB, hidden from UI
* Celery task runs daily to mark expired drafts as deleted

---

## **3. Status Transition Rules**

### **3.1 Reopen Rules**
* **Maximum 2 reopens** per ticket (hard limit, not configurable)
* **Always requires Moderator approval**
* Creates new version (Ticket v2) while retaining same ID
* Only last involved participants (Moderator, requestor, Assignee) rejoin automatically
* Old messages archived (new chat starts from zero)

### **3.2 Rejected Status**
* **Rejected status = End of lifecycle** (cannot be reopened, final state)
* Can occur at:
  - Under_Review (Moderator rejects before assignment)
  - Waiting_Approval (CEO/Finance rejects)

### **3.3 Postponement Rules**
* **Reason is required** (mandatory field)
* Can happen from any active status
* Reminders sent every 3 days until ticket closed
* **Reminders stop immediately** when ticket is restarted
* Moderator can restart anytime

### **3.4 Auto-Close Rules**
* **7 days** after ticket reaches Resolved status (configurable, default 7 days)
* **Warning notification sent on Day 5** — "Aapki ticket 2 din mein auto-close ho jayegi. Agar masla abhi bhi hai toh reply karein."
* If requestor doesn't respond within 7 days, system auto-closes
* Moderator verifies automatically
* Rationale: NGO staff often works in field — 3 days was too aggressive

---

## **4. Approval Workflow Rules**

### **4.1 Approval Request**
* **Only Finance Assignee** can request approval
* Cannot be requested by requestor or other roles
* Finance Assignee marks `requires_approval=true`

### **4.2 Approval Decision**
* CEO/Finance can Approve or Reject
* If Approved → Resolved → Closed
* If Rejected → Status = Rejected (end of lifecycle)

---

## **5. Team Members/Employees Rules**

### **5.1 Employee Assignment**
* Employees are **system users** assigned to departments by **Admin**
* Department Head assigns them to tickets for acknowledgment/tracking
* **All ticket updates must be done by Department Head only** (employees don't update tickets)

### **5.2 Internal Task Management**
* Department Head can create **internal task breakdown** for employees
* This is separate from system sub-tickets
* Used for department-level task management only

---

## **6. Deletion Rules**

### **6.1 Soft Delete Policy**
* **All deletions are soft deletes** (marked as `is_deleted=True`, hidden from UI, retained in DB)
* Applies to:
  - Tickets
  - Drafts
  - All entities
* Data is never hard deleted from database

---

## **7. Chat Visibility Rules**

### **7.1 Message Visibility**
* **New participants** see messages **after their join timestamp only**
* **Admin and Moderator** can see **full chat history**
* When user removed → loses chat history + access to ticket
* When new user added → starts fresh chat view (no history)

### **7.2 Chat Participation**
* Moderator can add/remove users from ticket chat
* Adding user gives them chat access and ticket visibility
* Removing user revokes both chat and ticket access

---

## **8. Undo Rules**

### **8.1 Undo Capability**
* Moderator can undo actions (reject, assign, postpone) within **15 minutes** of performing the action
* System fully restores previous state:
  - Status
  - Priority
  - Assignee
  - Participants
  - SLA
  - Chat connections
* Audit log shows both events: original action and undo action

---

## **9. SLA Rules**

### **9.1 SLA Templates (Priority-Based)**
SLA is automatically assigned based on ticket priority at creation time:

| Priority | First Response | Resolution |
|----------|---------------|------------|
| High     | 4 hours       | 24 hours   |
| Medium   | 8 hours       | 48 hours   |
| Low      | 24 hours      | 7 days     |

* Templates are configured by Admin via `SLATemplate` model
* On ticket creation, system auto-assigns SLA based on priority
* Templates stored as `due_delta` (duration); `due_at` (datetime) derived on creation

### **9.2 Milestone-Based Tracking**
Two independent SLA timers run per ticket:
1. **First Response SLA** — has anyone (Moderator/Assignee) responded yet?
2. **Resolution SLA** — has the ticket been resolved within deadline?

Each milestone follows this alert sequence:
* **75% of window elapsed** → Warning notification sent to Moderator + Assignee
* **100% (breach)** → Breach alert fired:
  1. Visible red badge on ticket in Moderator dashboard
  2. Immediate system notification via WebSocket
  3. Audit log entry + analytics event

### **9.3 SLA Override Rules**
* **Only Moderator** can extend SLA — Assignee cannot override directly
* Reason is **mandatory** (validation enforced)
* Every override is recorded in Audit Log:
  `"SLA extended by [Moderator Name] from [old_due_at] to [new_due_at] — Reason: ..."`
* Requestor receives a notification when SLA is extended
* No cap on number of extensions, but every one is logged and visible

### **9.4 Celery Monitoring Task**
* Runs every **15 minutes** to check all active tickets
* Fires warning at 75% window
* Fires breach alert at 100%
* Daily summary report: list of all breached tickets sent to Moderator

---

## **10. Notification Rules**

### **10.1 Notification Delivery**
* Real-time via WebSocket (<3 seconds after event)
* If user online → WS push
* If offline → store in DB and optionally email
* On read → mark `Notification.read = true`

### **10.2 Notification Types**
* Ticket status changes
* Assignments
* Mentions (@username)
* Approval requests
* Postponement reminders
* Auto-close reminders

### **10.3 Reminder Behavior**
* Postponed tickets: Every 3 days until closed or restarted
* Auto-close: 2 days before (on day 1 if auto-close is day 3)
* **Reminders stop immediately** when ticket is restarted or closed

---

## **11. Assignment Rules**

### **11.1 Department Assignment**
* Assignment is **always to a department head**, never to individual employees
* When assigned, **only the department head gets notified** — not the team
* Moderator can later reassign if department head is unresponsive, **after removing their access** first

### **11.2 Reassignment Rules**
* Moderator can reassign even during "In Progress"
* After removing old assignee's access and notifying all participants
* Old assignee loses access instantly

---

## **12. Validation Rules**

### **12.1 Ticket Creation**
* Required fields: title, description, department, category
* Maximum 10 open tickets per requestor (warning shown if exceeded)
* File size limits for attachments
* Invalid file types are skipped automatically with warning

### **12.2 Permission Checks**
* Cannot file ticket for department they're not authorized for → 403
* Attachment exceeds max size → client error + hint
* Too many open tickets from same requestor → rate limiting or moderator review

---

## **13. Audit & Compliance Rules**

### **13.1 Audit Logging**
* Every status change = audit event
* Every action logged with:
  - User ID
  - Timestamp
  - Before/after state
  - Reason (if applicable)
* Audit logs are immutable (no updates or deletes allowed)

### **13.2 Audit Log Retention**
* **Active Audit Logs:** 7 years (compliance requirement)
* **Archived Audit Logs:** Indefinite (moved to cold storage after 7 years)
* Archive process runs monthly via Celery scheduled task
* Archived logs remain accessible but read-only
* Original audit logs marked as archived but not deleted

### **13.3 Data Retention**
* All data retained in DB (soft delete policy)
* Audit logs archived after 7 years (not deleted)
* Attachments retained even after ticket closure

---

## **14. Parent-Child Ticket Rules**

### **14.1 Closure Rules**
* Once **all sub-tickets are closed**, parent ticket automatically becomes "Ready for Closure"
* Moderator can **manually force-close parent** before all children are done
* If parent closed manually → **all child tickets force-closed simultaneously**

### **14.2 Progress Calculation**
* Parent ticket progress = (closed sub-tickets / total sub-tickets)
* Auto-updates in real-time as sub-tickets close

---

## **15. Role-Based Access Rules**

### **15.1 requestor**
* Can view and track **only self-created or linked tickets**
* Can only edit before submission
* Cannot request sub-tickets

### **15.2 Moderator**
* Full visibility of all tickets across departments
* Can see full chat history
* Cannot alter system configuration (Admin-only)
* Can undo actions within 15 minutes

### **15.3 Assignee (Department Head)**
* Limited to tickets of their own department
* Cannot modify or access cross-department data
* Can request sub-tickets via chat
* All ticket updates must be done by Department Head (employees don't update)

### **15.4 Admin**
* Full system-wide access with configuration privileges
* Can see full chat history
* Assigns employees to departments
* Does not participate in ticket workflow unless intervention required

---

## **16. Edge Cases & Error Handling**

### **16.1 Draft Conflicts**
* Stale draft conflicts → warn if newer server version exists

### **16.2 Upload Failures**
* Upload interrupted → retry token
* Attachment scan failure → auto-remove or quarantine
* Large files → handle gracefully with progress indicators

### **16.3 Network Issues**
* Offline work → client caches action locally and retries when connectivity restored
* On retry, API deduplicates by idempotency key

### **16.4 Concurrent Updates**
* Conflicting parallel updates → server resolves via last-write or conflict resolution strategy

### **16.5 Notification Failures**
* WebSocket failure → retry up to 3 times (exponential backoff)
* If still failed → log failure + notify Admin

---

## **17. Performance & Scalability Rules**

### **17.1 Response Times**
* API response time: <250ms for major routes
* Dashboard/ticket load time: <2 seconds per page
* Notifications appear <3 seconds after the event

### **17.2 Scalability**
* Supports 500 concurrent socket connections in MVP
* Use pagination for heavy queries
* Cache summaries in Redis

---

## **18. Security Rules**

### **18.1 Authentication**
* JWT token-based authentication
* Token expiry → automatic logout
* Passwords hashed with Argon2

### **18.2 Authorization**
* Role-based access enforced in middleware
* Unauthorized attempts logged and Admin notified
* Repeated unauthorized attempts → security alert

### **18.3 Data Protection**
* Encrypted data at rest
* Secure file uploads (virus scanning)
* PII redaction rules for exports

---

## **19. Integration Rules**

### **19.1 SMS Integration**
* Single sign-on via SMS Auth Service
* Unauthorized attempts notify Admin
* Sync with SMS removes access instantly if user disabled

### **19.2 Data Sync**
* Employee data synced from SMS to HDMS
* Admin can trigger full or incremental sync
* Sync results logged (created/updated/failed)

---

## **20. Configuration Rules**

### **20.1 SLA Templates**
* Admin creates SLA templates with `due_delta` (duration)
* Templates used by Moderator when assigning default SLA
* Moderator can override SLA anytime with reason

### **20.2 Department Configuration**
* Admin creates/modifies departments
* Cannot delete department with active tickets (must reassign first)

---

## **21. Concurrent Update Handling Rules**

### **21.1 Optimistic Locking**
* All models include `version` field (IntegerField, auto-incremented on save)
* Client must send current version with update requests
* Server validates version matches before update
* If version mismatch → 409 Conflict error returned
* Client must refresh data and retry with new version

### **21.2 Pessimistic Locking**
* Used for critical operations (status transitions, approvals)
* Database-level row locks via `select_for_update()`
* Prevents concurrent modifications during critical workflows
* Locks released automatically after transaction commit

### **21.3 Conflict Resolution**
* Version mismatch → 409 Conflict error
* Client receives error with current version
* Client must refresh and retry
* No automatic merge (explicit user action required)

---

## **22. File Upload Security Rules**

### **22.1 Size Limits**
* **Server Limit:** 500MB per file (hard limit)
* **Frontend Limit:** 250MB (shown to user in UI)
* **Total per Ticket:** 100MB (sum of all attachments)
* Frontend validation prevents upload if file exceeds 250MB
* Server rejects files exceeding 500MB

### **22.2 File Type Validation**
* **Allowed Document Types:** PDF, TXT, DOCX, XLSX
* **Allowed Video Types:** MP4, MOV, MKV, AVI (transcoded to MP4 in background)
* **Allowed Image Types:** JPG, PNG, GIF (converted to WebP)
* MIME type validation on both client and server
* File extension validation (whitelist approach)
* Invalid file types rejected with clear error message

### **22.3 Upload Process**
1. **Client-Side Validation:**
   - File size check before upload (250MB limit shown)
   - File type validation
   - User notified immediately if file too large

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

6. **Logging:**
   - All upload attempts logged (user, timestamp, file info)
   - Failed uploads logged with reason
   - Security scan results logged

### **22.4 Authentication**
* Only authenticated users can upload
* Role-based upload permissions (if needed)
* Upload attempts without authentication → 401 Unauthorized

---

## **23. Rate Limiting Rules**

### **23.1 Rate Limits by Role**

| Endpoint | Role | Limit |
| ----- | ----- | ----- |
| `/api/v1/auth/login` | All Users | 10 requests/minute |
| All Endpoints | requestor | 150 requests/minute |
| All Endpoints | Assignee | 250 requests/minute |
| All Endpoints | Moderator | Unlimited |
| All Endpoints | Admin | Unlimited |

### **23.2 Rate Limiting Algorithm**
* **Algorithm:** Token Bucket
* Redis-based implementation
* Rate limit headers in response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
* 429 Too Many Requests response when limit exceeded

### **23.3 Per-Endpoint Limits**
* WebSocket connections: 10 concurrent connections per user
* File upload endpoints: Additional limits (see File Upload Security Rules)
* Specific endpoints may have custom limits based on resource usage

### **23.4 Rate Limit Enforcement**
* Middleware enforces rate limits
* Limits applied per user, per role
* Rate limit information included in response headers
* Client should respect rate limits and implement backoff

---

## **24. Cache Invalidation Rules**

### **24.1 Cache Invalidation Triggers**
* Ticket status change → invalidate ticket-related caches
* User assignment → invalidate dashboard caches
* Department update → invalidate department-related caches
* Sub-ticket creation → invalidate parent ticket caches
* Cache invalidation happens immediately after database update

### **24.2 Cache Key Patterns**
* Pattern: `{module}:{resource}:{filters}:{identifier}`
* Examples:
  - `summary:open_tickets:user_id:123:priority:high`
  - `dashboard:summary:user_id:456`
  - `ticket:detail:ticket_id:789`

### **24.3 Invalidation Strategy**
* **Automatic:** TTL expiration (Redis auto-deletes expired keys)
* **Manual:** Invalidation on data updates
* **Pattern:** When ticket status changes → `DEL summary:open_tickets:*`
* Next request will cache miss → fetch fresh data → update cache

### **24.4 Cache TTLs**
* Dynamic Data (Open ticket count, Chat status): 30-60 seconds
* Static Data (System settings): 1 hour
* User-specific dashboards: 60 seconds
* Department metrics: 2 minutes

---

## **25. Transaction Management Rules**

### **25.1 Transaction Boundaries**
* Complex operations wrapped in `@transaction.atomic` decorator
* Database transactions ensure data consistency
* Rollback on exceptions maintains data integrity

### **25.2 Critical Operations (Always Use Transactions)**
* Status transitions (with version checking)
* Sub-ticket creation (parent-child relationships)
* Approval workflows (multiple model updates)
* Reassignment (removing old, adding new assignee)
* File upload processing (multiple steps)

### **25.3 Rollback Scenarios**
* Exceptions trigger automatic rollback
* Error messages returned to client
* Audit logs record failed attempts
* No partial updates on failure

### **25.4 Nested Transactions**
* Django supports nested transactions (savepoints)
* Outer transaction rollback affects all nested transactions
* Useful for complex workflows with multiple steps

---

## **26. Idempotency Rules**

### **26.1 When Idempotency Keys Are Required**
* Ticket creation
* Status transitions
* Approval requests
* File uploads
* Any operation that should not be duplicated

### **26.2 Idempotency Key Format**
* UUID format (recommended)
* Key format in Redis: `idempotency:{user_id}:{key}`
* TTL: 24 hours (configurable)

### **26.3 Deduplication Logic**
* Same idempotency key within 24 hours → returns same response
* Different idempotency key → new request processed
* Server checks for existing key before processing
* If key exists → returns cached response (no duplicate processing)
* If key doesn't exist → processes request and stores key with response

---

## **27. Input Sanitization Rules**

### **27.1 HTML Sanitization**
* All user-generated content (chat messages) sanitized
* HTML tags stripped or escaped
* XSS prevention via content sanitization
* Allowed formatting: Plain text, basic markdown (if supported)

### **27.2 SQL Injection Prevention**
* Django ORM uses parameterized queries (automatic)
* No raw SQL queries with user input
* Input validation before database operations

### **27.3 File Content Validation**
* File content validation (not just extension/MIME type)
* Document parsing for malicious content
* Image validation (not just extension check)
* Video validation before transcoding

### **27.4 Validation Layers**
* Client-side validation (UX improvement)
* Server-side validation (security requirement)
* Database constraints (final layer)
* All validation errors logged

---

## **28. Summary of Key Constraints**

| Rule | Constraint | Enforced By |
| ----- | ----- | ----- |
| SLA Override | Only Moderator, reason required | Permission Check + Validation |
| SLA Warning | At 75% of window | Celery Task |
| SLA Breach Alert | At 100% of window | Celery Task |
| SLA Check Interval | Every 15 minutes | Celery Beat |
| Reopen Limit | Maximum 2 times | System (hard limit) |
| Auto-Close | 7 days after Resolved | System (default 7 days) |
| Auto-Close Reminder | Day 5 (2 days before) | System |
| Undo Time Window | 15 minutes | System |
| Postponement Reason | Required | Validation |
| requestor Edit | Only before submission | Business Logic |
| Sub-Ticket Creation | Only Moderator | Permission Check |
| Finance Approval | Only Finance Assignee | Permission Check |
| Soft Delete | All deletions | System Policy |
| Chat Visibility | After join timestamp | Business Logic |
| Draft Expiration | 7 days (soft delete) | Celery Task |
| Rate Limit (Login) | 10 requests/minute | Middleware |
| Rate Limit (requestor) | 150 requests/minute | Middleware |
| Rate Limit (Assignee) | 250 requests/minute | Middleware |
| File Upload (Server) | 500MB per file | Validation |
| File Upload (Frontend) | 250MB per file | Client Validation |
| Concurrent Updates | Version field required | Optimistic Locking |
| Cache TTL (Dynamic) | 30-60 seconds | Redis |
| Cache TTL (Static) | 1 hour | Redis |
| Idempotency TTL | 24 hours | Redis |




