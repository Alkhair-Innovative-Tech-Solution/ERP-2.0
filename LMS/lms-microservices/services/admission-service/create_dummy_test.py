"""
Script to create a dummy test with easy questions for testing purposes
This test can be easily passed to get access to the LMS
"""
import os
import django
import sys
import uuid

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admission_service.settings')
django.setup()

from tests.models import Test, Question

def create_dummy_test():
    print("🚀 Seeding Decoupled Database...")
    
    # 1. External IDs (Example IDs from course service)
    # Using specific UUIDs to match common test data if needed
    COURSE_ID = "d5b5bc80-155e-49d7-8112-7027dd233ed6"
    SPEC_ID = "a1b2c3d4-e5f6-4a5b-b6c7-d8e9f0a1b2c3"
    
    # 2. Create Test
    test, created = Test.objects.get_or_create(
        course_id=COURSE_ID,
        title="AI Fundamentals Entrance Test",
        defaults={
            "specialization_id": SPEC_ID,
            "passing_marks": 2,
            "total_marks": 5,
            "duration": 30,
            "is_required": True
        }
    )
    
    if not created:
        print(f"⚠️  Test already exists: {test.title}")
        test.questions.all().delete() # Refresh questions
    else:
        print(f"✅ Created Test: {test.title}")
    
    # 3. Add Questions
    questions_data = [
        {
            "text": "What is 2 + 2?",
            "a": "3", "b": "4", "c": "5", "d": "6",
            "correct": "B", "marks": 1, "difficulty": "easy"
        },
        {
            "text": "What color is the sky on a clear day?",
            "a": "Red", "b": "Green", "c": "Blue", "d": "Yellow",
            "correct": "C", "marks": 1, "difficulty": "easy"
        },
        {
            "text": "How many days are in a week?",
            "a": "5", "b": "6", "c": "7", "d": "8",
            "correct": "C", "marks": 1, "difficulty": "easy"
        },
        {
            "text": "What is the capital of France?",
            "a": "London", "b": "Berlin", "c": "Madrid", "d": "Paris",
            "correct": "D", "marks": 1, "difficulty": "easy"
        },
        {
            "text": "What comes after Monday?",
            "a": "Wednesday", "b": "Tuesday", "c": "Thursday", "d": "Friday",
            "correct": "B", "marks": 1, "difficulty": "easy"
        }
    ]
    
    for q in questions_data:
        Question.objects.create(
            test=test,
            question_text=q["text"],
            option_a=q["a"],
            option_b=q["b"],
            option_c=q["c"],
            option_d=q["d"],
            correct_answer=q["correct"],
            marks=q["marks"],
            difficulty=q["difficulty"]
        )
    print(f"✅ Added {len(questions_data)} questions.")
    
    print("\n🎉 Seeding Completed Successfully!")
    print(f"📋 Test ID: {test.id}")
    print(f"📚 Extern Course ID: {test.course_id}")

if __name__ == "__main__":
    create_dummy_test()
