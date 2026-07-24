from rest_framework import serializers
from .models import Visitor, Host, Visit, Employee
from .utils import format_cnic, validate_cnic, validate_phone_pakistan, check_duplicate_combo


class VisitorSerializer(serializers.ModelSerializer):
    visit_count = serializers.SerializerMethodField()

    class Meta:
        model = Visitor
        fields = '__all__'

    def get_visit_count(self, obj):
        return obj.visits.count()


class HostSerializer(serializers.ModelSerializer):
    class Meta:
        model = Host
        fields = '__all__'


class EmployeeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        fields = ['id', 'name', 'department', 'designation', 'employee_id', 'phone', 'email']


class VisitListSerializer(serializers.ModelSerializer):
    visitor_name = serializers.CharField(source='visitor.full_name', read_only=True)
    visitor_cnic = serializers.CharField(source='visitor.cnic', read_only=True)
    visitor_phone = serializers.CharField(source='visitor.phone', read_only=True)
    visitor_company = serializers.CharField(source='visitor.company', read_only=True)
    visitor_photo = serializers.ImageField(source='visitor.photo', read_only=True)
    visitor_is_blacklisted = serializers.BooleanField(source='visitor.is_blacklisted', read_only=True)
    host_name = serializers.SerializerMethodField()
    host_type = serializers.SerializerMethodField()
    purpose_display = serializers.SerializerMethodField()
    duration_minutes = serializers.SerializerMethodField()
    late_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Visit
        fields = [
            'id', 'visitor_name', 'visitor_cnic', 'visitor_phone',
            'visitor_company', 'visitor_photo', 'visitor_is_blacklisted',
            'host_name', 'host_type', 'purpose', 'purpose_display', 'purpose_other',
            'status', 'entry_type', 'scheduled_at', 'visiting_id',
            'checked_in_at', 'expected_checkout_at', 'checked_out_at',
            'is_returning', 'is_overnight', 'is_late', 'card_expired',
            'duration_minutes', 'late_minutes', 'created_at',
        ]

    def get_host_name(self, obj):
        if obj.employee_host:
            return f"{obj.employee_host.name} ({obj.employee_host.department})"
        if obj.host:
            return obj.host.name
        return obj.host_name_manual

    def get_host_type(self, obj):
        if obj.employee_host:
            return "employee"
        if obj.host:
            return "host"
        if obj.host_name_manual:
            return "manual"
        return None

    def get_purpose_display(self, obj):
        if obj.purpose:
            return obj.get_purpose_display()
        return obj.purpose_other or ''

    def get_duration_minutes(self, obj):
        if obj.checked_in_at and obj.checked_out_at:
            delta = obj.checked_out_at - obj.checked_in_at
            return int(delta.total_seconds() / 60)
        elif obj.checked_in_at and obj.status == 'checked_in':
            from django.utils import timezone
            delta = timezone.now() - obj.checked_in_at
            return int(delta.total_seconds() / 60)
        return None

    def get_late_minutes(self, obj):
        if obj.expected_checkout_at and obj.checked_out_at:
            if obj.checked_out_at > obj.expected_checkout_at:
                delta = obj.checked_out_at - obj.expected_checkout_at
                return int(delta.total_seconds() / 60)
        return 0


class VisitDetailSerializer(serializers.ModelSerializer):
    visitor = VisitorSerializer(read_only=True)
    host = HostSerializer(read_only=True)
    purpose_display = serializers.SerializerMethodField()
    host_name = serializers.SerializerMethodField()
    host_type = serializers.SerializerMethodField()
    visitor_name = serializers.CharField(source='visitor.full_name', read_only=True)
    visitor_cnic = serializers.CharField(source='visitor.cnic', read_only=True)
    visitor_phone = serializers.CharField(source='visitor.phone', read_only=True)
    visitor_company = serializers.CharField(source='visitor.company', read_only=True)
    visitor_photo = serializers.ImageField(source='visitor.photo', read_only=True)
    visitor_is_blacklisted = serializers.BooleanField(source='visitor.is_blacklisted', read_only=True)
    duration_minutes = serializers.SerializerMethodField()

    class Meta:
        model = Visit
        fields = '__all__'

    def get_purpose_display(self, obj):
        if obj.purpose:
            return obj.get_purpose_display()
        return obj.purpose_other or ''

    def get_host_name(self, obj):
        if obj.employee_host:
            return f"{obj.employee_host.name} ({obj.employee_host.department})"
        if obj.host:
            return obj.host.name
        return obj.host_name_manual

    def get_host_type(self, obj):
        if obj.employee_host:
            return "employee"
        if obj.host:
            return "host"
        if obj.host_name_manual:
            return "manual"
        return None

    def get_duration_minutes(self, obj):
        if obj.checked_in_at and obj.checked_out_at:
            delta = obj.checked_out_at - obj.checked_in_at
            return int(delta.total_seconds() / 60)
        elif obj.checked_in_at and obj.status == 'checked_in':
            from django.utils import timezone
            delta = timezone.now() - obj.checked_in_at
            return int(delta.total_seconds() / 60)
        return None


