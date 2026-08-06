from rest_framework import serializers
from central_auth.authentication import CentralAuthUser
from campus.models import Campus
from .models import Notification, Announcement


class NotificationSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            'id', 'recipient', 'actor', 'actor_name', 'verb', 'target_text', 'data', 'unread', 'timestamp'
        ]
        read_only_fields = ['id', 'recipient', 'actor_name', 'timestamp']
        # Phase C7: `actor` is left writable (pre-existing) but has no live
        # exploitable path: `recipient` is read_only and non-nullable at the
        # DB level, so any client POST to this ViewSet already fails with an
        # IntegrityError regardless of `actor`, for both token types.
        # Confirmed by reading NotificationViewSet.perform_create (just
        # `serializer.save()`, no recipient injected). Not touched.

    def get_actor_name(self, obj):
        try:
            return str(obj.actor)
        except Exception:
            return None


class AnnouncementSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField()
    campus_name = serializers.CharField(source='campus.campus_name', read_only=True)

    class Meta:
        model = Announcement
        fields = [
            'id', 'title', 'body', 'priority', 'audience',
            'campus', 'campus_name', 'is_active', 'expires_at',
            'created_by', 'created_by_name', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Phase C7: `campus` is a PrimaryKeyRelatedField auto-derived from
        # the model FK, so DRF built its queryset from Campus.objects —
        # campus-service's OrganizationManager, which returns queryset.none()
        # whenever no thread-local user is set (see users/managers.py:
        # `if not user: return queryset.none()`). OrganizationMiddleware
        # never populates that thread-local for central-auth requests (the
        # same blind spot fixed in every prior phase), so a central-auth
        # client could never successfully target a campus-specific
        # announcement — every `campus` pk would 400 as invalid. Swap to
        # Campus.all_objects for CentralAuthUser, same fix shape as C1-C6.
        request = self.context.get('request')
        if request is not None and isinstance(getattr(request, 'user', None), CentralAuthUser):
            if 'campus' in self.fields:
                self.fields['campus'].queryset = Campus.all_objects.all()

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
