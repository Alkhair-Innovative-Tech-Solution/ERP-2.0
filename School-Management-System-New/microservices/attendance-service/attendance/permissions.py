from rest_framework import permissions
from django.contrib.auth import get_user_model
from .models import Attendance

User = get_user_model()

# Roles that bypass the RolePermission table entirely (master roles).
# Mirrors users.permissions.HasDynamicPermission, plus 'admin' — which
# scope_resolver already treats as org_admin.
MASTER_ROLES = ('superadmin', 'org_admin', 'admin')


class HasAttendanceViewPermission(permissions.BasePermission):
    """
    Gate for the Unified Attendance Review endpoint.

    Legacy (HS256): checks the `view_attendance` toggle in the RolePermission
    table, which Org Admins control per-role. Fails closed: no row = no
    access. UNCHANGED by Phase D-b6 — still a live per-request `auth_db`
    read, kept until auth-8001/HS256 is actually retired.

    Central-auth (RS256): Phase D-b6 — resolves purely from the token's own
    `perms` claim (built in the C-phase RBAC work), zero database calls. See
    CENTRAL_PERM_CODENAME below for the catalog-gap caveat.

    Note this is deliberately narrower than CanViewAttendance below, which
    hardcodes role names and ignores the toggle entirely.
    """

    # Plain string, not a dict: DRF wraps this in PermissionDenied, and
    # utils.exceptions.custom_exception_handler lifts a bare `detail` into
    # error.message. A dict here gets buried in error.details instead, and the
    # client shows the generic "You do not have permission" text.
    # The resulting error.code is FORBIDDEN — the specific codes below this
    # layer (SCOPE_EMPTY, ROLL_ACCESS_DENIED, …) come from _error() instead.
    message = 'You do not have permission to view attendance records.'

    # Phase D-b6: the sms.* catalog permission this maps to for a
    # central-auth request. NOT currently in the catalog — read
    # permissions/sms_catalog.py in full (central auth) and confirmed
    # SMS_PERMISSIONS has no sms.attendance.* entry at all (only
    # sms.assignment.*, sms.fee.*, sms.result.view). Deliberately NOT
    # invented here — kept as the intended codename so adding it later is a
    # catalog-only change. Until it exists, CentralAuthUser.has_perm() below
    # can only ever return True via its own unconditional is_superadmin
    # bypass; every other central role fails closed, which is correct: a
    # permission that doesn't exist in the catalog cannot be granted, so
    # denying is the honest answer, not a bug.
    CENTRAL_PERM_CODENAME = 'sms.attendance.view'

    def has_permission(self, request, view):
        user = request.user
        if not (user and user.is_authenticated):
            return False

        from central_auth.authentication import CentralAuthUser
        if isinstance(user, CentralAuthUser):
            # Central path: token-only, no DB call. has_perm() already
            # bypasses for is_superadmin — that's the MASTER_ROLES-equivalent
            # here. Central tokens carry no generic role string reliable
            # enough to match legacy's org_admin/admin bypass (CentralAuthUser
            # has no .role attribute at all — only .vms_role, which is only
            # populated for VMS/HDMS logins), so that part of MASTER_ROLES
            # isn't replicated; flagged in the result doc rather than faked.
            return user.has_perm(self.CENTRAL_PERM_CODENAME)

        # Legacy (HS256) path — UNCHANGED from before Phase D-b6.
        if getattr(user, 'is_superuser', False) or getattr(user, 'role', '') in MASTER_ROLES:
            return True

        # RolePermission rows live in auth_db and are NOT synced here, and the
        # JWT _TokenUser has org_id rather than an organization FK — so read
        # the toggle cross-DB instead of via the local (empty) table.
        org_id = getattr(user, 'organization_id', None) or getattr(user, 'org_id', None)
        if not org_id:
            return False
        import os
        try:
            import psycopg2
            conn = psycopg2.connect(
                host=os.environ.get('AUTH_DB_HOST', 'postgres-auth'),
                dbname=os.environ.get('AUTH_DB_NAME', 'auth_db'),
                user=os.environ.get('AUTH_DB_USER', 'auth_user'),
                password=os.environ.get('AUTH_DB_PASSWORD', 'auth_pass'),
                connect_timeout=5,
            )
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT 1 FROM users_role_permission "
                        "WHERE organization_id = %s AND role = %s "
                        "AND permission_codename = 'view_attendance' AND is_allowed = true "
                        "LIMIT 1",
                        (org_id, user.role),
                    )
                    return cur.fetchone() is not None
            finally:
                conn.close()
        except Exception:
            # Fail closed, same as a missing RolePermission row.
            return False


