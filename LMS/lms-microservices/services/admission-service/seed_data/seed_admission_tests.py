import os
import django
import sys
import uuid

# Setup Django
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'admission_service.settings')
django.setup()

from tests.models import Test, Question

def seed_domain_tests():
    print("🚀 Seeding Course-Specific Admission Tests...")
    
    course_data = [
        {
            "id": "ef80f58b-a67a-48b6-aac4-0ec0065b07bc",
            "name": "Machine Learning & AI",
            "passing": 3,
            "questions": [
                {"q": "What is Supervised Learning?", "a": "Learning with labeled data", "b": "Learning without labels", "c": "Learning by playing games", "d": "None of the above", "correct": "A"},
                {"q": "Which algorithm is used for Classification?", "a": "Linear Regression", "b": "Logistic Regression", "c": "K-Means", "d": "PCA", "correct": "B"},
                {"q": "What does CNN stand for?", "a": "Central Neural Network", "b": "Computer Network Node", "c": "Convolutional Neural Network", "d": "Common Neural Node", "correct": "C"},
                {"q": "What is Overfitting?", "a": "Model performing too well on training data but poorly on new data", "b": "Model performing poorly on training data", "c": "Model is too simple", "d": "Model has too few parameters", "correct": "A"},
                {"q": "Which of these is a popular ML library?", "a": "React", "b": "Django", "c": "Scikit-Learn", "d": "Laravel", "correct": "C"}
            ]
        },
        {
            "id": "085c7d20-25c2-4e5a-9ebc-860752bf92f4",
            "name": "AI & Robotics",
            "passing": 3,
            "questions": [
                {"q": "What is a Sensor in robotics?", "a": "Output device", "b": "Input device that detects physical world changes", "c": "Brain of robot", "d": "Battery", "correct": "B"},
                {"q": "What is an Actuator?", "a": "Component that moves or controls a mechanism", "b": "A type of sensor", "c": "A software algorithm", "d": "A visual display", "correct": "A"},
                {"q": "What does ROS stand for?", "a": "Robot Operating System", "b": "Real-time Operating System", "c": "Remote Operating Service", "d": "Random Object Server", "correct": "A"},
                {"q": "Which field combines CS and Engineering to create machines?", "a": "Sociology", "b": "Robotics", "c": "Biology", "d": "History", "correct": "B"},
                {"q": "A gyroscope measures:", "a": "Temperature", "b": "Distance", "c": "Orientation and angular velocity", "d": "Light", "correct": "C"}
            ]
        },
        {
            "id": "746e34ff-0e2d-4676-aa3c-a9382aa648e0",
            "name": "Graphic Design & Creative Arts",
            "passing": 2,
            "questions": [
                {"q": "Which color model is used for printing?", "a": "RGB", "b": "CMYK", "c": "HSL", "d": "HEX", "correct": "B"},
                {"q": "What is 'Kerning' in typography?", "a": "Space between lines", "b": "Space between individual characters", "c": "Font size", "d": "Font weight", "correct": "B"},
                {"q": "Which software is vector-based?", "a": "Adobe Photoshop", "b": "Adobe Illustrator", "c": "MS Paint", "d": "Picasso", "correct": "B"},
                {"q": "What is a focal point?", "a": "The middle of the page", "b": "The area that first attracts attention", "c": "The background", "d": "The smallest element", "correct": "B"}
            ]
        },
        {
            "id": "9599cc67-5f11-436c-83aa-9b835b847972",
            "name": "Mobile App Development",
            "passing": 3,
            "questions": [
                {"q": "Which language is primarily used for Android (Native)?", "a": "Swift", "b": "Kotlin", "c": "PHP", "d": "Ruby", "correct": "B"},
                {"q": "Which language is primarily used for iOS (Native)?", "a": "Kotlin", "b": "Java", "c": "Swift", "d": "Python", "correct": "C"},
                {"q": "What is React Native?", "a": "A database", "b": "A framework for building mobile apps with JavaScript", "c": "A web browser", "d": "An operating system", "correct": "B"},
                {"q": "What does APK stand for?", "a": "Android Package Kit", "b": "App Program Kit", "c": "Android Play Kernel", "d": "Apple Program Key", "correct": "A"},
                {"q": "API stands for:", "a": "Application Programming Interface", "b": "Advanced Program Input", "c": "Apple Peripheral Icon", "d": "Access Point Interior", "correct": "A"}
            ]
        },
        {
            "id": "60c282fa-6bf3-4f04-bfd3-bf3d75d00d18",
            "name": "Digital Marketing Fundamental",
            "passing": 2,
            "questions": [
                {"q": "What does SEO stand for?", "a": "Search Engine Optimization", "b": "Social Engagement Online", "c": "Site Entry Office", "d": "Standard Error Output", "correct": "A"},
                {"q": "Which platform is best for B2B marketing?", "a": "TikTok", "b": "Instagram", "c": "LinkedIn", "d": "Snapchat", "correct": "C"},
                {"q": "What is a 'Call to Action' (CTA)?", "a": "A phone call", "b": "An instruction to the audience to provoke a response", "c": "A legal disclaimer", "d": "A marketing budget", "correct": "B"},
                {"q": "PPC stands for:", "a": "Pay Per Click", "b": "Personal Program Control", "c": "Price Per Customer", "d": "Public Page Content", "correct": "A"}
            ]
        }
    ]

    for data in course_data:
        test, created = Test.objects.get_or_create(
            course_id=data["id"],
            defaults={
                "title": f"Entrance Test: {data['name']}",
                "passing_marks": data["passing"],
                "total_marks": len(data["questions"]),
                "duration": 20,
                "is_required": True
            }
        )
        
        if not created:
             print(f"⚠️ Test already exists for {data['name']}, updating questions.")
             test.questions.all().delete()
        else:
             print(f"✅ Created Test for {data['name']}")

        for q in data["questions"]:
            Question.objects.create(
                test=test,
                question_text=q["q"],
                option_a=q["a"],
                option_b=q["b"],
                option_c=q["c"],
                option_d=q["d"],
                correct_answer=q["correct"],
                marks=1,
                difficulty="medium"
            )
            
    print("\n🎉 Seeding of all tests completed!")

if __name__ == "__main__":
    seed_domain_tests()
