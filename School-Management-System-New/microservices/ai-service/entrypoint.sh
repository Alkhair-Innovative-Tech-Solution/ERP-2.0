#!/bin/sh
set -e
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do sleep 1; done
python manage.py makemigrations --noinput
python manage.py migrate --noinput
exec gunicorn ai_service.wsgi:application --bind 0.0.0.0:8014 --workers 2 --timeout 90 --access-logfile - --error-logfile -
