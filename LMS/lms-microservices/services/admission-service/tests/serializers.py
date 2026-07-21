from rest_framework import serializers
from .models import Test, Question, TestAttempt, EntranceLead, Interview, ReceiptCode

class EntranceLeadSerializer(serializers.ModelSerializer):
    # Read-only computed fields for convenience
    is_converted = serializers.BooleanField(source='converted_to_student', read_only=True)

    class Meta:
        model = EntranceLead
        fields = '__all__'

    # NOTE: Email and phone are intentionally NOT unique-validated.
    # Multiple applicants from the same household may share an email or phone.
    # The lead_auto_id (sequential integer) is the primary identifier.

class QuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ['id', 'question_type', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'correct_answers', 'marks', 'difficulty', 'order', 'image', 'option_a_image', 'option_b_image', 'option_c_image', 'option_d_image']

class QuestionAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = '__all__'

class QuestionPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        exclude = ['correct_answer', 'correct_answers']

class TestSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)

    class Meta:
        model = Test
        fields = ['id', 'title', 'course_id', 'specialization_id', 'passing_marks', 'total_marks', 'duration', 'is_required', 'questions']

class TestWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Test
        fields = ['title', 'course_id', 'specialization_id', 'passing_marks', 'total_marks', 'duration', 'is_required']

class QuestionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Question
        fields = ['test', 'question_type', 'question_text', 'option_a', 'option_b', 'option_c', 'option_d', 'correct_answer', 'correct_answers', 'marks', 'difficulty', 'order', 'image', 'option_a_image', 'option_b_image', 'option_c_image', 'option_d_image']

class TestAttemptSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestAttempt
        fields = '__all__'

    def validate_answers(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Answers must be a JSON object (dictionary)")
        return value

class AnswerSubmissionSerializer(serializers.Serializer):
    attempt_id = serializers.UUIDField()
    answers = serializers.DictField(
        child=serializers.CharField(),
        help_text="Dictionary where keys are question IDs and values are selected options (A, B, C, or D)"
    )

class TestResultSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestAttempt
        fields = ['id', 'user_id', 'test', 'score', 'percentage', 'status', 'is_passed', 'enrollment_status', 'lms_enrollment_id', 'start_time', 'end_time']

class InterviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interview
        fields = '__all__'

class ReceiptCodeSerializer(serializers.ModelSerializer):
    # Nested read-only lead summary for pipeline visibility
    lead_info = serializers.SerializerMethodField()

    class Meta:
        model = ReceiptCode
        fields = '__all__'

    def get_lead_info(self, obj):
        if not obj.lead:
            return None
        return {
            "id": str(obj.lead.id),
            "name": obj.lead.name,
            "email": obj.lead.email,
            "phone": obj.lead.phone,
            "status": obj.lead.status,
            "test_score": obj.lead.test_score,
            "converted_to_student": obj.lead.converted_to_student,
            "lms_user_id": str(obj.lead.lms_user_id) if obj.lead.lms_user_id else None,
            
            # Additional detailed fields
            "cnic_number": obj.lead.cnic_number,
            "date_of_birth": obj.lead.date_of_birth,
            "gender": obj.lead.gender,
            "whatsapp_number": obj.lead.whatsapp_number,
            "father_guardian_name": obj.lead.father_guardian_name,
            "guardian_contact": obj.lead.guardian_contact,
            "relationship_to_student": obj.lead.relationship_to_student,
            "last_qualification": obj.lead.last_qualification,
            "full_address": obj.lead.full_address,
            "study_work_status": obj.lead.study_work_status,
            "study_work_details": obj.lead.study_work_details,
            "studied_at_idara": obj.lead.studied_at_idara,
            "signature": obj.lead.signature,
        }
