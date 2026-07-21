# Environment Variables Documentation

**Date**: 2025-01-27  
**Feature**: Database & Infrastructure Setup

---

## Overview

This document describes all environment variables used in HDMS microservices for database and infrastructure configuration.

---

## Root .env File (docker-compose.yml)

Located at project root: `.env`

### PostgreSQL Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `POSTGRES_DB` | Database name | `hdms_db` | No |
| `POSTGRES_USER` | Database user | `hdms_user` | Yes |
| `POSTGRES_PASSWORD` | Database password | - | Yes |

### PgBouncer Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `PGBOUNCER_POOL_SIZE` | Connection pool size | `25` | No |
| Range: 25-50 connections | | | |

### Redis Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_PASSWORD` | Redis password (optional for dev, required for production) | Empty | No |

---

## Service .env Files

Each Django service has its own `.env` file in `services/{service-name}/.env`

### Database Configuration (All Services)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DB_NAME` | Database name | `hdms_db` | No |
| `DB_USER` | Database user | `hdms_user` | Yes |
| `DB_PASSWORD` | Database password | - | Yes |
| `DB_HOST` | Database host (must be `pgbouncer`) | `pgbouncer` | No |
| `DB_PORT` | Database port (must be `6432` for PgBouncer) | `6432` | No |
| `DB_CONNECT_TIMEOUT` | Connection timeout in seconds | `20` | No |

**Important**: Services MUST connect through PgBouncer (`pgbouncer:6432`), not directly to PostgreSQL.

### Redis Configuration (All Services)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_PASSWORD` | Redis password (optional for dev, required for production) | Empty | No |

**Note**: Redis uses different databases:
- Database 0: Django cache (all services)
- Database 1: Django Channels (communication-service only)
- Database 2: Celery broker (file-service only)

### Django Settings (All Services)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SECRET_KEY` | Django secret key | - | Yes |
| `DEBUG` | Debug mode | `True` | No |
| `ALLOWED_HOSTS` | Allowed hosts (comma-separated) | `*` | No |

### JWT Settings (All Services)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `ACCESS_TOKEN_LIFETIME` | Access token lifetime in minutes | `60` | No |
| `REFRESH_TOKEN_LIFETIME` | Refresh token lifetime in minutes | `1440` | No |
| `JWT_ALGORITHM` | JWT algorithm | `HS256` | No |
| `JWT_SECRET_KEY` | JWT secret key | Uses `SECRET_KEY` if not set | No |

### Service URLs (All Services)

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `USER_SERVICE_URL` | User service URL | `http://user-service:8001` | No |
| `TICKET_SERVICE_URL` | Ticket service URL | `http://ticket-service:8002` | No |
| `COMMUNICATION_SERVICE_URL` | Communication service URL | `http://communication-service:8003` | No |
| `FILE_SERVICE_URL` | File service URL | `http://file-service:8005` | No |

### File Service Specific

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CELERY_BROKER_URL` | Celery broker URL (Redis database 2) | `redis://redis:6379/2` | No |
| `MEDIA_ROOT` | Media files root directory | `/app/media` | No |

---

## Environment-Specific Configuration

### Development

- `REDIS_PASSWORD`: Leave empty (no authentication)
- `DEBUG`: Set to `True`
- `ALLOWED_HOSTS`: Can use `*` for local development

### Production

- `REDIS_PASSWORD`: **MUST** be set to a strong password
- `POSTGRES_PASSWORD`: **MUST** be changed from default
- `SECRET_KEY`: **MUST** be changed from default
- `DEBUG`: Set to `False`
- `ALLOWED_HOSTS`: Set to specific domain names

---

## Connection String Formats

### Database Connection (via PgBouncer)

```
postgresql://{DB_USER}:{DB_PASSWORD}@pgbouncer:6432/{DB_NAME}
```

### Redis Cache (Database 0)

Without password:
```
redis://redis:6379/0
```

With password:
```
redis://:{REDIS_PASSWORD}@redis:6379/0
```

### Redis Channels (Database 1)

Without password:
```
redis://redis:6379/1
```

With password:
```
redis://:{REDIS_PASSWORD}@redis:6379/1
```

### Redis Celery Broker (Database 2)

Without password:
```
redis://redis:6379/2
```

With password:
```
redis://:{REDIS_PASSWORD}@redis:6379/2
```

---

## Setup Instructions

1. Copy `.env.example` to `.env` in project root
2. Copy `services/{service-name}/.env.example` to `services/{service-name}/.env` for each service
3. Update all password values for production
4. Set `REDIS_PASSWORD` for production environments
5. Verify all services can read environment variables correctly

---

## Security Notes

- **Never commit `.env` files to version control** (already in `.gitignore`)
- **Change all default passwords** in production
- **Use strong passwords** for `POSTGRES_PASSWORD` and `REDIS_PASSWORD`
- **Rotate secrets regularly** in production environments
- **Use different passwords** for development, staging, and production

---

## Validation

After setting up environment variables:

1. Start infrastructure: `docker-compose up -d postgres pgbouncer redis`
2. Verify connections: `./scripts/verify-all-connections.sh`
3. Check health: `./scripts/verify-health-checks.sh`
4. Test service startup: Start each Django service and verify it connects successfully

