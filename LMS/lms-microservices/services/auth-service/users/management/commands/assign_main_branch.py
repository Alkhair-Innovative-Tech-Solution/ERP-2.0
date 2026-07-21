from django.core.management.base import BaseCommand
from users.models import Branch, Student


class Command(BaseCommand):
    help = 'Assign MAIN branch to all students with null branch'

    def handle(self, *args, **kwargs):
        main_branch = Branch.objects.filter(code='MAIN').first()
        if not main_branch:
            self.stdout.write(self.style.ERROR('MAIN branch not found. Run seed_branches first.'))
            return

        count = Student.objects.filter(branch__isnull=True).update(branch=main_branch)
        self.stdout.write(self.style.SUCCESS(f'Assigned MAIN branch to {count} students'))
