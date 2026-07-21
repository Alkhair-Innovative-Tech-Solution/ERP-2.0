#!/usr/bin/env python
"""Startup script for course-service"""
import os
import sys
if "/app" not in sys.path:
    sys.path.insert(0, "/app")
import subprocess
import time
import psycopg2
from urllib.parse import urlparse

# Auto-install any missing requirements (handles packages added after image build)
req_file = os.path.join(os.path.dirname(__file__), 'requirements.txt')
if os.path.exists(req_file):
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', req_file, '-q',
                    '--root-user-action=ignore'], capture_output=True)

# Get database URL from environment
db_url = os.getenv('DATABASE_URL')
if not db_url:
    # Build from individual env vars
    db_host = os.getenv('DB_HOST', 'postgres-course')
    db_port = os.getenv('DB_PORT', '5432')
    db_name = os.getenv('DB_NAME', 'course_db')
    db_user = os.getenv('DB_USER', 'lms_user')
    db_password = os.getenv('DB_PASSWORD', 'lms_password')
    db_url = f'postgresql://{db_user}:{db_password}@{db_host}:{db_port}/{db_name}'

# Parse database URL
parsed = urlparse(db_url)
dbname = parsed.path[1:] if parsed.path.startswith('/') else parsed.path
user = parsed.username
password = parsed.password
host = parsed.hostname
port = parsed.port or 5432

if __name__ == '__main__':
    # Wait for database to be ready with retries
    print(f"Waiting for database at {host}:{port}...")
    max_retries = 30
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            conn = psycopg2.connect(
                dbname=dbname,
                user=user,
                password=password,
                host=host,
                port=port,
                connect_timeout=5
            )
            conn.close()
            print("✓ Database connection successful!")
            break
        except (psycopg2.OperationalError, psycopg2.Error) as e:
            retry_count += 1
            if retry_count >= max_retries:
                print(f"✗ Failed to connect to database after {max_retries} retries")
                print(f"Error: {e}")
                sys.exit(1)
            print(f"Database not ready yet (attempt {retry_count}/{max_retries}), retrying in 2 seconds...")
            time.sleep(2)
    
    # Now setup Django and run migrations
    import django
    from django.core.management import execute_from_command_line
    
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
    django.setup()
    
    print("Running migrations...")
    try:
        execute_from_command_line(['manage.py', 'migrate', '--noinput'])
    except Exception as e:
        print(f"Warning: Migration error (might be expected): {e}")
    
    print("Collecting static files...")
    try:
        execute_from_command_line(['manage.py', 'collectstatic', '--noinput'])
    except Exception as e:
        print(f"Warning: Static files collection error: {e}")
    
    print("Starting RabbitMQ consumer in background...")
    import subprocess
    try:
        consumer = subprocess.Popen(
            [sys.executable, '-c', '''
import os, sys, time
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "course_service.settings")
sys.path.insert(0, "/app")
import django; django.setup()
from courses.consumers import start_rabbitmq_listeners
start_rabbitmq_listeners()
while True: time.sleep(10)
'''],
            stdout=subprocess.PIPE, stderr=subprocess.STDOUT
        )
        print(f"Consumer PID: {consumer.pid}")
    except Exception as e:
        print(f"Warning: Failed to start consumer: {e}")

    print("Starting Gunicorn server...")
    try:
        subprocess.run(['gunicorn', 'course_service.wsgi:application', '--bind', '0.0.0.0:8002', '--workers', '4', '--timeout', '120', '--access-logfile', '-', '--error-logfile', '-'])
    except (SystemExit, KeyboardInterrupt):
        raise
    except Exception as e:
        print(f"Server error: {e}")
        raise

