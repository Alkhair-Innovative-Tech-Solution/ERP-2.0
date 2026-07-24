from rest_framework import serializers
from .models import Subject, ClassTimeTable, TeacherTimeTable, ShiftTiming
from classes.models import ClassRoom
from teachers.models import Teacher


def _classroom_field(**kw):
    # _base_manager bypasses OrganizationManager (which returns .none() when
    # evaluated outside a request context) so PK validation works.
    return serializers.PrimaryKeyRelatedField(queryset=ClassRoom._base_manager.all(), **kw)


def _teacher_field(**kw):
    return serializers.PrimaryKeyRelatedField(queryset=Teacher._base_manager.all(), **kw)

class ShiftTimingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShiftTiming
        fields = [
            'id', 'campus', 'shift', 'timetable_type', 'name',
            'start_time', 'end_time', 'is_break', 'order', 'days',
            'organization'
        ]
        read_only_fields = ['organization']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user and hasattr(request.user, 'organization'):
            validated_data['organization'] = request.user.organization
        return super().create(validated_data)

class SubjectSerializer(serializers.ModelSerializer):
    campus_name = serializers.CharField(source='campus.campus_name', read_only=True)
    
    class Meta:
        model = Subject
        fields = [
            'id', 'name', 'code', 'description',
            'campus', 'campus_name',
            'level',
            'is_active', 'created_at', 'updated_at',
            'organization'
        ]
        read_only_fields = ['code', 'created_at', 'updated_at', 'organization']

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user and hasattr(request.user, 'organization'):
            validated_data['organization'] = request.user.organization
        return super().create(validated_data)

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        if instance.level:
            representation['level'] = {
                'id': instance.level.id,
                'name': instance.level.name
            }
        return representation


class ClassTimeTableSerializer(serializers.ModelSerializer):
    # Read-only display fields
    classroom_display = serializers.CharField(source='classroom.__str__', read_only=True)
    grade = serializers.CharField(source='classroom.grade.name', read_only=True)
    section = serializers.CharField(source='classroom.section', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)
    teacher_code = serializers.CharField(source='teacher.employee_code', read_only=True)
    time_slot = serializers.CharField(read_only=True)
    day_display = serializers.CharField(source='get_day_display', read_only=True)
    
    class Meta:
        model = ClassTimeTable
        fields = [
            'id', 'classroom', 'classroom_display', 'grade', 'section',
            'subject', 'subject_name',
            'teacher', 'teacher_name', 'teacher_code',
            'day', 'day_display', 'start_time', 'end_time', 'time_slot',
            'is_break', 'notes',
            'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']


class TeacherTimeTableSerializer(serializers.ModelSerializer):
    # Read-only display fields
    teacher_name = serializers.CharField(source='teacher.full_name', read_only=True)
    teacher_code = serializers.CharField(source='teacher.employee_code', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    classroom_display = serializers.CharField(source='classroom.__str__', read_only=True)
    grade = serializers.CharField(source='classroom.grade.name', read_only=True)
    section = serializers.CharField(source='classroom.section', read_only=True)
    time_slot = serializers.CharField(read_only=True)
    day_display = serializers.CharField(source='get_day_display', read_only=True)
    
    class Meta:
        model = TeacherTimeTable
        fields = [
            'id', 'teacher', 'teacher_name', 'teacher_code',
            'subject', 'subject_name',
            'classroom', 'classroom_display', 'grade', 'section',
            'day', 'day_display', 'start_time', 'end_time', 'time_slot',
            'is_break', 'notes',
            'created_by', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']


# Create serializers for simplified creation
class ClassTimeTableCreateSerializer(serializers.ModelSerializer):
    classroom = _classroom_field()
    teacher = _teacher_field(required=False, allow_null=True)

    class Meta:
        model = ClassTimeTable
        fields = [
            'classroom', 'subject', 'teacher',
            'day', 'start_time', 'end_time',
            'is_break', 'notes', 'organization'
        ]
        read_only_fields = ['organization']
        # Disable unique-together validator so the view can do upsert logic
        validators = []

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user:
            user = request.user
            # Only set created_by if user has a real PK in the local DB
            if getattr(user, 'pk', None):
                try:
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    local_user = User.objects.filter(pk=user.pk).first()
                    if local_user:
                        validated_data['created_by'] = local_user
                except Exception:
                    pass
            if hasattr(user, 'organization') and user.organization:
                validated_data['organization'] = user.organization
            elif getattr(user, 'org_id', None):
                try:
                    from users.models import Organization
                    org = Organization.all_objects.filter(pk=user.org_id).first()
                    if org:
                        validated_data['organization'] = org
                except Exception:
                    pass
        return super().create(validated_data)


class TeacherTimeTableCreateSerializer(serializers.ModelSerializer):
    classroom = _classroom_field()
    teacher = _teacher_field()

    class Meta:
        model = TeacherTimeTable
        fields = [
            'teacher', 'subject', 'classroom',
            'day', 'start_time', 'end_time',
            'is_break', 'notes', 'organization'
        ]
        read_only_fields = ['organization']
        validators = []

    def create(self, validated_data):
        request = self.context.get('request')
        if request and request.user:
            user = request.user
            if getattr(user, 'pk', None):
                try:
                    from django.contrib.auth import get_user_model
                    User = get_user_model()
                    local_user = User.objects.filter(pk=user.pk).first()
                    if local_user:
                        validated_data['created_by'] = local_user
                except Exception:
                    pass
            if hasattr(user, 'organization') and user.organization:
                validated_data['organization'] = user.organization
            elif getattr(user, 'org_id', None):
                try:
                    from users.models import Organization
                    org = Organization.all_objects.filter(pk=user.org_id).first()
                    if org:
                        validated_data['organization'] = org
                except Exception:
                    pass
        return super().create(validated_data)
