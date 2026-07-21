from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, Branch


class BranchSerializer(serializers.ModelSerializer):
    type_display = serializers.CharField(source='get_type_display', read_only=True)

    class Meta:
        model = Branch
        fields = ['id', 'type', 'type_display', 'name', 'code', 'location',
                  'contact', 'address', 'contact_person', 'contact_email',
                  'is_head_office', 'is_active', 'created_at']


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token['role'] = user.role
        token['full_name'] = user.get_full_name()
        token['employee_id'] = user.employee_id
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = {
            'id': self.user.id,
            'username': self.user.username,
            'full_name': self.user.get_full_name(),
            'role': self.user.role,
            'role_display': self.user.get_role_display(),
            'department': self.user.department,
            'employee_id': self.user.employee_id,
            'spending_limit': str(self.user.spending_limit),
            'branch': BranchSerializer(self.user.branch).data if self.user.branch else None,
        }
        return data


class UserSerializer(serializers.ModelSerializer):
    role_display = serializers.CharField(source='get_role_display', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email',
                  'role', 'role_display', 'department', 'employee_id',
                  'phone', 'spending_limit', 'branch', 'branch_name']
        read_only_fields = ['id']
