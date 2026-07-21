#!/usr/bin/env python
"""
Startup script for notification-service
"""
import os
import sys
import subprocess
import time
import psycopg2

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'notification_service.settings')

# Auto-install any missing requirements (handles packages added after image build)
req_file = os.path.join(os.path.dirname(__file__), 'requirements.txt')
if os.path.exists(req_file):
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', req_file, '-q',
                    '--root-user-action=ignore'], capture_output=True)

import django
django.setup()

from django.core.management import execute_from_command_line

def wait_for_db(max_retries=30, delay=2):
    """Wait for database to be ready"""
    db_config = django.conf.settings.DATABASES['default']
    for i in range(max_retries):
        try:
            conn = psycopg2.connect(
                host=db_config['HOST'],
                port=db_config['PORT'],
                user=db_config['USER'],
                password=db_config['PASSWORD'],
                dbname=db_config['NAME']
            )
            conn.close()
            print("✅ Database is ready!")
            return True
        except psycopg2.OperationalError as e:
            if i < max_retries - 1:
                print(f"⏳ Waiting for database... ({i+1}/{max_retries})")
                time.sleep(delay)
            else:
                print(f"❌ Database connection failed: {e}")
                return False
    return False

def main():
    print("🚀 Starting notification-service...")
    
    if not wait_for_db():
        print("❌ Failed to connect to database. Exiting.")
        sys.exit(1)
    
    print("📦 Running migrations...")
    try:
        execute_from_command_line(['manage.py', 'migrate', '--noinput'])
        print("✅ Migrations completed")
    except Exception as e:
        print(f"⚠️  Migration warning: {e}")
    
    print("📁 Collecting static files...")
    try:
        execute_from_command_line(['manage.py', 'collectstatic', '--noinput'])
        print("✅ Static files collected")
    except Exception as e:
        print(f"⚠️  Warning: Could not collect static files: {e}")
    
    print("🌐 Starting Gunicorn server...")
    try:
        subprocess.run(['gunicorn', 'notification_service.wsgi:application', '--bind', '0.0.0.0:8003', '--workers', '4', '--timeout', '120', '--access-logfile', '-', '--error-logfile', '-'])
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
    except Exception as e:
        print(f"❌ Server error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()

