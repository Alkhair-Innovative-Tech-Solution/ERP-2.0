from django.core.management.base import BaseCommand
from django.db.models import Count
from courses.models import CourseRegistrationHistory, ScheduledClass, Batch

class Command(BaseCommand):
    help = 'Shows summary of LMS stats (Enrollments, Certificates, Drops)'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("\n=== AIT LMS SYSTEM STATS ===\n"))
        
        # 1. General Stats
        total_batches = Batch.objects.count()
        total_classes = ScheduledClass.objects.count()
        registrations = CourseRegistrationHistory.objects.all()
        total_enrolled = registrations.count()
        
        # 2. Status Breakdown
        status_stats = registrations.values('status').annotate(total=Count('id'))
        
        status_map = {
            'enrolled': 0,
            'completed': 0,
            'dropped': 0,
            'failed': 0
        }
        
        for s in status_stats:
            status_map[s['status']] = s['total']

        self.stdout.write(f"Total Batches   : {total_batches}")
        self.stdout.write(f"Total Classes   : {total_classes}")
        self.stdout.write(f"Total Students  : {total_enrolled}")
        self.stdout.write("-" * 30)
        self.stdout.write(self.style.SUCCESS(f"Certificates Issued (Completed) : {status_map.get('completed', 0)}"))
        self.stdout.write(self.style.WARNING(f"Active Enrollments              : {status_map.get('enrolled', 0)}"))
        self.stdout.write(self.style.ERROR(  f"Dropped Students                : {status_map.get('dropped', 0)}"))
        self.stdout.write("-" * 30)

        # 3. Top Courses
        self.stdout.write("\nTop Classes by Students:")
        top_classes = ScheduledClass.objects.annotate(
            actual_enrolled=Count('enrolled_students')
        ).order_by('-actual_enrolled')[:5]
        
        for c in top_classes:
            self.stdout.write(f" - {c.course.name} ({c.section}): {c.actual_enrolled} students")
        
        self.stdout.write("\n")
