from django.db import transaction
from rest_framework import viewsets, decorators, response, permissions, status
from rest_framework.exceptions import PermissionDenied
from .models import Campus
from .serializers import CampusSerializer
from central_auth.authentication import CentralAuthUser
from campus_service.dual_auth import (
    DualServiceSubscribed, DualRequiresPermission,
    user_is_superadmin, get_org_and_tenant, central_tenant_qs,
)

# Phase C5 endpoint -> sms.* permission map (see
# docs/PHASE_C5_CAMPUS_SERVICE_RESULT.md). Central auth's catalog
# (permissions.sms_catalog.SMS_PERMISSIONS, Phase B3) has no campus-shaped
# permission at all — sms.campus.manage is referenced but NOT added from
# this campus-service-scoped task, fail-closed: every non-superadmin
# central-auth token 403s on campus writes. Reads (list/retrieve/summary/
# facilities/active) are gated by DualServiceSubscribed only, matching
# "endpoints requiring no special perm should work" from the C1-C4 recipe.
CAMPUS_MANAGE_PERM = 'sms.campus.manage'


def _publish_campus(routing_key, campus):
    try:
        from ams_shared.events.publisher import publish_event
        publish_event(routing_key, {
            'id': campus.id,
            'campus_name': campus.campus_name,
            'campus_code': campus.campus_code,
            'status': campus.status,
            'organization_id': campus.organization_id,
        })
    except Exception as e:
        print(f'[WARN] {routing_key}: {e}')


