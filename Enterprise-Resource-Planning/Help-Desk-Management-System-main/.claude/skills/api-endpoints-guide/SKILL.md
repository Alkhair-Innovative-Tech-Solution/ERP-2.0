---
name: api-endpoints-guide
description: Authoritative reference for HDMS API endpoints across ticket-service, communication-service, file-service, and auth-service. Invoke before reading Django Ninja routers or frontend service clients to answer questions like "which endpoint does X?", "what's the URL for Y?", or when wiring a new frontend call.
---

# HDMS API Endpoints Reference

> **Purpose:** Single-shot lookup so Claude doesn't re-grep Django routers. Update this file whenever a router or frontend service client changes.

## Service Map

| Service | Port | Proxy prefix (via `next.config.ts`) | Auth |
|---------|------|-------------------------------------|------|
| auth-service | 8000 | `/api/auth/*`, `/api/employees/*`, `/api/*` fallback | External (issues JWT) |
| ticket-service | 8002 | `/api/v1/tickets/*`, `/api/v1/approvals/*` | `RemoteJWTAuthentication` |
| communication-service | 8003 | `/api/v1/chat/*`, `/api/v1/notifications/*` | `RemoteJWTAuthentication` |
| file-service | 8005 | `/api/v1/files/*` | `RemoteJWTAuthentication` |

All backend routers are Django Ninja (`@router.<method>`). Each service registers router prefixes in `src/core/routers.py`.

---

## 🎫 ticket-service (8002)

### Tickets — `/api/v1/tickets/`
Router: `services/ticket-service/src/apps/tickets/api.py`

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/` | Create ticket (`TicketIn`) |
| GET | `/` | List tickets. Query: `status`, `requestor_id`, `assignee_id`, `exclude_drafts=true` |
| GET | `/{id}` | Get ticket detail |
| PATCH | `/{id}` | Update ticket fields (`TicketUpdateIn`) |
| DELETE | `/{id}` | Delete (frontend calls this; verify in router) |
| POST | `/{id}/status` | Generic FSM status update (`StatusUpdateIn`) |
| GET | `/{id}/sub-tickets` | List child tickets |
| POST | `/{id}/attachments` | Attach file reference (UUID from file-service) |
| GET | `/{id}/history` | Audit log entries |

### FSM Transition Endpoints (ticket-service)
Explicit transition endpoints — use these instead of generic `/status` when the transition has structured payload.

| Method | Path | FSM: `from → to` |
|--------|------|------------------|
| POST | `/{id}/confirm-review` | submitted → in-review (moderator first touch, assigns fields) |
| POST | `/{id}/assign` | in-review → assigned |
| POST | `/{id}/reject` | any → rejected (with reason) |
| POST | `/{id}/postpone` | any → postponed (with reason) |
| PATCH | `/{id}/acknowledge` | assigned → acknowledged |
| PATCH | `/{id}/progress` | acknowledged → in_progress (progress notes) |
| PATCH | `/{id}/sla` | update due date (any state) |

FSM chain: `draft → submitted → in-review → assigned → acknowledged → in_progress → resolved → closed`. Rejection/postpone possible from most states.

### Approvals — `/api/v1/approvals/`
Router: `services/ticket-service/src/apps/approvals/api.py`

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/` | Create approval request |
| GET | `/ticket/{ticket_id}` | List approvals for ticket |
| POST | `/{approval_id}/decision` | Approve/reject decision |

---

## 💬 communication-service (8003)

### Chat — `/api/v1/chat/`
Router: `services/communication-service/src/apps/chat/api.py`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/messages/ticket/{ticket_id}` | Full message history for a ticket |
| POST | `/messages` | Create new message (`ChatMessageIn`) |

WebSocket: real-time chat via native WS (handled by Daphne/Channels, not Ninja). Frontend uses `src/hooks/useSocket.ts`.

### Notifications — `/api/v1/notifications/`
Router: `services/communication-service/src/apps/notifications/api.py`

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/` | List user's notifications. Query: `user_id`, `unread_only`, `page`, `page_size` |
| GET | `/unread-count` | `{count: number}` for user |
| POST | `/{id}/read` | Mark one as read |
| POST | `/mark-all-read` | Mark all read for user |
| DELETE | `/{id}` | Delete one |
| DELETE | `/delete-all` | Delete all for user |

