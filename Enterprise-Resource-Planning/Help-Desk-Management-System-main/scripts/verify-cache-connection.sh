#!/bin/bash
# Redis Cache Connection Verification Script
# Tests Redis cache connectivity and operations

set -e

echo "=== Redis Cache Connection Verification ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Check if Redis is accessible (using docker-compose exec)
echo "1. Testing Redis connection (database 0)..."
if [ -n "$REDIS_PASSWORD" ]; then
    if docker-compose exec -T redis redis-cli -a "$REDIS_PASSWORD" -n 0 ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis is accessible with authentication${NC}"
    else
        echo -e "${RED}✗ Redis connection failed${NC}"
        exit 1
    fi
else
    if docker-compose exec -T redis redis-cli -n 0 ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis is accessible${NC}"
    else
        echo -e "${RED}✗ Redis connection failed${NC}"
        exit 1
    fi
fi

# Test cache operations
echo "2. Testing cache operations..."
if [ -n "$REDIS_PASSWORD" ]; then
    docker-compose exec -T redis redis-cli -a "$REDIS_PASSWORD" -n 0 SET test_key "test_value" > /dev/null 2>&1
    VALUE=$(docker-compose exec -T redis redis-cli -a "$REDIS_PASSWORD" -n 0 GET test_key)
else
    docker-compose exec -T redis redis-cli -n 0 SET test_key "test_value" > /dev/null 2>&1
    VALUE=$(docker-compose exec -T redis redis-cli -n 0 GET test_key)
fi

if [ "$VALUE" = "test_value" ]; then
    echo -e "${GREEN}✓ Cache read/write operations successful${NC}"
    # Cleanup
    if [ -n "$REDIS_PASSWORD" ]; then
        docker-compose exec -T redis redis-cli -a "$REDIS_PASSWORD" -n 0 DEL test_key > /dev/null 2>&1
    else
        docker-compose exec -T redis redis-cli -n 0 DEL test_key > /dev/null 2>&1
    fi
else
    echo -e "${RED}✗ Cache operations failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}All cache connection tests passed!${NC}"

