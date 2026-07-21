from django.http import JsonResponse
from django.core.cache import cache
from django.db import models as django_models, transaction
import os
import requests
import uuid
from ninja import Router, Schema, Body
from typing import List, Dict, Any, Optional
from uuid import UUID
from django.shortcuts import get_object_or_404  # type: ignore
from ninja.errors import ValidationError
from .schemas import (
    LoginSchema,
    SignupSchema,
    SignupResponseSchema,
    TokenResponseSchema,
    CoordinatorUserSchema,
    UserIdsSchema,
    RoleListSchema,
    PasswordResetRequestSchema,
    PasswordResetConfirmSchema,
    ForcePasswordChangeSchema,
    UserUpdateSchema,
    PaginatedUserResponseSchema,
    UserInfoSchema,
    LeadLoginSchema,
    LeadCourseChangeSchema,
)
from .receipt_schemas import (
    ReceiptCodeSchema,
    ReceiptCodeTransferSchema,
    ReceiptCodeCreateSchema,
)
from .serializers import user_to_schema
from shared.common.authentication import roles_required
from django.contrib.auth import authenticate, logout as django_logout  # type: ignore
from ninja_jwt.tokens import RefreshToken  # type: ignore
from ninja.errors import HttpError
from django.contrib.auth import get_user_model
from asgiref.sync import sync_to_async
from django.utils import timezone
from datetime import timedelta, date

from users.models import User, RolePermission, Student, StudentAcademicRecord, GuardianInfo, ResidentialInfo, AdminActionLog
from users.models import Branch, Teacher
from .auth_router import auth_router, generate_access_token
from ninja_jwt.authentication import JWTAuth  # type: ignore

import logging

router = Router()
router.add_router("", auth_router)

from users.models import ReceiptCode, StudentTransferHistory
from .services import AuthService

logger = logging.getLogger(__name__)
User = get_user_model()

class RolePermissionUpdateSchema(Schema):
    role: str
    permissions: dict

class BranchSchema(Schema):
    id: UUID
    code: str
    name: str
    address: Optional[str] = None
    city: Optional[str] = None
    contact_phone: Optional[str] = None
    is_active: bool = True

class BranchCreateSchema(Schema):
    code: str
    name: str
    address: Optional[str] = None
    city: Optional[str] = "Karachi"
    contact_phone: Optional[str] = None

class BranchUpdateSchema(Schema):
    code: Optional[str] = None
    name: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    contact_phone: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("/branches/", response=List[BranchSchema], auth=JWTAuth())
def list_branches(request, is_active: Optional[bool] = None):
    qs = Branch.objects.all()
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    return list(qs.order_by("name"))

# Public (no-auth) endpoint for internal service sync
@router.get("/branches/public/", response=List[BranchSchema], auth=None)
def list_branches_public(request, is_active: Optional[bool] = None):
    qs = Branch.objects.all()
    if is_active is not None:
        qs = qs.filter(is_active=is_active)
    return list(qs.order_by("name"))

@router.post("/branches/", response=BranchSchema, auth=JWTAuth())
def create_branch(request, payload: BranchCreateSchema):
    if str(request.auth.role).upper() != 'ADMIN':
        raise HttpError(403, "Only admins can create branches")
    if Branch.objects.filter(code=payload.code).exists():
        raise HttpError(400, f"Branch code '{payload.code}' already exists")
    branch = Branch.objects.create(**payload.dict())
    return branch

@router.put("/branches/{branch_id}/", response=BranchSchema, auth=JWTAuth())
def update_branch(request, branch_id: str, payload: BranchUpdateSchema):
    if str(request.auth.role).upper() != 'ADMIN':
        raise HttpError(403, "Only admins can update branches")
    branch = get_object_or_404(Branch, id=uuid.UUID(branch_id))
    for field, value in payload.dict(exclude_unset=True).items():
        setattr(branch, field, value)
    branch.save()
    return branch

@router.delete("/branches/{branch_id}/", response=dict, auth=JWTAuth())
def delete_branch(request, branch_id: str):
    if str(request.auth.role).upper() != 'ADMIN':
        raise HttpError(403, "Only admins can delete branches")
    branch = get_object_or_404(Branch, id=uuid.UUID(branch_id))
    if branch.users.exists() or branch.students.exists() or branch.teachers.exists():
        raise HttpError(400, "Cannot delete branch with associated users, students, or teachers")
    branch.delete()
    return {"message": "Branch deleted"}

@router.get("/role-permissions/", response=List[dict], auth=JWTAuth())
def list_role_permissions(request):
    if str(request.auth.role).upper() != 'ADMIN':
        raise HttpError(403, "Only admins can view role permissions")
    perms = RolePermission.objects.all()
    return [{"role": p.role, "permissions": p.permissions} for p in perms]

@router.post("/role-permissions/update/", response=dict, auth=JWTAuth())
def update_role_permissions(request, payload: RolePermissionUpdateSchema):
    if str(request.auth.role).upper() != 'ADMIN':
        raise HttpError(403, "Only admins can update role permissions")
    
    role = payload.role
    permissions = payload.permissions
    
    if not role:
        raise HttpError(400, "Role is required")
        
    role_perm, created = RolePermission.objects.update_or_create(
        role=role.upper(),
        defaults={'permissions': permissions}
    )
    return {"message": "Permissions updated successfully", "role": role}

@router.post("/users/by-role/", response=dict)
def get_users_by_role(request, payload: RoleListSchema):
    roles = [r.lower() for r in payload.roles]
    users = User.objects.filter(role__in=roles).select_related(
        'student',
        'student__guardian_info',
        'student__residential_info'
    )
    return {
        "users": [UserInfoSchema.from_orm(user).dict() for user in users]
    }

@router.get("/users/", response=PaginatedUserResponseSchema, auth=JWTAuth())
def list_users(request, archived: bool = False, page: int = 1, limit: int = 100, search: Optional[str] = None, role: Optional[str] = None, organization_id: Optional[str] = None, campus_id: Optional[str] = None):
    user_role = str(getattr(request.auth, 'role', '')).upper()
    if user_role not in ['ADMIN', 'COORDINATOR']:
        raise HttpError(403, "Permission denied")
    
    users = User.objects.filter(is_deleted=archived).order_by('-created_at')
    
    # 🔹 Multi-Tenancy: Filter by organization_id and campus_id
    if organization_id:
        users = users.filter(organization_id=organization_id)
    if campus_id:
        users = users.filter(campus_id=campus_id)
    
    if search:
        users = users.filter(
            django_models.Q(full_name__icontains=search) |
            django_models.Q(email__icontains=search) |
            django_models.Q(cnic__icontains=search) |
            django_models.Q(phone__icontains=search)
        )
    
    if role and role != 'ALL':
        users = users.filter(role=role.lower())
    
    total = users.count()
    pages = (total + limit - 1) // limit
    offset = (page - 1) * limit
    
    items = users[offset:offset + limit]
    
    return {
        "items": [user_to_schema(user) for user in items],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": pages
    }

