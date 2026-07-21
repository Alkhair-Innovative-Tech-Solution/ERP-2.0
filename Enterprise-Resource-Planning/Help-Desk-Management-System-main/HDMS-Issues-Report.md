# HDMS — Issues & Action Plan
**Date:** 2026-04-24  
**Scope:** HDMS codebase only (ticket-service, communication-service, file-service, frontend-service, nginx)

---

## 1. Email Notifications — Fixed Today

All bugs found and fixed in `ticket-service`. Details below for record.

### Bugs Fixed

| # | File | Bug | Status |
|---|------|-----|--------|
| 1 | `services/ticket-service/src/apps/tickets/api.py:41` | FSM action key `'start'` wrong — should be `'start_progress'`. `in_progress` email never fired. | ✅ Fixed |
| 2 | `services/ticket-service/src/apps/tickets/api.py:42` | `'complete'` mapping dead — no such FSM action exists | ✅ Fixed |
| 3 | `services/ticket-service/src/apps/notifications/email.py` | `notify_ticket_completed` — dead function, FSM has no `complete` transition | ✅ Deleted |
| 4 | `services/ticket-service/src/apps/notifications/email.py:49` | `_wrap_html` HTML escaping applied to wrong variable — XSS risk in emails | ✅ Fixed |
| 5 | `services/ticket-service/src/apps/notifications/email.py:86` | `_get_info` psycopg2 connection leak on exception | ✅ Fixed (`try/finally`) |
| 6 | `services/ticket-service/src/apps/tickets/api.py:250` | `reject_ticket` endpoint had no AuditLog (asymmetric with `postpone_ticket`) | ✅ Fixed |
| 7 | `services/ticket-service/src/apps/notifications/email.py:20` | `_ticket_url` dead function — never called anywhere | ✅ Deleted |

### Open Data Issue

`Ubaid` employee (`c6f1e095-f3c6-4d67-822b-7ca3ee74e31b`) has no email in `auth_db.employees_employee`.  
Notifications silently skip for this user.  
→ Fix via auth-service admin: add `org_email` or `personal_email` for this record.

### Remaining Technical Debt (Email)

- `daemon=True` threads — emails may drop on server shutdown. Use Celery for production.
- `notify_ticket_postponed` — same generic body sent to both requestor and assignee. No personalized salutation.
- `notify_ticket_assigned` and `notify_ticket_acknowledged` not in `_notify_on_status` mapping — only fire via dedicated endpoints (`/assign`, `/acknowledge`). If someone calls generic `/status` endpoint with these actions, no email fires.

---

## 2. Nginx — Production Gaps

### 2.1 Critical

**No HTTPS**  
Port 443 open in `docker-compose.yml` but `nginx/templates/api-gateway.conf.template` only has `listen 80`.  
→ Add SSL certificate + HTTPS server block + HTTP redirect.  
→ File to edit: `nginx/templates/api-gateway.conf.template`

**Admin panels publicly accessible**  
`/ticket-admin/`, `/chat-admin/`, `/file-admin/` — no IP restriction.  
→ Add `allow <office-IP>; deny all;` to each admin location block.  
→ File to edit: `nginx/templates/api-gateway.conf.template`

### 2.2 Medium

**No rate limiting on API routes**  
No `limit_req_zone` defined. All endpoints open to brute force / abuse.  
→ Add rate limiting at minimum for `/api/auth/` routes.

**No proxy timeouts on API routes**  
Only WebSocket has `proxy_read_timeout`. API routes have no timeout — hanging connections possible.  
```nginx
# Add to all API location blocks:
proxy_connect_timeout 10s;
proxy_send_timeout 30s;
proxy_read_timeout 60s;
```

### 2.3 Minor

- `/api/employees` location missing trailing slash (inconsistent with other routes)
- No `X-Request-ID` header for distributed tracing

---

## 3. Docker Compose — Security Issues

### Critical

**Backend ports exposed on host**  
All backend services have `ports:` mapping — nginx can be bypassed entirely.

```yaml
# CURRENT (wrong for production):
ticket-service:
  ports:
    - "8002:8002"

# FIX:
ticket-service:
  expose:
    - "8002"
```

Apply to: `ticket-service`, `communication-service`, `file-service`, `frontend-service`.  
Only nginx should have `ports: 80:80` and `ports: 443:443`.

### Medium

**`CORS_ALLOWED_ORIGINS` not set**  
Warning on every container start. Set in root `.env`:
```
CORS_ALLOWED_ORIGINS=https://your-domain.com
```

**Hardcoded IP in frontend service**  
```yaml
NEXT_PUBLIC_API_URL=http://10.0.8.135
```
→ Replace with domain name.

---

## 4. Ticket Service — Code Issues

### FSM & API

- `communicate-service` depends on `ticket-service` being healthy — unnatural coupling. Chat should be independent.
- `create_ticket` endpoint: `requestor_id` accepts any string (no UUID validation). `TODO` comment left in for user validation — still disabled.
- `update_ticket` (`PATCH /{ticket_id}`) allows setting `assignee_id` directly without FSM transition. Bypasses `notify_ticket_assigned`. Assignment should go through `/assign` endpoint only.

### Signals

`services/ticket-service/src/apps/tickets/signals.py` — both signal handlers (`ticket_pre_save`, `ticket_saved`) are empty `pass` stubs. Either implement or remove.

---

## 5. Tomorrow's Action Plan

### Priority 1 — Must Do
- [ ] Add email for Ubaid employee in auth-service admin
- [ ] `expose:` instead of `ports:` for all backend services in `docker-compose.yml`
- [ ] IP-restrict admin panels in nginx template

### Priority 2 — Should Do
- [ ] HTTPS setup (SSL certificate + nginx HTTPS block)
- [ ] `CORS_ALLOWED_ORIGINS` set in `.env`
- [ ] Hardcoded IP → domain in frontend docker-compose env
- [ ] Add proxy timeouts to nginx API location blocks

### Priority 3 — Technical Debt
- [ ] Replace daemon email threads with Celery tasks
- [ ] Add `notify_ticket_assigned` + `notify_ticket_acknowledged` to `_notify_on_status` mapping
- [ ] Remove or implement empty signal handlers in `tickets/signals.py`
- [ ] Fix `update_ticket` PATCH to block direct `assignee_id` update (force through `/assign`)

---

## 6. Key Files

| File | Purpose |
|------|---------|
| `nginx/templates/api-gateway.conf.template` | All nginx routing, headers, SSL to be added here |
| `docker-compose.yml` | ports → expose changes here |
| `services/ticket-service/src/apps/notifications/email.py` | Email notification logic |
| `services/ticket-service/src/apps/tickets/api.py` | Ticket API + FSM transitions + notify calls |
| `services/ticket-service/src/apps/tickets/signals.py` | Empty stubs — clean up or implement |
