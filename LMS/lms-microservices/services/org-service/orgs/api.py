from ninja import Router, Schema, Field
from ninja_extra import NinjaExtraAPI
from typing import List, Optional
from uuid import UUID
from .models import Organization, Campus, Level, Grade, Classroom
import json

router = Router()

# ─── Schemas ───────────────────────────────────────────────────────

class OrganizationSchema(Schema):
    id: UUID
    name: str
    subdomain: Optional[str] = None
    max_users: int
    max_students: int
    max_campuses: int
    enabled_features: dict = {}
    is_active: bool
    created_at: str

class OrganizationCreateSchema(Schema):
    name: str
    subdomain: Optional[str] = None
    max_users: int = 100
    max_students: int = 500
    max_campuses: int = 5
    enabled_features: dict = {}
    is_active: bool = True

class CampusSchema(Schema):
    id: UUID
    organization_id: UUID
    campus_id: str
    campus_code: str
    campus_name: str
    campus_type: str
    status: str
    shift_available: str
    city: Optional[str] = None
    address: Optional[str] = None
    contact_phone: Optional[str] = None
    official_email: Optional[str] = None
    campus_head_name: Optional[str] = None
    student_capacity: int
    total_classrooms: int
    labs: bool
    library: bool
    transport: bool
    internet_available: bool
    power_backup: bool
    is_active: bool
    created_at: str

class CampusCreateSchema(Schema):
    organization_id: UUID
    campus_code: str
    campus_name: str
    campus_type: str = 'branch'
    status: str = 'active'
    shift_available: str = 'morning'
    city: Optional[str] = None
    address: Optional[str] = None
    contact_phone: Optional[str] = None
    official_email: Optional[str] = None
    campus_head_name: Optional[str] = None
    campus_head_email: Optional[str] = None
    student_capacity: int = 200
    total_classrooms: int = 0
    labs: bool = False
    library: bool = False
    transport: bool = False
    internet_available: bool = False
    power_backup: bool = False
    canteen_facility: bool = False

class LevelSchema(Schema):
    id: UUID
    organization_id: UUID
    campus_id: UUID
    name: str
    shift: Optional[str] = None
    is_active: bool

class LevelCreateSchema(Schema):
    organization_id: UUID
    campus_id: UUID
    name: str
    shift: Optional[str] = None

class GradeSchema(Schema):
    id: UUID
    organization_id: UUID
    campus_id: UUID
    level_id: UUID
    name: str
    is_active: bool

class GradeCreateSchema(Schema):
    organization_id: UUID
    campus_id: UUID
    level_id: UUID
    name: str

class ClassroomSchema(Schema):
    id: UUID
    organization_id: UUID
    campus_id: UUID
    grade_id: UUID
    section: str
    shift: Optional[str] = None
    capacity: int
    class_teacher_id: Optional[UUID] = None
    is_active: bool

class ClassroomCreateSchema(Schema):
    organization_id: UUID
    campus_id: UUID
    grade_id: UUID
    section: str
    shift: Optional[str] = None
    capacity: int = 40
    class_teacher_id: Optional[UUID] = None

class HierarchyNode(Schema):
    id: UUID
    name: str
    type: str  # campus, level, grade, classroom
    children: list = []


# ─── Organization Endpoints ────────────────────────────────────────

@router.get("/organizations/", response=List[OrganizationSchema])
def list_organizations(request):
    orgs = Organization.objects.all()
    return [
        OrganizationSchema(
            id=o.id, name=o.name, subdomain=o.subdomain,
            max_users=o.max_users, max_students=o.max_students,
            max_campuses=o.max_campuses, enabled_features=o.enabled_features,
            is_active=o.is_active, created_at=o.created_at.isoformat()
        ) for o in orgs
    ]

@router.post("/organizations/")
def create_organization(request, payload: OrganizationCreateSchema):
    org = Organization.objects.create(**payload.dict())
    return {"id": str(org.id), "message": "Organization created"}

@router.get("/organizations/{org_id}/", response=OrganizationSchema)
def get_organization(request, org_id: UUID):
    org = Organization.objects.get(id=org_id)
    return OrganizationSchema(
        id=org.id, name=org.name, subdomain=org.subdomain,
        max_users=org.max_users, max_students=org.max_students,
        max_campuses=org.max_campuses, enabled_features=org.enabled_features,
        is_active=org.is_active, created_at=org.created_at.isoformat()
    )

