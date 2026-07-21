"""
Tests for Employees API endpoints.
Covers Department and Designation CRUD operations.
"""
import pytest
import json
from django.test import Client
from employees.models import Department, Designation


class TestDepartmentAPI:
    """Tests for Department CRUD endpoints"""
    
    @pytest.mark.django_db
    def test_create_department_success(self, api_client):
        """Test creating a department with valid data"""
        response = api_client.post(
            '/api/departments',
            data=json.dumps({
                "dept_code": "HR",
                "dept_name": "Human Resources",
                "dept_sector": "hr",
                "description": "HR Department"
            }),
            content_type='application/json'
        )
        assert response.status_code == 201
        data = response.json()
        assert data['message'] == 'Department created successfully'
        assert data['dept_code'] == 'HR'
        
        # Verify in database
        dept = Department.objects.get(dept_code='HR')
        assert dept.dept_name == "Human Resources"
    
    @pytest.mark.django_db
    def test_create_department_code_too_long(self, api_client):
        """Test validation: dept_code > 6 characters"""
        response = api_client.post(
            '/api/departments',
            data=json.dumps({
                "dept_code": "TOOLONG",
                "dept_name": "Test Dept",
                "dept_sector": "other"
            }),
            content_type='application/json'
        )
        assert response.status_code == 400
        assert 'error' in response.json()
    
    @pytest.mark.django_db
    def test_create_department_non_alphanumeric(self, api_client):
        """Test validation: dept_code must be alphanumeric"""
        response = api_client.post(
            '/api/departments',
            data=json.dumps({
                "dept_code": "HR-01",
                "dept_name": "Test Dept",
                "dept_sector": "other"
            }),
            content_type='application/json'
        )
        assert response.status_code == 400
        assert 'alphanumeric' in response.json()['error'].lower()
    
    @pytest.mark.django_db
    def test_create_department_duplicate(self, api_client, sample_department):
        """Test validation: duplicate dept_code"""
        response = api_client.post(
            '/api/departments',
            data=json.dumps({
                "dept_code": sample_department.dept_code,
                "dept_name": "Duplicate Dept",
                "dept_sector": "other"
            }),
            content_type='application/json'
        )
        assert response.status_code == 400
        assert 'already exists' in response.json()['error'].lower()
    
    @pytest.mark.django_db
    def test_get_department_success(self, api_client, sample_department):
        """Test getting a department by dept_code"""
        response = api_client.get(f'/api/departments/{sample_department.dept_code}')
        assert response.status_code == 200
        data = response.json()
        assert data['dept_code'] == sample_department.dept_code
        assert data['dept_name'] == sample_department.dept_name
        assert 'employee_count' in data
        assert 'designations' in data
    
    @pytest.mark.django_db
    def test_get_department_not_found(self, api_client):
        """Test 404 for non-existent department"""
        response = api_client.get('/api/departments/NOTFND')
        assert response.status_code == 404
    
    @pytest.mark.django_db
    def test_update_department(self, api_client, sample_department):
        """Test updating a department"""
        response = api_client.put(
            f'/api/departments/{sample_department.dept_code}',
            data=json.dumps({
                "dept_name": "Updated Name",
                "description": "Updated description"
            }),
            content_type='application/json'
        )
        assert response.status_code == 200
        
        # Verify in database
        sample_department.refresh_from_db()
        assert sample_department.dept_name == "Updated Name"
    
    @pytest.mark.django_db
    def test_delete_department_success(self, api_client, sample_department):
        """Test soft deleting a department with no employees"""
        dept_code = sample_department.dept_code
        response = api_client.delete(f'/api/departments/{dept_code}')
        assert response.status_code == 200
        
        # Verify soft deleted (use all_objects to find deleted records)
        dept = Department.all_objects.get(dept_code=dept_code)
        assert dept.is_deleted == True
    
    @pytest.mark.django_db
    def test_delete_department_with_employees(self, api_client, sample_employee):
        """Test cannot delete department with active employees"""
        response = api_client.delete(f'/api/departments/{sample_employee.department.dept_code}')
        assert response.status_code == 400
        assert 'active employees' in response.json()['error'].lower()
    
    @pytest.mark.django_db
    def test_list_departments(self, api_client, sample_department):
        """Test listing all departments"""
        response = api_client.get('/api/departments')
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1


class TestDesignationAPI:
    """Tests for Designation CRUD endpoints"""
    
    @pytest.mark.django_db
    def test_create_designation_success(self, api_client, sample_department):
        """Test creating a designation"""
        response = api_client.post(
            '/api/designations',
            data=json.dumps({
                "department_code": sample_department.dept_code,
                "position_code": "DEV",
                "position_name": "Developer",
                "description": "Software Developer"
            }),
            content_type='application/json'
        )
        assert response.status_code == 201
        data = response.json()
        assert data['position_code'] == 'DEV'
    
    @pytest.mark.django_db
    def test_create_designation_code_too_long(self, api_client, sample_department):
        """Test validation: position_code > 4 characters"""
        response = api_client.post(
            '/api/designations',
            data=json.dumps({
                "department_code": sample_department.dept_code,
                "position_code": "LONGG",
                "position_name": "Long Position"
            }),
            content_type='application/json'
        )
        assert response.status_code == 400
    
    @pytest.mark.django_db
    def test_create_designation_non_alphanumeric(self, api_client, sample_department):
        """Test validation: position_code must be alphanumeric"""
        response = api_client.post(
            '/api/designations',
            data=json.dumps({
                "department_code": sample_department.dept_code,
                "position_code": "D-1",
                "position_name": "Test Position"
            }),
            content_type='application/json'
        )
        assert response.status_code == 400
    
    @pytest.mark.django_db
    def test_create_designation_duplicate_in_dept(self, api_client, sample_designation):
        """Test validation: duplicate position_code in same department"""
        response = api_client.post(
            '/api/designations',
            data=json.dumps({
                "department_code": sample_designation.department.dept_code,
                "position_code": sample_designation.position_code,
                "position_name": "Duplicate Position"
            }),
            content_type='application/json'
        )
        assert response.status_code == 400
    
    @pytest.mark.django_db
    def test_get_designation(self, api_client, sample_designation):
        """Test getting a designation by ID"""
        response = api_client.get(f'/api/designations/{sample_designation.id}')
        assert response.status_code == 200
        data = response.json()
        assert data['position_code'] == sample_designation.position_code
    
    @pytest.mark.django_db
    def test_update_designation(self, api_client, sample_designation):
        """Test updating a designation"""
        response = api_client.put(
            f'/api/designations/{sample_designation.id}',
            data=json.dumps({
                "position_name": "Updated Position Name"
            }),
            content_type='application/json'
        )
        assert response.status_code == 200
        
        sample_designation.refresh_from_db()
        assert sample_designation.position_name == "Updated Position Name"
    
    @pytest.mark.django_db
    def test_delete_designation_with_employees(self, api_client, sample_employee):
        """Test cannot delete designation with active employees"""
        response = api_client.delete(f'/api/designations/{sample_employee.designation.id}')
        assert response.status_code == 400
    
    @pytest.mark.django_db
    def test_list_designations(self, api_client, sample_designation):
        """Test listing designations"""
        response = api_client.get('/api/designations')
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    @pytest.mark.django_db
    def test_list_designations_by_department(self, api_client, sample_designation):
        """Test listing designations filtered by department"""
        response = api_client.get(f'/api/designations?department_code={sample_designation.department.dept_code}')
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
