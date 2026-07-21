import os
import django
import uuid

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admission_service.settings')
django.setup()

from tests.models import Test, Question

def seed_tests():
    if Test.objects.exists():
        print("Tests already exist.")
        return

    print("Seeding default tests...")
    
    # Example IDs
    COURSE_ID = "d5b5bc80-155e-49d7-8112-7027dd233ed6"
    
    # Create Test
    test = Test.objects.create(
        title="General Assessment",
        course_id=COURSE_ID,
        passing_marks=20,
        total_marks=50,
        duration=60,
        is_required=True
    )
    
    # Add Questions
    Question.objects.create(
        test=test,
        question_text="What is the result of 10 + 10?",
        option_a="10", option_b="20", option_c="30", option_d="40",
        correct_answer="B",
        marks=10,
        difficulty="easy"
    )
    
    print(f"Seeded test: {test.title}")

if __name__ == "__main__":
    seed_tests()
