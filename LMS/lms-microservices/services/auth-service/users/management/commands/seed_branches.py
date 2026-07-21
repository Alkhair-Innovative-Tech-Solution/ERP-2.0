from django.core.management.base import BaseCommand
from users.models import Branch

class Command(BaseCommand):
    help = 'Seed default branche (Main)'

    def handle(self, *args, **kwargs):
        branches = [
            {
                'code': 'MAIN',
                'name': 'Main Branch',
                'address': 'Main Campus, Karachi',
                'city': 'Karachi',
            },
        ]

        for b in branches:
            branch, created = Branch.objects.get_or_create(
                code=b['code'],
                defaults=b
            )
            status = 'Created' if created else 'Already exists'
            self.stdout.write(self.style.SUCCESS(f'{status}: {branch.name} ({branch.code})'))

        self.stdout.write(self.style.SUCCESS('All branches seeded successfully'))
