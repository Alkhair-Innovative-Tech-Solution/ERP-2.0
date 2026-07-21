from django.core.management.base import BaseCommand
from courses.models import Branch, Course, CourseRegistrationHistory


class Command(BaseCommand):
    help = 'Assign MAIN branch to all courses and enrollments with null/no branch'

    def handle(self, *args, **kwargs):
        main_branch = Branch.objects.filter(code='MAIN').first()
        if not main_branch:
            self.stdout.write(self.style.ERROR('MAIN branch not found. Run sync_branches first.'))
            return

        # Assign courses with no branches
        course_count = 0
        for course in Course.objects.filter(is_deleted=False):
            if not course.branches.exists():
                course.branches.add(main_branch)
                course_count += 1
        self.stdout.write(self.style.SUCCESS(f'Assigned MAIN branch to {course_count} courses'))

        # Assign enrollments with null branch
        enroll_count = CourseRegistrationHistory.objects.filter(branch__isnull=True).update(branch=main_branch)
        self.stdout.write(self.style.SUCCESS(f'Assigned MAIN branch to {enroll_count} enrollments'))
