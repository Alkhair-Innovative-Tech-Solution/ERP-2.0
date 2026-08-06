from rest_framework import serializers
from .models import Level, Grade, ClassRoom


def _central_user(context):
    """Returns the CentralAuthUser for this request, or None (legacy token
    / no request in context)."""
    from central_auth.authentication import CentralAuthUser
    request = context.get('request')
    user = getattr(request, 'user', None)
    return user if isinstance(user, CentralAuthUser) else None


class LevelSerializer(serializers.ModelSerializer):
    campus_name = serializers.CharField(source='campus.campus_name', read_only=True)
    coordinator_name = serializers.SerializerMethodField()
    coordinator_code = serializers.SerializerMethodField()
    shift_display = serializers.CharField(source='get_shift_display', read_only=True)
    grade_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False,
        help_text="Optional list of grade IDs to assign to this level"
    )
    new_grade_names = serializers.ListField(
        child=serializers.CharField(),
        write_only=True,
        required=False,
        help_text="Optional list of new grade names to create and assign to this level"
    )
    
    class Meta:
        model = Level
        fields = [
            'id', 'organization', 'tenant_id', 'central_org_id', 'name', 'shift', 'shift_display', 'code', 'campus', 'campus_name',
            'assigned_coordinator_id', 'central_assigned_coordinator_id', 'coordinator_name', 'coordinator_code',
            'grade_ids', 'new_grade_names', 'grade_set'
        ]
        read_only_fields = [
            'id', 'organization', 'tenant_id', 'central_org_id', 'code', 'grade_set',
            'coordinator_name', 'coordinator_code', 'central_assigned_coordinator_id',
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # `campus`'s auto-derived PrimaryKeyRelatedField queryset defaults
        # to Campus.objects.all() — OrganizationManager-filtered, silently
        # empty for a central-auth request (see campus_service/dual_auth.py's
        # module docstring), which rejects every valid id with "object does
        # not exist" on that path. Same fix shape as C4's
        # ResultCreateSerializer.__init__.
        if _central_user(self.context) is not None and 'campus' in self.fields:
            from campus.models import Campus
            self.fields['campus'].queryset = Campus.all_objects.all()

    def get_coordinator_name(self, obj):
        """Get coordinator name using the property"""
        return obj.coordinator_name
    
    def get_coordinator_code(self, obj):
        """Get coordinator code — use stored field first (cross-service safe)"""
        if obj.assigned_coordinator_code:
            return obj.assigned_coordinator_code
        coord = obj.coordinator
        return getattr(coord, 'employee_code', None)

    def create(self, validated_data):
        grade_ids = validated_data.pop('grade_ids', [])
        new_names = validated_data.pop('new_grade_names', [])
        level = super().create(validated_data)
        
        # 1) Handle existing grades
        if grade_ids:
            Grade.objects.filter(id__in=grade_ids).update(level=level)
            for grade in Grade.objects.filter(id__in=grade_ids):
                grade.save()

        # 2) Create new grades
        for name in new_names:
            Grade.objects.create(name=name, level=level)
            
        return level

    def update(self, instance, validated_data):
        grade_ids = validated_data.pop('grade_ids', None)
        new_names = validated_data.pop('new_grade_names', [])
        level = super().update(instance, validated_data)
        
        # 1) Handle existing grades
        if grade_ids is not None:
            Grade.objects.filter(id__in=grade_ids).update(level=level)
            for grade in Grade.objects.filter(id__in=grade_ids):
                grade.save()

        # 2) Create new grades
        for name in new_names:
            Grade.objects.create(name=name, level=level)
            
        return level

class GradeSerializer(serializers.ModelSerializer):
    level_name = serializers.CharField(source='level.name', read_only=True, required=False, allow_null=True)
    level_code = serializers.CharField(source='level.code', read_only=True, required=False, allow_null=True)
    level_shift = serializers.CharField(source='level.shift', read_only=True, required=False, allow_null=True)
    campus_name = serializers.CharField(source='campus.campus_name', read_only=True, required=False, allow_null=True)
    
    class Meta:
        model = Grade
        fields = [
            'id', 'organization', 'tenant_id', 'central_org_id', 'name', 'code', 'level', 'level_name',
            'level_code', 'level_shift', 'shift', 'campus', 'campus_name'
        ]
        read_only_fields = ['id', 'organization', 'tenant_id', 'central_org_id', 'code', 'shift', 'campus_name']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Same blind-spot fix as LevelSerializer, for `level` and `campus`.
        if _central_user(self.context) is not None:
            if 'level' in self.fields:
                self.fields['level'].queryset = Level.all_objects.all()
            if 'campus' in self.fields:
                from campus.models import Campus
                self.fields['campus'].queryset = Campus.all_objects.all()

class ClassRoomSerializer(serializers.ModelSerializer):
    grade_name = serializers.CharField(source='grade.name', read_only=True)
    grade_code = serializers.CharField(source='grade.code', read_only=True)
    level_name = serializers.CharField(source='grade.level.name', read_only=True)
    level_code = serializers.CharField(source='grade.level.code', read_only=True)
    campus_name = serializers.CharField(source='grade.level.campus.campus_name', read_only=True)
    class_teacher_name = serializers.CharField(source='class_teacher.full_name', read_only=True)
    class_teacher_code = serializers.CharField(source='class_teacher.employee_code', read_only=True)
    assigned_by_name = serializers.CharField(source='assigned_by.username', read_only=True)
    campus_id = serializers.IntegerField(source='grade.level.campus.id', read_only=True)
    
    class Meta:
        model = ClassRoom
        fields = [
            'id', 'organization', 'tenant_id', 'central_org_id', 'grade', 'grade_name', 'grade_code', 'section', 'shift', 'class_teacher',
            'central_class_teacher_id', 'class_teacher_name', 'class_teacher_code', 'capacity', 'code',
            'level_name', 'level_code', 'campus_id', 'campus_name', 'assigned_by', 'central_assigned_by_id', 'assigned_by_name',
            'assigned_at', 'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'organization', 'tenant_id', 'central_org_id', 'code', 'assigned_by',
            'central_assigned_by_id', 'central_class_teacher_id', 'assigned_at', 'created_at', 'updated_at',
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Same blind-spot fix as LevelSerializer, for `grade` (Grade.objects
        # is OrganizationManager-backed) and `class_teacher` (Teacher.objects
        # too — see classes/views.py's available_teachers note on the same
        # residual not-tenant-scoped caveat for Teacher, which lives in
        # staff-service).
        if _central_user(self.context) is not None:
            if 'grade' in self.fields:
                self.fields['grade'].queryset = Grade.all_objects.all()
            if 'class_teacher' in self.fields:
                from teachers.models import Teacher
                self.fields['class_teacher'].queryset = Teacher._base_manager.all()
