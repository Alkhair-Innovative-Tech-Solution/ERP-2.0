from rest_framework import serializers
from .models import Subject, SubjectTeacherAssignment


class SubjectSerializer(serializers.ModelSerializer):
    teacher_count = serializers.SerializerMethodField()

    class Meta:
        model = Subject
        fields = [
            'id', 'name', 'subject_code', 'description',
            'grade_id', 'grade_name', 'campus_id', 'campus_name',
            'is_active', 'created_at', 'updated_at', 'teacher_count',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'teacher_count']

    def get_teacher_count(self, obj):
        return obj.teacher_assignments.filter(is_active=True).count()


class SubjectCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = [
            'name', 'subject_code', 'description',
            'grade_id', 'grade_name', 'campus_id', 'campus_name', 'is_active',
        ]


class SubjectTeacherAssignmentSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_code = serializers.CharField(source='subject.subject_code', read_only=True)

    class Meta:
        model = SubjectTeacherAssignment
        fields = [
            'id', 'subject', 'subject_name', 'subject_code',
            'teacher_id', 'teacher_name', 'teacher_email',
            'classroom_id', 'classroom_code', 'classroom_label',
            'academic_year', 'is_active', 'assigned_at', 'assigned_by_id',
        ]
        read_only_fields = ['id', 'assigned_at']


class SubjectTeacherAssignmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubjectTeacherAssignment
        fields = [
            'subject', 'teacher_id', 'teacher_name', 'teacher_email',
            'classroom_id', 'classroom_code', 'classroom_label', 'academic_year',
        ]
