#!/bin/bash
# Comprehensive Status Check Script

echo "=== HDMS Complete Status Check ==="
echo ""

echo "1. Infrastructure Containers:"
docker-compose ps postgres pgbouncer redis 2>/dev/null || echo "  ⚠ Some infrastructure containers not running"

echo ""
echo "2. Service Containers:"
docker-compose ps user-service ticket-service communication-service file-service frontend-service 2>/dev/null || echo "  ⚠ Some service containers not running"

echo ""
echo "3. Service Images:"
SERVICES=("user-service" "ticket-service" "communication-service" "file-service" "frontend-service")
for service in "${SERVICES[@]}"; do
    if docker images | grep -q "hdms.*${service}"; then
        echo "  ✓ ${service} image built"
    else
        echo "  ✗ ${service} image NOT built"
    fi
done

echo ""
echo "4. Infrastructure Health:"
echo "  Testing PostgreSQL..."
if docker-compose exec -T postgres psql -U hdms_user -d hdms_db -c "SELECT 1;" > /dev/null 2>&1; then
    echo "    ✓ PostgreSQL accessible"
else
    echo "    ✗ PostgreSQL not accessible"
fi

echo "  Testing PgBouncer..."
if docker-compose exec -T pgbouncer pg_isready -h localhost -p 6432 > /dev/null 2>&1; then
    echo "    ✓ PgBouncer accessible"
else
    echo "    ✗ PgBouncer not accessible"
fi

echo "  Testing Redis..."
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "    ✓ Redis accessible (no password)"
elif docker-compose exec -T redis redis-cli -a "${REDIS_PASSWORD:-}" ping > /dev/null 2>&1; then
    echo "    ✓ Redis accessible (with password)"
else
    echo "    ✗ Redis not accessible"
fi

echo ""
echo "5. Connection Tests:"
./scripts/verify-all-connections-bash.sh

echo ""
echo "=== Status Check Complete ==="

