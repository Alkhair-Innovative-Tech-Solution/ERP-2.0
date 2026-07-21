"""
Django Ninja API endpoints for Department app.
"""
from ninja import Router
from typing import List
from .models import Department
from .schemas import DepartmentSchema, DepartmentCreateSchema

router = Router(tags=['departments'])


@router.get('/', response=List[DepartmentSchema])
def list_departments(request):
    """List all departments."""
    return Department.objects.filter(is_deleted=False)


@router.get('/{department_id}', response=DepartmentSchema)
def get_department(request, department_id: str):
    """Get department by ID."""
    return Department.objects.get(id=department_id, is_deleted=False)


