from rest_framework import viewsets, permissions, decorators, response, status
from django.db.models import Q
from django.utils import timezone
from .models import Notification, Announcement, PushSubscription
from .serializers import NotificationSerializer, AnnouncementSerializer
from central_auth.authentication import CentralAuthUser
from notification_service.dual_auth import (
    DualServiceSubscribed, DualRequiresPermission,
    user_can_manage_announcements, central_person_id, central_tenant_qs,
)

# Phase C7 endpoint -> sms.* permission map (see
# docs/PHASE_C7_NOTIFICATION_SERVICE_RESULT.md). Central auth's catalog has
# no notification/announcement-shaped permission at all. NotificationViewSet's
# actions (list/retrieve/unread/mark_read/mark_all_read/delete_all) are
# always scoped to the caller's OWN inbox (central_recipient_id / recipient_id)
# regardless of role, so — unlike announcement management — they're gated
# by DualServiceSubscribed only, matching "endpoints requiring no special
# perm should work"; managing your own notification read-state isn't a
# privileged action the way broadcasting an announcement to many people is.
ANNOUNCEMENT_MANAGE_PERM = 'sms.announcement.manage'


class NotificationViewSet(viewsets.ModelViewSet):
    @decorators.action(detail=False, methods=['post'])
    def delete_all(self, request):
        qs = self.get_queryset()
        count = qs.count()
        qs.delete()
        return response.Response({'deleted': count}, status=status.HTTP_200_OK)
    @decorators.action(detail=False, methods=['post'])
    def mark_all_read(self, request):
        qs = self.get_queryset().filter(unread=True)
        count = qs.count()
        qs.update(unread=False)
        return response.Response({'marked': count}, status=status.HTTP_200_OK)
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated, DualServiceSubscribed]

    def get_queryset(self):
        user = self.request.user
        if isinstance(user, CentralAuthUser):
            # recipient_id is an IntegerField-backed FK to users.User —
            # can't be filtered against a UUID (same class of gap as
            # everywhere else). central_recipient_id is the correct column
            # AND is the core IDOR-prevention property for this service —
            # see notification_service/dual_auth.py's module docstring.
            # Not additionally tenant-filtered: central_recipient_id is
            # already a strictly per-person boundary (globally unique to
            # one token identity), so tenant scoping adds no further
            # isolation here.
            return Notification.objects.filter(central_recipient_id=user.id)
        return Notification.objects.filter(recipient_id=self.request.user.id)

    def perform_create(self, serializer):
        # force recipient to be the provided user (server-side creation)
        serializer.save()

    @decorators.action(detail=False, methods=['get'])
    def unread(self, request):
        qs = self.get_queryset().filter(unread=True)
        data = self.get_serializer(qs, many=True).data
        return response.Response(data)

    @decorators.action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        obj = self.get_queryset().filter(pk=pk).first()
        if not obj:
            return response.Response(status=status.HTTP_404_NOT_FOUND)
        obj.mark_read()
        return response.Response(self.get_serializer(obj).data)


