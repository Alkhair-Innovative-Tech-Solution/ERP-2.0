from rest_framework import serializers
from django.contrib.auth.password_validation import validate_password
from .models import User, RolePermission, Organization, SubscriptionPlan, Invoice
from campus.models import Campus


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    """
    Serializer for SubscriptionPlan model
    """
    class Meta:
        model = SubscriptionPlan
        fields = [
            'id', 'name', 'max_users', 'max_students', 'max_campuses', 
            'description', 'price_per_student', 'price_per_user', 'base_price', 'is_enterprise', 'is_active', 'created_by'
        ]


class OrganizationSerializer(serializers.ModelSerializer):
    """
    Organization serializer for CRUD operations
    """
    used_users = serializers.SerializerMethodField()
    used_students = serializers.SerializerMethodField()
    used_campuses = serializers.SerializerMethodField()
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    plan_details = SubscriptionPlanSerializer(source='plan', read_only=True)
    
    class Meta:
        model = Organization
        fields = [
            'id', 'name', 'subdomain', 'plan', 'plan_name', 'plan_details',
            'max_users', 'max_students', 'max_campuses',
            'is_active', 'enabled_features', 'code_prefix', 'code_pattern',
            'created_by', 'created_at', 'updated_at',
            'used_users', 'used_students', 'used_campuses',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by']
    
    def get_used_users(self, obj):
        return obj.organization_users.exclude(role='student').count()
    
    def get_used_students(self, obj):
        try:
            return obj.students.count()
        except AttributeError:
            return 0

    def get_used_campuses(self, obj):
        try:
            return obj.campuses.count()
        except AttributeError:
            return 0


class OrganizationCreateSerializer(serializers.ModelSerializer):
    """
    Serializer for creating an Organization + its first admin user
    """
    admin_email = serializers.EmailField(write_only=True)
    admin_password = serializers.CharField(write_only=True)
    admin_full_name = serializers.CharField(write_only=True, required=False, default='')

    class Meta:
        model = Organization
        fields = [
            'name', 'subdomain', 'plan', 'max_users', 'max_students', 'max_campuses',
            'admin_email', 'admin_password', 'admin_full_name', 'enabled_features',
            'code_prefix', 'code_pattern',
        ]

    def validate_code_prefix(self, value):
        if not value:
            return value
        value = value.upper().strip()
        if not value.isalnum():
            raise serializers.ValidationError("Code prefix must be alphanumeric only (e.g. IAK, ABC).")
        if len(value) < 2 or len(value) > 6:
            raise serializers.ValidationError("Code prefix must be 2–6 characters.")
        # Exclude current instance on update
        qs = Organization.all_objects.filter(code_prefix__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("This code prefix is already taken by another organization.")
        return value

    def validate_admin_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated_data):
        import os
        import requests as http_requests
        from django.db import transaction
        admin_email = validated_data.pop('admin_email')
        admin_password = validated_data.pop('admin_password')
        admin_full_name = validated_data.pop('admin_full_name', '')

        # If a plan is provided, set quotas from plan
        plan = validated_data.get('plan')
        if plan:
            validated_data['max_users'] = plan.max_users
            validated_data['max_students'] = plan.max_students
            validated_data['max_campuses'] = plan.max_campuses

        # Set creator from request context
        created_by_id = None
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            req_user = request.user
            from central_auth.authentication import CentralAuthUser
            if isinstance(req_user, CentralAuthUser):
                # Phase C11: org-CREATE via central-auth stamps the
                # creator's own identity, but NOT tenant_id — there is no
                # source of truth here for "which central-auth tenant does
                # this brand-new org belong to" (the creating superadmin's
                # own tenant_id isn't necessarily the new org's tenant, and
                # OrganizationCreateSerializer has no field to carry a
                # target tenant explicitly). Flagged as a gap for a future
                # provisioning-flow phase; tenant_id stays NULL here.
                from org_service.dual_auth import central_person_id
                validated_data['created_by'] = None
                validated_data['central_created_by_id'] = central_person_id(req_user)
            elif req_user.is_superadmin():
                validated_data['created_by'] = None
            else:
                from users.views import _ensure_local_user
                local_user = _ensure_local_user(req_user)
                validated_data['created_by'] = local_user
                created_by_id = req_user.id

        name_parts = admin_full_name.split(' ', 1) if admin_full_name else ['', '']
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ''

        with transaction.atomic():
            org = Organization.objects.create(**validated_data)

            # Create user in org-service DB (for local queries)
            local_user = User.objects.create_user(
                username=admin_email,
                email=admin_email,
                password=admin_password,
                first_name=first_name,
                last_name=last_name,
                role='org_admin',
                is_org_admin=True,
                organization=org,
                has_changed_default_password=True,
            )

        # Sync to auth-service AFTER transaction commits (avoids TransactionManagementError)
        auth_url = os.environ.get('AUTH_SERVICE_URL', 'http://auth-service:8001')
        internal_secret = os.environ.get('INTERNAL_SERVICE_SECRET', '')
        try:
            resp = http_requests.post(
                f'{auth_url}/api/internal/create-user/',
                json={
                    'email': admin_email,
                    'password': admin_password,
                    'username': local_user.username,
                    'first_name': first_name,
                    'last_name': last_name,
                    'role': 'org_admin',
                    'is_org_admin': True,
                    'has_changed_default_password': True,
                    'organization': {
                        'id': org.id,
                        'name': org.name,
                        'created_by_id': created_by_id,
                        'code_prefix': org.code_prefix,
                        'code_pattern': org.code_pattern,
                    },
                },
                headers={'X-Internal-Secret': internal_secret},
                timeout=10,
            )
            if resp.status_code not in (201, 409):
                # Log the failure but don't roll back — org was created successfully.
                # Admin can retry sync or manually fix.
                print(f'[WARN] Auth-service sync failed for {admin_email}: {resp.status_code} {resp.text}')
        except http_requests.RequestException as e:
            print(f'[WARN] Could not reach auth-service to sync user {admin_email}: {e}')

        # Phase D-b5 dual-write: also land this org-admin in central auth's
        # SMS01 tenant, and push the new org's name/active status. No-ops
        # unless SYNC_TO_CENTRAL_AUTH=true (same flag B4/D-b2 use). Never
        # blocks org creation — auth-8001 sync above already ran and org
        # was already committed.
        from services.central_auth_sync_service import sync_org_admin_to_central_auth, sync_org_to_central_auth
        sync_org_admin_to_central_auth(
            local_user_id=local_user.id,
            email=admin_email,
            username=local_user.username,
            password_hash=local_user.password,
            full_name=admin_full_name or f"{first_name} {last_name}".strip() or admin_email,
            is_active=org.is_active,
        )
        sync_org_to_central_auth(legacy_org_id=org.id, name=org.name, is_active=org.is_active)

        # Publish org.created event — all services will sync automatically via RabbitMQ
        try:
            from ams_shared.events.publisher import publish_event
            publish_event('org.created', {
                'id': org.id,
                'name': org.name,
                'max_users': org.max_users,
                'max_students': org.max_students,
                'max_campuses': org.max_campuses,
                'is_active': org.is_active,
                'code_prefix': org.code_prefix,
                'code_pattern': org.code_pattern,
            })
        except Exception as e:
            print(f'[WARN] Could not publish org.created event: {e}')

        return org

class CampusSerializer(serializers.ModelSerializer):
    """
    Campus serializer for nested serialization
    """
    class Meta:
        model = Campus
        fields = ['id', 'campus_name', 'campus_code']

class UserSerializer(serializers.ModelSerializer):
    """
    User serializer for general use
    """
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    campus_name = serializers.CharField(source='campus.name', read_only=True)
    campus = CampusSerializer(read_only=True)
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    organization_data = OrganizationSerializer(source='organization', read_only=True)
    
    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'first_name', 'last_name',
            'role', 'role_display', 'campus', 'campus_name',
            'organization', 'organization_name', 'organization_data',
            'phone_number', 'photo', 'is_verified', 'is_active',
            'last_login', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'last_login', 'created_at', 'updated_at']

