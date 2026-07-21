"""
Employees API endpoints for Auth Service.

Provides REST API for employee management including creation,
retrieval, and updates for integration with HDMS frontend.
"""
from ninja import Router, File, Form, Schema
from ninja.files import UploadedFile
import requests
import os
from typing import Optional, List
from pydantic import BaseModel, validator
from datetime import date, datetime
from employees.models import Employee, Organization, Institution, Department, Designation, EmployeeAssignment, Branch
from django.db import transaction, models
from django.shortcuts import get_object_or_404
import re
import logging

from authentication.api import AuthBearer
from permissions.rbac import require_permission

router = Router(tags=["employees"], auth=AuthBearer())
logger = logging.getLogger(__name__)


# Pydantic Schemas
class EducationSchema(BaseModel):
    """Education record from frontend"""
    degree: str
    institute: str
    passingYear: str


class ExperienceSchema(BaseModel):
    """Work experience record from frontend"""
    employer: str
    jobTitle: str
    startDate: str
    endDate: str
    responsibilities: str


class InstitutionSchema(Schema):
    """Schema for Institution details"""
    id: Optional[str] = None
    inst_code: str
    name: str
    inst_type: str
    address: Optional[str] = None
    city: Optional[str] = None
    contact_number: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class BranchSchema(Schema):
    """Schema for Branch details"""
    branch_id: str
    branch_code: str
    branch_name: str
    institution_code: str
    status: str
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    postal_code: Optional[str] = None
    contact_number: Optional[str] = None
    secondary_contact: Optional[str] = None
    email: Optional[str] = None
    branch_head_name: Optional[str] = None
    branch_head_contact: Optional[str] = None
    branch_head_email: Optional[str] = None
    established_year: Optional[int] = None
    registration_number: Optional[str] = None

class EmployeeCreateSchema(BaseModel):
    """Schema for creating employee from frontend form"""
    # Personal Information
    fullName: str
    dob: Optional[str] = None
    cnic: str
    gender: str
    maritalStatus: Optional[str] = None
    nationality: Optional[str] = 'Pakistani'
    religion: Optional[str] = None
    
    # Contact Information
    personalEmail: str
    mobile: str
    orgEmail: Optional[str] = None
    orgPhone: Optional[str] = None
    emergencyName: Optional[str] = None
    emergencyPhone: Optional[str] = None
    residentialAddress: str
    permanentAddress: Optional[str] = None
    city: Optional[str] = None

    
    # Assignment Details
    organizationCode: str = 'IAK'
    institutionCode: Optional[str] = None
    branchCode: Optional[str] = None  # Added for Branch support
    departmentCode: str 
    designationCode: str
    joiningDate: Optional[str] = None
    shift: Optional[str] = 'general'
    
    # Bank Information
    bankName: Optional[str] = None
    accountNumber: Optional[str] = None
    
    # Additional Data
    education: Optional[List[EducationSchema]] = None
    experience: Optional[List[ExperienceSchema]] = None

    @validator('cnic')
    def validate_cnic(cls, v):
        if not re.match(r'^\d{5}-?\d{7}-?\d{1}$', v):
            raise ValueError('Invalid Pakistani CNIC format (XXXXX-XXXXXXX-X)')
        return v.replace('-', '')

    @validator('mobile', 'emergencyPhone', 'orgPhone')
    def validate_phone(cls, v):
        if v and not re.match(r'^(\+92|92|0|0092)?3\d{2}-?\d{7}$', v):
            raise ValueError('Invalid Pakistani Mobile number format')
        return v

    @validator('personalEmail', 'orgEmail')
    def validate_email(cls, v):
        if v and not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError('Invalid email format')
        return v

    @validator('dob')
    def validate_dob(cls, v):
        if not v:
            return v
        try:
            dob_date = datetime.strptime(v, '%Y-%m-%d').date()
        except ValueError:
            raise ValueError('Date of birth must be YYYY-MM-DD format')
        today = date.today()
        age = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
        if age < 13:
            raise ValueError('Employee must be at least 13 years old')
        return v

    @validator('gender')
    def validate_gender(cls, v):
        allowed = ['male', 'female']
        if v and v.lower() not in allowed:
            raise ValueError(f"gender must be one of: {', '.join(allowed)}")
        return v.lower() if v else v

    @validator('maritalStatus')
    def validate_marital_status(cls, v):
        if v is None:
            return v
        allowed = ['single', 'married', 'divorced', 'widowed']
        if v.lower() not in allowed:
            raise ValueError(f"maritalStatus must be one of: {', '.join(allowed)}")
        return v.lower()

    @validator('shift')
    def validate_shift(cls, v):
        if v is None:
            return v
        allowed = ['general', 'morning', 'afternoon', 'night', 'hourly', 'both']
        if v.lower() not in allowed:
            raise ValueError(f"shift must be one of: {', '.join(allowed)}")
        return v.lower()


class EmployeeResponseSchema(BaseModel):
    """Response schema after employee creation"""
    message: str
    employee_id: str
    employee_code: str
    
    class Config:
        from_attributes = True


class ErrorResponseSchema(BaseModel):
    """Error response schema"""
    error: str

class InstitutionCreateSchema(BaseModel):
    """Request body for POST /institutions."""
    organization_code: Optional[str] = None  # Falls back to first Organization when absent
    inst_code: str
    name: str
    inst_type: str = "educational"
    address: Optional[str] = None
    city: Optional[str] = None
    contact_number: Optional[str] = None

    @validator('inst_type')
    def validate_inst_type(cls, v):
        allowed = ['educational', 'medical', 'ngo', 'corporate', 'government', 'religious', 'other']
        if v and v.lower() not in allowed:
            raise ValueError(f"inst_type must be one of: {', '.join(allowed)}")
        return v.lower() if v else v


class InstitutionUpdateSchema(BaseModel):
    """Request body for PUT /institutions/{id}. All fields optional."""
    organization_code: Optional[str] = None
    inst_code: Optional[str] = None
    name: Optional[str] = None
    inst_type: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    contact_number: Optional[str] = None

    @validator('inst_type')
    def validate_inst_type(cls, v):
        if v is None:
            return v
        allowed = ['educational', 'medical', 'ngo', 'corporate', 'government', 'religious', 'other']
        if v.lower() not in allowed:
            raise ValueError(f"inst_type must be one of: {', '.join(allowed)}")
        return v.lower()


