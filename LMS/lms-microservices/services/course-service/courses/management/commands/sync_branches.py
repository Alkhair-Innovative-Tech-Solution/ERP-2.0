from django.core.management.base import BaseCommand
from courses.models import Branch
import os
import requests

class Command(BaseCommand):
    help = 'Sync branches from auth-service to course-service'

    def handle(self, *args, **kwargs):
        auth_svc = os.environ.get('AUTH_SERVICE_URL', 'http://auth-service:8001')

        try:
            branches_res = requests.get(f"{auth_svc}/api/auth/branches/public/", timeout=10)
            
            if branches_res.status_code != 200:
                self.stdout.write(self.style.ERROR(f"Failed to fetch branches: {branches_res.text}"))
                return

            branches = branches_res.json()

            for b in branches:
                branch, created = Branch.objects.get_or_create(
                    id=b['id'],
                    defaults={
                        'code': b['code'],
                        'name': b['name'],
                        'is_active': b.get('is_active', True),
                    }
                )
                if not created:
                    branch.code = b['code']
                    branch.name = b['name']
                    branch.is_active = b.get('is_active', True)
                    branch.save()

                status = 'Created' if created else 'Updated'
                self.stdout.write(self.style.SUCCESS(f'{status}: {branch.name} ({branch.code})'))

            self.stdout.write(self.style.SUCCESS(f'Synced {len(branches)} branches from auth-service'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Sync failed: {str(e)}'))