class CanMarkAttendance(permissions.BasePermission):
    """
    Permission class for marking attendance
    - Teachers can mark for their assigned classroom only
    - Coordinators can mark for classrooms in their level
    - Principals can mark for classrooms in their campus
    - SuperAdmins can mark for any classroom
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # SuperAdmin can mark any attendance
        if request.user.is_superuser:
            return True
        
        # Check if user has teacher profile
        if request.user.is_teacher():
            try:
                from teachers.models import Teacher
                teacher = Teacher.objects.get(email=request.user.email)
                if teacher and teacher.assigned_classroom:
                    return True
            except:
                pass
        
        # Check if user has coordinator profile
        if request.user.is_coordinator():
            try:
                from coordinator.models import Coordinator
                coordinator = Coordinator.get_for_user(request.user)
                if coordinator and coordinator.is_currently_active:
                    return True
            except:
                pass
        
        # Check if user has principal profile
        if request.user.is_principal():
            try:
                from principals.models import Principal
                principal = Principal.objects.get(email=request.user.email)
                if principal and principal.is_currently_active:
                    return True
            except:
                pass
        
        return False
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # SuperAdmin can mark any attendance
        if request.user.is_superuser:
            return True
        
        # Check teacher permissions
        if request.user.is_teacher():
            try:
                from teachers.models import Teacher
                teacher = Teacher.objects.get(email=request.user.email)
                if teacher and teacher.assigned_classroom == obj.classroom:
                    return True
            except:
                pass
        
        # Check coordinator permissions
        if request.user.is_coordinator():
            try:
                from coordinator.models import Coordinator
                coordinator = Coordinator.get_for_user(request.user)
                if (coordinator and coordinator.is_currently_active and 
                    coordinator.level == obj.classroom.grade.level):
                    return True
            except:
                pass
        
        # Check principal permissions
        if request.user.is_principal():
            try:
                from principals.models import Principal
                principal = Principal.objects.get(email=request.user.email)
                if (principal and principal.is_currently_active and 
                    principal.campus == obj.classroom.campus):
                    return True
            except:
                pass
        
        return False


class CanEditAttendance(permissions.BasePermission):
    """
    Permission class for editing attendance
    - Teachers can edit their own attendance within 7 days
    - Coordinators+ can edit any attendance in their scope
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # SuperAdmin can edit any attendance
        if request.user.is_superuser:
            return True
        
        # Check if user has teacher, coordinator, or principal profile
        return (request.user.is_teacher() or 
                request.user.is_coordinator() or 
                request.user.is_principal())
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # SuperAdmin can edit any attendance
        if request.user.is_superuser:
            return True
        
        # Check if attendance is editable (within 7 days and not final)
        if not obj.is_editable:
            # Only coordinators+ can edit old attendance
            if request.user.is_coordinator() or request.user.is_principal():
                # Check scope permissions
                if request.user.is_coordinator():
                    try:
                        from coordinator.models import Coordinator
                        coordinator = Coordinator.get_for_user(request.user)
                        return (coordinator and coordinator.is_currently_active and 
                               coordinator.level == obj.classroom.grade.level)
                    except:
                        pass
                elif request.user.is_principal():
                    try:
                        from principals.models import Principal
                        principal = Principal.objects.get(email=request.user.email)
                        return (principal and principal.is_currently_active and 
                               principal.campus == obj.classroom.campus)
                    except:
                        pass
            return False
        
        # For recent attendance, check if user can edit
        # Teacher can edit their own classroom's attendance
        if request.user.is_teacher():
            try:
                from teachers.models import Teacher
                teacher = Teacher.objects.get(email=request.user.email)
                if teacher and teacher.assigned_classroom == obj.classroom:
                    return True
            except:
                pass
        
        # Coordinator can edit classrooms in their level
        if request.user.is_coordinator():
            try:
                from coordinator.models import Coordinator
                coordinator = Coordinator.get_for_user(request.user)
                if (coordinator and coordinator.is_currently_active and 
                    coordinator.level == obj.classroom.grade.level):
                    return True
            except:
                pass
        
        # Principal can edit classrooms in their campus
        if request.user.is_principal():
            try:
                from principals.models import Principal
                principal = Principal.objects.get(email=request.user.email)
                if (principal and principal.is_currently_active and 
                    principal.campus == obj.classroom.campus):
                    return True
            except:
                pass
        
        return False