@router.post("/users/bulk/", response=List[UserInfoSchema])
def get_users_by_ids(request, payload: UserIdsSchema):
    logger.info(f"🔍 Bulk user fetch requested for {len(payload.ids)} IDs")
    for idx, uid in enumerate(payload.ids[:10]):
        logger.info(f"   ID[{idx}]: {uid} (type: {type(uid)})")
    
    users = User.objects.filter(id__in=payload.ids)
    logger.info(f"✅ Found {users.count()} users out of {len(payload.ids)}")
    return [user_to_schema(user) for user in users]

@router.delete("/admin/users/{user_id}/", auth=JWTAuth())
def delete_user_admin(request, user_id: str):
    if str(request.auth.role).upper() != 'ADMIN':
        raise HttpError(403, "Only admins can delete users")
    
    user_to_del = get_object_or_404(User, id=user_id)
    user_to_del.is_deleted = True
    user_to_del.deleted_at = timezone.now()
    user_to_del.is_active = False
    user_to_del.save()
    
    AdminActionLog.objects.create(
        admin_user_id=request.auth.id,
        admin_name=request.auth.full_name,
        action_type="DELETE",
        model_name="User",
        object_id=str(user_to_del.id)
    )
    return {"message": "User archived"}

@router.post("/admin/users/{user_id}/restore/", auth=JWTAuth())
def restore_user_admin(request, user_id: str):
    if str(request.auth.role).upper() != 'ADMIN':
        raise HttpError(403, "Only admins can restore users")
    
    user_to_res = get_object_or_404(User, id=user_id)
    user_to_res.is_deleted = False
    user_to_res.deleted_at = None
    user_to_res.is_active = True
    user_to_res.save()
    
    AdminActionLog.objects.create(
        admin_user_id=request.auth.id,
        admin_name=request.auth.full_name,
        action_type="RESTORE",
        model_name="User",
        object_id=str(user_to_res.id)
    )
    return {"message": "User restored"}

@router.get("/analytics/overview/", auth=JWTAuth())
def get_analytics_overview(request, branch_id: str = None, organization_id: Optional[str] = None, campus_id: Optional[str] = None):
    user_role = str(getattr(request.auth, 'role', '')).upper()
    if user_role not in ['ADMIN', 'COORDINATOR']:
        raise HttpError(403, "Permission denied")
    
    # 🔹 Multi-Tenancy: Base querysets filtered by org/campus
    users_qs = User.objects.all()
    student_qs = Student.objects.all()
    
    if organization_id:
        users_qs = users_qs.filter(organization_id=organization_id)
        student_qs = student_qs.filter(organization_id=organization_id)
    if campus_id:
        users_qs = users_qs.filter(campus_id=campus_id)
        student_qs = student_qs.filter(campus_id=campus_id)
    
    total_users = users_qs.count()
    total_teachers = users_qs.filter(role='teacher').count()
    if branch_id:
        branch_user_ids = list(student_qs.filter(branch_id=branch_id).values_list('user_id', flat=True))
        total_users = users_qs.filter(id__in=branch_user_ids).count()
        total_teachers = users_qs.filter(id__in=branch_user_ids, role='teacher').count()
    
    total_students = student_qs.filter(status='enrolled').count()
    
    total_gendered = student_qs.exclude(gender__isnull=True).exclude(gender='').count()
    men_pct = 0
    women_pct = 0
    if total_gendered > 0:
        men = student_qs.filter(gender__iexact='male').count()
        women = student_qs.filter(gender__iexact='female').count()
        men_pct = round((men / total_gendered) * 100)
        women_pct = round((women / total_gendered) * 100)
    
    today = timezone.now().date()
    enrollment_trends = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        day_str = day.strftime('%b %d')
        user_ids = None
        if branch_id:
            user_ids = list(student_qs.filter(branch_id=branch_id).values_list('user_id', flat=True))
        if user_ids:
            count = users_qs.filter(role='student', created_at__date=day, id__in=user_ids).count()
        else:
            count = users_qs.filter(role='student', created_at__date=day).count()
        enrollment_trends.append({"name": day_str, "students": count})

    recent_qs = users_qs.order_by('-created_at')
    if branch_id:
        user_ids = list(student_qs.filter(branch_id=branch_id).values_list('user_id', flat=True))
        recent_qs = recent_qs.filter(id__in=user_ids)
    recent_users = list(
        recent_qs.values(
            'id', 'full_name', 'email', 'role', 'created_at'
        )[:10]
    )
    for u in recent_users:
        u['id'] = str(u['id'])
        u['created_at'] = u['created_at'].isoformat() if u['created_at'] else None

    return {
        "total_users": total_users,
        "total_teachers": total_teachers,
        "enrolled_students": total_students,
        "demographics": [
            {"name": "Male", "value": men_pct},
            {"name": "Female", "value": women_pct}
        ],
        "enrollment_trends": enrollment_trends,
        "recent_users": recent_users,
        "top_courses": []
    }

class AttendanceMarkSchema(Schema):
    teacher_id: str
    date: date
    status: str
    remarks: Optional[str] = ""

@router.get("/coordinator/teachers/attendance/", auth=JWTAuth())
def get_teacher_attendance(request, date: str):
    from users.models import Teacher, TeacherAttendance
    teachers = Teacher.objects.select_related('user').all()
    attendances = TeacherAttendance.objects.filter(date=date)
    att_map = {str(a.teacher_id): a for a in attendances}
    
    results = []
    for t in teachers:
        att = att_map.get(str(t.id))
        results.append({
            "teacher_id": str(t.id),
            "teacher_name": t.user.full_name,
            "teacher_email": t.user.email,
            "specialization": t.specialization,
            "status": att.status if att else "NOT_MARKED",
            "remarks": att.remarks if att else ""
        })
    return {"results": results}

@router.post("/coordinator/teachers/attendance/", auth=JWTAuth())
def mark_teacher_attendance(request, payload: AttendanceMarkSchema):
    user_role = str(getattr(request.auth, 'role', '')).upper()
    if user_role not in ['ADMIN', 'COORDINATOR']:
        raise HttpError(403, "Permission denied")

    from users.models import Teacher, TeacherAttendance
    teacher = get_object_or_404(Teacher, id=payload.teacher_id)
    
    att, created = TeacherAttendance.objects.update_or_create(
        teacher=teacher,
        date=payload.date,
        defaults={
            "status": payload.status,
            "remarks": payload.remarks,
            "marked_by_id": request.auth.id
        }
    )
    return {"message": "Attendance marked successfully", "status": att.status}