class UserRegistrationSerializer(serializers.ModelSerializer):
    """
    User registration serializer
    """
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password_confirm = serializers.CharField(write_only=True)
    
    class Meta:
        model = User
        fields = [
            'username', 'email', 'first_name', 'last_name',
            'role', 'campus', 'organization', 'phone_number', 'is_active', 'password', 'password_confirm'
        ]
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs
    
    def validate_email(self, value):
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email already exists")
        return value
    
    def validate_username(self, value):
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("User with this username already exists")
        return value
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        password = validated_data.pop('password')
        
        from utils.id_generator import IDGenerator
        
        # Auto-set flags based on role
        if validated_data.get('role') == 'org_admin':
            validated_data['is_org_admin'] = True
            validated_data['has_changed_default_password'] = True
            # Generate OA- code
            if not validated_data.get('username') or '@' in validated_data.get('username', ''):
                try:
                    validated_data['username'] = IDGenerator.generate_orgadmin_code()
                except:
                    pass
        
        elif validated_data.get('role') == 'admin':
            validated_data['has_changed_default_password'] = True
            # Generate AD- code
            if not validated_data.get('username') or '@' in validated_data.get('username', ''):
                try:
                    validated_data['username'] = IDGenerator.generate_admin_code()
                except:
                    pass
            
        user = User.objects.create_user(password=password, **validated_data)
        return user

