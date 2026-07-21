#!/bin/bash
# Docker Compose Startup Script
# Starts infrastructure services in dependency order

set -e

echo "=== Starting HDMS Infrastructure ==="
echo ""

# Start PostgreSQL first
echo "1. Starting PostgreSQL..."
docker-compose up -d postgres

# Wait for PostgreSQL to be healthy
echo "2. Waiting for PostgreSQL to be healthy..."
timeout=60
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker inspect hdms_postgres --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; then
        echo "   PostgreSQL is healthy!"
        break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo "   Waiting... ($elapsed/$timeout seconds)"
done

# Start PgBouncer (depends on PostgreSQL)
echo "3. Starting PgBouncer..."
docker-compose up -d pgbouncer

# Wait for PgBouncer to be healthy
echo "4. Waiting for PgBouncer to be healthy..."
timeout=30
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker inspect hdms_pgbouncer --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; then
        echo "   PgBouncer is healthy!"
        break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo "   Waiting... ($elapsed/$timeout seconds)"
done

# Start Redis
echo "5. Starting Redis..."
docker-compose up -d redis

# Wait for Redis to be healthy
echo "6. Waiting for Redis to be healthy..."
timeout=30
elapsed=0
while [ $elapsed -lt $timeout ]; do
    if docker inspect hdms_redis --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; then
        echo "   Redis is healthy!"
        break
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    echo "   Waiting... ($elapsed/$timeout seconds)"
done

echo ""
echo "=== Infrastructure services started successfully! ==="
echo "PostgreSQL: Ready"
echo "PgBouncer: Ready"
echo "Redis: Ready"
echo ""
echo "You can now start Django services."