class CampusViewSet(viewsets.ModelViewSet):
    queryset = Campus.objects.all()
    serializer_class = CampusSerializer
    permission_classes = [permissions.IsAuthenticated, DualServiceSubscribed]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [permissions.IsAuthenticated(), DualServiceSubscribed(), DualRequiresPermission(CAMPUS_MANAGE_PERM)()]
        return super().get_permissions()

    def _get_org(self):
        """Return org object or None. Legacy path only — unchanged (same
        two-fallback shape as before). Central-auth path uses
        get_org_and_tenant() directly instead (see get_queryset/perform_create)."""
        from users.middleware import get_current_organization
        org = getattr(self.request.user, 'organization', None) or get_current_organization()
        return org

    def get_queryset(self):
        user = self.request.user
        is_central = isinstance(user, CentralAuthUser)

        if is_central:
            # Campus.objects is OrganizationManager-backed — empty for a
            # central-auth request (see campus_service/dual_auth.py's
            # module docstring). No role/principal_type claim exists on
            # CentralAuthUser yet (same gap flagged since B3/C1-C4), so the
            # legacy role-based branches below (principal/coordinator see
            # only their own campus) have no central-auth equivalent —
            # every non-superadmin central-auth token sees every campus in
            # its tenant, flagged in docs/PHASE_C5_CAMPUS_SERVICE_RESULT.md.
            queryset = central_tenant_qs(Campus.all_objects.all(), user)
            return queryset

        queryset = Campus.objects.all()

        if user.is_superadmin():
            return queryset

        org = self._get_org()
        if org:
            if user.role in ['superadmin', 'admin', 'org_admin']:
                return queryset
            # Principal sees only their assigned campus; fall back to org campuses if campus_id not set
            if user.role == 'principal':
                campus_id = getattr(user, 'campus_id', None) or getattr(getattr(user, 'campus', None), 'id', None)
                if campus_id:
                    return queryset.filter(id=campus_id)
                org_id = getattr(org, 'pk', None) or getattr(user, 'org_id', None)
                if org_id:
                    return queryset.filter(organization_id=org_id)
                return queryset.none()
            # Coordinator sees only their campus; fall back to org campuses if campus_id not set
            if user.role == 'coordinator':
                campus_id = getattr(user, 'campus_id', None) or getattr(getattr(user, 'campus', None), 'id', None)
                if campus_id:
                    return queryset.filter(id=campus_id)
                org_id = getattr(org, 'pk', None) or getattr(user, 'org_id', None)
                if org_id:
                    return queryset.filter(organization_id=org_id)
            return queryset

        # No org context — restrict to assigned campus if available
        campus_id = getattr(user, 'campus_id', None) or getattr(getattr(user, 'campus', None), 'id', None)
        if campus_id:
            return queryset.filter(id=campus_id)

        return queryset.none()

    def perform_create(self, serializer):
        """Auto-assign organization and enforce campus quota from plan."""
        user = self.request.user

        if isinstance(user, CentralAuthUser):
            # No local org_id/.organization on this token — stamp tenant_id
            # instead, leave organization null (see C1's _get_org note).
            # Quota enforcement (org.max_campuses) has no central-auth
            # equivalent — Organization rows created via central-auth writes
            # are never populated (organization=None throughout this dual-run
            # recipe), so there's nothing to check a quota against here;
            # flagged, not silently skipped.
            if not user_is_superadmin(user):
                _, tenant_id = get_org_and_tenant(user)
                campus = serializer.save(organization=None, tenant_id=tenant_id)
            else:
                campus = serializer.save()
            _publish_campus('campus.created', campus)
            return

        if not user.is_superadmin():
            org = self._get_org()
            if not org:
                raise PermissionDenied("You are not associated with any organization.")

            current_count = Campus.objects.filter(organization=org).count()
            if current_count >= org.max_campuses:
                raise PermissionDenied(
                    f"Campus quota exceeded. Your plan allows a maximum of "
                    f"{org.max_campuses} campus(es). You already have {current_count}. "
                    f"Please upgrade your subscription to add more campuses."
                )

            campus = serializer.save(organization=org)
        else:
            campus = serializer.save()
        _publish_campus('campus.created', campus)

    def perform_update(self, serializer):
        campus = serializer.save()
        _publish_campus('campus.updated', campus)

    # ✅ Custom endpoint: campus summary
    @decorators.action(detail=True, methods=["get"])
    def summary(self, request, pk=None):
        campus = self.get_object()
        data = {
            "campus_name": campus.campus_name,
            "campus_code": campus.campus_code,
            "campus_type": campus.campus_type,
            "city": campus.city,
            "student_capacity": campus.student_capacity,
            "status": campus.status,
        }
        return response.Response(data)

    # ✅ Custom endpoint: facilities list
    @decorators.action(detail=True, methods=["get"])
    def facilities(self, request, pk=None):
        campus = self.get_object()
        data = {
            "power_backup": campus.power_backup,
            "internet_available": campus.internet_available,
            "canteen_facility": campus.canteen_facility,
            "library_available": campus.library_available,
            "teacher_transport": campus.teacher_transport,
            "student_transport": campus.student_transport,
            "meal_program": campus.meal_program,
            "sports_available": campus.sports_available,
            "num_computer_labs": campus.num_computer_labs,
            "num_science_labs": campus.num_science_labs,
            "num_biology_labs": campus.num_biology_labs,
            "num_chemistry_labs": campus.num_chemistry_labs,
            "num_physics_labs": campus.num_physics_labs,
            "washrooms": {
                "male_teachers": campus.male_teachers_washrooms,
                "female_teachers": campus.female_teachers_washrooms,
                "male_students": campus.male_student_washrooms,
                "female_students": campus.female_student_washrooms,
                "total": campus.total_washrooms,
            }
        }
        return response.Response(data)

    # ✅ Custom endpoint: only active campuses
    @decorators.action(detail=False, methods=["get"])
    def active(self, request):
        # Legacy: unchanged — Campus.objects.filter(...) already relies on
        # OrganizationManager's contextvar scoping (same as before, no
        # role restriction applied here, unlike list()/get_queryset()).
        # Central-auth: same blind spot as everywhere else in this module
        # (Campus.objects is empty on this path) — central_tenant_qs instead.
        user = request.user
        if isinstance(user, CentralAuthUser):
            campuses = central_tenant_qs(Campus.all_objects.filter(status="active"), user)
        else:
            campuses = Campus.objects.filter(status="active")
        serializer = self.get_serializer(campuses, many=True)
        return response.Response(serializer.data)