from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import Subject, ClassTimeTable, TeacherTimeTable, ShiftTiming
from classes.models import ClassRoom
from teachers.models import Teacher
from central_auth.authentication import CentralAuthUser
from timetable_service.dual_auth import central_person_id, get_org_and_tenant


def _classroom_field(**kw):
    # _base_manager bypasses OrganizationManager (which returns .none() when
    # evaluated outside a request context) so PK validation works.
    return serializers.PrimaryKeyRelatedField(queryset=ClassRoom._base_manager.all(), **kw)


def _teacher_field(**kw):
    return serializers.PrimaryKeyRelatedField(queryset=Teacher._base_manager.all(), **kw)


def _subject_field(**kw):
    # Phase C9: found live while proving slot-creation — `subject` was a
    # bare field name in ClassTimeTableCreateSerializer/
    # TeacherTimeTableCreateSerializer's Meta.fields (unlike classroom/
    # teacher above, which were already wrapped), so DRF auto-built its
    # PrimaryKeyRelatedField from `Subject.objects` — OrganizationManager,
    # blind for a central-auth request (returns "Invalid pk" for every
    # subject, since the queryset used for PK validation is empty). Same
    # fix shape as _classroom_field/_teacher_field, just missed on the
    # first pass since it wasn't already using the helper pattern.
    return serializers.PrimaryKeyRelatedField(queryset=Subject._base_manager.all(), **kw)


def _stamp_org_and_tenant(validated_data, request):
    """Phase C9: shared by ShiftTimingSerializer/SubjectSerializer.create().
    Legacy: unchanged (request.user.organization, when present). Central:
    no `.organization`/`.org_id` on CentralAuthUser (only tenant_id) — the
    original `hasattr(user, 'organization')` check already safely no-ops
    for it (AttributeError-free, just never true), so `organization` stays
    None exactly as before; `tenant_id` is stamped in addition."""
    if not request or not request.user:
        return
    user = request.user
    if isinstance(user, CentralAuthUser):
        validated_data['tenant_id'] = user.tenant_id
    elif hasattr(user, 'organization'):
        validated_data['organization'] = user.organization


class ShiftTimingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShiftTiming
        fields = [
            'id', 'campus', 'shift', 'timetable_type', 'name',
            'start_time', 'end_time', 'is_break', 'order', 'days',
            'organization'
        ]
        read_only_fields = ['organization']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Phase C9: `campus` is a writable PrimaryKeyRelatedField DRF
        # auto-derives from the model FK — built from `campus.Campus.objects`
        # (OrganizationManager, blind for a central-auth request; `Campus`
        # has no `all_objects` on `main` — a campus-service model, out of
        # scope to add one from here, same as C8's identical finding).
        # `._base_manager` used instead, same not-tenant-scoped caveat as
        # this file's `_classroom_field`/`_teacher_field`.
        request = self.context.get('request')
        if request is not None and isinstance(getattr(request, 'user', None), CentralAuthUser):
            if 'campus' in self.fields:
                from campus.models import Campus
                self.fields['campus'].queryset = Campus._base_manager.all()

    def create(self, validated_data):
        request = self.context.get('request')
        _stamp_org_and_tenant(validated_data, request)
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

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Phase C9: same blind spot as ShiftTimingSerializer.campus above,
        # plus `level` -> `classes.Level` (also OrganizationManager-backed,
        # no `all_objects` on `main` either — same C5-class gap C8 found
        # for Level/Grade, out of scope to fix from timetable-service).
        request = self.context.get('request')
        if request is not None and isinstance(getattr(request, 'user', None), CentralAuthUser):
            if 'campus' in self.fields:
                from campus.models import Campus
                self.fields['campus'].queryset = Campus._base_manager.all()
            if 'level' in self.fields:
                from classes.models import Level
                self.fields['level'].queryset = Level._base_manager.all()

    def create(self, validated_data):
        request = self.context.get('request')
        _stamp_org_and_tenant(validated_data, request)
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


def _stamp_actor(validated_data, request):
    """Phase C9: legacy branch UNCHANGED (byte-for-byte from the original —
    `getattr(user, 'pk', None)` already safely no-ops for CentralAuthUser,
    which has no `.pk` at all, so this whole block was already a no-op on
    the central path before this phase; kept exactly as it was). Central
    branch added alongside it: stamps `central_created_by_id` (the acting
    user's own identity — always resolvable directly from the token, same
    as every prior phase's `central_person_id`) and `tenant_id`."""
    if not request or not request.user:
        return
    user = request.user
    if isinstance(user, CentralAuthUser):
        validated_data['central_created_by_id'] = central_person_id(user)
        validated_data['tenant_id'] = user.tenant_id
        return
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


def _full_clean_and_save(model_cls, validated_data):
    """Phase C9 fix, found while proving the double-booking conflict check:
    DRF's default ModelSerializer.create() does `Model._default_manager.create
    (**validated_data)`, which calls `.save()` but NEVER `.full_clean()` — a
    well-known Django/DRF gap. `TeacherTimeTable.clean()`'s conflict check
    (and `ClassTimeTable.clean()`'s overlap check) were therefore DEAD CODE
    from the API's perspective for BOTH token types — only Django admin
    (whose ModelForm calls full_clean() automatically) ever ran them.
    Pre-existing, not introduced by this phase, but it blocks the very
    proof this phase's prompt explicitly requires ("double-booking within a
    tenant -> conflict raised") — fixed here for both legacy and central,
    not narrowed to central-auth only, since there's no reason the legacy
    path should keep the gap now that it's found."""
    instance = model_cls(**validated_data)
    try:
        # validate_unique=False: ClassTimeTableViewSet.create() intentionally
        # relies on the DB UniqueConstraint raising IntegrityError for an
        # exact (classroom/teacher, day, start_time) duplicate, which it
        # then catches and upserts (existing behavior, unrelated to this
        # phase — must not be short-circuited into a hard validation error
        # here). clean_fields()/clean() (the conflict/overlap check this
        # fix is actually about) still run.
        instance.full_clean(exclude=['id'], validate_unique=False)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(exc.message_dict if hasattr(exc, 'message_dict') else exc.messages)
    instance.save()
    return instance


# Create serializers for simplified creation
class ClassTimeTableCreateSerializer(serializers.ModelSerializer):
    classroom = _classroom_field()
    teacher = _teacher_field(required=False, allow_null=True)
    subject = _subject_field(required=False, allow_null=True)

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
        _stamp_actor(validated_data, self.context.get('request'))
        return _full_clean_and_save(ClassTimeTable, validated_data)


class TeacherTimeTableCreateSerializer(serializers.ModelSerializer):
    classroom = _classroom_field()
    teacher = _teacher_field()
    subject = _subject_field()

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
        _stamp_actor(validated_data, self.context.get('request'))
        return _full_clean_and_save(TeacherTimeTable, validated_data)
