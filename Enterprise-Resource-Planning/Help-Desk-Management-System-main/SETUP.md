# HDMS Infrastructure Setup Guide

## Issues Fixed

1. ✅ **PostgreSQL Password**: Now properly configured via environment variables
2. ✅ **Service Dockerization**: All services have Dockerfiles, need to be built
3. ✅ **Verification Scripts**: Created bash scripts for Git Bash

## Quick Setup Steps

### Step 1: Create .env File (Root)

Create `.env` file in project root:

```bash
# PostgreSQL Configuration
POSTGRES_DB=hdms_db
POSTGRES_USER=hdms_user
POSTGRES_PASSWORD=your_secure_password_here

# PgBouncer Configuration
PGBOUNCER_POOL_SIZE=25

# Redis Configuration (optional for dev)
REDIS_PASSWORD=
```

### Step 2: Start Infrastructure

```bash
docker-compose up -d postgres pgbouncer redis
```

Wait for containers to be healthy (about 10-15 seconds).

### Step 3: Build Service Images

**IMPORTANT**: Services need to be built before they can run!

```bash
# Build all services
./scripts/build-services.sh

# OR build individually
docker-compose build user-service
docker-compose build ticket-service
docker-compose build communication-service
docker-compose build file-service
docker-compose build frontend-service
```

### Step 4: Verify Infrastructure

```bash
# Check status
./scripts/check-status.sh

# Test connections
./scripts/verify-all-connections-bash.sh
```

### Step 5: Start All Services

```bash
docker-compose up -d
```

## Common Issues

### Issue: "PostgreSQL password not set"
**Solution**: Create `.env` file with `POSTGRES_PASSWORD=your_password`

### Issue: "Service not found" or "Image not found"
**Solution**: Build services first: `./scripts/build-services.sh`

### Issue: "Redis NOAUTH Authentication required"
**Solution**: Set `REDIS_PASSWORD=` (empty) in `.env` or restart Redis:
```bash
docker-compose stop redis
docker-compose rm -f redis
docker-compose up -d redis
```

### Issue: "PgBouncer not accessible"
**Solution**: Make sure PostgreSQL is healthy first:
```bash
docker-compose up -d postgres
# Wait for "healthy" status
docker-compose up -d pgbouncer
```

## Verification

After setup, verify everything works:

```bash
# 1. Check container status
docker-compose ps

# 2. Test PostgreSQL
docker-compose exec postgres psql -U hdms_user -d hdms_db -c "SELECT version();"

# 3. Test PgBouncer
docker-compose exec pgbouncer pg_isready -h localhost -p 6432

# 4. Test Redis
docker-compose exec redis redis-cli ping

# 5. Run full verification
./scripts/verify-all-connections-bash.sh
```

## Next Steps

Once infrastructure is running:
1. Run migrations: `docker-compose exec user-service python manage.py migrate`
2. Create superuser: `docker-compose exec user-service python manage.py createsuperuser`
3. Start all services: `docker-compose up`

