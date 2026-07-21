#!/bin/sh
set -e

echo "Waiting for PostgreSQL..."
while ! nc -z $DB_HOST $DB_PORT; do
  sleep 0.5
done
echo "PostgreSQL is ready!"

echo "Running migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Checking if seed data needed..."
python manage.py seed_data --check-first || true

echo "Starting Django server..."
exec python manage.py runserver 0.0.0.0:8000