@router.patch("/organizations/{org_id}/")
def update_organization(request, org_id: UUID, payload: OrganizationCreateSchema):
    org = Organization.objects.get(id=org_id)
    for key, val in payload.dict(exclude_unset=True).items():
        setattr(org, key, val)
    org.save()
    return {"message": "Organization updated"}

@router.delete("/organizations/{org_id}/")
def delete_organization(request, org_id: UUID):
    Organization.objects.filter(id=org_id).delete()
    return {"message": "Organization deleted"}


# ─── Campus Endpoints ──────────────────────────────────────────────

@router.get("/campuses/", response=List[CampusSchema])
def list_campuses(request, organization_id: Optional[UUID] = None):
    qs = Campus.objects.all()
    if organization_id:
        qs = qs.filter(organization_id=organization_id)
    return [
        CampusSchema(
            id=c.id, organization_id=c.organization_id, campus_id=c.campus_id,
            campus_code=c.campus_code, campus_name=c.campus_name,
            campus_type=c.campus_type, status=c.status,
            shift_available=c.shift_available, city=c.city,
            address=c.address, contact_phone=c.contact_phone,
            official_email=c.official_email, campus_head_name=c.campus_head_name,
            student_capacity=c.student_capacity, total_classrooms=c.total_classrooms,
            labs=c.labs, library=c.library, transport=c.transport,
            internet_available=c.internet_available, power_backup=c.power_backup,
            is_active=c.is_active, created_at=c.created_at.isoformat()
        ) for c in qs
    ]

@router.post("/campuses/")
def create_campus(request, payload: CampusCreateSchema):
    campus = Campus.objects.create(**payload.dict())
    return {"id": str(campus.id), "campus_id": campus.campus_id, "message": "Campus created"}

@router.get("/campuses/{campus_id}/", response=CampusSchema)
def get_campus(request, campus_id: UUID):
    c = Campus.objects.get(id=campus_id)
    return CampusSchema(
        id=c.id, organization_id=c.organization_id, campus_id=c.campus_id,
        campus_code=c.campus_code, campus_name=c.campus_name,
        campus_type=c.campus_type, status=c.status,
        shift_available=c.shift_available, city=c.city,
        address=c.address, contact_phone=c.contact_phone,
        official_email=c.official_email, campus_head_name=c.campus_head_name,
        student_capacity=c.student_capacity, total_classrooms=c.total_classrooms,
        labs=c.labs, library=c.library, transport=c.transport,
        internet_available=c.internet_available, power_backup=c.power_backup,
        is_active=c.is_active, created_at=c.created_at.isoformat()
    )

@router.patch("/campuses/{campus_id}/")
def update_campus(request, campus_id: UUID, payload: CampusCreateSchema):
    campus = Campus.objects.get(id=campus_id)
    for key, val in payload.dict(exclude_unset=True).items():
        setattr(campus, key, val)
    campus.save()
    return {"message": "Campus updated"}

@router.delete("/campuses/{campus_id}/")
def delete_campus(request, campus_id: UUID):
    Campus.objects.filter(id=campus_id).delete()
    return {"message": "Campus deleted"}


# ─── Level Endpoints ───────────────────────────────────────────────

@router.get("/levels/", response=List[LevelSchema])
def list_levels(request, campus_id: Optional[UUID] = None, organization_id: Optional[UUID] = None):
    qs = Level.objects.all()
    if campus_id:
        qs = qs.filter(campus_id=campus_id)
    if organization_id:
        qs = qs.filter(organization_id=organization_id)
    return [
        LevelSchema(
            id=l.id, organization_id=l.organization_id, campus_id=l.campus_id,
            name=l.name, shift=l.shift, is_active=l.is_active
        ) for l in qs
    ]

@router.post("/levels/")
def create_level(request, payload: LevelCreateSchema):
    level = Level.objects.create(**payload.dict())
    return {"id": str(level.id), "message": "Level created"}

@router.patch("/levels/{level_id}/")
def update_level(request, level_id: UUID, payload: LevelCreateSchema):
    level = Level.objects.get(id=level_id)
    for key, val in payload.dict(exclude_unset=True).items():
        setattr(level, key, val)
    level.save()
    return {"message": "Level updated"}

@router.delete("/levels/{level_id}/")
def delete_level(request, level_id: UUID):
    Level.objects.filter(id=level_id).delete()
    return {"message": "Level deleted"}


