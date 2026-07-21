#!/bin/bash
# seed_all.sh — Run full data seed pipeline from scratch
# Usage: bash scripts/seed_all.sh
set -e

echo "=========================================="
echo "  FULL DATA SEED PIPELINE"
echo "  Seeding: Branches | Teachers | Academics"
echo "           Students | Enrollments | Tests"
echo "           Certifications"
echo "  Step 0: Purge existing data for fresh seed"
echo "=========================================="

# 0. Clear Redis lockouts
echo ""
echo "--- Step 0/16: Clearing Redis lockouts ---"
docker exec redis redis-cli EVAL "for _,k in ipairs(redis.call('keys', 'lockout_*')) do redis.call('del',k) end; for _,k in ipairs(redis.call('keys', 'attempts_*')) do redis.call('del',k) end; return 'done'" 0 2>/dev/null || echo "  No lockouts found or redis not reachable"

# 0.5 Purge existing data (fresh seed from scratch)
echo ""
echo "--- Step 0.5/16: Purging existing data for fresh seed ---"

# Order matters due to FK constraints
echo "  Purging certifications..."
docker exec certification-service python -c "
import django, os; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'certification_service.settings'); django.setup()
from certifications.models import Certification
count = Certification.objects.count()
Certification.objects.all().delete()
print(f'  Deleted {count} certifications')
" 2>/dev/null || echo "  No certifications to purge"

echo "  Purging course-service data..."
docker exec course-service python -c "
import django, os; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings'); django.setup()
from courses.models import CourseRegistrationHistory, StudentDeposit, ScheduledClass, Course, Specialization, Room, StudentCourseProgress, ContentCompletion, CourseRating, FeePaymentTransaction, StudentFeeRecord, FeeStructure, AttendanceContactLog
from batches.models import Batch, Enrollment, TeacherAssignment, Interview as BatchInterview
from courses.models import Assignment, Submission, Attendance

FeePaymentTransaction.objects.all().delete()
StudentFeeRecord.objects.all().delete()
FeeStructure.objects.all().delete()
ContentCompletion.objects.all().delete()
CourseRating.objects.all().delete()
Submission.objects.all().delete()
Assignment.objects.all().delete()
Attendance.objects.all().delete()
AttendanceContactLog.objects.all().delete()
StudentCourseProgress.objects.all().delete()
StudentDeposit.objects.all().delete()
CourseRegistrationHistory.objects.all().delete()
BatchInterview.objects.all().delete()
Enrollment.objects.all().delete()
TeacherAssignment.objects.all().delete()
Batch.objects.all().delete()
ScheduledClass.objects.all().delete()
Course.objects.all().delete()
Specialization.objects.all().delete()
Room.objects.all().delete()
print('  Purged course-service data')
" 2>/dev/null || echo "  No course-service data to purge"

echo "  Purging admission-service data..."
docker exec admission-service python -c "
import django, os; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admission_service.settings'); django.setup()
from tests.models import EntranceLead, Interview, ReceiptCode, Test, Question, TestAttempt
TestAttempt.objects.all().delete()
Question.objects.all().delete()
Test.objects.all().delete()
ReceiptCode.objects.all().delete()
Interview.objects.all().delete()
EntranceLead.objects.all().delete()
print('  Purged admission-service data')
" 2>/dev/null || echo "  No admission-service data to purge"

echo "  Purging teachers, students & leads..."
docker exec auth-service python -c "
import django, os; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings'); django.setup()
from users.models import User, Student, Teacher, GuardianInfo, ResidentialInfo, StudentAcademicRecord, TeacherAttendance, PasswordResetToken, StudentTransferHistory, ReceiptCode
from profiles.models import UserProfile, StudentProfile, TeacherProfile

# Delete in dependency order
ReceiptCode.objects.all().delete()
PasswordResetToken.objects.all().delete()
TeacherAttendance.objects.all().delete()
StudentTransferHistory.objects.all().delete()
StudentAcademicRecord.objects.all().delete()
GuardianInfo.objects.all().delete()
ResidentialInfo.objects.all().delete()
StudentProfile.objects.all().delete()
TeacherProfile.objects.all().delete()
UserProfile.objects.all().delete()
Student.objects.all().delete()
Teacher.objects.all().delete()
# Delete users with seed roles (preserve admin/superuser accounts)
del_users = User.objects.filter(role__in=['teacher', 'student', 'lead']).count()
User.objects.filter(role__in=['teacher', 'student', 'lead']).delete()
print(f'  Deleted {del_users} users (teachers+students+leads)')
print('  Purged auth-service data')
" 2>/dev/null || echo "  No auth-service data to purge"

echo "  Purge complete."

