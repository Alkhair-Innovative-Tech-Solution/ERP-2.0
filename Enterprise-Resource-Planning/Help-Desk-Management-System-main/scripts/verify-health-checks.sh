#!/bin/bash
# Health Check Verification Script
# Validates all container health checks are working

set -e

echo "=== Health Check Verification ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# Check PostgreSQL health
echo "1. Checking PostgreSQL health..."
if docker inspect hdms_postgres --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; then
    echo -e "${GREEN}✓ PostgreSQL is healthy${NC}"
else
    echo -e "${RED}✗ PostgreSQL health check failed${NC}"
    FAILED=1
fi

# Check PgBouncer health
echo "2. Checking PgBouncer health..."
if docker inspect hdms_pgbouncer --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; then
    echo -e "${GREEN}✓ PgBouncer is healthy${NC}"
else
    echo -e "${RED}✗ PgBouncer health check failed${NC}"
    FAILED=1
fi

# Check Redis health
echo "3. Checking Redis health..."
if docker inspect hdms_redis --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; then
    echo -e "${GREEN}✓ Redis is healthy${NC}"
else
    echo -e "${RED}✗ Redis health check failed${NC}"
    FAILED=1
fi

echo ""
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}=== All health checks passed! ===${NC}"
    exit 0
else
    echo -e "${RED}=== Some health checks failed! ===${NC}"
    exit 1
fi