@router.get("/teachers/")
def list_teachers(request, organization_id: Optional[str] = None, campus_id: Optional[str] = None):
    teachers = User.objects.filter(role__in=['teacher', 'admin'])
    
    # 🔹 Multi-Tenancy: Filter by organization_id and campus_id
    if organization_id:
        teachers = teachers.filter(organization_id=organization_id)
    if campus_id:
        teachers = teachers.filter(campus_id=campus_id)
    
    return list(teachers.values('id', 'full_name', 'email', 'role'))

@router.get("/users/{user_id}/", response=UserInfoSchema, auth=JWTAuth())
def get_user(request, user_id: str):
    user = get_object_or_404(User, id=user_id)
    return user_to_schema(user)

@router.patch("/users/{user_id}/", response=UserInfoSchema, auth=JWTAuth())
def update_user(request, user_id: str, payload: UserUpdateSchema):
    auth_id = str(getattr(request.auth, 'id', getattr(request.auth, 'user_id', ''))).lower()
    is_self = auth_id == str(user_id).lower()
    is_admin = str(getattr(request.auth, 'role', '')).upper() == 'ADMIN'
    is_coordinator = str(getattr(request.auth, 'role', '')).upper() == 'COORDINATOR'

    if not (is_admin or is_coordinator or is_self):
        raise HttpError(403, "Not authorized to update this user")
        
    user = get_object_or_404(User, id=user_id)
    
    # Fields that belong to specific models
    student_fields = [
        'gender', 'status', 'whatsapp_number', 'student_id', 'level', 'batch', 'specialization',
        'study_work_status', 'study_work_details', 'studied_at_idara', 'studying_at_idara', 'signature',
        'test_score', 'has_paid_deposit', 'course_code'
    ]
    guardian_fields = ['father_name', 'guardian_name', 'guardian_contact', 'relationship']
    residential_fields = ['address']
    
    update_data = payload.dict(exclude_unset=True)
    
    if user.role.lower() == 'student':
        student, _ = Student.objects.get_or_create(user=user)
        
        for attr, value in update_data.items():
            if attr == 'password' and value:
                user.set_password(value)
            elif attr == 'dob' and value:
                # Parse date string → date object for Student.date_of_birth
                from datetime import datetime as dt
                try:
                    student.date_of_birth = dt.strptime(value, '%Y-%m-%d').date()
                except (ValueError, TypeError):
                    pass  # skip invalid date strings silently
            elif attr == 'branch_id' and value:
                from users.models import Branch
                try:
                    user.branch = Branch.objects.get(id=value)
                except Branch.DoesNotExist:
                    pass
            elif attr == 'organization_id' and value:
                user.organization_id = value
                student.organization_id = value
            elif attr == 'campus_id' and value:
                user.campus_id = value
                student.campus_id = value
            elif attr in student_fields:
                setattr(student, attr, value)
            elif attr in guardian_fields:
                from .models import GuardianInfo
                guardian, _ = GuardianInfo.objects.get_or_create(student=student)
                setattr(guardian, attr, value)
                guardian.save()
            elif attr in residential_fields:
                from .models import ResidentialInfo
                res_info, _ = ResidentialInfo.objects.get_or_create(student=student)
                setattr(res_info, attr, value)
                res_info.save()
            elif hasattr(user, attr):
                setattr(user, attr, value)
        
        # 🔹 Handle Student ID Regeneration on Transfer/Update
        new_batch = update_data.get('batch')
        new_course_code = update_data.get('course_code')
        
        if (new_batch or new_course_code) and student.student_id:
            # If batch/course changed, we update the student_id string to reflect the new context
            # Example: AIT25-WD13-0581 -> AIT25-WD14-0581
            parts = student.student_id.split('-')
            if len(parts) >= 3:
                # Assuming format [BRAND/YEAR]-[COURSE/BATCH]-[SEQ]
                # AIT25 - WD13 - 0581
                # Or AIT - 2025 - WD13 - 0581
                
                # If there are 3 parts: [AIT25, WD13, 0581]
                if len(parts) == 3:
                    parts[1] = (new_course_code or new_batch).upper()
                # If there are 4 parts: [AIT, 2025, WD13, 0581]
                elif len(parts) == 4:
                    parts[2] = (new_course_code or new_batch).upper()
                
                student.student_id = "-".join(parts)
        
        student.save()
    else:
        # For non-students, just update user fields
        for attr, value in update_data.items():
            if attr == 'password' and value:
                user.set_password(value)
            elif attr == 'branch_id' and value:
                from users.models import Branch
                try:
                    user.branch = Branch.objects.get(id=value)
                except Branch.DoesNotExist:
                    pass
            elif attr == 'organization_id' and value:
                user.organization_id = value
            elif attr == 'campus_id' and value:
                user.campus_id = value
            elif hasattr(user, attr):
                setattr(user, attr, value)
            
    user.save()
    return user_to_schema(user)

@router.delete("/users/{user_id}/", response={204: None}, auth=JWTAuth())
def delete_user(request, user_id: str):
    if request.auth.role != 'ADMIN':
        raise HttpError(403, "Only admins can delete users")
    user = get_object_or_404(User, id=user_id)
    user.delete()
    return 204, None



from .services import UserService
@router.post("/coordinator/users/", response=UserInfoSchema, auth=JWTAuth())
@roles_required(["ADMIN", "COORDINATOR"])
def coordinator_create_user(request, payload: CoordinatorUserSchema = Body(...)):
    data = payload.dict()
    if not data.get('full_name'):
        data['full_name'] = f"{data.get('first_name', '')} {data.get('last_name', '')}".strip()
    
    if User.objects.filter(email=data['email']).exists():
        raise HttpError(400, "Email already exists")
    
    if not data.get('cnic'):
        import random
        data['cnic'] = f"{random.randint(10000, 99999)}-{random.randint(1000000, 9999999)}-{random.randint(1, 9)}"
    if not data.get('phone'):
        import random
        data['phone'] = f"+923{random.randint(10, 99)}{random.randint(1000000, 9999999)}"

    user = UserService.create_user_with_role(data)
    return user

