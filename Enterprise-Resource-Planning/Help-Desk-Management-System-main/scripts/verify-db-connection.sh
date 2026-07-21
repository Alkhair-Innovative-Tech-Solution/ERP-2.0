#!/bin/bash
# Database Connection Verification Script
# Tests PostgreSQL connection through PgBouncer

set -e

echo "=== Database Connection Verification ==="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Load environment variables from .env if it exists
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

DB_USER=${POSTGRES_USER:-hdms_user}
DB_PASSWORD=${POSTGRES_PASSWORD:-hdms_pwd}
DB_NAME=${POSTGRES_DB:-hdms_db}

# Check if PgBouncer is accessible (using docker-compose exec to run inside postgres container)
echo "1. Testing PgBouncer connection..."
if docker-compose exec -T postgres pg_isready -h pgbouncer -p 6432 -U ${DB_USER} -d ${DB_NAME} > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PgBouncer is accessible${NC}"
else
    echo -e "${RED}✗ PgBouncer connection failed${NC}"
    exit 1
fi

# Test database connection via psql (using docker-compose exec)
echo "2. Testing database query through PgBouncer..."
if docker-compose exec -T -e PGPASSWORD=${POSTGRES_PASSWORD} postgres psql -h pgbouncer -p 6432 -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c "SELECT version();" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Database query successful${NC}"
else
    echo -e "${RED}✗ Database query failed${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}All database connection tests passed!${NC}"

