# API Specifications

## **API Endpoints — Help Desk Management System**

This document defines all REST API endpoints and WebSocket events for the HDMS system.

**Architecture:** Microservices with API Gateway

**Base URL:** `/api/v1/` (via API Gateway - Nginx)

**Service-Specific URLs:**
- **User Service:** `http://user-service:8001/api/v1/` (internal)
- **Ticket Service:** `http://ticket-service:8002/api/v1/` (internal)
- **Communication Service:** `http://communication-service:8003/api/v1/` (internal)
- **File Service:** `http://file-service:8005/api/v1/` (internal)
- **WebSocket:** `ws://gateway/ws/` (via API Gateway)

**Note:** Frontend always calls `/api/v1/` which routes through API Gateway to appropriate services. Internal services communicate directly using service URLs.

**Authentication:** JWT Token (Bearer token in Authorization header)

**API Versioning:** All endpoints use `/api/v1/` prefix. Future versions will use `/api/v2/`, `/api/v3/`, etc.

---

## **Service Endpoint Mapping**

| Service | Endpoints | Port |
| ----- | ----- | ----- |
| **User Service** | `/api/v1/auth/*`, `/api/v1/users/*`, `/api/v1/departments/*` | 8001 |
| **Ticket Service** | `/api/v1/tickets/*`, `/api/v1/subticket-requests/*`, `/api/v1/approvals/*` | 8002 |
| **Communication Service** | `/api/v1/chat/*`, `/api/v1/notifications/*`, `ws://gateway/ws/*` | 8003, 8004 |
| **File Service** | `/api/v1/files/*` | 8005 |

**Note:** All endpoints are accessed via API Gateway at `/api/v1/`. The API Gateway routes requests to the appropriate service based on the path.

---

## **1. Authentication Endpoints**

**Service:** User Service

### **1.1 Login**
```
POST /api/v1/auth/login
```

**Request Body:**
```json
{
  "employee_code": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "access_token": "string",
  "refresh_token": "string",
  "user": {
    "id": "integer",
    "employee_code": "string",
    "name": "string",
    "role": "requestor|moderator|assignee|admin",
    "department": "string"
  }
}
```

### **1.2 Refresh Token**
```
POST /api/v1/auth/refresh
```

### **1.3 Logout**
```
POST /api/v1/auth/logout
```

---

## **2. Ticket Endpoints**

**Service:** Ticket Service