class BranchCreateSchema(BaseModel):
    """Request body for POST /branches."""
    institution_code: str
    branch_code: str
    branch_name: str
    status: str = "active"
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    postal_code: Optional[str] = None
    contact_number: Optional[str] = None
    secondary_contact: Optional[str] = None
    email: Optional[str] = None
    branch_head_name: Optional[str] = None
    branch_head_contact: Optional[str] = None
    branch_head_email: Optional[str] = None
    established_year: Optional[int] = None
    registration_number: Optional[str] = None

    @validator('status')
    def validate_status(cls, v):
        allowed = ['active', 'inactive', 'closed', 'under_construction']
        if v and v.lower() not in allowed:
            raise ValueError(f"status must be one of: {', '.join(allowed)}")
        return v.lower() if v else v


class BranchUpdateSchema(BaseModel):
    """Request body for PUT /branches/{key}. All fields optional."""
    institution_code: Optional[str] = None
    branch_code: Optional[str] = None
    branch_name: Optional[str] = None
    status: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    district: Optional[str] = None
    postal_code: Optional[str] = None
    contact_number: Optional[str] = None
    secondary_contact: Optional[str] = None
    email: Optional[str] = None
    branch_head_name: Optional[str] = None
    branch_head_contact: Optional[str] = None
    branch_head_email: Optional[str] = None
    established_year: Optional[int] = None
    registration_number: Optional[str] = None

    @validator('status')
    def validate_status(cls, v):
        if v is None:
            return v
        allowed = ['active', 'inactive', 'closed', 'under_construction']
        if v.lower() not in allowed:
            raise ValueError(f"status must be one of: {', '.join(allowed)}")
        return v.lower()


class DepartmentCreateSchema(BaseModel):
    """Schema for creating a department"""
    dept_code: str
    dept_name: str
    institution_code: Optional[str] = None  # Link to institution
    branch_code: Optional[str] = None      # Link to branch
    description: Optional[str] = None

class DepartmentUpdateSchema(BaseModel):
    """Schema for updating a department"""
    dept_name: Optional[str] = None
    institution_code: Optional[str] = None
    branch_code: Optional[str] = None
    description: Optional[str] = None

class DepartmentDetailSchema(BaseModel):
    """Schema for department detail response"""
    department_id: str
    dept_code: str
    dept_name: str
    institution_code: Optional[str] = None
    branch_code: Optional[str] = None
    description: Optional[str] = None
    employee_count: int
    designations: list

class DesignationCreateSchema(BaseModel):
    """Schema for creating a designation"""
    department_code: str
    position_code: str
    position_name: str
    description: Optional[str] = None

class DesignationUpdateSchema(BaseModel):
    """Schema for updating a designation"""
    position_name: Optional[str] = None
    description: Optional[str] = None






# ========================================
# ORGANIZATION API (READ ONLY)
# ========================================

@router.get("/organizations", response=List[dict])
@require_permission("organization.view")
def list_organizations(request):
    """
    ONLY READ-ONLY (Fixed Master Org)
    """
    return [
        {
            "id": str(org.id),
            "name": org.name,
            "org_code": org.org_code,
            "email": org.email,
            "phone": org.phone,
            "logo_url": org.logo_url,
            "website": org.website,
            "address": org.address,
        }
        for org in Organization.objects.filter(is_deleted=False)
    ]

# ========================================
# INSTITUTION SCHEMAS
# ========================================


@router.get("/institutions", response=List[InstitutionSchema])
@require_permission("institution.view")
def list_institutions(request):
    """Get all active institutions"""
    institutions = Institution.objects.filter(is_deleted=False)

    return [
        {
            "id": str(inst.id),

            "inst_code": inst.inst_code,
            "name": inst.name,
            "inst_type": inst.inst_type,
            "address": inst.address,
            "city": inst.city,
            "contact_number": inst.contact_number,

            "created_at": inst.created_at.isoformat() if inst.created_at else None,
            "updated_at": inst.updated_at.isoformat() if inst.updated_at else None,
        }
        for inst in institutions
    ]


@router.post("/institutions", response={201: InstitutionSchema, 400: ErrorResponseSchema})
@require_permission("institution.create")
def create_institution(request, payload: InstitutionCreateSchema):
    """Create a new institution"""
    try:
        org_code = payload.organization_code
        if org_code:
            org = Organization.objects.filter(org_code=org_code).first()
        else:
            org = Organization.objects.first()

        if not org:
            return 400, {"error": "Organization not found"}

        inst = Institution.objects.create(
            organization=org,
            inst_code=payload.inst_code,
            name=payload.name,
            inst_type=payload.inst_type,
            address=payload.address,
            city=payload.city,
            contact_number=payload.contact_number,
        )

        return 201, {
            "id": str(inst.id),

            "inst_code": inst.inst_code,
            "name": inst.name,
            "inst_type": inst.inst_type,
            "address": inst.address,
            "city": inst.city,
            "contact_number": inst.contact_number,

            "created_at": inst.created_at.isoformat() if inst.created_at else None,
            "updated_at": inst.updated_at.isoformat() if inst.updated_at else None,
        }

    except Exception as e:
        return 400, {"error": str(e)}


@router.get(
    "/institutions/{institution_id}",
    response={200: InstitutionSchema, 404: ErrorResponseSchema}
)
@require_permission("institution.view")
def get_institution(request, institution_id: str):
    """Get single institution"""
    inst = Institution.objects.filter(
        id=institution_id,
        is_deleted=False
    ).first()

    if not inst:
        return 404, {"error": "Institution not found"}

    return 200, {
        "id": str(inst.id),
        "inst_code": inst.inst_code,
        "name": inst.name,
        "inst_type": inst.inst_type,
        "address": inst.address,
        "city": inst.city,
        "contact_number": inst.contact_number,
        "created_at": inst.created_at.isoformat() if inst.created_at else None,
        "updated_at": inst.updated_at.isoformat() if inst.updated_at else None,
    }


@router.put(
    "/institutions/{institution_id}",
    response={200: InstitutionSchema, 404: ErrorResponseSchema}
)
@require_permission("institution.edit")
def update_institution(request, institution_id: str, payload: InstitutionUpdateSchema):
    """Update institution"""
    inst = Institution.objects.filter(
        id=institution_id,
        is_deleted=False
    ).first()

    if not inst:
        return 404, {"error": "Institution not found"}

    data = payload.dict(exclude_unset=True)

    inst.inst_code = data["inst_code"] if "inst_code" in data else inst.inst_code
    inst.name = data["name"] if "name" in data else inst.name
    inst.inst_type = data["inst_type"] if "inst_type" in data else inst.inst_type
    inst.address = data["address"] if "address" in data else inst.address
    inst.city = data["city"] if "city" in data else inst.city
    inst.contact_number = data["contact_number"] if "contact_number" in data else inst.contact_number

    org_code = data.get("organization_code")
    if org_code:
        org = Organization.objects.filter(org_code=org_code).first()
        if org:
            inst.organization = org

    inst.save()

    return 200, {
        "id": str(inst.id),
        "inst_code": inst.inst_code,
        "name": inst.name,
        "inst_type": inst.inst_type,
        "address": inst.address,
        "city": inst.city,
        "contact_number": inst.contact_number,
        "created_at": inst.created_at.isoformat() if inst.created_at else None,
        "updated_at": inst.updated_at.isoformat() if inst.updated_at else None,
    }