@router.post("/register", response=SignupResponseSchema, auth=None)
def signup(request, payload: SignupSchema):
    if User.objects.filter(email=payload.email).exists():
        return JsonResponse("email", status=301, safe=False)
    if User.objects.filter(phone=payload.phone).exists():
        return JsonResponse("phone", status=301, safe=False)
    if User.objects.filter(cnic=payload.cnic).exists():
        return JsonResponse("cnic", status=301, safe=False)

    if payload.role.lower() == 'student':
        lead_id = payload.lead_id
        if not lead_id:
             raise HttpError(400, "Entrance test required for students.")
        
        status_data, error = UserService.verify_lead_status(lead_id)
        if error:
            return JsonResponse({"message": error}, status=400, safe=False)
        
        if not status_data.get("passed"):
            return JsonResponse({"message": "You must pass the entrance test first."}, status=403, safe=False)
        
        if status_data.get("email") and str(status_data.get("email")).lower() != str(payload.email).lower():
            return JsonResponse({"message": "Email mismatch."}, status=403, safe=False)

    try:
        user_data = payload.dict()
        if payload.role.lower() == 'student' and 'status_data' in locals():
            # Sync critical fields from lead data
            user_data.update({
                'test_score': status_data.get('test_score'),
                'has_paid_deposit': status_data.get('has_paid_deposit', False),
            })
            
        user = UserService.create_user_with_role(user_data)
        token = generate_access_token(user)
        user_info = user_to_schema(user)
        return JsonResponse({
            "user": user_info.dict(),
            "access_token": token["access"],
            "refresh_token": token["refresh"],
        }, status=201, safe=False)
    except Exception as e:
        logger.error(f"Signup error: {e}")
        raise HttpError(500, f"Registration failed. {str(e)}")

@router.post("/login", response=TokenResponseSchema, auth=None)
def login(request, payload: LoginSchema):
    identifier = payload.email.lower().strip()
    lockout_key = f"lockout_{identifier}"
    attempts_key = f"attempts_{identifier}"

    if cache.get(lockout_key):
        raise HttpError(403, "Too many failed attempts. Please wait 5 minutes.")

    auth_email = identifier
    if '@' not in identifier:
        student = Student.objects.filter(student_id__iexact=identifier).select_related('user').first()
        if student and student.user:
            auth_email = student.user.email

    user = authenticate(email=auth_email, password=payload.password)
    if not user:
        attempts = cache.get(attempts_key, 0) + 1
        cache.set(attempts_key, attempts, timeout=600)
        if attempts >= 5:
            cache.set(lockout_key, True, timeout=300)
        raise HttpError(401, f"Invalid credentials. Attempt {attempts}/5")

    cache.delete(attempts_key)
    cache.delete(lockout_key)
    tokens = generate_access_token(user)
    return {
        "user": user_to_schema(user),
        "access": tokens["access"],
        "refresh": tokens["refresh"],
    }

@router.post("/send-verification-otp", response=dict)
def send_verification_otp(request, payload: PasswordResetRequestSchema):
    from django.core.mail import send_mail
    from django.conf import settings
    import random, string
    user = User.objects.filter(email=payload.email.lower().strip()).first()
    if not user:
        return {"message": "If an account exists, a verification code has been sent."}
    otp = "".join(random.choices(string.digits, k=6))
    expiry = timezone.now() + timedelta(minutes=10)
    user.features_access["_temp_otp"] = otp
    user.features_access["_otp_expiry"] = expiry.isoformat()
    user.save()
    
    try:
        send_mail(
            subject="AIT LMS: Password Change Verification Code",
            message=f"Hello {user.full_name},\n\nYour code: {otp}\nExpires in 10 mins.",
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False
        )
        return {"message": "If an account exists, a verification code has been sent."}
    except Exception as e:
        logger.error(f"OTP Error: {e}")
        return {"message": "If an account exists, a verification code has been sent."}

@router.post("/force-password-change", response=dict)
def force_password_change(request, payload: ForcePasswordChangeSchema):
    identifier = payload.email.lower().strip()
    user = User.objects.filter(email=identifier).first()
    
    if not user:
        raise HttpError(400, "Invalid or expired verification code.")
    
    # Check OTP
    stored_otp = user.features_access.get("_temp_otp")
    stored_expiry = user.features_access.get("_otp_expiry")
    
    if not stored_otp or stored_otp != payload.otp:
        raise HttpError(400, "Invalid or expired verification code.")
        
    if stored_expiry:
        try:
            from django.utils import timezone
            expiry = timezone.datetime.fromisoformat(stored_expiry)
            if timezone.now() > expiry:
                user.features_access.pop("_temp_otp", None)
                user.features_access.pop("_otp_expiry", None)
                user.save()
                raise HttpError(400, "Invalid or expired verification code.")
        except Exception:
            pass
            
    # Update password
    user.set_password(payload.new_password)
    user.must_change_password = False
    # Clear OTP
    user.features_access.pop("_temp_otp", None)
    user.features_access.pop("_otp_expiry", None)
    user.save()
    
    return {"message": "Password updated successfully."}

@router.post("/password-reset/request/", response=dict)
def request_password_reset(request, payload: PasswordResetRequestSchema):
    AuthService.initiate_password_reset(payload.email)
    return {"message": "Reset link sent if account exists."}

@router.post("/password-reset/confirm/", response=dict)
def confirm_password_reset(request, payload: PasswordResetConfirmSchema):
    success, message = AuthService.confirm_password_reset(payload.token, payload.new_password)
    if not success: raise HttpError(400, message)
    return {"message": message}

@router.post("/logout", response={200:dict})
async def logout(request):
    try:
        await sync_to_async(django_logout)(request)
        return JsonResponse({"message":"logged out"}, status=200, safe=False) 
    except Exception as e:
        return JsonResponse({"message":"failed", "error": str(e)}, status=500, safe=False) 

@router.post("/refresh", response=TokenResponseSchema)
def refresh_token(request, payload: dict):
    try:
        refresh = RefreshToken(payload["refresh"])
        return {"access": str(refresh.access_token), "refresh": payload["refresh"]}
    except Exception:
        raise HttpError(401, "Invalid refresh token")

# ===== RECEIPT CODE PROTOCOL (MIGRATED TO ADMISSION SERVICE) =====
from .receipt_schemas import ReceiptCodeVerifySchema

