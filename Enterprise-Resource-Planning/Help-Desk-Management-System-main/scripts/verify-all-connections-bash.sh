#!/bin/bash
# Comprehensive Connection Verification Script (Bash for Git Bash/Windows)
# Tests all connections: PostgreSQL, PgBouncer, Redis cache, Redis Channels, Redis Celery

set +e  # Don't exit on error, collect all failures

# Load environment variables from .env if it exists
if [ -f .env ]; then
    # Filter out comments and empty lines, then export
    export $(grep -v '^#' .env | grep -v '^$' | xargs)
fi

echo "=== Comprehensive Connection Verification ==="
echo ""

FAILED=0

# 1. PostgreSQL Connection (via PgBouncer)
echo "1. Testing PostgreSQL connection through PgBouncer..."
if docker-compose exec -T pgbouncer pg_isready -h localhost -p 6432 -U hdms_user -d hdms_db > /dev/null 2>&1; then
    echo "✓ PgBouncer is accessible"
    
    # Test actual query
    if docker-compose exec -T pgbouncer psql -h localhost -p 6432 -U hdms_user -d hdms_db -c "SELECT 1;" > /dev/null 2>&1; then
        echo "✓ PostgreSQL connection OK"
    else
        echo "✗ PostgreSQL query FAILED"
        FAILED=1
    fi
else
    echo "✗ PostgreSQL connection FAILED (PgBouncer not accessible)"
    FAILED=1
fi

# 2. Redis Cache Connection (database 0)
echo "2. Testing Redis cache connection (database 0)..."
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
if [ -n "$REDIS_PASSWORD" ]; then
    if docker-compose exec -T redis redis-cli -a "$REDIS_PASSWORD" -n 0 ping > /dev/null 2>&1; then
        echo "✓ Redis cache connection OK (with password)"
    else
        echo "✗ Redis cache connection FAILED"
        FAILED=1
    fi
else
    if docker-compose exec -T redis redis-cli -n 0 ping > /dev/null 2>&1; then
        echo "✓ Redis cache connection OK (no password)"
    else
        echo "✗ Redis cache connection FAILED"
        FAILED=1
    fi
fi

# 3. Redis Channels Connection (database 1)
echo "3. Testing Redis Channels connection (database 1)..."
if [ -n "$REDIS_PASSWORD" ]; then
    if docker-compose exec -T redis redis-cli -a "$REDIS_PASSWORD" -n 1 ping > /dev/null 2>&1; then
        echo "✓ Redis Channels connection OK"
    else
        echo "✗ Redis Channels connection FAILED"
        FAILED=1
    fi
else
    if docker-compose exec -T redis redis-cli -n 1 ping > /dev/null 2>&1; then
        echo "✓ Redis Channels connection OK"
    else
        echo "✗ Redis Channels connection FAILED"
        FAILED=1
    fi
fi

# 4. Redis Celery Broker Connection (database 2)
echo "4. Testing Redis Celery broker connection (database 2)..."
if [ -n "$REDIS_PASSWORD" ]; then
    if docker-compose exec -T redis redis-cli -a "$REDIS_PASSWORD" -n 2 ping > /dev/null 2>&1; then
        echo "✓ Redis Celery broker connection OK"
    else
        echo "✗ Redis Celery broker connection FAILED"
        FAILED=1
    fi
else
    if docker-compose exec -T redis redis-cli -n 2 ping > /dev/null 2>&1; then
        echo "✓ Redis Celery broker connection OK"
    else
        echo "✗ Redis Celery broker connection FAILED"
        FAILED=1
    fi
fi

echo ""
if [ $FAILED -eq 0 ]; then
    echo "=== All connection tests passed! ==="
    exit 0
else
    echo "=== Some connection tests failed! ==="
    exit 1
fi