class UserLoginSerializer(serializers.Serializer):
    """
    User login serializer
    """
    email = serializers.CharField()  # Changed from EmailField to CharField
    password = serializers.CharField()
    
    def validate_email(self, value):
        # Check if user exists with either email or username (employee code) - Case Insensitive
        if not User.objects.filter(email__iexact=value).exists() and not User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("User with this email or employee code does not exist")
        return value

class UserUpdateSerializer(serializers.ModelSerializer):
    """
    User update serializer
    """
    class Meta:
        model = User
        fields = [
            'first_name', 'last_name', 'email', 'username', 'phone_number',
            'organization', 'campus', 'is_active', 'is_verified', 'photo'
        ]
    
    def validate_campus(self, value):
        user = self.context['request'].user
        
        # Allow SuperAdmin and Principal to change campus for any user
        if not (user.is_superadmin() or user.is_principal()) and value != user.campus:
            raise serializers.ValidationError("You don't have permission to change campus")
        
        return value

class ChangePasswordSerializer(serializers.Serializer):
    """
    Change password serializer
    """
    old_password = serializers.CharField()
    new_password = serializers.CharField(validators=[validate_password])
    new_password_confirm = serializers.CharField()
    
    def validate_old_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect")
        return value
    
    def validate(self, attrs):
        if attrs['new_password'] != attrs['new_password_confirm']:
            raise serializers.ValidationError("New passwords don't match")
        return attrs
    
    def save(self):
        user = self.context['request'].user
        user.set_password(self.validated_data['new_password'])
        user.save()
        return user


class RolePermissionSerializer(serializers.ModelSerializer):
    """
    Serializer for RolePermission model
    """
    permission_label = serializers.CharField(source='get_permission_codename_display', read_only=True)
    role_label = serializers.CharField(source='get_role_display', read_only=True)
    
    class Meta:
        model = RolePermission
        fields = ['id', 'organization', 'role', 'role_label', 'permission_codename', 'permission_label', 'is_allowed', 'updated_at']
        read_only_fields = ['id', 'updated_at']


class InvoiceSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source='organization.name', read_only=True)
    plan_name = serializers.CharField(source='plan.name', read_only=True)
    approved_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return None

    class Meta:
        model = Invoice
        fields = [
            'id', 'invoice_number', 'invoice_type', 'organization', 'organization_name',
            'plan', 'plan_name', 'amount', 'status', 'status_display',
            'due_date', 'billing_period_start', 'billing_period_end',
            'receipt', 'receipt_uploaded_at',
            'approved_by', 'approved_by_name', 'approved_at',
            'rejection_note', 'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'invoice_number', 'invoice_type', 'organization', 'plan',
            'amount', 'due_date', 'billing_period_start', 'billing_period_end',
            'receipt_uploaded_at', 'approved_by', 'approved_at', 'created_at', 'updated_at',
        ]