# ── Shared validation mixins ──────────────────────────────────────────────────

def _validate_cnic_field(value):
    if value and value.strip():
        is_valid, error = validate_cnic(value)
        if not is_valid:
            raise serializers.ValidationError(error)
    return value


def _validate_phone_field(value):
    if value and value.strip():
        is_valid, error, _ = validate_phone_pakistan(value)
        if not is_valid:
            raise serializers.ValidationError(error)
    return value


def _validate_email_field(value):
    """Issue #9: email validation for all forms."""
    if value and value.strip():
        import re
        pattern = r'^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$'
        if not re.match(pattern, value.strip()):
            raise serializers.ValidationError("Enter a valid email address.")
    return value


class ReceptionistEntrySerializer(serializers.Serializer):
    full_name = serializers.CharField()
    cnic = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)   # Issue #9: EmailField
    company = serializers.CharField(required=False, allow_blank=True)
    host_id = serializers.UUIDField(required=False)
    employee_host_id = serializers.UUIDField(required=False)
    host_name_manual = serializers.CharField(required=False, allow_blank=True)
    purpose = serializers.ChoiceField(choices=Visit.Purpose.choices, required=False, allow_blank=True)
    purpose_other = serializers.CharField(required=False, allow_blank=True)
    interview_position = serializers.CharField(required=False, allow_blank=True)
    contractor_company = serializers.CharField(required=False, allow_blank=True)
    contractor_designation = serializers.CharField(required=False, allow_blank=True)
    contractor_address = serializers.CharField(required=False, allow_blank=True)
    delivery_company = serializers.CharField(required=False, allow_blank=True)
    official_department = serializers.CharField(required=False, allow_blank=True)
    official_rank = serializers.CharField(required=False, allow_blank=True)
    vip_category = serializers.CharField(required=False, allow_blank=True)
    # Issue #8: required
    expected_checkout_at = serializers.DateTimeField(required=True)
    notes = serializers.CharField(required=False, allow_blank=True)
    internal_department = serializers.CharField(required=False, allow_blank=True)

    def validate_cnic(self, value):
        return _validate_cnic_field(value)

    def validate_phone(self, value):
        return _validate_phone_field(value)

    def validate_email(self, value):
        return _validate_email_field(value)

    def validate(self, data):
        cnic = format_cnic(data.get('cnic')) if data.get('cnic') else None
        from .models import Visitor
        query_kwargs = {}
        if cnic:
            query_kwargs['cnic__iexact'] = cnic
        if data.get('phone'):
            query_kwargs['phone'] = data['phone']
        if data.get('email'):
            query_kwargs['email__iexact'] = data['email'].lower()

        if query_kwargs:
            from django.db.models import Q
            visitor = Visitor.objects.filter(Q(**query_kwargs)).first()
            if visitor and visitor.is_blacklisted:
                raise serializers.ValidationError({
                    'non_field_errors': ['RED ALERT: This visitor is blacklisted!']
                })

        return data


