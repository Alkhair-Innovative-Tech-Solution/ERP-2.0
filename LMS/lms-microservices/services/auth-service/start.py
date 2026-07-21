#!/usr/bin/env python
"""
Startup script for auth-service
Handles database readiness, migrations, and server startup
"""
import os
import sys
import time
import subprocess
import psycopg2
import traceback

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')

# Auto-install any missing requirements (handles packages added after image build)
req_file = os.path.join(os.path.dirname(__file__), 'requirements.txt')
if os.path.exists(req_file):
    subprocess.run([sys.executable, '-m', 'pip', 'install', '-r', req_file, '-q',
                    '--root-user-action=ignore'], capture_output=True)

def wait_for_db(max_retries=30, delay=2):
    """Wait for database to be ready"""
    import django
    from django.conf import settings
    
    # Ensure Django is set up
    try:
        django.setup()
    except Exception as e:
        print(f"⚠️ Django setup warning: {e}")

    db_config = settings.DATABASES['default']
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

def ensure_django_tables():
    """Ensure Django core tables exist"""
    from django.db import connection
    try:
        with connection.cursor() as cur:
            # Check if django_migrations table exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = 'django_migrations'
                );
            """)
            if not cur.fetchone()[0]:
                print("Creating django_migrations table...")
                cur.execute("""
                    CREATE TABLE django_migrations (
                        id SERIAL PRIMARY KEY,
                        app VARCHAR(255) NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        applied TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(app, name)
                    );
                """)
                connection.commit()
                print("✅ django_migrations table created")
    except Exception as e:
        print(f"⚠️  Warning: Could not ensure Django tables: {e}")

def main():
    """Main startup function"""
    print("🚀 Starting auth-service...")
    
    # 1. Wait for database
    if not wait_for_db():
        print("❌ Failed to connect to database. Exiting.")
        sys.exit(1)
    
    # 2. Final Django setup
    import django
    from django.core.management import execute_from_command_line
    
    try:
        django.setup()
    except Exception as e:
        print(f"❌ Final Django setup failed: {e}")

    # 3. Ensure tables
    ensure_django_tables()
    
    # 4. Run migrations
    print("📦 Running migrations...")
    try:
        execute_from_command_line(['manage.py', 'migrate', '--noinput'])
        print("✅ Migrations completed")
    except Exception as e:
        print(f"⚠️  Migration error, continuing anyway: {e}")
    
    # 5. Collect static files
    print("📁 Collecting static files...")
    try:
        execute_from_command_line(['manage.py', 'collectstatic', '--noinput'])
        print("✅ Static files collected")
    except Exception as e:
        print(f"⚠️  Warning: Could not collect static files: {e}")
    
    # 6. Start server with Gunicorn
    print("🌐 Starting Gunicorn server...")
    try:
        subprocess.run(['gunicorn', 'auth_service.wsgi:application', '--bind', '0.0.0.0:8001', '--workers', '4', '--timeout', '120', '--access-logfile', '-', '--error-logfile', '-'])
    except KeyboardInterrupt:
        print("\n👋 Server stopped")
    except Exception as e:
        print(f"❌ Server error: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
