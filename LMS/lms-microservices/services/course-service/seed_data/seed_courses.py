import os
import django
import uuid

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'course_service.settings')
django.setup()

from courses.models import Specialization, Course

def seed():
    print("Seeding specializations...")
    ai_spec, _ = Specialization.objects.get_or_create(
        name="Artificial Intelligence",
        defaults={"description": "Learn about AI and Machine Learning", "active": True}
    )
    cs_spec, _ = Specialization.objects.get_or_create(
        name="Computer Science",
        defaults={"description": "Core computer science principles", "active": True}
    )
    
    print("Seeding courses...")
    Course.objects.get_or_create(
        name="Python Programming",
        specialization=cs_spec,
        defaults={
            "description": "Introduction to Python",
            "level": 0,
            "duration": 4,
            "active": True
        }
    )
    Course.objects.get_or_create(
        name="Deep Learning",
        specialization=ai_spec,
        defaults={
            "description": "Advanced Neural Networks",
            "level": 2,
            "duration": 8,
            "active": True
        }
    )
    print("✓ Seeding complete!")

if __name__ == "__main__":
    seed()