@router.post("/students/verify-receipt-code/", response=dict)
def verify_receipt_code(request, payload: ReceiptCodeVerifySchema):
    """Student endpoint to verify receipt code via admission-service and create LMS account"""
    admission_url = os.environ.get("ADMISSION_SERVICE_URL", "http://admission-service:8003")
    
    try:
        resp = requests.get(f"{admission_url}/api/tests/receipt-codes/verify/{payload.receipt_code}/", timeout=5)
        if resp.status_code == 404:
            raise HttpError(404, "Receipt code not found")
        elif resp.status_code != 200:
            raise HttpError(400, "Error verifying receipt code")
            
        receipt_data = resp.json()
        if receipt_data['student_email'].lower() != payload.email.lower():
            raise HttpError(403, "Email mismatch")
        
        if not receipt_data['added_to_system_at']:
            raise HttpError(400, "Code not yet activated by admin")
        
        if receipt_data['verified']:
            student_id = "ALREADY_ENROLLED"
            try:
                user = User.objects.get(email=receipt_data['student_email'])
                student = Student.objects.get(user=user)
                student_id = student.student_id
            except Exception as lookup_err:
                logger.warning(f"Already verified but student lookup failed: {lookup_err}")

            return {
                "verified": True,
                "message": "Already verified.",
                "lms_credentials": {
                    "username": receipt_data['student_email'],
                    "student_id": student_id,
                }
            }
        
        # Validate course_id before proceeding
        target_course_id = receipt_data.get('course_id')
        if not target_course_id:
            raise HttpError(400, "Receipt code has no course assigned")
        
        with transaction.atomic():
            if User.objects.filter(email=receipt_data['student_email']).exists():
                user = User.objects.get(email=receipt_data['student_email'])
            else:
                user = User.objects.create_user(
                    full_name=payload.full_name or receipt_data['student_name'],
                    cnic=payload.cnic,
                    email=receipt_data['student_email'],
                    phone=payload.phone,
                    password=payload.password,
                    role='student'
                )
            
            student, _ = Student.objects.get_or_create(user=user)
            student.receipt_code = receipt_data['code']
            student.receipt_code_verified = True
            student.lms_account_created = True
            student.lms_user_id = user.id
            if target_course_id:
                student.eligible_course = {"id": str(target_course_id)}
            
            for field in ['gender', 'whatsapp_number', 'study_work_status', 'study_work_details', 'studied_at_idara', 'studying_at_idara', 'signature']:
                setattr(student, field, getattr(payload, field, None))
            student.terms_agreed = payload.is_terms_agreed
            student.status = 'enrolled'
            student.save()

            StudentAcademicRecord.objects.update_or_create(
                student=student,
                defaults={"highest_qualification": payload.last_qualification}
            )
            GuardianInfo.objects.update_or_create(
                student=student,
                defaults={
                    "father_name": payload.father_guardian_name,
                    "father_phone": payload.guardian_contact,
                    "relationship_to_student": payload.relationship_to_student,
                }
            )
            ResidentialInfo.objects.update_or_create(
                student=student,
                defaults={"address": payload.full_address}
            )

        # --- External calls after transaction (no DB lock held) ---

        # Sync receipt verification back to admission-service
        try:
            requests.patch(
                f"{admission_url}/api/tests/receipt-codes/{receipt_data['id']}/",
                json={"verified": True, "lms_account_created": True, "lms_user_id": str(user.id)},
                timeout=5
            )
        except Exception as sync_err:
            logger.error(f"Failed to sync receipt verification: {sync_err}")

        # Mark the EntranceLead as converted in admission-service
        try:
            lead_id = receipt_data.get('lead')
            if not lead_id:
                lead_lookup = requests.get(
                    f"{admission_url}/api/tests/lead/by-email/",
                    params={"email": receipt_data['student_email']},
                    timeout=5
                )
                if lead_lookup.status_code == 200:
                    lead_list = lead_lookup.json()
                    if isinstance(lead_list, list) and lead_list:
                        lead_id = lead_list[0].get('id')
                    elif isinstance(lead_list, dict):
                        lead_id = lead_list.get('id')
            if lead_id:
                requests.post(
                    f"{admission_url}/api/tests/lead/{lead_id}/convert/",
                    json={"lms_user_id": str(user.id)},
                    timeout=5
                )
                logger.info(f"Lead {lead_id} marked as converted for {user.email}")
        except Exception as conv_err:
            logger.warning(f"Could not mark lead as converted: {conv_err}")

        # MQ Event
        try:
            from shared.common.rabbitmq_client import RabbitMQClient
            mq = RabbitMQClient()
            event_data = {
                "student_id": str(user.id),
                "course_id": str(target_course_id),
                "email": user.email,
                "scheduled_class_id": str(receipt_data.get('scheduled_class_id')) if receipt_data.get('scheduled_class_id') else None,
                "branch_id": str(receipt_data.get('branch', {}).get('id')) if isinstance(receipt_data.get('branch'), dict) and receipt_data['branch'].get('id') else None
            }
            mq.publish_event(exchange='lms_events', routing_key='student.enrolled', message=event_data)
        except Exception as mq_err:
            logger.error(f"Failed to publish enrollment event for user {user.id}: {mq_err}")

        return {
            "verified": True,
            "message": "Account created!",
            "user_id": str(user.id),
            "lms_credentials": {
                "student_id": student.student_id,
                "username": user.email,
            }
        }

    except HttpError:
        raise
    except Exception as e:
        logger.error(f"Verification error: {e}")
        raise HttpError(500, "Service error")

@router.get("/students/receipt-status/", response=dict)
def check_receipt_status(request, email: str):
    admission_url = os.environ.get("ADMISSION_SERVICE_URL", "http://admission-service:8003")
    try:
        r_resp = requests.get(f"{admission_url}/api/tests/receipt-codes/", params={"search": email, "page_size": 1}, timeout=5)
        if r_resp.status_code == 200:
            results = r_resp.json().get('results', [])
            if results:
                receipt = results[0]
                return {
                    "test_passed": True,
                    "receipt_code": receipt.get('code'),
                    "receipt_code_in_system": receipt.get('added_to_system_at') is not None,
                    "receipt_verified": receipt.get('verified'),
                    "lms_account_ready": receipt.get('lms_account_created')
                }
        return {"test_passed": False}
    except Exception as e:
        logger.error(f"check_receipt_status failed for {email}: {e}")
        return {"test_passed": False}

class EmailCheckSchema(Schema):
    email: str

@router.post("/check-email-exists/", response=dict)
def check_email_exists(request, payload: EmailCheckSchema):
    return {"exists": User.objects.filter(email=payload.email).exists()}


# ===== STUDENT MANAGEMENT ENDPOINTS =====

from typing import Optional as Opt

class StudentListSchema(Schema):
    id: str
    user_id: str
    full_name: str
    email: str
    phone: str
    student_id: Opt[str] = None
    status: str
    level: Opt[str] = None
    batch: Opt[str] = None
    specialization: Opt[str] = None
    gender: Opt[str] = None
    receipt_code: Opt[str] = None
    receipt_code_verified: bool
    lms_account_created: bool
    created_at: str

