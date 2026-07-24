from rest_framework import serializers
from django.utils import timezone
from .models import Assignment, Submission
from subjects.models import Subject


class SubmissionSerializer(serializers.ModelSerializer):
    submitted_file_url = serializers.SerializerMethodField()
    percentage = serializers.SerializerMethodField()

    class Meta:
        model = Submission
        fields = [
            'id', 'assignment', 'student_id', 'student_name',
            'submitted_file', 'submitted_file_url', 'submission_text',
            'grade', 'feedback', 'status',
            'submitted_at', 'graded_by_id', 'graded_by_name', 'graded_at',
            'percentage',
        ]
        read_only_fields = [
            'id', 'submitted_at', 'graded_at', 'submitted_file_url', 'percentage'
        ]

    def get_submitted_file_url(self, obj):
        if obj.submitted_file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.submitted_file.url)
            return obj.submitted_file.url
        return None

    def get_percentage(self, obj):
        if obj.grade is not None and obj.assignment.total_marks:
            return round((obj.grade / obj.assignment.total_marks) * 100, 1)
        return None


class SubmissionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = ['submitted_file', 'submission_text']


class SubmissionGradeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Submission
        fields = ['grade', 'feedback', 'status']

    def update(self, instance, validated_data):
        instance.grade = validated_data.get('grade', instance.grade)
        instance.feedback = validated_data.get('feedback', instance.feedback)
        instance.status = validated_data.get('status', 'GRADED')
        instance.graded_at = timezone.now()
        request = self.context.get('request')
        if request and request.user:
            instance.graded_by_id = request.user.id
            instance.graded_by_name = request.user.username
        instance.save()
        return instance


class AssignmentSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    submission_count = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()
    my_submission = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = [
            'id', 'subject', 'subject_name',
            'classroom_id', 'classroom_code', 'classroom_label',
            'title', 'description', 'instructions', 'assignment_type',
            'total_marks', 'due_date', 'is_published',
            'attachment', 'attachment_url', 'quiz_form_url', 'quiz_responses_url',
            'created_by_id', 'created_by_name',
            'created_at', 'updated_at',
            'submission_count', 'my_submission',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'attachment_url']

    def get_attachment_url(self, obj):
        if obj.attachment:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None

    def get_submission_count(self, obj):
        return obj.submissions.count()

    def get_my_submission(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.role == 'student':
            sub = obj.submissions.filter(student_id=request.user.id).first()
            if sub:
                return {
                    'id': sub.id,
                    'status': sub.status,
                    'grade': sub.grade,
                    'submitted_at': sub.submitted_at,
                }
        return None


class AssignmentCreateSerializer(serializers.ModelSerializer):
    subject = serializers.PrimaryKeyRelatedField(queryset=Subject.all_objects.all())

    class Meta:
        model = Assignment
        fields = [
            'subject', 'classroom_id', 'classroom_code', 'classroom_label',
            'title', 'description', 'instructions', 'assignment_type',
            'total_marks', 'due_date', 'is_published', 'attachment', 'quiz_form_url', 'quiz_responses_url',
        ]