---

## 📁 file-service (8005)

### Files — `/api/v1/files/`
Router: `services/file-service/src/apps/files/api.py`

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/upload` | Upload file. Query: `ticket_id?`, `chat_message_id?`, `category?`, `purpose?`, `uploaded_by_id?`. Multipart body. |
| GET | `/{file_id_or_key}/status` | Processing status (Celery-backed) |
| GET | `/{file_id_or_key}/download` | Binary download |
| GET | `/{file_id_or_key}` | File metadata |

**Rule:** All attachments flow through here. ticket-service and communication-service store only the returned UUID reference — never the binary.

---

## 🔐 auth-service (8000, external)

This service lives outside the HDMS repo. The frontend proxies requests via `next.config.ts` fallback rule (`/api/*` → `http://auth_service:8000`).

### Auth — `/api/auth/*`
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login-hdms` | HDMS-scoped login (returns access + refresh + user) |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Invalidate session |
| GET | `/api/auth/me` | Current user from JWT |

### Users — `/api/users/*`
| Method | Path | Purpose |
|--------|------|---------|
| POST | `/login/` | Generic user login (not HDMS-specific) |
| POST | `/register/` | Register user |
| GET | `/me/` | Current user |
| GET | `/{id}/` | User detail |
| PATCH | `/{id}/` | Update user (multipart allowed) |
| DELETE | `/{id}/` | Delete user |
| POST | `/change-password/` |  |
| POST | `/forgot-password/` |  |
| POST | `/reset-password/` |  |
| GET | `/departments/` | List user's departments |

### Directory & Permissions
| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/departments` | All departments |
| GET | `/api/employees?employee_id=...` | Employee lookup |
| GET | `/api/permissions/hdms-users` | HDMS users with permission filters |

### Analytics — `/api/analytics/*`
Served by auth-service. Used by admin dashboard.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/analytics/` | Aggregate dashboard stats (with filter query) |
| GET | `/api/analytics/department-load/` | Load per department |
| GET | `/api/analytics/priority-trends/?period=` | Priority trends |
| GET | `/api/analytics/ticket-volume/?period=` | Volume over time |
| GET | `/api/analytics/status-distribution/` | Status breakdown |
| GET | `/api/analytics/resolution-time/` | Resolution time avg |
| GET | `/api/analytics/satisfaction/` | CSAT |
| GET | `/api/analytics/export/?...` | Blob export |

---

## 🧭 How the Frontend Talks to These

Frontend service clients (`services/frontend-service/src/services/api/*.ts`) wrap these endpoints. Key clients:

- `authService.ts` — `/api/auth/*`
- `userService.ts` — `/api/users/*`, `/api/permissions/*`
- `ticketService.ts` — `/api/v1/tickets/*` + some `/api/v1/chat/*` calls (chat within ticket detail)
- `notificationService.ts` — `/api/v1/notifications/*`
- `fileService.ts` — `/api/v1/files/*`
- `departmentService.ts` — `/api/departments`
- `analyticsService.ts` — `/api/analytics/*`

**Common base URL pattern:**
```ts
`${ENV.TICKET_SERVICE_URL}/api/v1/tickets/...`
`${ENV.COMMUNICATION_SERVICE_URL}/api/v1/chat/...`
`${ENV.AUTH_SERVICE_URL}/api/...`
```

All requests use the shared `apiClient` (Axios) which auto-attaches the JWT from `authStore`.

---

## ⚠️ Staleness Check

If you added/renamed a router, update this file immediately. To regenerate the ticket section quickly:
```bash
grep -rn '@router\.\(get\|post\|put\|patch\|delete\)' services/ticket-service/src
```
Same pattern for the other services.

Last inventory: 2026-04-18.
