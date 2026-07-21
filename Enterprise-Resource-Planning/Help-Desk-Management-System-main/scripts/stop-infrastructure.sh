#!/bin/bash
# Docker Compose Shutdown Script
# Stops infrastructure services with proper cleanup

set -e

echo "=== Stopping HDMS Infrastructure ==="
echo ""

# Stop services in reverse dependency order
echo "1. Stopping Redis..."
docker-compose stop redis

echo "2. Stopping PgBouncer..."
docker-compose stop pgbouncer

echo "3. Stopping PostgreSQL..."
docker-compose stop postgres

echo ""
echo "=== Infrastructure services stopped successfully! ==="
echo ""
echo "Note: Data volumes are preserved. Use 'docker-compose down -v' to remove volumes."

