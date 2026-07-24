#!/bin/sh
set -e
until pg_isready -h "$DB_HOST" -p "${DB_PORT:-5432}" -U "$DB_USER"; do sleep 1; done
python manage.py migrate --noinput
python manage.py collectstatic --noinput
exec gunicorn subject_service.wsgi:application \
    --bind 0.0.0.0:8012 \
    --workers 4 \
    --worker-tmp-dir /dev/shm \
    --timeout 120 \
    --access-logfile - \
    --error-logfile -