@router.delete(
    "/institutions/{institution_id}",
    response={200: dict, 404: ErrorResponseSchema}
)
@require_permission("institution.delete")
def delete_institution(request, institution_id: str):
    """Soft delete institution"""
    inst = Institution.objects.filter(
        id=institution_id,
        is_deleted=False
    ).first()

    if not inst:
        return 404, {"error": "Institution not found"}

    inst.is_deleted = True
    inst.save()

    return 200, {"message": "Institution deleted successfully"}

@router.get("/branches", response=List[BranchSchema])
@require_permission("branch.view")
def list_branches(request, institution_code: str = None):
    """Get all active branches, optionally filtered by institution"""
    query = Branch.objects.filter(is_deleted=False)
    if institution_code:
        query = query.filter(institution__inst_code=institution_code)
    
    return [_branch_response(b) for b in query]


@router.post("/branches", response={201: BranchSchema, 400: ErrorResponseSchema})
@require_permission("branch.create")
def create_branch(request, payload: BranchCreateSchema):
    """Create a new branch under an institution"""
    try:
        inst = get_object_or_404(Institution, inst_code=payload.institution_code)
        branch = Branch.objects.create(
            institution=inst,
            branch_code=payload.branch_code,
            branch_name=payload.branch_name,
            status=payload.status,
            address=payload.address,
            city=payload.city,
            district=payload.district,
            postal_code=payload.postal_code,
            contact_number=payload.contact_number,
            secondary_contact=payload.secondary_contact,
            email=payload.email,
            branch_head_name=payload.branch_head_name,
            branch_head_contact=payload.branch_head_contact,
            branch_head_email=payload.branch_head_email,
            established_year=payload.established_year,
            registration_number=payload.registration_number,
        )
        return 201, _branch_response(branch)
    except Exception as e:
        return 400, {"error": str(e)}


def _branch_response(branch):
    """Build consistent branch dict for all branch endpoints."""
    return {
        "branch_id": branch.branch_id,
        "branch_code": branch.branch_code,
        "branch_name": branch.branch_name,
        "institution_code": branch.institution.inst_code,
        "status": branch.status,
        "address": branch.address,
        "city": branch.city,
        "district": branch.district,
        "postal_code": branch.postal_code,
        "contact_number": branch.contact_number,
        "secondary_contact": branch.secondary_contact,
        "email": branch.email,
        "branch_head_name": branch.branch_head_name,
        "branch_head_contact": branch.branch_head_contact,
        "branch_head_email": branch.branch_head_email,
        "established_year": branch.established_year,
        "registration_number": branch.registration_number,
    }


def _resolve_branch(branch_key: str):
    """Lookup a non-deleted branch by branch_id or branch_code."""
    return Branch.objects.filter(is_deleted=False).filter(
        models.Q(branch_id=branch_key) | models.Q(branch_code=branch_key)
    ).first()


def _assignment_institution(asn):
    """Derive institution from assignment via designation.department chain."""
    dept = asn.designation.department
    if dept.branch_id and dept.branch.institution_id:
        return dept.branch.institution
    if dept.institution_id:
        return dept.institution
    return None


@router.put("/branches/{branch_key}", response={200: BranchSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema})
@require_permission("branch.edit")
def update_branch(request, branch_key: str, payload: BranchUpdateSchema):
    """Update a branch. Accepts branch_id or branch_code as key."""
    branch = _resolve_branch(branch_key)
    if not branch:
        return 404, {"error": "Branch not found"}

    data = payload.dict(exclude_unset=True)

    inst_code = data.get("institution_code")
    if inst_code and inst_code != branch.institution.inst_code:
        inst = Institution.objects.filter(inst_code=inst_code, is_deleted=False).first()
        if not inst:
            return 400, {"error": f"Institution '{inst_code}' not found"}
        branch.institution = inst

    new_code = data.get("branch_code")
    if new_code and new_code != branch.branch_code:
        if Branch.objects.filter(branch_code=new_code).exclude(pk=branch.pk).exists():
            return 400, {"error": f"Branch code '{new_code}' already exists"}
        branch.branch_code = new_code

    for field in (
        "branch_name", "status", "address", "city", "district", "postal_code",
        "contact_number", "secondary_contact", "email",
        "branch_head_name", "branch_head_contact", "branch_head_email",
        "established_year", "registration_number",
    ):
        if field in data:
            setattr(branch, field, data[field])

    try:
        branch.save()
    except Exception as e:
        return 400, {"error": str(e)}

    return 200, _branch_response(branch)


@router.delete("/branches/{branch_key}", response={200: dict, 404: ErrorResponseSchema})
@require_permission("branch.delete")
def delete_branch(request, branch_key: str):
    """Soft delete a branch. Accepts branch_id or branch_code as key."""
    branch = _resolve_branch(branch_key)
    if not branch:
        return 404, {"error": "Branch not found"}
    branch.is_deleted = True
    branch.save()
    return 200, {"message": "Branch deleted successfully"}


@router.get("/departments", response=List[dict])
@require_permission("department.view")
def list_departments(request, branch_code: str = None, institution_code: str = None):
    """Get departments, optionally filtered by hierarchy"""
    query = Department.objects.filter(is_deleted=False)
    
    if branch_code:
        query = query.filter(branch__branch_code=branch_code)
    elif institution_code:
        query = query.filter(institution__inst_code=institution_code)

    departments = query.values('id', 'dept_code', 'dept_name', 'institution__inst_code', 'branch__branch_code')
    return [
        {
            'id': str(d['id']),
            'dept_code': d['dept_code'],
            'dept_name': d['dept_name'],
            'institution_code': d['institution__inst_code'],
            'branch_code': d['branch__branch_code'],
        }
        for d in departments
    ]

