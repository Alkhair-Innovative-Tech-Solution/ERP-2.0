"""
Django management command to test email functionality.
Run: python manage.py test_email [recipient_email]
"""
from django.core.management.base import BaseCommand
from django.conf import settings
from django.core.mail import send_mail
from visitors.email_utils import send_host_notification, send_overnight_notification
from visitors.models import Visit, Host, Visitor


class Command(BaseCommand):
    help = 'Test email functionality'

    def add_arguments(self, parser):
        parser.add_argument('recipient_email', nargs='?', default=None, help='Email to send test to')

    def handle(self, *args, **kwargs):
        recipient = kwargs.get('recipient_email')
        
        self.stdout.write(self.style.SUCCESS('\n📧 Email Configuration:'))
        self.stdout.write(f'  Backend: {settings.EMAIL_BACKEND}')
        self.stdout.write(f'  Host: {settings.EMAIL_HOST}')
        self.stdout.write(f'  Port: {settings.EMAIL_PORT}')
        self.stdout.write(f'  From: {settings.DEFAULT_FROM_EMAIL}')
        self.stdout.write(f'  Admin: {settings.ADMIN_EMAIL}')
        self.stdout.write('')

        # Test 1: Simple test email
        self.stdout.write(self.style.SUCCESS('📤 Test 1: Simple test email'))
        try:
            send_mail(
                subject='VMS Email Test',
                message='This is a test email from Visitor Management System.\n\nIf you received this, email is working correctly!',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient or settings.ADMIN_EMAIL],
                fail_silently=False,
            )
            self.stdout.write(self.style.SUCCESS(f'  ✅ Sent to: {recipient or settings.ADMIN_EMAIL}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ❌ Failed: {str(e)}'))

        # Test 2: Host notification email
        self.stdout.write(self.style.SUCCESS('\n📤 Test 2: Host notification email'))
        try:
            # Create a mock visit for testing
            test_visitor, _ = Visitor.objects.get_or_create(
                cnic='99999-9999999-9',
                defaults={
                    'full_name': 'Test Visitor',
                    'phone': '+923009999999',
                    'email': 'testvisitor@example.com',
                    'company': 'Test Company',
                }
            )
            
            test_host, _ = Host.objects.get_or_create(
                employee_id='TEST-EMAIL-001',
                defaults={
                    'name': 'Test Host',
                    'department': 'Test Department',
                    'email': recipient or settings.ADMIN_EMAIL,
                    'phone': '+923008888888',
                }
            )
            
            test_visit = Visit.objects.create(
                visitor=test_visitor,
                host=test_host,
                purpose=Visit.Purpose.MEETING,
                status=Visit.Status.CHECKED_IN,
                checked_in_at=Visit._meta.get_field('checked_in_at').auto_now,
            )
            
            success = send_host_notification(test_visit)
            if success:
                self.stdout.write(self.style.SUCCESS(f'  ✅ Host notification sent to: {test_host.email}'))
            else:
                self.stdout.write(self.style.WARNING('  ⚠️ Email sent but may not have been delivered'))
            
            # Cleanup
            test_visit.delete()
            test_host.delete()
            test_visitor.delete()
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ❌ Failed: {str(e)}'))

        # Test 3: Overnight notification email
        self.stdout.write(self.style.SUCCESS('\n📤 Test 3: Overnight stay notification'))
        try:
            send_mail(
                subject='ALERT: Overnight Stay - Test Visitor',
                message='This is a test overnight stay notification.\n\nA visitor is still inside the premises past working hours.',
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[recipient or settings.ADMIN_EMAIL],
                fail_silently=False,
            )
            self.stdout.write(self.style.SUCCESS(f'  ✅ Sent to: {recipient or settings.ADMIN_EMAIL}'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'  ❌ Failed: {str(e)}'))

        self.stdout.write(self.style.SUCCESS('\n✅ Email tests completed!\n'))
        
        if settings.EMAIL_BACKEND == 'django.core.mail.backends.console.EmailBackend':
            self.stdout.write(self.style.WARNING('⚠️  Using console backend - emails are printed to console, not sent'))
            self.stdout.write(self.style.WARNING('   To send real emails, set EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend in .env\n'))
