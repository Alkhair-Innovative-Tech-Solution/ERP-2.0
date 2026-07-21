#!/bin/bash
# Comprehensive Connection Verification Script
# Tests all connections: PostgreSQL, PgBouncer, Redis cache, Redis Channels, Redis Celery

set -e

echo "=== Comprehensive Connection Verification ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# 1. PostgreSQL Connection (via PgBouncer)
echo "1. Testing PostgreSQL connection through PgBouncer..."
if ./scripts/verify-db-connection.sh > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PostgreSQL connection OK${NC}"
else
    echo -e "${RED}✗ PostgreSQL connection FAILED${NC}"
    FAILED=1
fi

# 2. Redis Cache Connection (database 0)
echo "2. Testing Redis cache connection (database 0)..."
if ./scripts/verify-cache-connection.sh > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis cache connection OK${NC}"
else
    echo -e "${RED}✗ Redis cache connection FAILED${NC}"
    FAILED=1
fi

# 3. Redis Channels Connection (database 1)
echo "3. Testing Redis Channels connection (database 1)..."
if ./scripts/verify-channels-connection.sh > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis Channels connection OK${NC}"
else
    echo -e "${RED}✗ Redis Channels connection FAILED${NC}"
    FAILED=1
fi

# 4. Redis Celery Broker Connection (database 2)
echo "4. Testing Redis Celery broker connection (database 2)..."
if ./scripts/verify-celery-broker.sh > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Redis Celery broker connection OK${NC}"
else
    echo -e "${RED}✗ Redis Celery broker connection FAILED${NC}"
    FAILED=1
fi

echo ""
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}=== All connection tests passed! ===${NC}"
    exit 0
else
    echo -e "${RED}=== Some connection tests failed! ===${NC}"
    exit 1
fi