@router.post("/departments", response={201: dict, 400: ErrorResponseSchema})
@require_permission("department.create")
def create_department(request, payload: DepartmentCreateSchema):
    """Create a new department"""
    import re
    # Validate dept_code length
    if len(payload.dept_code) > 6:
        return 400, {"error": "Department code must be 6 characters or less"}
    if not re.match(r'^[A-Za-z0-9]+$', payload.dept_code):
        return 400, {"error": "Department code must be alphanumeric only"}
    if Department.objects.filter(dept_code=payload.dept_code).exists():
        return 400, {"error": f"Department code '{payload.dept_code}' already exists"}
    
    try:
        inst = None
        branch = None
        if payload.branch_code:
            from employees.models import Branch as BranchModel
            branch = BranchModel.objects.filter(branch_code=payload.branch_code, is_deleted=False).first()
            if not branch:
                return 400, {"error": f"Branch '{payload.branch_code}' not found"}
        elif payload.institution_code:
            inst = get_object_or_404(Institution, inst_code=payload.institution_code)

        dept = Department.objects.create(
            institution=inst,
            branch=branch,
            dept_code=payload.dept_code.upper(),
            dept_name=payload.dept_name,
            description=payload.description or None
        )
        return 201, {
            "message": "Department created successfully",
            "department_id": str(dept.id),
            "dept_code": dept.dept_code
        }
    except Exception as e:
        return 400, {"error": str(e)}


@router.get("/departments/{dept_code}", response={200: dict, 404: ErrorResponseSchema})
@require_permission("department.view")
def get_department(request, dept_code: str):
    """Get single department with employee count and designations"""
    try:
        dept = Department.objects.get(dept_code=dept_code)
        return 200, {
            "department_id": str(dept.id),
            "dept_code": dept.dept_code,
            "dept_name": dept.dept_name,
            "institution_code": dept.institution.inst_code if dept.institution else None,
            "branch_code": dept.branch.branch_code if dept.branch else None,
            "description": dept.description,
            "employee_count": dept.assignments.filter(is_deleted=False).count(),
            "designations": [
                {"position_code": d.position_code, "position_name": d.position_name}
                for d in dept.designations.filter(is_deleted=False)
            ]
        }
    except Department.DoesNotExist:
        return 404, {"error": f"Department '{dept_code}' not found"}


@router.put("/departments/{dept_code}", response={200: dict, 400: ErrorResponseSchema, 404: ErrorResponseSchema})
@require_permission("department.edit")
def update_department(request, dept_code: str, payload: DepartmentUpdateSchema):
    """Update department details"""
    try:
        dept = Department.objects.get(dept_code=dept_code)
        if payload.dept_name is not None:
            dept.dept_name = payload.dept_name
        if payload.description is not None:
            dept.description = payload.description
        if payload.branch_code is not None:
            from employees.models import Branch as BranchModel
            dept.branch = BranchModel.objects.filter(branch_code=payload.branch_code, is_deleted=False).first() if payload.branch_code else None
            dept.institution = None  # branch takes priority, clear institution
        elif payload.institution_code is not None:
            dept.institution = Institution.objects.filter(inst_code=payload.institution_code).first()
            dept.branch = None  # institution set, clear branch
        dept.save()
        return 200, {
            "message": "Department updated successfully",
            "dept_code": dept.dept_code
        }
    except Department.DoesNotExist:
        return 404, {"error": f"Department '{dept_code}' not found"}
    except Exception as e:
        return 400, {"error": str(e)}


@router.delete("/departments/{dept_code}", response={200: dict, 400: ErrorResponseSchema, 404: ErrorResponseSchema})
@require_permission("department.delete")
def delete_department(request, dept_code: str):
    """Soft delete a department (only if no active employees)"""
    try:
        dept = Department.objects.get(dept_code=dept_code)
        active_employees = dept.assignments.filter(is_deleted=False).count()
        if active_employees > 0:
            return 400, {"error": f"Cannot delete department with {active_employees} active employees"}
        dept.soft_delete()
        return 200, {"message": f"Department '{dept_code}' deleted successfully"}
    except Department.DoesNotExist:
        return 404, {"error": f"Department '{dept_code}' not found"}


@router.get("/designations", response=List[dict])
@require_permission("designation.view")
def list_designations(request, department_code: str = None):
    """Get designations, optionally filtered by department"""
    query = Designation.objects.filter(is_deleted=False)
    if department_code:
        query = query.filter(department__dept_code=department_code)
    designations = query.values('id', 'position_code', 'position_name', 'department__dept_code')
    return list(designations)


@router.post("/designations", response={201: dict, 400: ErrorResponseSchema})
@require_permission("designation.create")
def create_designation(request, payload: DesignationCreateSchema):
    """Create a new designation under a department"""
    try:
        dept = Department.objects.filter(dept_code=payload.department_code).first()
        if not dept:
            return 400, {"error": f"Department '{payload.department_code}' not found"}

        if Designation.objects.filter(department=dept, position_code=payload.position_code).exists():
            return 400, {"error": f"Position code '{payload.position_code}' already exists in this department"}

        designation = Designation.objects.create(
            department=dept,
            position_code=payload.position_code,
            position_name=payload.position_name,
            description=payload.description
        )
        return 201, {
            "message": "Designation created successfully",
            "id": str(designation.id),
            "position_code": designation.position_code
        }
    except Exception as e:
        return 400, {"error": str(e)}


# Create employee with Branch support
@router.post(
    "/employees",
    response={201: dict, 400: dict},
    summary="Create New Employee",
)
@require_permission("employee.create")
def create_employee(request, payload: EmployeeCreateSchema):
    """Create a new employee. Accepts JSON body. Resume upload moved to a separate endpoint."""
    field_errors = {}
    try:
        cnic_clean = payload.cnic.replace('-', '').replace(' ', '')
        if Employee.objects.filter(cnic=cnic_clean, is_deleted=False).exists():
            field_errors['cnic'] = ['An employee with this CNIC already exists']
        
        org = Organization.objects.filter(org_code=payload.organizationCode).first()
        if not org:
            field_errors['organizationCode'] = ["Organization not found"]
            
        inst = None
        if payload.institutionCode:
            inst = Institution.objects.filter(inst_code=payload.institutionCode).first()
            if not inst:
                field_errors['institutionCode'] = ["Institution not found"]
        
        dept = Department.objects.filter(dept_code=payload.departmentCode).first()
        if not dept:
            field_errors['departmentCode'] = ["Department not found"]
            
        designation = None
        if dept:
            designation = Designation.objects.filter(department=dept, position_code=payload.designationCode).first()
            if not designation:
                field_errors['designationCode'] = ["Designation not found for this department"]

        if field_errors:
            return 400, {"error": "Validation failed", "field_errors": field_errors}

        if not payload.dob:
            return 400, {"error": "Validation failed", "field_errors": {"dob": ["Date of birth is required"]}}
        dob = datetime.strptime(payload.dob, '%Y-%m-%d').date()
        joining_date = datetime.strptime(payload.joiningDate, '%Y-%m-%d').date() if payload.joiningDate else date.today()

        with transaction.atomic():
            employee = Employee.objects.create(
                organization=org,
                full_name=payload.fullName,
                cnic=cnic_clean,
                personal_phone=payload.mobile,
                personal_email=payload.personalEmail or None,
                org_email=payload.orgEmail or None,
                org_phone=payload.orgPhone or None,
                dob=dob,
                gender=payload.gender,
                marital_status=payload.maritalStatus,
                nationality=payload.nationality or 'Pakistani',
                religion=payload.religion,
                residential_address=payload.residentialAddress,
                permanent_address=payload.permanentAddress,
                city=payload.city,
                emergency_contact_name=payload.emergencyName,
                emergency_contact_phone=payload.emergencyPhone,
                bank_name=payload.bankName,
                account_number=payload.accountNumber,
                education_history=[e.dict() for e in payload.education or []],
                work_experience=[e.dict() for e in payload.experience or []],
            )

            EmployeeAssignment.objects.create(
                employee=employee,
                department=dept,
                designation=designation,
                joining_date=joining_date,
                is_primary=True,
                shift=payload.shift or 'general'
            )
        
        # Resume proxy logic would go here (truncated for brevity in this replace call)
        return 201, {
            "message": "Employee created successfully",
            "employee_id": employee.employee_id,
            "employee_code": employee.employee_code
        }
    except Exception as e:
        logger.error(f"Error creating employee: {str(e)}", exc_info=True)
        return 400, {"error": str(e)}


