from rest_framework import serializers
from .models import FormTemplate

class FormTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = FormTemplate
        fields = '__all__'
        # Phase C6: tenant_id/central_org_id are stamped server-side only
        # (form_builder/views.py's perform_create) — never client-
        # suppliable, same reasoning as every central_*_id field added in
        # C1-C5 (e.g. C5's CampusSerializer, the first one in this recipe
        # to need read_only_fields added to a fields='__all__' serializer).
        read_only_fields = ['tenant_id', 'central_org_id']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # `organization`'s auto-derived PrimaryKeyRelatedField queryset
        # defaults to Organization.objects.all() — OrganizationManager-
        # filtered, empty for a central-auth request (same blind spot as
        # C3/C4/C5's PrimaryKeyRelatedField fix). perform_create always
        # overwrites organization=None on that path regardless, but a
        # central-auth client that happens to supply `organization` in the
        # payload would otherwise get a spurious "object does not exist"
        # at validation time, before perform_create ever runs.
        from central_auth.authentication import CentralAuthUser
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if isinstance(user, CentralAuthUser) and 'organization' in self.fields:
            from users.models import Organization
            self.fields['organization'].queryset = Organization.all_objects.all()
