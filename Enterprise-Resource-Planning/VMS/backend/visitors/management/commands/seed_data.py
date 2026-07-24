"""
Django management command to seed the database with mock data.
Run: python manage.py seed_data
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
import random
from visitors.models import Visitor, Host, Visit, Employee


class Command(BaseCommand):
    help = 'Seed the database with mock data (only if empty)'

    def handle(self, *args, **kwargs):
        # Check if data already exists
        if Visitor.objects.exists() or Host.objects.exists() or Employee.objects.exists():
            self.stdout.write(self.style.WARNING('⏭️  Database already has data. Skipping seed.'))
            self.stdout.write(self.style.SUCCESS(f'   Visitors: {Visitor.objects.count()}'))
            self.stdout.write(self.style.SUCCESS(f'   Hosts: {Host.objects.count()}'))
            self.stdout.write(self.style.SUCCESS(f'   Employees: {Employee.objects.count()}'))
            self.stdout.write(self.style.SUCCESS(f'   Visits: {Visit.objects.count()}'))
            return

        self.stdout.write(self.style.SUCCESS('🌱 Starting to seed data...'))

        # Clear existing data (optional)
        # Visit.objects.all().delete()
        # Visitor.objects.all().delete()
        # Host.objects.all().delete()

        # ── Create Hosts ──────────────────────────────────────────────────────
        hosts_data = [
            {'name': 'Ahmed Khan', 'department': 'Engineering', 'employee_id': 'EMP-001', 'phone': '+923001234567', 'email': 'ahmed.khan@company.com'},
            {'name': 'Sara Ali', 'department': 'HR', 'employee_id': 'EMP-002', 'phone': '+923001234568', 'email': 'sara.ali@company.com'},
            {'name': 'Usman Malik', 'department': 'Finance', 'employee_id': 'EMP-003', 'phone': '+923001234569', 'email': 'usman.malik@company.com'},
            {'name': 'Fatima Noor', 'department': 'Marketing', 'employee_id': 'EMP-004', 'phone': '+923001234570', 'email': 'fatima.noor@company.com'},
            {'name': 'Bilal Ahmed', 'department': 'Operations', 'employee_id': 'EMP-005', 'phone': '+923001234571', 'email': 'bilal.ahmed@company.com'},
            {'name': 'Ayesha Siddiqui', 'department': 'IT', 'employee_id': 'EMP-006', 'phone': '+923001234572', 'email': 'ayesha.siddiqui@company.com'},
            {'name': 'Hassan Raza', 'department': 'Legal', 'employee_id': 'EMP-007', 'phone': '+923001234573', 'email': 'hassan.raza@company.com'},
            {'name': 'Zainab Hussain', 'department': 'Admin', 'employee_id': 'EMP-008', 'phone': '+923001234574', 'email': 'zainab.hussain@company.com'},
        ]

        hosts = []
        for h in hosts_data:
            host, created = Host.objects.get_or_create(
                employee_id=h['employee_id'],
                defaults=h
            )
            hosts.append(host)
            if created:
                self.stdout.write(f'  Created host: {host.name} - {host.department}')

        # ── Create Employees (Internal Staff) ──────────────────────────────────
        employees_data = [
            {'name': 'Ahmed Khan', 'department': 'Engineering', 'designation': 'Senior Developer', 'employee_id': 'EMP-001', 'phone': '+923001234567', 'email': 'ahmed.khan@company.com'},
            {'name': 'Sara Ali', 'department': 'HR', 'designation': 'HR Manager', 'employee_id': 'EMP-002', 'phone': '+923001234568', 'email': 'sara.ali@company.com'},
            {'name': 'Usman Malik', 'department': 'Finance', 'designation': 'Financial Analyst', 'employee_id': 'EMP-003', 'phone': '+923001234569', 'email': 'usman.malik@company.com'},
            {'name': 'Fatima Noor', 'department': 'Marketing', 'designation': 'Marketing Lead', 'employee_id': 'EMP-004', 'phone': '+923001234570', 'email': 'fatima.noor@company.com'},
            {'name': 'Bilal Ahmed', 'department': 'Operations', 'designation': 'Operations Manager', 'employee_id': 'EMP-005', 'phone': '+923001234571', 'email': 'bilal.ahmed@company.com'},
            {'name': 'Ayesha Siddiqui', 'department': 'IT', 'designation': 'System Administrator', 'employee_id': 'EMP-006', 'phone': '+923001234572', 'email': 'ayesha.siddiqui@company.com'},
            {'name': 'Hassan Raza', 'department': 'Legal', 'designation': 'Legal Counsel', 'employee_id': 'EMP-007', 'phone': '+923001234573', 'email': 'hassan.raza@company.com'},
            {'name': 'Zainab Hussain', 'department': 'Admin', 'designation': 'Admin Officer', 'employee_id': 'EMP-008', 'phone': '+923001234574', 'email': 'zainab.hussain@company.com'},
            {'name': 'Ali Raza', 'department': 'Engineering', 'designation': 'Tech Lead', 'employee_id': 'EMP-009', 'phone': '+923001234575', 'email': 'ali.raza@company.com'},
            {'name': 'Maryam Nawaz', 'department': 'HR', 'designation': 'Recruiter', 'employee_id': 'EMP-010', 'phone': '+923001234576', 'email': 'maryam.nawaz@company.com'},
        ]

        employees = []
        for e in employees_data:
            employee, created = Employee.objects.get_or_create(
                employee_id=e['employee_id'],
                defaults=e
            )
            employees.append(employee)
            if created:
                self.stdout.write(f'  Created employee: {employee.name} - {employee.designation}')

        # ── Create Visitors ───────────────────────────────────────────────────
        visitors_data = [
            {'full_name': 'Muhammad Ali', 'cnic': '42201-1234567-1', 'phone': '+923009876543', 'email': 'ali@example.com', 'company': 'ABC Corp'},
            {'full_name': 'Amina Begum', 'cnic': '42201-2345678-2', 'phone': '+923009876544', 'email': 'amina@example.com', 'company': 'XYZ Ltd'},
            {'full_name': 'Omar Farooq', 'cnic': '42201-3456789-3', 'phone': '+923009876545', 'email': 'omar@example.com', 'company': 'Tech Solutions'},
            {'full_name': 'Sana Sheikh', 'cnic': '42201-4567890-4', 'phone': '+923009876546', 'email': 'sana@example.com', 'company': 'Design Hub'},
            {'full_name': 'Tariq Jameel', 'cnic': '42201-5678901-5', 'phone': '+923009876547', 'email': 'tariq@example.com', 'company': 'BuildRight'},
            {'full_name': 'Nadia Khan', 'cnic': '42201-6789012-6', 'phone': '+923009876548', 'email': 'nadia@example.com', 'company': 'MediaWorks'},
            {'full_name': 'Faisal Qureshi', 'cnic': '42201-7890123-7', 'phone': '+923009876549', 'email': 'faisal@example.com', 'company': 'LogiTrans'},
            {'full_name': 'Hira Mani', 'cnic': '42201-8901234-8', 'phone': '+923009876550', 'email': 'hira@example.com', 'company': 'EduCare'},
            {'full_name': 'Kamran Akmal', 'cnic': '42201-9012345-9', 'phone': '+923009876551', 'email': 'kamran@example.com', 'company': 'SportsZone'},
            {'full_name': 'Rida Fatima', 'cnic': '42201-0123456-0', 'phone': '+923009876552', 'email': 'rida@example.com', 'company': 'HealthPlus'},
            # Blacklisted visitor
            {'full_name': 'Bad Actor', 'cnic': '42201-9999999-9', 'phone': '+923009999999', 'email': 'badactor@example.com', 'company': 'Unknown', 'is_blacklisted': True, 'blacklist_reason': 'Previous theft incident'},
        ]

        visitors = []
        for v in visitors_data:
            is_blacklisted = v.pop('is_blacklisted', False)
            blacklist_reason = v.pop('blacklist_reason', None)
            
            visitor, created = Visitor.objects.get_or_create(
                cnic=v['cnic'],
                defaults=v
            )
            
            if is_blacklisted and not visitor.is_blacklisted:
                visitor.is_blacklisted = True
                visitor.blacklist_reason = blacklist_reason
                visitor.save()
            
            visitors.append(visitor)
            if created:
                self.stdout.write(f'  Created visitor: {visitor.full_name}')

        # ── Create Visits ─────────────────────────────────────────────────────
        purposes = [p[0] for p in Visit.Purpose.choices]
        statuses = [s[0] for s in Visit.Status.choices]
        entry_types = [e[0] for e in Visit.EntryType.choices]

        # Today's visits
        today = timezone.now().date()
        
        visits_data = []
        
        # Checked in visitors (currently inside)
        for i in range(5):
            visits_data.append({
                'visitor': visitors[i],
                'host': hosts[i % len(hosts)],
                'purpose': purposes[i % len(purposes)],
                'status': Visit.Status.CHECKED_IN,
                'entry_type': random.choice([Visit.EntryType.RECEPTIONIST, Visit.EntryType.QR_SELF]),
                'checked_in_at': timezone.now() - timedelta(hours=random.randint(1, 5)),
                'created_at': timezone.now() - timedelta(hours=random.randint(1, 5)),
            })

        # Pending approval
        for i in range(3):
            visits_data.append({
                'visitor': visitors[i + 5],
                'host': hosts[(i + 2) % len(hosts)],
                'purpose': purposes[(i + 2) % len(purposes)],
                'status': Visit.Status.PENDING_APPROVAL,
                'entry_type': Visit.EntryType.QR_SELF,
                'created_at': timezone.now() - timedelta(minutes=random.randint(5, 30)),
            })

        # Checked out (completed visits from past days)
        for i in range(10):
            days_ago = random.randint(1, 30)
            checkin_time = timezone.now() - timedelta(days=days_ago, hours=random.randint(9, 17))
            checkout_time = checkin_time + timedelta(hours=random.randint(1, 4))
            
            visits_data.append({
                'visitor': visitors[i % len(visitors)],
                'host': hosts[i % len(hosts)],
                'purpose': purposes[i % len(purposes)],
                'status': Visit.Status.CHECKED_OUT,
                'entry_type': random.choice(entry_types),
                'checked_in_at': checkin_time,
                'checked_out_at': checkout_time,
                'created_at': checkin_time,
            })

        # Scheduled future visits
        for i in range(5):
            future_date = timezone.now() + timedelta(days=random.randint(1, 30), hours=random.randint(9, 17))
            visits_data.append({
                'visitor': visitors[i % len(visitors)],
                'host': hosts[(i + 3) % len(hosts)],
                'purpose': purposes[i % len(purposes)],
                'status': Visit.Status.SCHEDULED,
                'entry_type': Visit.EntryType.SCHEDULED,
                'scheduled_at': future_date,
                'created_at': timezone.now() - timedelta(days=random.randint(1, 5)),
            })

        # Create visits
        for vd in visits_data:
            created_at = vd.pop('created_at', timezone.now())
            visit = Visit.objects.create(**vd)
            visit.created_at = created_at
            visit.save()
            self.stdout.write(f'  Created visit: {visit.visitor.full_name} -> {visit.get_purpose_display()} [{visit.status}]')

        # ── Add condition-based data to some visits ───────────────────────────
        # Interview visits
        interview_visits = Visit.objects.filter(purpose=Visit.Purpose.INTERVIEW)[:3]
        positions = ['Software Engineer', 'HR Manager', 'Financial Analyst']
        departments = ['Engineering', 'Human Resources', 'Finance']
        for idx, visit in enumerate(interview_visits):
            visit.interview_position = positions[idx % len(positions)]
            visit.save()

        # Contractor visits
        contractor_visits = Visit.objects.filter(purpose=Visit.Purpose.CONTRACTOR)[:2]
        companies = ['BuildRight Construction', 'ElectroTech Services']
        designations = ['Site Supervisor', 'Electrician']
        addresses = ['123 Main Street, Karachi', '456 Industrial Area, Lahore']
        for idx, visit in enumerate(contractor_visits):
            visit.contractor_company = companies[idx % len(companies)]
            visit.contractor_designation = designations[idx % len(designations)]
            visit.contractor_address = addresses[idx % len(addresses)]
            visit.save()

        # Official visits
        official_visits = Visit.objects.filter(purpose=Visit.Purpose.OFFICIAL)[:2]
        depts = ['Revenue Department', 'Police Headquarters']
        ranks = ['Tax Officer', 'Inspector']
        for idx, visit in enumerate(official_visits):
            visit.official_department = depts[idx % len(depts)]
            visit.official_rank = ranks[idx % len(ranks)]
            visit.save()

        # VIP visits
        vip_visits = Visit.objects.filter(purpose=Visit.Purpose.VIP)[:2]
        categories = ['Major Client', 'Regular Donor']
        for idx, visit in enumerate(vip_visits):
            visit.vip_category = categories[idx % len(categories)]
            visit.save()

        # Delivery visits
        delivery_visits = Visit.objects.filter(purpose=Visit.Purpose.DELIVERY)[:2]
        delivery_companies = ['TCS Courier', 'Leopards Logistics']
        for idx, visit in enumerate(delivery_visits):
            visit.delivery_company = delivery_companies[idx % len(delivery_companies)]
            visit.save()

        self.stdout.write(self.style.SUCCESS('\n✅ Seeding completed successfully!'))
        self.stdout.write(self.style.WARNING(f'\n📊 Summary:'))
        self.stdout.write(f'  Hosts: {Host.objects.count()}')
        self.stdout.write(f'  Visitors: {Visitor.objects.count()}')
        self.stdout.write(f'  Visits: {Visit.objects.count()}')
        self.stdout.write(f'  Blacklisted: {Visitor.objects.filter(is_blacklisted=True).count()}')
        self.stdout.write(f'  Currently Inside: {Visit.objects.filter(status=Visit.Status.CHECKED_IN).count()}')
        self.stdout.write(f'  Pending Approval: {Visit.objects.filter(status=Visit.Status.PENDING_APPROVAL).count()}')
        self.stdout.write(f'  Scheduled: {Visit.objects.filter(status=Visit.Status.SCHEDULED).count()}')
