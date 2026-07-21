"""
Tests for Permissions API endpoints.
Covers Grant HDMS Access functionality.
"""
import pytest
import json
from django.test import Client
from permissions.models import ServiceAccess, HdmsRole
from authentication.models import UserCredentials


class TestGrantHdmsAccessAPI:
    """Tests for Grant HDMS Access endpoint"""
    
    @pytest.mark.django_db
    def test_grant_access_new_user_success(self, api_client, sample_employee):
        """Test granting HDMS access to a new user"""
        response = api_client.post(
            '/api/permissions/grant-hdms-access',
            data=json.dumps({
                "employee_id": sample_employee.employee_id,
                "password": "TestPass1",
                "role": "requestor"  # Note: 'requestor' not 'requestor'
            }),
            content_type='application/json'
        )
        assert response.status_code == 201
        data = response.json()
        assert data['is_new_user'] == True
        assert data['role'] == 'requestor'
        
        # Verify ServiceAccess created
        assert ServiceAccess.objects.filter(
            employee=sample_employee,
            service='hdms',
            is_active=True
        ).exists()
        
        # Verify HdmsRole created
        service_access = ServiceAccess.objects.get(employee=sample_employee, service='hdms')
        assert hasattr(service_access, 'hdms_role')
        assert service_access.hdms_role.role_type == 'requestor'
        
        # Verify UserCredentials created
        assert UserCredentials.objects.filter(employee=sample_employee).exists()
    
    @pytest.mark.django_db
    def test_grant_access_existing_user_update_role(self, api_client, sample_employee):
        """Test updating role for existing HDMS user"""
        # First, grant access
        api_client.post(
            '/api/permissions/grant-hdms-access',
            data=json.dumps({
                "employee_id": sample_employee.employee_id,
                "password": "TestPass1",
                "role": "requestor"
            }),
            content_type='application/json'
        )
        
        # Then update role
        response = api_client.post(
            '/api/permissions/grant-hdms-access',
            data=json.dumps({
                "employee_id": sample_employee.employee_id,
                "password": "TestPass1",
                "role": "moderator",
                "change_password": False
            }),
            content_type='application/json'
        )
        assert response.status_code == 200
        data = response.json()
        assert data['role'] == 'moderator'
        assert data['is_new_user'] == False
    
    @pytest.mark.django_db
    def test_password_validation_no_uppercase(self, api_client, sample_employee):
        """Test password validation: requires uppercase"""
        response = api_client.post(
            '/api/permissions/grant-hdms-access',
            data=json.dumps({
                "employee_id": sample_employee.employee_id,
                "password": "testpass1",
                "role": "requestor"
            }),
            content_type='application/json'
        )
        assert response.status_code == 400
        assert 'uppercase' in response.json()['error'].lower()
    
    @pytest.mark.django_db
    def test_password_validation_no_lowercase(self, api_client, sample_employee):
        """Test password validation: requires lowercase"""
        response = api_client.post(
            '/api/permissions/grant-hdms-access',
            data=json.dumps({
                "employee_id": sample_employee.employee_id,
                "password": "TESTPASS1",
                "role": "requestor"
            }),
            content_type='application/json'
        )
        assert response.status_code == 400
        assert 'lowercase' in response.json()['error'].lower()
    
    @pytest.mark.django_db
    def test_password_validation_too_short(self, api_client, sample_employee):
        """Test password validation: min 6 characters"""
        response = api_client.post(
            '/api/permissions/grant-hdms-access',
            data=json.dumps({
                "employee_id": sample_employee.employee_id,
                "password": "Ab1",
                "role": "requestor"
            }),
            content_type='application/json'
        )
        assert response.status_code == 400
        assert '6 characters' in response.json()['error']
    
    @pytest.mark.django_db
    def test_password_validation_special_chars(self, api_client, sample_employee):
        """Test password validation: alphanumeric only"""
        response = api_client.post(
            '/api/permissions/grant-hdms-access',
            data=json.dumps({
                "employee_id": sample_employee.employee_id,
                "password": "Test@Pass1",
                "role": "requestor"
            }),
            content_type='application/json'
        )
        assert response.status_code == 400
        assert 'alphanumeric' in response.json()['error'].lower()
    
    @pytest.mark.django_db
    def test_invalid_role(self, api_client, sample_employee):
        """Test invalid role validation"""
        response = api_client.post(
            '/api/permissions/grant-hdms-access',
            data=json.dumps({
                "employee_id": sample_employee.employee_id,
                "password": "TestPass1",
                "role": "admin"  # Invalid role
            }),
            content_type='application/json'
        )
        assert response.status_code == 400
        assert 'role' in response.json()['error'].lower()
    
    @pytest.mark.django_db
    def test_employee_not_found(self, api_client):
        """Test granting access to non-existent employee"""
        response = api_client.post(
            '/api/permissions/grant-hdms-access',
            data=json.dumps({
                "employee_id": "NOTFOUND",
                "password": "TestPass1",
                "role": "requestor"
            }),
            content_type='application/json'
        )
        assert response.status_code == 400
        assert 'not found' in response.json()['error'].lower()
    
    @pytest.mark.django_db
    def test_moderator_role_permissions(self, api_client, sample_employee):
        """Test moderator role gets correct permissions"""
        response = api_client.post(
            '/api/permissions/grant-hdms-access',
            data=json.dumps({
                "employee_id": sample_employee.employee_id,
                "password": "TestPass1",
                "role": "moderator"
            }),
            content_type='application/json'
        )
        assert response.status_code == 201
        
        # Check permissions
        service_access = ServiceAccess.objects.get(employee=sample_employee, service='hdms')
        hdms_role = service_access.hdms_role
        assert hdms_role.can_view_all_tickets == True
        assert hdms_role.can_assign_tickets == True
        assert hdms_role.can_close_tickets == True


class TestCheckHdmsAccessAPI:
    """Tests for checking existing HDMS access"""
    
    @pytest.mark.django_db
    def test_check_no_access(self, api_client, sample_employee):
        """Test checking employee with no HDMS access"""
        response = api_client.get(f'/api/permissions/hdms-access/{sample_employee.employee_id}')
        assert response.status_code == 200
        data = response.json()
        assert data['has_access'] == False
        assert data['role'] is None
    
    @pytest.mark.django_db
    def test_check_with_access(self, api_client, sample_employee):
        """Test checking employee with HDMS access"""
        # Grant access first
        api_client.post(
            '/api/permissions/grant-hdms-access',
            data=json.dumps({
                "employee_id": sample_employee.employee_id,
                "password": "TestPass1",
                "role": "assignee"
            }),
            content_type='application/json'
        )
        
        # Check access
        response = api_client.get(f'/api/permissions/hdms-access/{sample_employee.employee_id}')
        assert response.status_code == 200
        data = response.json()
        assert data['has_access'] == True
        assert data['role'] == 'assignee'
    
    @pytest.mark.django_db
    def test_check_employee_not_found(self, api_client):
        """Test checking non-existent employee"""
        response = api_client.get('/api/permissions/hdms-access/NOTFOUND')
        assert response.status_code == 404