class AnnouncementViewSet(viewsets.ModelViewSet):
    """Announcements: org_admin / superadmin (organization-wide) and
    principal (their campus) can create/edit; everyone in scope reads."""
    serializer_class = AnnouncementSerializer
    permission_classes = [permissions.IsAuthenticated, DualServiceSubscribed]

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [permissions.IsAuthenticated(), DualServiceSubscribed(), DualRequiresPermission(ANNOUNCEMENT_MANAGE_PERM)()]
        return super().get_permissions()

    def _can_manage(self, user):
        # See notification_service/dual_auth.py's user_can_manage_announcements
        # docstring: the legacy branch there relocates the ORIGINAL expression
        # unchanged, including a pre-existing `is_org_admin_role()`
        # AttributeError bug for any legacy token not already caught by
        # `is_superadmin()`'s short-circuit. Not fixed here — flagged in
        # docs/PHASE_C7_NOTIFICATION_SERVICE_RESULT.md.
        return user_can_manage_announcements(user)

    def get_queryset(self):
        user = self.request.user
        qs = Announcement.objects.filter(is_active=True).select_related('campus', 'created_by')

        if isinstance(user, CentralAuthUser):
            qs = central_tenant_qs(qs, user)
            qs = qs.filter(Q(expires_at__isnull=True) | Q(expires_at__gte=timezone.now()))
            if user.is_superadmin:
                return qs
            # No local Teacher/Coordinator/Principal/Student tables vendored
            # in this service (unlike C3/C6 — only `campus` is Dockerfile-
            # copied here) and no role/principal_type claim exists on
            # CentralAuthUser yet (same gap flagged since B3) — the
            # role-based audience/campus scoping below has no central-auth
            # equivalent. Fail closed: only org-wide, all-audience
            # announcements are shown — flagged, not silently guessed at.
            return qs.filter(campus__isnull=True, audience='all')

        # Legacy — unchanged, including the pre-existing is_org_admin_role()
        # AttributeError bug (see _can_manage's docstring above).
        # Organization scope (superadmin sees all)
        if not user.is_superadmin() and getattr(user, 'organization_id', None):
            qs = qs.filter(Q(organization=user.organization) | Q(organization__isnull=True))

        # Hide expired
        qs = qs.filter(Q(expires_at__isnull=True) | Q(expires_at__gte=timezone.now()))

        # Org admin / superadmin: everything in their org (org-wide + all campuses)
        if user.is_superadmin() or user.is_org_admin_role():
            return qs

        campus_id = getattr(user, 'campus_id', None)

        # Principal: org-wide + their own campus
        if user.is_principal():
            return qs.filter(Q(campus__isnull=True) | Q(campus_id=campus_id))

        # Coordinators / teachers / students: org-wide + their campus, filtered by audience
        qs = qs.filter(Q(campus__isnull=True) | Q(campus_id=campus_id))
        audience_map = {
            'coordinator': 'coordinators',
            'teacher': 'teachers',
            'student': 'students',
            'principal': 'principals',
        }
        aud = audience_map.get(getattr(user, 'role', ''))
        if aud:
            return qs.filter(Q(audience='all') | Q(audience=aud))
        return qs.filter(audience='all')

    def create(self, request, *args, **kwargs):
        if not self._can_manage(request.user):
            return response.Response(
                {'detail': 'You do not have permission to create announcements.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = self.request.user
        if isinstance(user, CentralAuthUser):
            # No local .organization_id/is_principal() on this token —
            # stamp tenant_id + central_created_by_id instead. No principal-
            # campus restriction equivalent (see get_queryset's note) — a
            # central-auth superadmin's announcement is always org-wide,
            # never campus-scoped, on this path.
            kwargs = {
                'created_by': None,
                'central_created_by_id': central_person_id(user),
                'tenant_id': user.tenant_id,
            }
            announcement = serializer.save(**kwargs)
            self._fan_out_notifications(announcement, actor=user)
            return

        # Legacy — unchanged (including the pre-existing gap where
        # `organization_id` is never actually stamped: _TokenUser has no
        # `.organization_id` attribute at all, only `.org_id` — `getattr(user,
        # 'organization_id', None)` below always returns the default `None`,
        # so this `if` never fires. Confirmed by reading the original code;
        # not introduced or fixed by this phase).
        kwargs = {'created_by': user}
        if getattr(user, 'organization_id', None):
            kwargs['organization_id'] = user.organization_id
        # A principal can only post to their own campus
        if user.is_principal() and getattr(user, 'campus_id', None):
            kwargs['campus_id'] = user.campus_id
        announcement = serializer.save(**kwargs)
        self._fan_out_notifications(announcement, actor=user)

    def _fan_out_notifications(self, announcement, actor):
        """Create an in-app notification (+ live WebSocket push via the bell)
        for every user the announcement targets."""
        from django.contrib.auth import get_user_model
        from .services import create_notification
        User = get_user_model()

        if isinstance(actor, CentralAuthUser):
            # Found during C7: users.User.objects (MultiTenantUserManager)
            # returns UNFILTERED (all organizations, all tenants) when the
            # OrganizationMiddleware thread-local is unset — which it always
            # is for central-auth requests (the same blind spot flagged in
            # every prior phase). users.User has no tenant_id/central_org_id
            # column of its own (only per-service tenant-scoped models got
            # one), so there is no reliable way to resolve "which local User
            # rows belong to this token's tenant" here. Rather than fan out
            # an in-app Notification to every user across every organization
            # in the platform (a real cross-tenant isolation break), fail
            # closed: skip in-app fan-out entirely for central-auth-authored
            # announcements. The Announcement itself is still correctly
            # tenant-scoped for readers via get_queryset/central_tenant_qs —
            # only this secondary "auto-notify" convenience feature is
            # affected. Flagged in docs/PHASE_C7_NOTIFICATION_SERVICE_RESULT.md.
            return

        recipients = User.objects.filter(is_active=True)
        if announcement.organization_id:
            recipients = recipients.filter(organization_id=announcement.organization_id)
        # Null campus = whole org; specific campus = only that campus
        if announcement.campus_id:
            recipients = recipients.filter(campus_id=announcement.campus_id)
        # Audience targeting
        role_map = {
            'principals': 'principal',
            'coordinators': 'coordinator',
            'teachers': 'teacher',
            'students': 'student',
        }
        target_role = role_map.get(announcement.audience)
        if target_role:
            recipients = recipients.filter(role=target_role)
        # Don't notify the author of their own post
        recipients = recipients.exclude(id=actor.id)

        for r in recipients.iterator():
            try:
                create_notification(
                    recipient=r,
                    actor=actor,
                    verb=f"Announcement: {announcement.title}",
                    target_text=(announcement.body or '')[:255],
                    data={
                        'type': 'announcement',
                        'announcement_id': announcement.id,
                        'priority': announcement.priority,
                    },
                )
            except Exception:
                # never let one bad recipient break the publish
                continue

    def update(self, request, *args, **kwargs):
        if not self._can_manage(request.user):
            return response.Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        if not self._can_manage(request.user):
            return response.Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not self._can_manage(request.user):
            return response.Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


# ---------------------------------------------------------------------------
# Web Push subscription endpoints
# ---------------------------------------------------------------------------
# vapid_public_key stays AllowAny, unchanged: it returns settings.
# VAPID_PUBLIC_KEY, which is by design meant to be handed to ANY browser
# client so it can set up a push subscription — that's how the Web Push
# protocol works (only the VAPID PRIVATE key, never exposed here, is
# secret). No data exposure, no mutation, no IDOR risk. Investigated per
# the C7 prompt's explicit instruction to scrutinize the service's one
# AllowAny endpoint; confirmed safe to leave as-is.
@decorators.api_view(['GET'])
@decorators.permission_classes([permissions.AllowAny])
def vapid_public_key(request):
    from django.conf import settings
    return response.Response({'publicKey': getattr(settings, 'VAPID_PUBLIC_KEY', '')})


@decorators.api_view(['POST'])
@decorators.permission_classes([permissions.IsAuthenticated, DualServiceSubscribed])
def push_subscribe(request):
    data = request.data or {}
    endpoint = data.get('endpoint')
    keys = data.get('keys') or {}
    p256dh = keys.get('p256dh')
    auth = keys.get('auth')
    if not endpoint or not p256dh or not auth:
        return response.Response({'detail': 'Invalid subscription'}, status=status.HTTP_400_BAD_REQUEST)
    user = request.user
    # user_id is an IntegerField-backed FK to users.User — a CentralAuthUser's
    # id is a UUID and can't be assigned there (PushSubscription.user is now
    # nullable for exactly this reason — see notifications/models.py).
    # central_user_id carries the central-auth identity instead.
    if isinstance(user, CentralAuthUser):
        defaults = {
            'user_id': None,
            'central_user_id': central_person_id(user),
            'p256dh': p256dh,
            'auth': auth,
            'user_agent': (request.META.get('HTTP_USER_AGENT') or '')[:300],
        }
    else:
        defaults = {
            'user_id': user.id,
            'p256dh': p256dh,
            'auth': auth,
            'user_agent': (request.META.get('HTTP_USER_AGENT') or '')[:300],
        }
    PushSubscription.objects.update_or_create(endpoint=endpoint, defaults=defaults)
    return response.Response({'ok': True})


@decorators.api_view(['POST'])
@decorators.permission_classes([permissions.IsAuthenticated, DualServiceSubscribed])
def push_unsubscribe(request):
    # endpoint is an opaque, globally-unique browser-generated value — the
    # lookup below never touches request.user, so no dual-safe change is
    # needed here beyond gating the endpoint with DualServiceSubscribed.
    endpoint = (request.data or {}).get('endpoint')
    if endpoint:
        PushSubscription.objects.filter(endpoint=endpoint).delete()
    return response.Response({'ok': True})
