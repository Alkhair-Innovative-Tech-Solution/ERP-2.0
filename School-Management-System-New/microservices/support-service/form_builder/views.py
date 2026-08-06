from rest_framework import viewsets, permissions
from .models import FormTemplate
from .serializers import FormTemplateSerializer
from central_auth.authentication import CentralAuthUser
from support_service.dual_auth import (
    DualServiceSubscribed, DualRequiresPermission, get_org_and_tenant, central_tenant_qs,
)

# Phase C6 endpoint -> sms.* permission map (see
# docs/PHASE_C6_SUPPORT_SERVICE_RESULT.md). Central auth's catalog has no
# form-shaped permission at all — referenced but NOT added from this
# support-service-scoped task, fail-closed.
FORM_MANAGE_PERM = 'sms.form.manage'


class FormTemplateViewSet(viewsets.ModelViewSet):
    queryset = FormTemplate.objects.all()
    serializer_class = FormTemplateSerializer
    lookup_field = 'name'

    def get_permissions(self):
        if self.action in ['list', 'retrieve']:
            # Legacy: unchanged (IsAuthenticated only, no extra perm).
            # Central-auth: same "no special perm needed" pattern as every
            # prior phase's reads — gated by subscription only.
            return [permissions.IsAuthenticated(), DualServiceSubscribed()]
        # Legacy: IsAdminUser (checks request.user.is_staff) — unchanged.
        # CentralAuthUser has no .is_staff attribute at all (IsAdminUser
        # would raise AttributeError on it) — use DualRequiresPermission
        # instead on that path.
        if isinstance(self.request.user, CentralAuthUser):
            return [permissions.IsAuthenticated(), DualServiceSubscribed(), DualRequiresPermission(FORM_MANAGE_PERM)()]
        return [permissions.IsAdminUser()]  # Only admins/principals can create/edit templates

    def get_queryset(self):
        user = self.request.user
        if isinstance(user, CentralAuthUser):
            # FormTemplate.objects is OrganizationManager-backed — empty
            # for a central-auth request (see support_service/dual_auth.py's
            # module docstring).
            return central_tenant_qs(FormTemplate.all_objects.all(), user)
        return FormTemplate.objects.all()

    def perform_create(self, serializer):
        user = self.request.user
        if isinstance(user, CentralAuthUser):
            _, tenant_id = get_org_and_tenant(user)
            serializer.save(organization=None, tenant_id=tenant_id)
        else:
            # Legacy: unchanged — organization was never auto-populated
            # here (the client supplies it directly, or it stays None),
            # matching the original code's complete absence of a
            # perform_create override.
            serializer.save()
