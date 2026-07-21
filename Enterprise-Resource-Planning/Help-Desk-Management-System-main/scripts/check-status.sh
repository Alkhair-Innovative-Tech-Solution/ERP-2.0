#!/bin/bash
# Check infrastructure and service status

echo "=== HDMS Infrastructure Status ==="
echo ""

echo "1. Container Status:"
docker-compose ps

echo ""
echo "2. Testing PostgreSQL (direct connection)..."
if docker-compose exec -T postgres psql -U hdms_user -d hdms_db -c "SELECT version();" > /dev/null 2>&1; then
    echo "✓ PostgreSQL is accessible"
else
    echo "✗ PostgreSQL connection failed"
    echo "  → Check if POSTGRES_PASSWORD is set correctly in .env file"
fi

echo ""
echo "3. Testing PgBouncer..."
if docker-compose exec -T pgbouncer pg_isready -h localhost -p 6432 > /dev/null 2>&1; then
    echo "✓ PgBouncer is accessible"
else
    echo "✗ PgBouncer not accessible"
    echo "  → Run: docker-compose up -d pgbouncer"
fi

echo ""
echo "4. Testing Redis..."
if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
    echo "✓ Redis is accessible (no password)"
elif docker-compose exec -T redis redis-cli -a "${REDIS_PASSWORD}" ping > /dev/null 2>&1; then
    echo "✓ Redis is accessible (with password)"
else
    echo "✗ Redis connection failed"
    echo "  → Check REDIS_PASSWORD in .env file or restart Redis"
fi

echo ""
echo "5. Service Images:"
echo "Checking if service images are built..."
SERVICES=("user-service" "ticket-service" "communication-service" "file-service" "frontend-service")
for service in "${SERVICES[@]}"; do
    if docker images | grep -q "hdms.*${service}"; then
        echo "✓ ${service} image exists"
    else
        echo "✗ ${service} image NOT built"
        echo "  → Run: docker-compose build ${service}"
    fi
done

echo ""
echo "=== Status Check Complete ==="