class CanViewAttendance(permissions.BasePermission):
    """
    Permission class for viewing attendance
    - Teachers can view their own classroom's attendance
    - Coordinators can view classrooms in their level
    - Principals can view classrooms in their campus
    - SuperAdmins can view all attendance
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # All authenticated users with profiles can view attendance
        return (request.user.is_teacher() or 
                request.user.is_coordinator() or 
                request.user.is_principal() or 
                request.user.is_superuser)
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # SuperAdmin can view any attendance
        if request.user.is_superuser:
            return True
        
        # Teacher can view their own classroom's attendance
        if request.user.is_teacher():
            try:
                from teachers.models import Teacher
                teacher = Teacher.objects.get(email=request.user.email)
                if teacher and teacher.assigned_classroom == obj.classroom:
                    return True
            except:
                pass
        
        # Coordinator can view classrooms in their level
        if request.user.is_coordinator():
            try:
                from coordinator.models import Coordinator
                coordinator = Coordinator.get_for_user(request.user)
                if (coordinator and coordinator.is_currently_active and 
                    coordinator.level == obj.classroom.grade.level):
                    return True
            except:
                pass
        
        # Principal can view classrooms in their campus
        if request.user.is_principal():
            try:
                from principals.models import Principal
                principal = Principal.objects.get(email=request.user.email)
                if (principal and principal.is_currently_active and 
                    principal.campus == obj.classroom.campus):
                    return True
            except:
                pass
        
        return False


class CanDeleteAttendance(permissions.BasePermission):
    """
    Permission class for deleting attendance
    - Only Coordinators+ can delete attendance
    - Requires reason for deletion
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # SuperAdmin can delete any attendance
        if request.user.is_superuser:
            return True
        
        # Only coordinators and principals can delete
        return (request.user.is_coordinator() or 
                request.user.is_principal())
    
    def has_object_permission(self, request, view, obj):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # SuperAdmin can delete any attendance
        if request.user.is_superuser:
            return True
        
        # Coordinator can delete attendance in their level
        if request.user.is_coordinator():
            try:
                from coordinator.models import Coordinator
                coordinator = Coordinator.get_for_user(request.user)
                if (coordinator and coordinator.is_currently_active and 
                    coordinator.level == obj.classroom.grade.level):
                    return True
            except:
                pass
        
        # Principal can delete attendance in their campus
        if request.user.is_principal():
            try:
                from principals.models import Principal
                principal = Principal.objects.get(email=request.user.email)
                if (principal and principal.is_currently_active and 
                    principal.campus == obj.classroom.campus):
                    return True
            except:
                pass
        
        return False


class CanExportAttendance(permissions.BasePermission):
    """
    Permission class for exporting attendance reports
    - Teachers can export their own classroom's reports
    - Coordinators can export their level's reports
    - Principals can export their campus's reports
    - SuperAdmins can export all reports
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        # All authenticated users with profiles can export
        return (request.user.is_teacher() or 
                request.user.is_coordinator() or 
                request.user.is_principal() or 
                request.user.is_superuser)