@router.get("/designations/{designation_id}", response={200: dict, 404: ErrorResponseSchema})
@require_permission("designation.view")
def get_designation(request, designation_id: str):
    """Get single designation details"""
    try:
        designation = Designation.objects.select_related('department').get(id=designation_id)
        return 200, {
            "id": str(designation.id),
            "position_code": designation.position_code,
            "position_name": designation.position_name,
            "description": designation.description,
            "department": {
                "dept_code": designation.department.dept_code,
                "dept_name": designation.department.dept_name
            }
        }
    except Designation.DoesNotExist:
        return 404, {"error": "Designation not found"}


@router.put("/designations/{designation_id}", response={200: dict, 400: ErrorResponseSchema, 404: ErrorResponseSchema})
@require_permission("designation.edit")
def update_designation(request, designation_id: str, payload: DesignationUpdateSchema):
    """Update designation details"""
    try:
        designation = Designation.objects.get(id=designation_id)
        
        if payload.position_name is not None:
            designation.position_name = payload.position_name
        if payload.description is not None:
            designation.description = payload.description
        
        designation.save()
        return 200, {
            "message": "Designation updated successfully",
            "position_code": designation.position_code
        }
    except Designation.DoesNotExist:
        return 404, {"error": "Designation not found"}
    except Exception as e:
        return 400, {"error": str(e)}


@router.delete("/designations/{designation_id}", response={200: dict, 400: ErrorResponseSchema, 404: ErrorResponseSchema})
@require_permission("designation.delete")
def delete_designation(request, designation_id: str):
    """Soft delete a designation (only if no active employees)"""
    try:
        designation = Designation.objects.get(id=designation_id)
        
        # Check for active employees via assignments
        active_employees = designation.assignments.filter(is_deleted=False).count()
        if active_employees > 0:
            return 400, {"error": f"Cannot delete designation with {active_employees} active employees"}
        
        designation.soft_delete()  # Use soft_delete method
        return 200, {"message": f"Designation '{designation.position_code}' deleted successfully"}
    except Designation.DoesNotExist:
        return 404, {"error": "Designation not found"}

@router.get("/employees", response=dict)
@require_permission("employee.view")
def list_employees(
    request,
    page: int = 1,
    per_page: int = 20,
    search: str = None,
    department: str = None,
    designation: str = None,
    employment_type: str = None
):
    """
    List employees with pagination and filters.
    
    Query params:
    - page: Page number (default 1)
    - per_page: Items per page (default 20, max 100)
    - search: Search in name, email, employee_code
    - department: Filter by department code
    - designation: Filter by designation code
    - employment_type: Filter by employment type
    """
    try:
        # Base query - only non-deleted employees
        query = Employee.objects.filter(is_deleted=False).prefetch_related(
            'assignments',
            'assignments__department',
            'assignments__department__branch',
            'assignments__department__branch__institution',
            'assignments__department__institution',
            'assignments__designation',
            'assignments__designation__department',
            'assignments__designation__department__branch',
        )
        
        # Apply search filter
        if search:
            from django.db.models import Q
            query = query.filter(
                Q(full_name__icontains=search) |
                Q(personal_email__icontains=search) |
                Q(org_email__icontains=search) |
                Q(employee_code__icontains=search) |
                Q(employee_id__icontains=search)
            )
        
        # Apply department filter (via assignments)
        if department:
            query = query.filter(assignments__department__dept_code=department)
        
        # Apply designation filter (via assignments)
        if designation:
            query = query.filter(assignments__designation__position_code=designation)
        
        # Get total count
        total = query.distinct().count()
        
        # Pagination
        per_page = min(per_page, 100)
        start = (page - 1) * per_page
        employees = query.order_by('-created_at').distinct()[start:start + per_page]
        
        employee_list = []
        for emp in employees:
            assignments_list = list(emp.assignments.all())
            primary = next((a for a in assignments_list if a.is_primary), None) or (assignments_list[0] if assignments_list else None)
            
            employee_list.append({
                'employee_id': emp.employee_id,
                'employee_code': emp.employee_code,
                'full_name': emp.full_name,
                'email': emp.personal_email,
                'phone': emp.personal_phone,
                'department': {
                    'dept_name': primary.department.dept_name if primary else None,
                    'dept_code': primary.department.dept_code if primary else None
                } if primary else None,
                'designation': {
                    'position_name': primary.designation.position_name if primary else None,
                    'position_code': primary.designation.position_code if primary else None
                } if primary else None,
                'primary_assignment': {
                    'department': primary.department.dept_name if primary else None,
                    'designation': primary.designation.position_name if primary else None,
                    'institution': _assignment_institution(primary).name if primary and _assignment_institution(primary) else "Global",
                } if primary else None,
                'employment_type': emp.get_employment_type_display(),
                'is_active': emp.is_active,
                'gender': emp.gender,
                'created_at': emp.created_at.isoformat()
            })
        
        return {
            'employees': employee_list,
            'total': total,
            'page': page,
            'per_page': per_page,
            'total_pages': (total + per_page - 1) // per_page
        }
    
    except Exception as e:
        logger.error(f"Error listing employees: {str(e)}", exc_info=True)
        return {
            'employees': [],
            'total': 0,
            'page': 1,
            'per_page': per_page,
            'total_pages': 0,
            'error': str(e)
        }