@router.get("/students/", response=dict, auth=JWTAuth())
def list_students(request, status: str = "", search: str = "", page: int = 1, page_size: int = 50, organization_id: Optional[str] = None, campus_id: Optional[str] = None):
    """Admin: list all Student records with their User info."""
    user_role = str(getattr(request.auth, 'role', '')).upper()
    if user_role not in ['ADMIN', 'COORDINATOR']:
        raise HttpError(403, "Permission denied")

    qs = Student.objects.select_related(
        'user', 'academic_record', 'guardian_info', 'residential_info'
    ).filter(user__is_deleted=False)

    # 🔹 Multi-Tenancy: Filter by organization_id and campus_id
    if organization_id:
        qs = qs.filter(organization_id=organization_id)
    if campus_id:
        qs = qs.filter(campus_id=campus_id)

    if status:
        qs = qs.filter(status=status)
    if search:
        qs = qs.filter(
            django_models.Q(user__full_name__icontains=search) |
            django_models.Q(user__email__icontains=search) |
            django_models.Q(student_id__icontains=search) |
            django_models.Q(user__phone__icontains=search)
        )

    qs = qs.order_by('-created_at')
    total = qs.count()
    start = (page - 1) * page_size
    students = qs[start:start + page_size]

    results = []
    for s in students:
        results.append({
            "id": str(s.id),
            "user_id": str(s.user.id),
            "full_name": s.user.full_name,
            "email": s.user.email,
            "phone": s.user.phone or "",
            "cnic": s.user.cnic or "",
            "student_id": s.student_id,
            "status": s.status,
            "level": s.level,
            "batch": s.batch,
            "specialization": s.specialization,
            "gender": s.gender,
            "whatsapp_number": s.whatsapp_number,
            "receipt_code": s.receipt_code,
            "receipt_code_verified": s.receipt_code_verified,
            "lms_account_created": s.lms_account_created,
            "terms_agreed": s.terms_agreed,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })

    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "results": results
    }


@router.get("/students/lookup/", response=dict, auth=JWTAuth())
def lookup_student(request, student_id: str):
    """Look up a student by their human-readable student_id (e.g. AIT-PH-2026-WD-1-0001)."""
    student = Student.objects.filter(student_id__iexact=student_id).select_related('user').first()
    if not student:
        raise HttpError(404, "Student not found")
    u = student.user
    if not u:
        raise HttpError(404, "Student user not found")
    return {
        "id": str(u.id),
        "full_name": u.full_name,
        "email": u.email,
        "phone": u.phone or "",
        "cnic": u.cnic or "",
        "student_id": student.student_id,
        "status": student.status,
        "gender": student.gender or "",
        "level": student.level or "",
        "batch": student.batch or "",
        "specialization": student.specialization or "",
    }


@router.get("/students/{student_user_id}/", response=dict, auth=JWTAuth())
def get_student_detail(request, student_user_id: str):
    """Admin/self: full student profile (user + academic + guardian + residential)."""
    auth_id = str(getattr(request.auth, 'id', ''))
    user_role = str(getattr(request.auth, 'role', '')).upper()
    is_self = auth_id == student_user_id
    if not (is_self or user_role in ['ADMIN', 'COORDINATOR']):
        raise HttpError(403, "Permission denied")

    student = get_object_or_404(
        Student.objects.select_related('user', 'academic_record', 'guardian_info', 'residential_info'),
        user__id=student_user_id
    )
    u = student.user
    acad = getattr(student, 'academic_record', None)
    guardian = getattr(student, 'guardian_info', None)
    res = getattr(student, 'residential_info', None)

    return {
        "student_id": student.student_id,
        "status": student.status,
        "level": student.level,
        "batch": student.batch,
        "specialization": student.specialization,
        "gender": student.gender,
        "whatsapp_number": student.whatsapp_number,
        "receipt_code": student.receipt_code,
        "receipt_code_verified": student.receipt_code_verified,
        "lms_account_created": student.lms_account_created,
        "terms_agreed": student.terms_agreed,
        "eligible_course": student.eligible_course,
        "completed_courses": student.completed_courses,
        "studied_at_idara": student.studied_at_idara,
        "studying_at_idara": student.studying_at_idara,
        "user": {
            "id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "phone": u.phone,
            "cnic": u.cnic,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        },
        "academic": {
            "highest_qualification": acad.highest_qualification if acad else None,
            "institute_name": acad.institute_name if acad else None,
            "passing_year": acad.passing_year if acad else None,
            "grade_or_cgpa": acad.grade_or_cgpa if acad else None,
        } if acad else None,
        "guardian": {
            "father_name": guardian.father_name if guardian else None,
            "father_cnic": guardian.father_cnic if guardian else None,
            "father_phone": guardian.father_phone if guardian else None,
            "relationship_to_student": guardian.relationship_to_student if guardian else None,
            "emergency_contact_name": guardian.emergency_contact_name if guardian else None,
            "emergency_contact_phone": guardian.emergency_contact_phone if guardian else None,
        } if guardian else None,
        "residential": {
            "address": res.address if res else None,
            "city": res.city if res else None,
            "state_or_province": res.state_or_province if res else None,
            "country": res.country if res else None,
        } if res else None,
    }
# ===== ADMIN RECEIPT & TRANSFER ENDPOINTS =====

@router.get("/admin/receipt-codes/", response=dict, auth=JWTAuth())
@roles_required(['ADMIN', 'COORDINATOR'])
def list_receipt_codes(request, search: Optional[str] = None, archived: bool = False, page: int = 1, page_size: int = 50):
    admission_url = os.environ.get("ADMISSION_SERVICE_URL", "http://admission-service:8003")
    headers = {'Authorization': request.headers.get('Authorization')}
    
    params = {
        'search': search,
        'archived': str(archived).lower(),
        'page': page,
        'page_size': page_size
    }
    
    try:
        resp = requests.get(f"{admission_url}/api/tests/receipt-codes/", params=params, headers=headers, timeout=10)
        if resp.status_code != 200:
            return {"items": [], "total": 0, "verified_count": 0, "page": page, "page_size": page_size, "pages": 0, "error": resp.text}
        
        data = resp.json()
        # admission-service returns results in DRF paginated format
        items = data.get('results', [])
        total = data.get('count', 0)
        
        # verified_count is not directly returned by the paginated list in admission-service, 
        # but it is available in lead-stats. For now, we'll return the total or fetch stats if needed.
        return {
            "items": items, 
            "total": total, 
            "verified_count": total, # Placeholder or fetch from stats
            "page": page, 
            "page_size": page_size, 
            "pages": (total + page_size - 1) // page_size if total else 0
        }
    except Exception as e:
        raise HttpError(500, f"Error reaching admission-service: {str(e)}")