class QRCheckinSerializer(serializers.Serializer):
    full_name = serializers.CharField()
    cnic = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)   # Issue #9
    company = serializers.CharField(required=False, allow_blank=True)
    host_id = serializers.UUIDField(required=False)
    employee_host_id = serializers.UUIDField(required=False)
    host_name = serializers.CharField(required=False, allow_blank=True)
    host_is_other = serializers.BooleanField(required=False, default=False)
    purpose = serializers.ChoiceField(choices=Visit.Purpose.choices, required=False, allow_blank=True)
    purpose_other = serializers.CharField(required=False, allow_blank=True)
    interview_position = serializers.CharField(required=False, allow_blank=True)
    contractor_company = serializers.CharField(required=False, allow_blank=True)
    contractor_designation = serializers.CharField(required=False, allow_blank=True)
    contractor_address = serializers.CharField(required=False, allow_blank=True)
    delivery_company = serializers.CharField(required=False, allow_blank=True)
    official_department = serializers.CharField(required=False, allow_blank=True)
    official_rank = serializers.CharField(required=False, allow_blank=True)
    vip_category = serializers.CharField(required=False, allow_blank=True)
    internal_department = serializers.CharField(required=False, allow_blank=True)

    def validate_cnic(self, value):
        return _validate_cnic_field(value)

    def validate_phone(self, value):
        return _validate_phone_field(value)

    def validate_email(self, value):
        return _validate_email_field(value)

    def validate(self, data):
        cnic = format_cnic(data.get('cnic')) if data.get('cnic') else None
        phone = data.get('phone')
        email = data.get('email', '').lower() if data.get('email') else None

        from django.db.models import Q
        from .models import Visitor

        query = Q()
        if cnic:
            query |= Q(cnic__iexact=cnic)
        if phone:
            _, _, cleaned = validate_phone_pakistan(phone)
            if cleaned:
                query |= Q(phone=cleaned)
        if email:
            query |= Q(email__iexact=email)

        if query:
            existing_visitor = Visitor.objects.filter(query).first()
            if existing_visitor:
                cnic_match = (cnic and existing_visitor.cnic and existing_visitor.cnic.lower() == cnic.lower())
                phone_match = (phone and existing_visitor.phone and existing_visitor.phone == phone)
                email_match = (email and existing_visitor.email and existing_visitor.email.lower() == email)

                if cnic and cnic_match:
                    if (phone and not phone_match) or (email and not email_match):
                        raise serializers.ValidationError({
                            'non_field_errors': [
                                'This CNIC is already registered with different contact details. '
                                'Please contact the receptionist for assistance.'
                            ]
                        })

                if phone and phone_match:
                    if (cnic and not cnic_match) or (email and not email_match):
                        raise serializers.ValidationError({
                            'non_field_errors': [
                                'This phone number is already registered. '
                                'Please contact the receptionist for assistance.'
                            ]
                        })

        query_kwargs = {}
        if cnic:
            query_kwargs['cnic__iexact'] = cnic
        if phone:
            _, _, cleaned = validate_phone_pakistan(phone)
            if cleaned:
                query_kwargs['phone'] = cleaned
        if email:
            query_kwargs['email__iexact'] = email

        if query_kwargs:
            visitor = Visitor.objects.filter(Q(**query_kwargs)).first()
            if visitor and visitor.is_blacklisted:
                raise serializers.ValidationError({
                    'non_field_errors': ['RED ALERT: This visitor is blacklisted!']
                })

        return data


class ScheduledEntrySerializer(serializers.Serializer):
    visiting_id = serializers.CharField()


class ScheduleVisitSerializer(serializers.Serializer):
    full_name = serializers.CharField()
    cnic = serializers.CharField(required=False, allow_blank=True)
    phone = serializers.CharField(required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True)  # Issue #9
    company = serializers.CharField(required=False, allow_blank=True)
    host_id = serializers.UUIDField(required=False)
    employee_host_id = serializers.UUIDField(required=False)
    host_name_manual = serializers.CharField(required=False, allow_blank=True)
    purpose = serializers.ChoiceField(choices=Visit.Purpose.choices, required=False, allow_blank=True)
    purpose_other = serializers.CharField(required=False, allow_blank=True)
    interview_position = serializers.CharField(required=False, allow_blank=True)
    contractor_company = serializers.CharField(required=False, allow_blank=True)
    contractor_designation = serializers.CharField(required=False, allow_blank=True)
    contractor_address = serializers.CharField(required=False, allow_blank=True)
    delivery_company = serializers.CharField(required=False, allow_blank=True)
    official_department = serializers.CharField(required=False, allow_blank=True)
    official_rank = serializers.CharField(required=False, allow_blank=True)
    vip_category = serializers.CharField(required=False, allow_blank=True)
    internal_department = serializers.CharField(required=False, allow_blank=True)
    scheduled_at = serializers.DateTimeField()
    expected_checkout_at = serializers.DateTimeField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True)

    def validate_cnic(self, value):
        return _validate_cnic_field(value)

    def validate_phone(self, value):
        return _validate_phone_field(value)

    def validate_email(self, value):
        return _validate_email_field(value)

    def validate_scheduled_at(self, value):
        from django.utils import timezone
        if value <= timezone.now():
            raise serializers.ValidationError("Scheduled date must be in the future.")
        return value

    def validate(self, data):
        cnic = format_cnic(data.get('cnic')) if data.get('cnic') else None
        from .models import Visitor
        from django.db.models import Q

        query_kwargs = {}
        if cnic:
            query_kwargs['cnic__iexact'] = cnic
        if data.get('phone'):
            _, _, cleaned = validate_phone_pakistan(data['phone'])
            if cleaned:
                query_kwargs['phone'] = cleaned
        if data.get('email'):
            query_kwargs['email__iexact'] = data['email'].lower()

        if query_kwargs:
            visitor = Visitor.objects.filter(Q(**query_kwargs)).first()
            if visitor and visitor.is_blacklisted:
                raise serializers.ValidationError({
                    'non_field_errors': ['RED ALERT: This visitor is blacklisted!']
                })

        return data
