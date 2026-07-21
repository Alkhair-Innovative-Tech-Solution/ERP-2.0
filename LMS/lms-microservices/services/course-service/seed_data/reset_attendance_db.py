import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

def reset_attendance_migrations():
    with connection.cursor() as cursor:
        print("Dropping tables...")
        cursor.execute("DROP TABLE IF EXISTS courses_submission CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS courses_assignment CASCADE;")
        cursor.execute("DROP TABLE IF EXISTS courses_attendance CASCADE;")
        
        print("Deleting migration records for courses app...")
        cursor.execute("DELETE FROM django_migrations WHERE app = 'courses' AND name != '0001_initial';")

if __name__ == "__main__":
    reset_attendance_migrations()
    print("Database reset for courses migrations completed.")
