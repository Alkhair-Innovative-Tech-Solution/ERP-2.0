"""Repair EnrollmentSnapshots that an older PromoteStudentsView stamped with the
CURRENT academic year instead of the year the student actually completed.

Bug: the FROM grade (pre-promotion) was recorded under date.today()'s year, so a
student promoted in the new session got their old grade stamped under the new
year — leaving no prior-year snapshot for Grade Progression to compare against.

This rebuilds, for each student promoted via the result flow (an approved Final
pass):
    • (completed_year, end_of_year, FROM grade)   — the year they finished
    • (entering_year, start_of_year, current grade) — the year they entered
and deletes the mis-yeared FROM-grade snapshots. Idempotent.
"""
import os
from datetime import date

from django.core.management.base import BaseCommand

from students.models import Student, EnrollmentSnapshot


def _approved_final_passes():
    """(student_id, academic_year) pairs for approved Final passes.

    Result lives in result_db (result-service), not here — read it cross-DB
    via psycopg2, the same pattern used across this codebase for read-only
    lookups into another service's database.
    """
    import psycopg2
    conn = psycopg2.connect(
        host=os.environ.get('RESULT_DB_HOST', 'postgres-result'),
        dbname=os.environ.get('RESULT_DB_NAME', 'result_db'),
        user=os.environ.get('RESULT_DB_USER', 'result_user'),
        password=os.environ.get('RESULT_DB_PASSWORD', 'result_pass'),
        connect_timeout=5,
    )
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT student_id, academic_year FROM result_result "
                "WHERE exam_type = 'final' AND status = 'approved' AND pass_status = 'pass'"
            )
            return cur.fetchall()
    finally:
        conn.close()


class Command(BaseCommand):
    help = "Fix promotion snapshots mis-stamped with the current year instead of the completed year."

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')

    def handle(self, *args, **opts):
        dry = opts['dry_run']

        # Students promoted via the result flow = those with an approved Final pass.
        years_by_student = {}
        for sid, ay in _approved_final_passes():
            if ay:
                years_by_student.setdefault(sid, set()).add(ay)

        fixed = 0
        for sid, years in years_by_student.items():
            student = Student._base_manager.filter(id=sid).first()
            if not student or not student.current_grade:
                continue
            completed_ay = max(years)                      # latest completed year
            cs = int(completed_ay.split('-')[0])
            entering_ay = f"{cs + 1}-{str(cs + 2)[-2:]}"
            cur = student.current_grade

            snaps = list(EnrollmentSnapshot.all_objects.filter(student_id=sid))
            from_grades = {s.grade for s in snaps if s.grade and s.grade != cur}
            if len(from_grades) != 1:
                continue  # nothing unambiguous to fix (not promoted, or multi-year history)
            from_grade = next(iter(from_grades))

            has_from = any(s.academic_year == completed_ay and s.grade == from_grade for s in snaps)
            has_to = any(s.academic_year == entering_ay and s.grade == cur for s in snaps)
            mis_yeared = [s for s in snaps if s.grade == from_grade and s.academic_year != completed_ay]
            if has_from and has_to and not mis_yeared:
                continue  # already correct

            self.stdout.write(f"  {sid} {student.name[:18]:18} → {from_grade}@{completed_ay} + {cur}@{entering_ay}")
            if dry:
                fixed += 1
                continue

            common = {
                'campus': student.campus, 'classroom': student.classroom,
                'section': student.section, 'status': student.enrollment_status,
                'gender': student.gender, 'organization': student.organization,
            }
            EnrollmentSnapshot.all_objects.update_or_create(
                student_id=sid, academic_year=completed_ay, snapshot_type='end_of_year',
                defaults={'grade': from_grade, 'snapshot_date': date(cs + 1, 3, 31), **common})
            EnrollmentSnapshot.all_objects.update_or_create(
                student_id=sid, academic_year=entering_ay, snapshot_type='start_of_year',
                defaults={'grade': cur, 'snapshot_date': date(cs + 1, 4, 1), **common})
            # Remove the FROM grade wherever it was mis-stamped (any year but completed).
            EnrollmentSnapshot.all_objects.filter(
                student_id=sid, grade=from_grade).exclude(academic_year=completed_ay).delete()
            fixed += 1

        self.stdout.write(self.style.SUCCESS(f"{'Would fix' if dry else 'Fixed'} {fixed} student(s)."))
