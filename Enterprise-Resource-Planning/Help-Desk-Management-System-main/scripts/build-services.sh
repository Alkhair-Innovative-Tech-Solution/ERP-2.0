#!/bin/bash
# Build all Docker services
# Usage: ./scripts/build-services.sh

echo "=== Building HDMS Services ==="
echo ""

echo "Building user-service..."
docker-compose build user-service

echo "Building ticket-service..."
docker-compose build ticket-service

echo "Building communication-service..."
docker-compose build communication-service

echo "Building file-service..."
docker-compose build file-service

echo "Building frontend-service..."
docker-compose build frontend-service

echo ""
echo "=== All services built successfully! ==="
echo "You can now start services with: docker-compose up -d"

