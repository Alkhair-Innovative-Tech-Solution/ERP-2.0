#!/bin/bash
set -e

echo "Waiting for database..."
until pg_isready -h "${DB_HOST:-db}" -p "${DB_PORT:-5432}" -U "${DB_USER:-vms_user}" -q; do
    echo "  db not ready, retrying..."
    sleep 2
done
echo "Database is ready."

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Seeding initial data..."
python manage.py seed_data

echo "Starting Daphne..."
exec daphne -b 0.0.0.0 -p 8000 config.asgi:application
