from django.core.management.base import BaseCommand
from tests.models import Branch, EntranceLead


class Command(BaseCommand):
    help = 'Assign MAIN branch to all leads with null branch'

    def handle(self, *args, **kwargs):
        main_branch = Branch.objects.filter(code='MAIN').first()
        if not main_branch:
            self.stdout.write(self.style.ERROR('MAIN branch not found. Run sync_branches first.'))
            return

        count = EntranceLead.objects.filter(branch__isnull=True).update(branch=main_branch)
        self.stdout.write(self.style.SUCCESS(f'Assigned MAIN branch to {count} leads'))