# 1. Copy CSV files into containers
echo ""
echo "--- Step 1/16: Copying CSV data into containers ---"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
docker cp "$SCRIPT_DIR/data/timetable.csv" auth-service:/app/seed_data/timetable.csv
docker cp "$SCRIPT_DIR/data/timetable.csv" course-service:/app/seed_data/timetable.csv
docker cp "$SCRIPT_DIR/data/students.csv" auth-service:/app/seed_data/students.csv
docker cp "$SCRIPT_DIR/data/teachers.csv" auth-service:/app/shared/teachers.csv
echo "  Done (timetable, students, teachers)."

# 2. Seed branches in auth-service
echo ""
echo "--- Step 2/16: Seeding auth-service branches ---"
docker exec auth-service python manage.py seed_branches

# 3. Sync branches across all services
echo ""
echo "--- Step 3/16: Syncing branches to course & admission services ---"
docker exec course-service python manage.py sync_branches
docker exec admission-service python manage.py sync_branches

# 4. Clean stale mapping files
echo ""
echo "--- Step 4/16: Cleaning stale mapping files ---"
docker exec course-service sh -c "rm -f seed_data/teacher_mapping.json teacher_mapping.json"
echo "  Done."

# 5. Seed teachers from CSV (enriched with teachers.csv data)
echo ""
echo "--- Step 5/16: Seeding teachers from CSV (with enrichment) ---"
docker exec auth-service python seed_data/seed_teachers_from_sheet.py

# 6. Reset teacher passwords
echo ""
echo "--- Step 6/16: Resetting teacher passwords ---"
docker exec auth-service python seed_data/reset_teacher_passwords.py

# 7. Import academic structure (specializations → courses → scheduled classes)
echo ""
echo "--- Step 7/16: Importing academic structure ---"
docker exec course-service python seed_data/import_academic_structure.py

# 8. Assign room branches and capacities
echo ""
echo "--- Step 8/16: Assigning room branches and capacities ---"
docker exec course-service python assign_room_branches.py

# 9. Seed students from CSV
echo ""
echo "--- Step 9/16: Seeding students from CSV ---"
docker exec auth-service python seed_data/seed_from_master_sheet.py

# 10. Copy enrollment mapping to shared volume for ingest
echo ""
echo "--- Step 10/16: Syncing enrollment mapping ---"
docker exec auth-service sh -c "cp -f /app/seed_data/master_enrollment_mapping.json /app/shared/enrollment_mapping.json"
docker exec course-service sh -c "cp -f /app/shared/enrollment_mapping.json /app/master_enrollment_mapping.json"

# 11. Ingest enrollments (course registrations + deposits)
echo ""
echo "--- Step 11/16: Ingesting enrollments ---"
docker exec course-service python seed_data/ingest_enrollments.py

# 12. Assign MAIN branch to unassigned entities
echo ""
echo "--- Step 12/16: Assigning MAIN branch to entities ---"
docker exec course-service python manage.py assign_main_branch
docker exec admission-service python manage.py assign_main_branch
docker exec auth-service python manage.py assign_main_branch

# 13. Seed admission tests
echo ""
echo "--- Step 13/16: Seeding admission tests ---"
docker exec admission-service python seed_data/seed_admission_tests.py

# 14. Seed certifications from sheet
echo ""
echo "--- Step 14/16: Seeding certifications ---"
docker exec certification-service python seed_data/seed_certifications_unified.py || echo "  Certifications seeding skipped or failed (may require Google Sheets access)"

# 15. Verification
echo ""
echo "--- Step 15/16: Verification ---"
echo "Teachers in auth-service:"
docker exec auth-service python -c "
import django, os; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings'); django.setup()
from users.models import User
print(f'Total teachers: {User.objects.filter(role=\"teacher\").count()}')
for u in User.objects.filter(role='teacher').values('email', 'full_name'):
    print(f'  {u[\"email\"]} - {u[\"full_name\"]}')"

echo ""
echo "Students in auth-service:"
docker exec auth-service python -c "
import django, os; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings'); django.setup()
from users.models import User
print(f'Total students: {User.objects.filter(role=\"student\").count()}')"

echo ""
echo "Specializations in course-service:"
docker exec course-service python -c "
import django, os; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings'); django.setup()
from courses.models import Specialization
print(f'Total specializations: {Specialization.objects.count()}')"

echo ""
echo "Admission tests:"
docker exec admission-service python -c "
import django, os; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admission_service.settings'); django.setup()
from tests.models import Test
print(f'Total tests: {Test.objects.count()}')"

echo ""
echo "=========================================="
echo "  SEED PIPELINE COMPLETE"
echo "=========================================="