@router.get("/employees/by-user/{user_id}", response=dict)
@require_permission("employee.view")
def get_employee_by_user_id(request, user_id: str):
    """
    Lightweight lookup by Employee.id (UUID) — used by HDMS ticket-service
    to resolve requestor_id (which is the auth-service user UUID) to a name.
    """
    try:
        employee = Employee.objects.get(id=user_id, is_deleted=False)
        return {
            'employee_id': employee.employee_id,
            'employee_code': employee.employee_code,
            'full_name': employee.full_name,
        }
    except Employee.DoesNotExist:
        return 404, {'error': f'Employee with user ID {user_id} not found'}
    except Exception as e:
        logger.error(f"Error getting employee by user_id {user_id}: {str(e)}", exc_info=True)
        return 400, {'error': str(e)}


@router.get("/employees/{employee_id}", response=dict)
@require_permission("employee.view")
def get_employee(request, employee_id: str):
    """
    Get single employee details. Accepts either employee_id or employee_code.
    """
    try:
        employee = Employee.objects.prefetch_related(
            'assignments',
            'assignments__department',
            'assignments__department__branch',
            'assignments__department__branch__institution',
            'assignments__department__institution',
            'assignments__designation',
            'assignments__designation__department',
            'assignments__designation__department__branch',
            'assignments__designation__department__branch__institution',
        ).filter(is_deleted=False).filter(
            models.Q(employee_id=employee_id) | models.Q(employee_code=employee_id)
        ).first()
        if not employee:
            raise Employee.DoesNotExist()
        
        assignments = []
        for asn in employee.assignments.filter(is_deleted=False):
            assignments.append({
                'institution': _assignment_institution(asn).name if _assignment_institution(asn) else "Global",
                'institution_code': _assignment_institution(asn).inst_code if _assignment_institution(asn) else None,
                'branch_name': asn.designation.department.branch.branch_name if asn.designation.department.branch_id else "N/A",
                'branch_code': asn.designation.department.branch.branch_code if asn.designation.department.branch_id else None,
                'department': asn.department.dept_name if asn.department else None,
                'department_code': asn.department.dept_code if asn.department else None,
                'designation': asn.designation.position_name if asn.designation else None,
                'designation_code': asn.designation.position_code if asn.designation else None,
                'shift': asn.shift,
                'joining_date': asn.joining_date.isoformat(),
                'is_primary': asn.is_primary,
                'role_data': asn.role_data
            })

        return {
            'employee_id': employee.employee_id,
            'employee_code': employee.employee_code,
            'organization_code': employee.organization.org_code if employee.organization else None,
            'full_name': employee.full_name,
            'personal_email': employee.personal_email,
            'personal_phone': employee.personal_phone,
            'email': employee.personal_email, # Alias for frontend consistency
            'phone': employee.personal_phone, # Alias for frontend consistency
            'org_email': employee.org_email,
            'org_phone': employee.org_phone,
            'cnic': employee.cnic,
            'dob': employee.dob.isoformat() if employee.dob else None,
            'gender': employee.gender,
            'gender_display': employee.get_gender_display(),
            'marital_status': employee.marital_status,
            'marital_status_display': employee.get_marital_status_display(),
            'employment_type': employee.employment_type,
            'employment_type_display': employee.get_employment_type_display(),
            'nationality': employee.nationality,
            'religion': employee.religion,
            'emergency_contact': {
                'name': employee.emergency_contact_name,
                'phone': employee.emergency_contact_phone
            },
            'address': {
                'residential': employee.residential_address,
                'permanent': employee.permanent_address,
                'city': employee.city,
            },
            'assignments': assignments,
            'bank_info': {
                'bank_name': employee.bank_name,
                'account_number': employee.account_number,
            },
            'education_history': employee.education_history,
            'work_experience': employee.work_experience,
            'resume': employee.resume_url, # Renamed for frontend convenience
            'resume_url': employee.resume_url,
            'is_active': employee.is_active,
            'created_at': employee.created_at.isoformat(),
        }
    
    except Employee.DoesNotExist:
        return 404, {'error': f'Employee with ID {employee_id} not found'}
    except Exception as e:
        logger.error(f"Error getting employee {employee_id}: {str(e)}", exc_info=True)
        return 400, {'error': str(e)}


@router.delete("/employees/{employee_id}", response=dict)
@require_permission("employee.delete")
def delete_employee(request, employee_id: str):
    """
    Soft delete an employee by setting is_deleted=True.
    
    This preserves the employee record but marks it as deleted.
    """
    try:
        employee = Employee.objects.filter(is_deleted=False).filter(
            models.Q(employee_id=employee_id) | models.Q(employee_code=employee_id)
        ).first()
        if not employee:
            raise Employee.DoesNotExist()

        # Soft delete
        employee.is_deleted = True
        employee.save()
        
        logger.info(f"Employee soft deleted: {employee.employee_code} - {employee.full_name}")
        
        return {
            'success': True,
            'message': f'Employee {employee.employee_code} deleted successfully',
            'employee_id': employee.employee_id
        }
    
    except Employee.DoesNotExist:
        return 404, {'error': f'Employee with ID {employee_id} not found'}
    except Exception as e:
        logger.error(f"Error deleting employee {employee_id}: {str(e)}", exc_info=True)
        return 400, {'error': str(e)}


# ========================================
# UPDATE EMPLOYEE (PUT)
# ========================================