@router.post("/admin/receipt-codes/add/", response=ReceiptCodeSchema, auth=JWTAuth())
@roles_required(['ADMIN', 'COORDINATOR'])
def create_receipt_code(request, payload: ReceiptCodeCreateSchema):
    admission_url = os.environ.get("ADMISSION_SERVICE_URL", "http://admission-service:8003")
    headers = {'Authorization': request.headers.get('Authorization')}
    
    try:
        resp = requests.post(f"{admission_url}/api/tests/receipt-codes/add/", json=payload.model_dump(mode='json'), headers=headers, timeout=10)
        if resp.status_code == 400:
            raise HttpError(400, resp.json().get('detail', 'Validation error in admission-service'))
        elif resp.status_code != 201:
            raise HttpError(resp.status_code, f"Admission-service error: {resp.text}")
            
        return resp.json()
    except requests.exceptions.RequestException as e:
        raise HttpError(500, f"Cannot reach admission-service: {str(e)}")

@router.patch("/admin/receipt-codes/{code_id}/", response=ReceiptCodeSchema, auth=JWTAuth())
@roles_required(['ADMIN', 'COORDINATOR'])
def update_receipt_code(request, code_id: uuid.UUID, payload: dict = Body(...)):
    admission_url = os.environ.get("ADMISSION_SERVICE_URL", "http://admission-service:8003")
    headers = {'Authorization': request.headers.get('Authorization')}
    
    try:
        resp = requests.patch(f"{admission_url}/api/tests/receipt-codes/{code_id}/", json=payload, headers=headers, timeout=10)
        if resp.status_code != 200:
            raise HttpError(resp.status_code, f"Admission-service error: {resp.text}")
        return resp.json()
    except Exception as e:
        raise HttpError(500, f"Error reaching admission-service: {str(e)}")

@router.delete("/admin/receipt-codes/{code_id}/", auth=JWTAuth())
@roles_required(['ADMIN', 'COORDINATOR'])
def delete_receipt_code(request, code_id: uuid.UUID):
    admission_url = os.environ.get("ADMISSION_SERVICE_URL", "http://admission-service:8003")
    headers = {'Authorization': request.headers.get('Authorization')}
    
    try:
        resp = requests.delete(f"{admission_url}/api/tests/receipt-codes/{code_id}/", headers=headers, timeout=10)
        if resp.status_code not in (200, 204):
            raise HttpError(resp.status_code, f"Admission-service error: {resp.text}")
        return {"message": "Receipt deleted"}
    except Exception as e:
        raise HttpError(500, f"Error reaching admission-service: {str(e)}")

@router.post("/admin/receipt-codes/{code_id}/restore/", auth=JWTAuth())
@roles_required(['ADMIN', 'COORDINATOR'])
def restore_receipt_code(request, code_id: uuid.UUID):
    admission_url = os.environ.get("ADMISSION_SERVICE_URL", "http://admission-service:8003")
    headers = {'Authorization': request.headers.get('Authorization')}
    
    try:
        resp = requests.post(f"{admission_url}/api/tests/receipt-codes/{code_id}/restore/", headers=headers, timeout=10)
        if resp.status_code != 200:
            raise HttpError(resp.status_code, f"Admission-service error: {resp.text}")
        return {"message": "Receipt restored"}
    except Exception as e:
        raise HttpError(500, f"Error reaching admission-service: {str(e)}")

@router.patch("/admin/receipt-codes/{code_id}/process-return/", response=ReceiptCodeSchema, auth=JWTAuth())
@roles_required(['ADMIN', 'COORDINATOR'])
def process_receipt_return(request, code_id: uuid.UUID, payload: dict = Body(...)):
    admission_url = os.environ.get("ADMISSION_SERVICE_URL", "http://admission-service:8003")
    headers = {'Authorization': request.headers.get('Authorization')}
    
    try:
        resp = requests.patch(f"{admission_url}/api/tests/receipt-codes/{code_id}/process-return/", json=payload, headers=headers, timeout=10)
        if resp.status_code != 200:
            raise HttpError(resp.status_code, f"Admission-service error: {resp.text}")
        return resp.json()
    except Exception as e:
        raise HttpError(500, f"Error reaching admission-service: {str(e)}")

@router.get("/admin/transfers/", response=List[dict], auth=JWTAuth())
@roles_required(['ADMIN', 'COORDINATOR'])
def list_transfers(request):
    transfers = StudentTransferHistory.objects.select_related('student__user', 'receipt_code').all().order_by('-transferred_at')
    res = []
    for t in transfers:
        res.append({
            "id": str(t.id),
            "student_name": t.student.user.full_name,
            "student_email": t.student.user.email,
            "receipt_code": t.receipt_code.code,
            "from_course_id": str(t.from_course_id),
            "to_course_id": str(t.to_course_id),
            "reason": t.reason,
            "transferred_at": t.transferred_at.isoformat(),
            "transferred_by": t.transferred_by.full_name if t.transferred_by else "System"
        })
    return res

@router.post("/admin/receipt-codes/{code_id}/transfer/", response=dict, auth=JWTAuth())
@roles_required(['ADMIN', 'COORDINATOR'])
def transfer_receipt_code(request, code_id: uuid.UUID, payload: ReceiptCodeTransferSchema):
    receipt = get_object_or_404(ReceiptCode, id=code_id)
    
    old_course_id = receipt.course_id
    receipt.course_id = payload.new_course_id
    receipt.scheduled_class_id = payload.new_scheduled_class_id
    receipt.save()
    
    # Log transfer history
    try:
        student = Student.objects.get(user__email=receipt.student_email)
        StudentTransferHistory.objects.create(
            student=student,
            receipt_code=receipt,
            from_course_id=old_course_id,
            to_course_id=payload.new_course_id,
            from_section_id=payload.old_scheduled_class_id,
            to_section_id=payload.new_scheduled_class_id,
            reason=payload.reason,
            transferred_by=request.auth
        )
    except Student.DoesNotExist:
        pass # If student hasn't created account yet, we just update the receipt
        
    return {"message": "Receipt transferred successfully"}

# ────────────────────────────────────────────────────────────────────────────
# LEAD ENDPOINTS
# ────────────────────────────────────────────────────────────────────────────

