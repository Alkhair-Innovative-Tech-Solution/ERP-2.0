#!/bin/bash
# Django Channels Connection Verification Script
# Tests Redis channel layer connectivity (database 1)

set -e

echo "=== Django Channels Connection Verification ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

# Check if Redis channel layer is accessible (database 1) - using docker-compose exec
echo "1. Testing Redis channel layer connection (database 1)..."
if [ -n "$REDIS_PASSWORD" ]; then
    if docker-compose exec -T redis redis-cli -a "$REDIS_PASSWORD" -n 1 ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis channel layer is accessible with authentication${NC}"
    else
        echo -e "${RED}✗ Redis channel layer connection failed${NC}"
        exit 1
    fi
else
    if docker-compose exec -T redis redis-cli -n 1 ping > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Redis channel layer is accessible${NC}"
    else
        echo -e "${RED}✗ Redis channel layer connection failed${NC}"
        exit 1
    fi
fi

# Test channel operations
echo "2. Testing channel operations..."
if [ -n "$REDIS_PASSWORD" ]; then
    docker-compose exec -T redis redis-cli -a "$REDIS_PASSWORD" -n 1 PUBLISH test_channel "test_message" > /dev/null 2>&1
    echo -e "${GREEN}✓ Channel publish operation successful${NC}"
else
    docker-compose exec -T redis redis-cli -n 1 PUBLISH test_channel "test_message" > /dev/null 2>&1
    echo -e "${GREEN}✓ Channel publish operation successful${NC}"
fi

echo ""
echo -e "${GREEN}All Django Channels connection tests passed!${NC}"