class EmployeeUpdateSchema(BaseModel):
    """Partial employee update. All fields optional; only provided fields are applied."""
    # Personal
    fullName: Optional[str] = None
    dob: Optional[str] = None
    cnic: Optional[str] = None
    gender: Optional[str] = None
    maritalStatus: Optional[str] = None
    nationality: Optional[str] = None
    religion: Optional[str] = None

    # Contact
    personalEmail: Optional[str] = None
    mobile: Optional[str] = None
    orgEmail: Optional[str] = None
    orgPhone: Optional[str] = None
    emergencyName: Optional[str] = None
    emergencyPhone: Optional[str] = None
    residentialAddress: Optional[str] = None
    permanentAddress: Optional[str] = None
    city: Optional[str] = None


    # Primary assignment (flat, same shape as create payload)
    organizationCode: Optional[str] = None
    institutionCode: Optional[str] = None
    departmentCode: Optional[str] = None
    designationCode: Optional[str] = None
    joiningDate: Optional[str] = None
    shift: Optional[str] = None

    # Bank
    bankName: Optional[str] = None
    accountNumber: Optional[str] = None

    # History (replace-on-update semantics)
    education: Optional[List[EducationSchema]] = None
    experience: Optional[List[ExperienceSchema]] = None

    # Status & HR fields
    employmentType: Optional[str] = None
    isActive: Optional[bool] = None

    @validator('cnic')
    def validate_cnic(cls, v):
        if v is None:
            return v
        if not re.match(r'^\d{5}-?\d{7}-?\d{1}$', v):
            raise ValueError('Invalid Pakistani CNIC format (XXXXX-XXXXXXX-X)')
        return v.replace('-', '')

    @validator('mobile', 'emergencyPhone', 'orgPhone')
    def validate_phone(cls, v):
        if v and not re.match(r'^(\+92|92|0|0092)?3\d{2}-?\d{7}$', v):
            raise ValueError('Invalid Pakistani Mobile number format')
        return v

    @validator('personalEmail', 'orgEmail')
    def validate_email(cls, v):
        if v and not re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', v):
            raise ValueError('Invalid email format')
        return v

    @validator('dob')
    def validate_dob(cls, v):
        if not v:
            return v
        try:
            dob_date = datetime.strptime(v, '%Y-%m-%d').date()
        except ValueError:
            raise ValueError('Date of birth must be YYYY-MM-DD format')
        today = date.today()
        age = today.year - dob_date.year - ((today.month, today.day) < (dob_date.month, dob_date.day))
        if age < 13:
            raise ValueError('Employee must be at least 13 years old')
        return v

    @validator('gender')
    def validate_gender(cls, v):
        if v is None:
            return v
        allowed = ['male', 'female']
        if v.lower() not in allowed:
            raise ValueError(f"gender must be one of: {', '.join(allowed)}")
        return v.lower()

    @validator('maritalStatus')
    def validate_marital_status(cls, v):
        if v is None:
            return v
        allowed = ['single', 'married', 'divorced', 'widowed']
        if v.lower() not in allowed:
            raise ValueError(f"maritalStatus must be one of: {', '.join(allowed)}")
        return v.lower()

    @validator('shift')
    def validate_shift(cls, v):
        if v is None:
            return v
        allowed = ['general', 'morning', 'afternoon', 'night', 'hourly', 'both']
        if v.lower() not in allowed:
            raise ValueError(f"shift must be one of: {', '.join(allowed)}")
        return v.lower()

    @validator('employmentType')
    def validate_employment_type(cls, v):
        if v is None:
            return v
        allowed = ['full_time', 'part_time', 'contract', 'intern', 'volunteer']
        if v.lower() not in allowed:
            raise ValueError(f"employmentType must be one of: {', '.join(allowed)}")
        return v.lower()


@router.put(
    "/employees/{employee_id}",
    response={200: dict, 400: dict, 404: dict},
    summary="Update Employee",
)
@require_permission("employee.edit")
def update_employee(request, employee_id: str, payload: EmployeeUpdateSchema):
    """
    Partial update of an employee. Only fields present in the request body are applied.
    Primary assignment FKs (institutionCode/branchCode/departmentCode/designationCode)
    update the employee's primary EmployeeAssignment row in place.
    """
    employee = Employee.objects.filter(is_deleted=False).filter(
        models.Q(employee_id=employee_id) | models.Q(employee_code=employee_id)
    ).first()
    if not employee:
        return 404, {'error': f'Employee with ID {employee_id} not found'}

    field_errors = {}

    # Resolve optional FKs
    inst = None
    if payload.institutionCode:
        inst = Institution.objects.filter(inst_code=payload.institutionCode, is_deleted=False).first()
        if not inst:
            field_errors['institutionCode'] = ['Institution not found']

    dept = None
    if payload.departmentCode:
        dept = Department.objects.filter(dept_code=payload.departmentCode, is_deleted=False).first()
        if not dept:
            field_errors['departmentCode'] = ['Department not found']

    designation = None
    if payload.designationCode:
        primary_existing = employee.assignments.filter(is_primary=True, is_deleted=False).first()
        scope_dept = dept or (primary_existing.department if primary_existing else None)
        if not scope_dept:
            field_errors['designationCode'] = ['Cannot validate designation without a department']
        else:
            designation = Designation.objects.filter(
                department=scope_dept, position_code=payload.designationCode, is_deleted=False
            ).first()
            if not designation:
                field_errors['designationCode'] = ['Designation not found for this department']

    # CNIC uniqueness (excluding self)
    if payload.cnic and Employee.objects.filter(cnic=payload.cnic, is_deleted=False).exclude(pk=employee.pk).exists():
        field_errors['cnic'] = ['An employee with this CNIC already exists']

    if field_errors:
        return 400, {'error': 'Validation failed', 'field_errors': field_errors}

    try:
        with transaction.atomic():
            field_map = {
                'fullName': 'full_name',
                'cnic': 'cnic',
                'mobile': 'personal_phone',
                'personalEmail': 'personal_email',
                'orgEmail': 'org_email',
                'orgPhone': 'org_phone',
                'gender': 'gender',
                'maritalStatus': 'marital_status',
                'nationality': 'nationality',
                'religion': 'religion',
                'residentialAddress': 'residential_address',
                'permanentAddress': 'permanent_address',
                'city': 'city',
                'emergencyName': 'emergency_contact_name',
                'emergencyPhone': 'emergency_contact_phone',
                'bankName': 'bank_name',
                'accountNumber': 'account_number',
            }
            data = payload.dict(exclude_unset=True)
            # For nullable unique fields, treat "" as None to avoid unique-constraint collisions
            NULLABLE_BLANK_TO_NONE = {"orgEmail", "orgPhone", "personalEmail"}
            for payload_key, model_field in field_map.items():
                if payload_key in data:
                    val = data[payload_key]
                    if payload_key in NULLABLE_BLANK_TO_NONE and val == "":
                        val = None
                    setattr(employee, model_field, val)

            if 'dob' in data and data['dob']:
                employee.dob = datetime.strptime(data['dob'], '%Y-%m-%d').date()

            if payload.education is not None:
                employee.education_history = [e.dict() for e in payload.education]
            if payload.experience is not None:
                employee.work_experience = [e.dict() for e in payload.experience]
            if payload.isActive is not None:
                employee.is_active = payload.isActive
            if payload.employmentType is not None:
                employee.employment_type = payload.employmentType

            employee.save()

            # Update primary assignment if any assignment field was provided
            assignment_fields_provided = any([
                payload.institutionCode,
                payload.departmentCode, payload.designationCode,
                payload.joiningDate, payload.shift
            ])
            if assignment_fields_provided:
                primary = employee.assignments.filter(is_primary=True, is_deleted=False).first()
                if primary:
                    if dept is not None:
                        primary.department = dept
                    if designation is not None:
                        primary.designation = designation
                    if payload.joiningDate:
                        primary.joining_date = datetime.strptime(payload.joiningDate, '%Y-%m-%d').date()
                    if payload.shift:
                        primary.shift = payload.shift
                    primary.save()

        logger.info(f"Employee updated: {employee.employee_code} - {employee.full_name}")
        return 200, {
            'success': True,
            'message': 'Employee updated successfully',
            'employee_id': employee.employee_id,
            'employee_code': employee.employee_code,
        }
    except Exception as e:
        logger.error(f"Error updating employee {employee_id}: {str(e)}", exc_info=True)
        return 400, {'error': str(e)}