@router.post("/lead/login", response=dict, auth=None)
def lead_login(request, payload: LeadLoginSchema):
    credential = (payload.credential or payload.email or '').strip().lower()
    lockout_key = f"lead_lockout_{credential}"
    attempts_key = f"lead_attempts_{credential}"

    if cache.get(lockout_key):
        raise HttpError(403, "Too many failed attempts. Please wait 5 minutes.")

    auth_email = credential
    if '@' not in credential:
        user = None
        try:
            user = User.objects.filter(cnic__iexact=credential).exclude(cnic='').first()
        except Exception:
            pass
        if not user:
            try:
                student = Student.objects.filter(student_id__iexact=credential).select_related('user').first()
                if student and student.user:
                    user = student.user
            except Exception:
                pass
        if not user:
            try:
                lookup = requests.post(
                    f"{os.environ.get('ADMISSION_SERVICE_URL', 'http://admission-service:8003')}/api/tests/lead/lookup/",
                    json={'email': credential} if '@' in credential else {'seq_id': credential},
                    timeout=5
                )
                if lookup.status_code == 200:
                    lead_email = lookup.json().get('email')
                    if lead_email:
                        user = User.objects.filter(email__iexact=lead_email).first()
            except Exception:
                pass
        if user:
            auth_email = user.email

    user = authenticate(email=auth_email, password=payload.password)
    if not user:
        attempts = cache.get(attempts_key, 0) + 1
        cache.set(attempts_key, attempts, timeout=600)
        if attempts >= 5:
            cache.set(lockout_key, True, timeout=300)
        raise HttpError(401, f"Invalid credentials. Attempt {attempts}/5")

    if user.role != 'lead':
        cache.delete(attempts_key)
        cache.delete(lockout_key)
        tokens = generate_access_token(user)
        return {
            "user": user_to_schema(user),
            "access": tokens["access"],
            "refresh": tokens["refresh"],
            "account_type": user.role,
        }

    cache.delete(attempts_key)
    cache.delete(lockout_key)
    tokens = generate_access_token(user)

    lead_info = {}
    try:
        lookup = requests.post(
            f"{os.environ.get('ADMISSION_SERVICE_URL', 'http://admission-service:8003')}/api/tests/lead/lookup/",
            json={'email': user.email}, timeout=5
        )
        if lookup.status_code == 200:
            lead_info = lookup.json()
    except Exception:
        pass

    return {
        "user": user_to_schema(user),
        "access": tokens["access"],
        "refresh": tokens["refresh"],
        "account_type": "lead",
        "lead": lead_info,
    }


@router.get("/lead/profile/", response=dict, auth=JWTAuth())
def lead_profile(request):
    user = request.auth
    if user.role not in ['lead', 'student', 'admin', 'coordinator']:
        raise HttpError(403, "Access denied.")

    result = {
        "id": str(user.id),
        "full_name": user.full_name,
        "email": user.email,
        "phone": user.phone or "",
        "cnic": user.cnic or "",
        "role": user.role,
    }

    try:
        lookup = requests.post(
            f"{os.environ.get('ADMISSION_SERVICE_URL', 'http://admission-service:8003')}/api/tests/lead/lookup/",
            json={'email': user.email}, timeout=5
        )
        if lookup.status_code == 200:
            data = lookup.json()
            result.update({
                "lead_auto_id": data.get('lead_auto_id'),
                "course_name_requested": data.get('course_name_requested', ''),
                "course_id": str(data.get('course_id')) if data.get('course_id') else None,
                "test_score": data.get('test_score'),
                "status": data.get('status', 'pending'),
                "has_paid_deposit": data.get('has_paid_deposit', False),
                "converted_to_student": data.get('converted_to_student', False),
                "created_at": str(data.get('created_at', '')) if data.get('created_at') else None,
                "scheduled_class_id": str(data.get('scheduled_class_id')) if data.get('scheduled_class_id') else None,
            })

            course_id = data.get('course_id')
            if course_id:
                try:
                    courses_resp = requests.get(
                        f"{os.environ.get('COURSE_SERVICE_URL', 'http://course-service:8002')}/api/courses/courses/{course_id}/",
                        timeout=5
                    )
                    if courses_resp.status_code == 200:
                        course = courses_resp.json()
                        result["course_name"] = course.get('name', '')
                        result["course_code"] = course.get('course_code', '')
                except Exception:
                    pass
    except Exception as e:
        result["lead_error"] = str(e)

    return result


@router.post("/lead/change-course/", response=dict, auth=JWTAuth())
def lead_change_course(request, payload: LeadCourseChangeSchema):
    user = request.auth
    if user.role != 'lead':
        raise HttpError(403, "Only lead users can change their course.")

    try:
        lookup = requests.post(
            f"{os.environ.get('ADMISSION_SERVICE_URL', 'http://admission-service:8003')}/api/tests/lead/lookup/",
            json={'email': user.email}, timeout=5
        )
        if lookup.status_code != 200:
            raise HttpError(404, "Lead not found in admission system.")
        lead_data = lookup.json()
        lead_id = lead_data.get('id')
    except Exception:
        raise HttpError(500, "Could not fetch lead data from admission service.")

    if lead_data.get('has_paid_deposit', False):
        raise HttpError(400, "Cannot change course after deposit has been paid. Contact admin.")

    try:
        resp = requests.patch(
            f"{os.environ.get('ADMISSION_SERVICE_URL', 'http://admission-service:8003')}/api/tests/lead/{lead_id}/",
            json={
                'course_id': str(payload.course_id),
                'course_name_requested': payload.course_name or '',
                'test_score': None,
                'status': 'pending',
                'test_attempt_id': None,
            },
            timeout=5
        )
        if resp.status_code == 200:
            return {"message": "Course changed successfully.", "course_id": str(payload.course_id)}
        raise HttpError(400, f"Failed to update course: {resp.text[:200]}")
    except HttpError:
        raise
    except Exception as e:
        raise HttpError(500, f"Could not update course: {e}")


@router.get("/lead/test-history/", response=dict, auth=JWTAuth())
def lead_test_history(request):
    user = request.auth
    if user.role != 'lead':
        raise HttpError(403, "Access denied.")

    try:
        lookup = requests.post(
            f"{os.environ.get('ADMISSION_SERVICE_URL', 'http://admission-service:8003')}/api/tests/lead/lookup/",
            json={'email': user.email}, timeout=5
        )
        if lookup.status_code != 200:
            return {"attempts": [], "lead": None}
        lead_data = lookup.json()
    except Exception:
        return {"attempts": [], "lead": None}

    attempts = []
    lead_id = lead_data.get('id')
    if lead_id:
        try:
            stats = requests.get(
                f"{os.environ.get('ADMISSION_SERVICE_URL', 'http://admission-service:8003')}/api/tests/lead-stats/",
                timeout=5
            )
        except Exception:
            pass

        try:
            test_attempts = requests.get(
                f"{os.environ.get('ADMISSION_SERVICE_URL', 'http://admission-service:8003')}/api/tests/attempts/?user_id={user.id}",
                timeout=5
            )
            if test_attempts.status_code == 200:
                attempts = test_attempts.json().get('attempts', [])
        except Exception:
            pass

    return {
        "lead": lead_data,
        "attempts": attempts,
        "test_score": lead_data.get('test_score'),
        "status": lead_data.get('status'),
    }