### **2.1 Create Ticket**
```
POST /api/v1/tickets
```

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "department_id": "integer",
  "priority": "high|medium|low",
  "category": "string",
  "attachments": ["string"],  // file keys
  "is_draft": "boolean"
}
```

**Response:** `201 Created` with ticket object

### **2.2 Get Ticket Details**
```
GET /api/v1/tickets/{id}?include_subtickets=true
```

**Response:** Ticket object with optional sub-tickets

### **2.3 Update Ticket**
```
PATCH /api/v1/tickets/{id}
```

**Note:** requestor can only update before submission

### **2.4 Get User Tickets**
```
GET /api/v1/users/{id}/tickets?filters...
```

**Query Parameters:**
- `status`: filter by status
- `department_id`: filter by department
- `page`: pagination
- `limit`: items per page

### **2.5 Update Ticket Status**
```
PATCH /api/v1/tickets/{id}/status
```

**Request Body:**
```json
{
  "status": "in_progress|completed|postponed",
  "reason": "string"  // required for postpone
}
```

### **2.6 Acknowledge Assignment**
```
PATCH /api/v1/tickets/{id}/acknowledge
```

**Request Body:**
```json
{
  "comment": "string"  // optional
}
```

### **2.7 Update Progress**
```
PATCH /api/v1/tickets/{id}/progress
```

**Request Body:**
```json
{
  "progress_percent": "integer",
  "progress_notes": "string"
}
```

### **2.8 Resolve by requestor**
```
PATCH /api/v1/tickets/{id}/resolve_by_requestor
```

**Request Body:**
```json
{
  "satisfied": "boolean",
  "feedback": "string"  // optional
}
```

### **2.9 Reopen Ticket**
```
POST /api/v1/tickets/{id}/reopen
```

**Request Body:**
```json
{
  "reason": "string"  // required
}
```

**Note:** Requires Moderator approval, max 2 reopens

### **2.10 Postpone Request**
```
POST /api/v1/tickets/{id}/postpone-request
```

**Request Body:**
```json
{
  "reason": "string",  // required
  "desired_interval": "integer"  // days
}
```

### **2.11 Bulk Actions**
```
POST /api/v1/tickets/bulk_action
```

**Request Body:**
```json
{
  "action": "close|reassign",
  "ticket_ids": ["integer"],
  "params": {}  // action-specific parameters
}
```

---

## **3. Sub-Ticket Endpoints**

**Service:** Ticket Service

### **3.1 Request Sub-Ticket**
```
POST /api/v1/subticket-requests
```

**Request Body:**
```json
{
  "parent_ticket_id": "integer",
  "details": "string",
  "requested_department_id": "integer"
}
```

**Note:** Only Assignee can request; Moderator creates

### **3.2 Create Sub-Ticket (Moderator Only)**
```
POST /api/v1/tickets/{parent_id}/split
```

**Request Body:**
```json
{
  "sub_tickets": [
    {
      "title": "string",
      "description": "string",
      "department_id": "integer",
      "assignee_id": "integer"
    }
  ]
}
```

### **3.3 Get Sub-Tickets**
```
GET /api/v1/tickets/{id}/sub-tickets
```

---

## **4. Approval Endpoints**

**Service:** Ticket Service

### **4.1 Request Approval (Finance Only)**
```
POST /api/v1/approvals
```

**Request Body:**
```json
{
  "ticket_id": "integer",
  "reason": "string",
  "documents": ["string"]  // attachment keys
}
```

### **4.2 Approve/Reject**
```
PATCH /api/v1/approvals/{id}/approve
PATCH /api/v1/approvals/{id}/reject
```

**Request Body:**
```json
{
  "comment": "string"  // optional
}
```

### **4.3 Acknowledge SLA Update**
```
PATCH /api/v1/tickets/{id}/sla/ack
```

**Request Body:**
```json
{
  "acknowledged": "boolean",
  "dispute": "boolean",  // if disputing
  "dispute_reason": "string"  // if disputing
}
```

---

## **5. Chat Endpoints**

**Service:** Communication Service

### **5.1 Send Message**
```
POST /api/v1/tickets/{id}/messages
```

**Request Body:**
```json
{
  "message": "string",
  "mentions": ["integer"],  // user IDs
  "attachments": ["string"]  // optional
}
```

### **5.2 Get Chat History**
```
GET /api/v1/tickets/{id}/messages?after={timestamp}
```

**Query Parameters:**
- `after`: timestamp (for new participants, shows messages after join time)
- `limit`: messages per page
- `page`: pagination

**Note:** New participants see messages after their join timestamp. Admin/Moderator see full history.

### **5.3 Add/Remove Participants (Moderator Only)**
```
POST /api/v1/tickets/{id}/participants/add
POST /api/v1/tickets/{id}/participants/remove
```

**Request Body:**
```json
{
  "user_ids": ["integer"]
}
```

---

## **6. Attachment Endpoints**

**Service:** File Service

### **6.1 Request Upload URL**
```
POST /api/v1/uploads/request
```

**Request Body:**
```json
{
  "filename": "string",
  "content_type": "string",
  "size": "integer"
}
```

**Response:**
```json
{
  "upload_url": "string",
  "key": "string",
  "expires_at": "datetime"
}
```

### **6.2 Upload Attachment**
```
POST /api/v1/tickets/{id}/attachments
```

**Request Body:** Multipart form data

### **6.3 Download Attachment**
```
GET /api/v1/uploads/{key}/download
```

**Response:** Signed URL or direct file stream

### **6.4 Delete Attachment (Moderator Only)**
```
DELETE /api/v1/attachments/{id}
```

---

## **7. Notification Endpoints**

**Service:** Communication Service

### **7.1 Get Notifications**
```
GET /api/v1/notifications
```

**Query Parameters:**
- `unread_only`: boolean
- `limit`: items per page
- `page`: pagination

### **7.2 Mark as Read**
```
PATCH /api/v1/notifications/{id}/read
```

### **7.3 Mark All as Read**
```
PATCH /api/v1/notifications/read-all
```

---

## **8. User Management Endpoints (Admin Only)**

**Service:** User Service

### **8.1 Import User from SMS**
```
POST /api/v1/admin/users/import
```

**Request Body:**
```json
{
  "employee_code": "string"
}
```

### **8.2 Grant/Revoke Access**
```
PATCH /api/v1/admin/users/{id}
```

**Request Body:**
```json
{
  "helpdesk_authorized": "boolean",
  "role": "requestor|moderator|assignee|admin"
}
```

### **8.3 Deactivate User**
```
PATCH /api/v1/admin/users/{id}
```

**Request Body:**
```json
{
  "active": "boolean"
}
```

**Note:** Soft delete - marks as inactive, retains data

### **8.4 Get Access Requests**
```
GET /api/v1/admin/access-requests
```

### **8.5 Approve Access Request**
```
PATCH /api/v1/admin/access-requests/{id}/approve
```

---

## **9. Department Endpoints**

**Service:** User Service

### **9.1 Get Department Workload**
```
GET /api/v1/departments/{id}/workload
```

**Response:**
```json
{
  "department_id": "integer",
  "active_tickets": "integer",
  "pending_tickets": "integer",
  "team_members": [
    {
      "id": "integer",
      "name": "string",
      "active_tickets": "integer",
      "available": "boolean"
    }
  ]
}
```

### **9.2 Assign Team Member (Department Head Only)**
```
POST /api/v1/tickets/{id}/team-members
```

**Request Body:**
```json
{
  "user_ids": ["integer"]
}
```

**Note:** Team members are for acknowledgment only, don't update tickets

### **9.3 Create Department (Admin Only)**
```
POST /api/v1/admin/departments
```

### **9.4 Update Department (Admin Only)**
```
PATCH /api/v1/admin/departments/{id}
```

---

## **10. Moderator Endpoints**

### **10.1 Review Ticket**
```
PATCH /api/v1/moderator/tickets/{id}/review
```

**Request Body:**
```json
{
  "action": "approve|reject|request_clarification",
  "reason": "string",  // optional for approve, required for reject
  "category": "string",
  "priority": "high|medium|low"
}
```

### **10.2 Assign Ticket**
```
POST /api/v1/moderator/tickets/{id}/assign
```

**Request Body:**
```json
{
  "department_id": "integer",
  "assignee_id": "integer",
  "priority": "high|medium|low",
  "sla_due_at": "datetime",  // optional override
  "reason": "string"  // optional
}
```

### **10.3 Reassign Ticket**
```
PATCH /api/v1/moderator/tickets/{id}/reassign
```

**Request Body:**
```json
{
  "new_department_id": "integer",
  "new_assignee_id": "integer",
  "reason": "string"  // required
}
```

### **10.4 Postpone Ticket**
```
PATCH /api/v1/moderator/tickets/{id}/postpone
```

**Request Body:**
```json
{
  "reason": "string",  // required
  "reminder_interval": "integer"  // days, default 3
}
```

### **10.5 Restart Ticket**
```
PATCH /api/v1/moderator/tickets/{id}/restart
```

**Request Body:**
```json
{
  "note": "string"  // optional
}
```

### **10.6 Undo Action**
```
POST /api/v1/moderator/tickets/{id}/undo
```

**Note:** Only available within 15 minutes of action

### **10.7 Close Ticket**
```
PATCH /api/v1/moderator/tickets/{id}/close
```

**Request Body:**
```json
{
  "force_close_children": "boolean"  // if parent, close all children
}
```

### **10.8 Get Ticket Pool**
```
GET /api/v1/moderator/tickets/pool
```

**Query Parameters:**
- `status`: filter by status
- `department_id`: filter by department
- `priority`: filter by priority

---

## **11. Admin Endpoints**

### **11.1 SMS Sync**
```
POST /api/v1/admin/sync/sms?type=full|incremental
```

**Response:**
```json
{
  "job_id": "string",
  "status": "started|completed|failed",
  "created": "integer",
  "updated": "integer",
  "failed": "integer"
}
```

### **11.2 Create SLA Template**
```
POST /api/v1/admin/sla_templates
```

**Request Body:**
```json
{
  "name": "string",
  "priority": "high|medium|low",
  "due_delta": "integer"  // days
}
```

### **11.3 Audit Log Search**
```
GET /api/v1/admin/audit?filters...
```

**Query Parameters:**
- `user_id`: filter by user
- `ticket_id`: filter by ticket
- `action`: filter by action type
- `start_date`: filter by date range
- `end_date`: filter by date range

### **11.4 Export Audit Logs**
```
POST /api/v1/admin/audit/export
```

**Request Body:**
```json
{
  "filters": {},
  "format": "csv|json|zip"
}
```

**Response:** Job ID, download link sent when ready

### **11.5 Trigger Backup**
```
POST /api/v1/admin/backup
```

### **11.6 Configure Integrations**
```
POST /api/v1/admin/integrations
```

**Request Body:**
```json
{
  "type": "email|whatsapp|slack",
  "config": {}  // type-specific configuration
}
```

---

## **12. Analytics Endpoints**

### **12.1 Get Dashboard Data**
```
GET /api/v1/analytics/dashboard
```

**Query Parameters:**
- `role`: requestor|moderator|assignee|admin
- `department_id`: filter by department (for assignee)
- `date_range`: filter by date

**Response:** Role-specific dashboard metrics

### **12.2 Get Department Metrics**
```
GET /api/v1/analytics/departments/{id}/metrics
```

### **12.3 Get Ticket Trends**
```
GET /api/v1/analytics/trends
```

---

## **13. WebSocket Events**

### **13.1 Connection**
```
Client connects to: ws://host/api/v1/ws/tickets/{ticket_id}?token={jwt_token}
```

Or via subprotocol header (preferred):
```
Sec-WebSocket-Protocol: jwt, {jwt_token}
```

Or via Authorization header:
```
Authorization: Bearer {jwt_token}
```

**Authentication:** JWT token validated during WebSocket upgrade handshake

### **13.2 Client → Server Events**

| Event | Payload | Description |
| ----- | ----- | ----- |
| `chat:send` | `{message, mentions[], attachments[]}` | Send chat message |
| `chat:typing` | `{}` | User is typing |
| `chat:stop_typing` | `{}` | User stopped typing |
| `ticket:join` | `{ticket_id}` | Join ticket room |
| `ticket:leave` | `{ticket_id}` | Leave ticket room |

### **13.3 Server → Client Events**

| Event | Payload | Description |
| ----- | ----- | ----- |
| `chat:message` | `{id, sender, message, timestamp, mentions[]}` | New message received |
| `chat:participant_added` | `{user_id, ticket_id}` | Participant added |
| `chat:participant_removed` | `{user_id, ticket_id}` | Participant removed |
| `ticket:created` | `{ticket_id, requestor_id}` | New ticket created |
| `ticket:assigned` | `{ticket_id, assignee_id}` | Ticket assigned |
| `ticket:status_changed` | `{ticket_id, old_status, new_status}` | Status updated |
| `ticket:in_progress` | `{ticket_id}` | Ticket in progress |
| `ticket:completed` | `{ticket_id}` | Ticket completed |
| `ticket:reopened` | `{ticket_id, version}` | Ticket reopened |
| `ticket:postponed` | `{ticket_id, reason}` | Ticket postponed |
| `ticket:closed` | `{ticket_id}` | Ticket closed |
| `sub_ticket:created` | `{parent_id, sub_ticket_id}` | Sub-ticket created |
| `approval:requested` | `{ticket_id, approver_id}` | Approval requested |
| `approval:decision` | `{ticket_id, approved, decision}` | Approval decision |
| `notification:new` | `{id, type, message, ticket_id}` | New notification |
| `notification:read` | `{id}` | Notification read |
| `workload:update` | `{department_id, metrics}` | Department workload updated |

---

## **14. Error Responses**

### **14.1 Standard Error Format**
```json
{
  "error": "string",
  "message": "string",
  "details": {}  // optional
}
```

### **14.2 HTTP Status Codes**

| Code | Meaning | Example |
| ----- | ----- | ----- |
| 200 | Success | GET requests |
| 201 | Created | POST requests (new resource) |
| 400 | Bad Request | Validation errors |
| 401 | Unauthorized | Invalid/missing token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Business rule violation |
| 422 | Unprocessable Entity | Validation failed |
| 500 | Internal Server Error | Server error |

### **14.3 Common Error Scenarios**

**403 Forbidden:**
- requestor trying to access other's tickets
- Assignee trying to access other department's tickets
- Non-Moderator trying to create sub-tickets
- Non-Finance trying to request approval

**409 Conflict:**
- Reopen limit exceeded (max 2)
- Ticket already in that status
- Concurrent update conflict

**422 Unprocessable Entity:**
- Missing required fields
- Invalid status transition
- Postponement without reason

---

## **15. Rate Limiting**

**Rate Limiting Algorithm:** Token Bucket

**Rate Limits by Role:**

| Endpoint | Role | Limit |
| ----- | ----- | ----- |
| `/api/v1/auth/login` | All Users | 10 requests/minute |
| All Endpoints | requestor | 150 requests/minute |
| All Endpoints | Assignee | 250 requests/minute |
| All Endpoints | Moderator | Unlimited |
| All Endpoints | Admin | Unlimited |

**Implementation:**
* Django middleware for rate limiting
* Redis-based token bucket implementation
* Rate limit headers in response: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
* 429 Too Many Requests response when limit exceeded

**Per-Endpoint Limits:**
* WebSocket connections: 10 concurrent connections per user
* File uploads: 500MB per file (server), 250MB (frontend limit shown to user), 100MB total per ticket

---

## **16. Pagination**

All list endpoints support pagination:

**Query Parameters:**
- `page`: page number (default: 1)
- `limit`: items per page (default: 20, max: 100)

**Response Format:**
```json
{
  "data": [],
  "pagination": {
    "page": "integer",
    "limit": "integer",
    "total": "integer",
    "pages": "integer"
  }
}
```

---

## **17. Filtering & Sorting**

Most list endpoints support filtering and sorting:

**Query Parameters:**
- `status`: filter by status
- `department_id`: filter by department
- `priority`: filter by priority
- `created_from`: filter by date range
- `created_to`: filter by date range
- `sort_by`: field to sort by
- `order`: asc|desc

---

## **18. WebSocket Authentication**

WebSocket connections require JWT token:

**Connection:**
```
ws://host/api/v1/ws/tickets/{ticket_id}?token={jwt_token}
```

Or via subprotocol header (preferred):
```
Sec-WebSocket-Protocol: jwt, {jwt_token}
```

Or via Authorization header:
```
Authorization: Bearer {jwt_token}
```

**Authentication Flow:**
1. Client initiates WebSocket connection with JWT token
2. Server validates token during upgrade handshake
3. If valid → connection accepted, user added to channel group
4. If invalid → connection rejected with error message

**Security:**
* Token validation on every connection
* No token → connection rejected
* Expired token → connection rejected
* User must re-authenticate to reconnect

---

## **19. File Upload Flow**

1. Client requests signed URL: `POST /api/v1/uploads/request`
2. Client uploads directly to S3 using signed URL
3. Client confirms upload: `POST /api/v1/tickets/{id}/attachments` with file key
4. Backend validates and processes file (async virus scan)

**File Upload Security:**
* **Size Limits:** 500MB server limit, 250MB frontend limit (shown to user)
* **File Types:** PDF, TXT, DOCX, XLSX (documents), MP4, MOV, MKV, AVI (videos, transcoded to MP4), JPG, PNG, GIF (images, converted to WebP)
* **Validation:** MIME type and file extension validation on both client and server
* **Storage:** Files saved outside web root with random UUID filenames
* **Security Scanning:** Antivirus scan in background; infected files deleted immediately
* **Processing:** Images converted to WebP, videos transcoded to MP4 (async)
* **Logging:** All upload attempts logged (user, timestamp, file info, scan results)
* **Authentication:** Only authenticated users can upload
* **Security Headers:** `Content-Disposition: attachment; filename="original_name.pdf"` on downloads

---

## **20. Idempotency**

For critical operations (create, update, delete), include `idempotency_key` in request:

```json
{
  "idempotency_key": "uuid",
  // ... other fields
}
```

**Implementation:**
* Idempotency keys stored in Redis (TTL: 24 hours)
* Server checks for existing key before processing
* If key exists → returns cached response (no duplicate processing)
* If key doesn't exist → processes request and stores key with response
* Key format: `idempotency:{user_id}:{key}`

**When to Use:**
* Ticket creation
* Status transitions
* Approval requests
* File uploads
* Any operation that should not be duplicated

**Deduplication Logic:**
* Same idempotency key within 24 hours → returns same response
* Different idempotency key → new request processed
* Key TTL: 24 hours (configurable)




