# HDMS Production Readiness Report
**Date:** 2026-04-24  
**Prepared by:** Claude (Senior Lead)  
**Scope:** HDMS microservices — email notifications, nginx, Docker, SSO architecture

---

## 1. Email Notification System

### Status: Fixed (2026-04-24)

Root cause analysis confirmed SMTP credentials and `_get_info` (auth_db lookup) both working.
Bugs were in code logic only — all fixed in today's session.

### Bugs Fixed

| # | File | Bug | Fix Applied |
|---|------|-----|-------------|
| 1 | `api.py:41` | `'start'` key → FSM uses `start_progress` — `in_progress` email never fired | Changed to `'start_progress'` |
| 2 | `api.py:42` | `'complete'` mapping — no such FSM action exists | Removed dead mapping |
| 3 | `email.py:42` | `notify_ticket_completed` — dead function, unreachable | Deleted |
| 4 | `email.py:49` | `_wrap_html` — HTML escaping computed but never applied (XSS risk) | Fixed to use escaped string in loop |
| 5 | `email.py:86` | `_get_info` — psycopg2 connection leak if `cur.execute()` throws | Wrapped in `try/finally` |
| 6 | `api.py:250` | `reject_ticket` — no AuditLog created (asymmetric with `postpone_ticket`) | Added AuditLog |
| 7 | `email.py:20` | `_ticket_url` — dead function, never called | Deleted |

### Remaining Known Issue (Data)

**Ubaid's employee record (`c6f1e095-f3c6-4d67-822b-7ca3ee74e31b`) has no email** in `auth_db.employees_employee`.  
→ Notifications silently skip for this user.  
→ Fix: Add `org_email` or `personal_email` via auth-service admin panel.

### Pending Minor Issues (Not Fixed Yet)

- Daemon threads (`daemon=True`) — in-flight emails may drop on server shutdown. Celery task queue recommended for production.
- `notify_ticket_postponed` — sends identical impersonal body to both requestor and assignee (no personalized salutation).

---

## 2. Docker & Nginx — Production Gaps

### 2.1 CRITICAL

**A. No HTTPS**  
Port 443 is open in `docker-compose.yml` but `nginx.conf` only has `listen 80`.  
No SSL certificate, no HTTP→HTTPS redirect. All traffic is plain text.  
→ Action: Set up SSL (Let's Encrypt or internal CA). Add HTTPS server block + redirect.

**B. Backend Ports Exposed on Host**  
```yaml
ticket-service:      ports: "8002:8002"
communication-service: ports: "8003:8003"
file-service:        ports: "8005:8005"
frontend-service:    ports: "3001:3000"
```
Nginx can be bypassed — anyone on the network can hit services directly.  
→ Action: Replace `ports:` with `expose:` on all backend services. Only nginx gets `ports: 80:80 / 443:443`.

**C. DB Password Not Changed**  
`.env` contains: `erp_admin_password_change_me_in_prod`  
→ Action: Change immediately before any production deployment.

**D. Admin Panels Publicly Accessible**  
`/auth-admin/`, `/ticket-admin/`, `/chat-admin/`, `/file-admin/` — no IP restriction, no extra auth layer.  
→ Action: Add `allow <office-IP>; deny all;` to each admin `location` block in nginx.

---

### 2.2 MEDIUM

**E. CORS_ALLOWED_ORIGINS Not Set**  
Warning on every container start. Blank value = ineffective CORS policy.  
→ Action: Set in `.env`: `CORS_ALLOWED_ORIGINS=https://your-domain.com`

**F. Hardcoded Internal IP in Frontend**  
```yaml
NEXT_PUBLIC_API_URL=http://10.0.8.135
```
Internal IP hardcoded — breaks if server IP changes.  
→ Action: Use domain name instead of IP.

**G. No Rate Limiting on Auth Endpoints**  
`/api/auth/login` and related endpoints unprotected. Brute force possible.  
→ Action: Add `limit_req_zone` in nginx for auth routes.

**H. No Proxy Timeouts on API Routes**  
`proxy_read_timeout` only set for WebSocket. API routes have no timeout — hanging connections possible.  
→ Action: Add `proxy_connect_timeout 10s; proxy_send_timeout 30s; proxy_read_timeout 60s;` to API location blocks.

---

### 2.3 MINOR

- `/api/employees` location block missing trailing slash (inconsistent with other routes)
- No `X-Request-ID` header for request tracing across services

---

## 3. SSO Architecture — Structural Issue

### Current State

Auth-service is an SSO provider for the entire ERP (HDMS, VMS, SIS).  
However, it is proxied through **HDMS's nginx**:

```nginx
location /api/auth/ { proxy_pass http://auth_service:8000; }
```

**Problem:** HDMS nginx going down = SSO going down for the entire organization.  
Auth is tightly coupled to HDMS infrastructure. VMS and other services likely also depend on this path.

### Target Architecture (To Discuss / Plan)

```
[auth.iak.ngo] ← own nginx, own domain, own Docker Compose
      │
      └── Issues JWTs
            │
    ┌───────┼───────┐
    ▼       ▼       ▼
  HDMS     VMS     SIS
(validates (validates (validates
  JWT)      JWT)      JWT)
```

Each application should:
- Hit auth-service directly via its own domain for login/token
- Validate JWTs locally — not proxy auth routes through application nginx

### Action Items (Auth)

| Priority | Action |
|----------|--------|
| High | Give auth-service its own domain/subdomain |
| High | Auth-service should have its own Docker Compose (independent deployment) |
| High | Remove `/api/auth/` and `/api/employees/` proxy from HDMS nginx |
| Medium | Add rate limiting on auth endpoints |
| Medium | Confirm JWT secret is securely shared across all services (not copy-pasted in each `.env`) |
| Low | Health check endpoint on auth-service |

---

## 4. Tomorrow's Priority Order

### Must Do
1. Add employee emails in auth-service admin (so notifications reach all users)
2. Replace `ports:` → `expose:` on backend services (close direct access)
3. Admin panel IP restrictions in nginx

### Should Do
4. HTTPS setup — SSL certificate
5. Set `CORS_ALLOWED_ORIGINS` in `.env`
6. Fix hardcoded IP → domain in frontend env
7. Change DB password

### Plan / Discuss
8. Auth-service own domain + independent deployment (SSO decoupling)
9. Rate limiting on auth routes
10. Celery for email queue (replace daemon threads)

---

## 5. Files Reference

| File | Location |
|------|----------|
| Nginx config | `HDMS/nginx/nginx.conf` |
| Nginx API gateway template | `HDMS/nginx/templates/api-gateway.conf.template` |
| Docker Compose | `HDMS/docker-compose.yml` |
| Root .env | `erp_new/.env` |
| Email notifications | `HDMS/services/ticket-service/src/apps/notifications/email.py` |
| Ticket API | `HDMS/services/ticket-service/src/apps/tickets/api.py` |
| Ticket service settings | `HDMS/services/ticket-service/src/core/settings/base.py` |