# ========================================
# EMPLOYEE ASSIGNMENTS (dedicated endpoints)
# ========================================

class EmployeeAssignmentCreateSchema(BaseModel):
    department_code: str
    designation_code: str
    joining_date: Optional[str] = None
    shift: str = 'general'
    is_primary: bool = False

    @validator('shift')
    def validate_shift(cls, v):
        allowed = ['general', 'morning', 'afternoon', 'night', 'hourly', 'both']
        if v and v.lower() not in allowed:
            raise ValueError(f"shift must be one of: {', '.join(allowed)}")
        return v.lower() if v else v


class EmployeeAssignmentUpdateSchema(BaseModel):
    department_code: Optional[str] = None
    designation_code: Optional[str] = None
    joining_date: Optional[str] = None
    shift: Optional[str] = None
    is_primary: Optional[bool] = None
    is_active: Optional[bool] = None

    @validator('shift')
    def validate_shift(cls, v):
        if v is None:
            return v
        allowed = ['general', 'morning', 'afternoon', 'night', 'hourly', 'both']
        if v.lower() not in allowed:
            raise ValueError(f"shift must be one of: {', '.join(allowed)}")
        return v.lower()


def _assignment_response(asn) -> dict:
    inst = _assignment_institution(asn)
    return {
        'id': str(asn.id),
        'institution': inst.name if inst else None,
        'institution_code': inst.inst_code if inst else None,
        'branch_name': asn.designation.department.branch.branch_name if asn.designation.department.branch_id else None,
        'branch_code': asn.designation.department.branch.branch_code if asn.designation.department.branch_id else None,
        'department': asn.department.dept_name,
        'department_code': asn.department.dept_code,
        'designation': asn.designation.position_name,
        'designation_code': asn.designation.position_code,
        'shift': asn.shift,
        'joining_date': asn.joining_date.isoformat() if asn.joining_date else None,
        'is_primary': asn.is_primary,
        'is_active': asn.is_active,
    }


@router.post(
    "/employees/{employee_key}/assignments",
    response={201: dict, 400: dict, 404: dict},
)
@require_permission("assignment.create")
def create_assignment(request, employee_key: str, payload: EmployeeAssignmentCreateSchema):
    """Add a new assignment to an employee."""
    emp = Employee.objects.filter(
        models.Q(employee_id=employee_key) | models.Q(employee_code=employee_key),
        is_deleted=False
    ).first()
    if not emp:
        return 404, {'error': 'Employee not found'}

    dept = Department.objects.filter(dept_code=payload.department_code, is_deleted=False).first()
    if not dept:
        return 400, {'error': f"Department '{payload.department_code}' not found"}

    desig = Designation.objects.filter(position_code=payload.designation_code, department=dept, is_deleted=False).first()
    if not desig:
        return 400, {'error': f"Designation '{payload.designation_code}' not found in this department"}

    joining_date = None
    if payload.joining_date:
        try:
            joining_date = datetime.strptime(payload.joining_date, '%Y-%m-%d').date()
        except ValueError:
            return 400, {'error': 'joining_date must be YYYY-MM-DD'}

    if joining_date is None:
        joining_date = date.today()

    if payload.is_primary:
        emp.assignments.filter(is_primary=True, is_deleted=False).update(is_primary=False)

    asn = EmployeeAssignment.objects.create(
        employee=emp,
        department=dept,
        designation=desig,
        joining_date=joining_date,
        shift=payload.shift,
        is_primary=payload.is_primary,
        is_active=True,
    )
    return 201, _assignment_response(asn)


@router.put(
    "/employees/{employee_key}/assignments/{assignment_id}",
    response={200: dict, 400: dict, 404: dict},
)
@require_permission("assignment.edit")
def update_assignment(request, employee_key: str, assignment_id: str, payload: EmployeeAssignmentUpdateSchema):
    """Update a specific assignment."""
    emp = Employee.objects.filter(
        models.Q(employee_id=employee_key) | models.Q(employee_code=employee_key),
        is_deleted=False
    ).first()
    if not emp:
        return 404, {'error': 'Employee not found'}

    try:
        asn = emp.assignments.get(id=assignment_id, is_deleted=False)
    except EmployeeAssignment.DoesNotExist:
        return 404, {'error': 'Assignment not found'}

    if payload.department_code:
        dept = Department.objects.filter(dept_code=payload.department_code, is_deleted=False).first()
        if not dept:
            return 400, {'error': f"Department '{payload.department_code}' not found"}
        asn.department = dept

    if payload.designation_code:
        scope_dept = asn.department
        desig = Designation.objects.filter(position_code=payload.designation_code, department=scope_dept, is_deleted=False).first()
        if not desig:
            return 400, {'error': f"Designation '{payload.designation_code}' not found in this department"}
        asn.designation = desig

    if payload.joining_date is not None:
        try:
            asn.joining_date = datetime.strptime(payload.joining_date, '%Y-%m-%d').date()
        except ValueError:
            return 400, {'error': 'joining_date must be YYYY-MM-DD'}

    if payload.shift is not None:
        asn.shift = payload.shift
    if payload.is_primary is not None:
        if payload.is_primary:
            emp.assignments.filter(is_primary=True, is_deleted=False).update(is_primary=False)
        asn.is_primary = payload.is_primary
    if payload.is_active is not None:
        asn.is_active = payload.is_active

    asn.save()
    return 200, _assignment_response(asn)


@router.delete(
    "/employees/{employee_key}/assignments/{assignment_id}",
    response={200: dict, 400: dict, 404: dict},
)
@require_permission("assignment.delete")
def delete_assignment(request, employee_key: str, assignment_id: str):
    """Soft-delete an assignment. Cannot delete the last remaining assignment."""
    emp = Employee.objects.filter(
        models.Q(employee_id=employee_key) | models.Q(employee_code=employee_key),
        is_deleted=False
    ).first()
    if not emp:
        return 404, {'error': 'Employee not found'}

    try:
        asn = emp.assignments.get(id=assignment_id, is_deleted=False)
    except EmployeeAssignment.DoesNotExist:
        return 404, {'error': 'Assignment not found'}

    if emp.assignments.filter(is_deleted=False).count() <= 1:
        return 400, {'error': 'Cannot delete the only assignment. Employee must have at least one assignment.'}

    asn.soft_delete()
    return 200, {'message': 'Assignment deleted successfully'}