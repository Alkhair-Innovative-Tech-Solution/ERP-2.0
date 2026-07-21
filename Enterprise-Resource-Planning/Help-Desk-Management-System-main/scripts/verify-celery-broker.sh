#!/bin/bash
# Celery Broker Connection Verification Script
# Tests Redis broker connectivity (database 2)

set -e

echo "=== Celery Broker Connection Verification ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Check if Redis broker is accessible (database 2) - using docker-compose exec
echo "1. Testing Redis broker connection (database 2)..."
if [ -n "$REDIS_PASSWORD" ]; then
    if docker-compose exec -T redis redis-cli -a "$REDIS_PASSWORD" -n 2 ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis broker is accessible with authentication${NC}"
    else
        echo -e "${RED}✗ Redis broker connection failed${NC}"
        exit 1
    fi
else
    if docker-compose exec -T redis redis-cli -n 2 ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis broker is accessible${NC}"
    else
        echo -e "${RED}✗ Redis broker connection failed${NC}"
        exit 1
    fi
fi

# Test broker operations
echo "2. Testing broker operations..."
if [ -n "$REDIS_PASSWORD" ]; then
    docker-compose exec -T redis redis-cli -a "$REDIS_PASSWORD" -n 2 LPUSH celery "test_task" > /dev/null 2>&1
    TASK=$(docker-compose exec -T redis redis-cli -a "$REDIS_PASSWORD" -n 2 RPOP celery)
else
    docker-compose exec -T redis redis-cli -n 2 LPUSH celery "test_task" > /dev/null 2>&1
    TASK=$(docker-compose exec -T redis redis-cli -n 2 RPOP celery)
fi

if [ "$TASK" = "test_task" ]; then
    echo -e "${GREEN}✓ Broker queue operations successful${NC}"
else
    echo -e "${RED}✗ Broker operations failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}All Celery broker connection tests passed!${NC}"