# ─── Grade Endpoints ───────────────────────────────────────────────

@router.get("/grades/", response=List[GradeSchema])
def list_grades(request, campus_id: Optional[UUID] = None, level_id: Optional[UUID] = None, organization_id: Optional[UUID] = None):
    qs = Grade.objects.all()
    if campus_id:
        qs = qs.filter(campus_id=campus_id)
    if level_id:
        qs = qs.filter(level_id=level_id)
    if organization_id:
        qs = qs.filter(organization_id=organization_id)
    return [
        GradeSchema(
            id=g.id, organization_id=g.organization_id, campus_id=g.campus_id,
            level_id=g.level_id, name=g.name, is_active=g.is_active
        ) for g in qs
    ]

@router.post("/grades/")
def create_grade(request, payload: GradeCreateSchema):
    grade = Grade.objects.create(**payload.dict())
    return {"id": str(grade.id), "message": "Grade created"}

@router.patch("/grades/{grade_id}/")
def update_grade(request, grade_id: UUID, payload: GradeCreateSchema):
    grade = Grade.objects.get(id=grade_id)
    for key, val in payload.dict(exclude_unset=True).items():
        setattr(grade, key, val)
    grade.save()
    return {"message": "Grade updated"}

@router.delete("/grades/{grade_id}/")
def delete_grade(request, grade_id: UUID):
    Grade.objects.filter(id=grade_id).delete()
    return {"message": "Grade deleted"}


# ─── Classroom Endpoints ───────────────────────────────────────────

@router.get("/classrooms/", response=List[ClassroomSchema])
def list_classrooms(request, campus_id: Optional[UUID] = None, grade_id: Optional[UUID] = None, organization_id: Optional[UUID] = None):
    qs = Classroom.objects.all()
    if campus_id:
        qs = qs.filter(campus_id=campus_id)
    if grade_id:
        qs = qs.filter(grade_id=grade_id)
    if organization_id:
        qs = qs.filter(organization_id=organization_id)
    return [
        ClassroomSchema(
            id=cr.id, organization_id=cr.organization_id, campus_id=cr.campus_id,
            grade_id=cr.grade_id, section=cr.section, shift=cr.shift,
            capacity=cr.capacity, class_teacher_id=cr.class_teacher_id,
            is_active=cr.is_active
        ) for cr in qs
    ]

@router.post("/classrooms/")
def create_classroom(request, payload: ClassroomCreateSchema):
    classroom = Classroom.objects.create(**payload.dict())
    return {"id": str(classroom.id), "message": "Classroom created"}

@router.patch("/classrooms/{classroom_id}/")
def update_classroom(request, classroom_id: UUID, payload: ClassroomCreateSchema):
    classroom = Classroom.objects.get(id=classroom_id)
    for key, val in payload.dict(exclude_unset=True).items():
        setattr(classroom, key, val)
    classroom.save()
    return {"message": "Classroom updated"}

@router.delete("/classrooms/{classroom_id}/")
def delete_classroom(request, classroom_id: UUID):
    Classroom.objects.filter(id=classroom_id).delete()
    return {"message": "Classroom deleted"}


# ─── Hierarchy Endpoint ────────────────────────────────────────────

@router.get("/hierarchy/")
def get_hierarchy(request, organization_id: UUID):
    """Returns full org -> campus -> level -> grade -> classroom tree."""
    campuses = Campus.objects.filter(organization_id=organization_id, is_active=True)
    result = []
    for campus in campuses:
        levels = Level.objects.filter(campus=campus, is_active=True)
        level_nodes = []
        for level in levels:
            grades = Grade.objects.filter(level=level, is_active=True)
            grade_nodes = []
            for grade in grades:
                classrooms = Classroom.objects.filter(grade=grade, is_active=True)
                grade_nodes.append({
                    "id": str(grade.id),
                    "name": grade.name,
                    "type": "grade",
                    "children": [
                        {"id": str(cr.id), "name": f"Section {cr.section}", "type": "classroom", "children": []}
                        for cr in classrooms
                    ]
                })
            level_nodes.append({
                "id": str(level.id),
                "name": level.name,
                "type": "level",
                "children": grade_nodes
            })
        result.append({
            "id": str(campus.id),
            "name": campus.campus_name,
            "type": "campus",
            "children": level_nodes
        })
    return {"organization_id": str(organization_id), "hierarchy": result}
