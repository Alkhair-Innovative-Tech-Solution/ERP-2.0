from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.db.models import Q
from django.utils import timezone
from .models import Module, Lesson, ContentItem, StudentContentProgress
from .serializers import (
    ModuleSerializer, ModuleCreateSerializer,
    LessonSerializer, LessonCreateSerializer,
    ContentItemSerializer, ContentItemCreateSerializer,
    StudentContentProgressSerializer,
)
from users.models import Organization
from central_auth.authentication import CentralAuthUser
from content.dual_auth import DualServiceSubscribed, DualRequiresPermission

# Phase C1 endpoint -> sms.* permission map (see docs/PHASE_C1_CONTENT_SERVICE_RESULT.md
# "Endpoint -> permission map" for the full table + the flagged catalog gap):
#   list/retrieve (all viewsets), curriculum action  -> DualServiceSubscribed only
#       (no fine-grained perm needed — matches "endpoints requiring no special
#       perm should work" from the recipe)
#   create/update/destroy (Module/Lesson/ContentItem) -> sms.content.manage
#   StudentProgressView (post/get)                    -> sms.content.progress.update
# FLAGGED: neither sms.content.manage nor sms.content.progress.update exists in
# central auth's permissions.sms_catalog.py yet (only sms.assignment.*, sms.fee.*,
# sms.result.view — none are a clean match for content management). Per the
# rules, no permission was invented/added to central auth's catalog from this
# content-service-scoped task. Referencing these codenames here means EVERY
# non-superadmin central-auth token currently gets 403 on the gated actions —
# correct fail-closed behavior, not a bug, until a future catalog step adds
# them. The legacy SMS-token path is completely unaffected (see _is_content_manager/
# _is_student below) — this gap only exists on the new path, which nothing
# depends on yet.
CONTENT_MANAGE_PERM = 'sms.content.manage'
CONTENT_PROGRESS_PERM = 'sms.content.progress.update'


def _get_org(user):
    """Legacy path only. CentralAuthUser has no org_id (only tenant_id) —
    content rows created via a central-auth token get tenant_id stamped
    instead (see perform_create below), organization stays null."""
    if isinstance(user, CentralAuthUser):
        return None
    org_id = getattr(user, 'org_id', None)
    if not org_id:
        return None
    org, _ = Organization.all_objects.get_or_create(
        id=org_id, defaults={'name': f'Org-{org_id}'}
    )
    return org


def _is_content_manager(user):
    """Legacy SMS token: unchanged role check. Central-auth token: gated by
    sms.content.manage (see CONTENT_MANAGE_PERM note above — not yet in the
    catalog, so this is False for every non-superadmin central-auth token
    today; superadmin always passes via CentralAuthUser.has_perm's '*' check)."""
    if isinstance(user, CentralAuthUser):
        return user.has_perm(CONTENT_MANAGE_PERM)
    return user.role in ('teacher', 'coordinator', 'principal', 'org_admin', 'admin', 'superadmin')


def _is_student(user):
    if isinstance(user, CentralAuthUser):
        return user.has_perm(CONTENT_PROGRESS_PERM)
    return user.role == 'student'


def _tenant_scoped(all_objects_manager, tenant_id):
    """Central-auth read path: explicit tenant filter, NOT the
    OrganizationManager-backed `objects` default (see dual_auth.py's
    docstring — the shared OrganizationMiddleware never populates its
    contextvars for central-auth-authenticated requests, so `objects`
    would silently return nothing). Rows with tenant_id IS NULL (created
    before this migration, or by the legacy path) are included — same
    permissive-for-unscoped-rows precedent as VMS's TenantQuerySet."""
    if not tenant_id:
        return all_objects_manager.none()
    return all_objects_manager.filter(Q(tenant_id=tenant_id) | Q(tenant_id__isnull=True))


class ModuleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DualServiceSubscribed]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['subject_id', 'is_published']
    search_fields = ['title', 'subject_name']
    ordering_fields = ['order', 'created_at']
    ordering = ['order']

    def get_queryset(self):
        user = self.request.user
        if isinstance(user, CentralAuthUser):
            qs = _tenant_scoped(Module.all_objects, user.tenant_id)
        else:
            qs = Module.objects.all()
        if not _is_content_manager(user):
            qs = qs.filter(is_published=True)
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ModuleCreateSerializer
        return ModuleSerializer

    def perform_create(self, serializer):
        user = self.request.user
        if isinstance(user, CentralAuthUser):
            serializer.save(organization=None, tenant_id=user.tenant_id)
        else:
            serializer.save(organization=_get_org(user))

    def create(self, request, *args, **kwargs):
        if not _is_content_manager(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not _is_content_manager(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not _is_content_manager(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='curriculum/(?P<subject_id>[0-9]+)')
    def curriculum(self, request, subject_id=None):
        """Full Module→Lesson→ContentItem tree for a subject, with student progress."""
        user = request.user
        if isinstance(user, CentralAuthUser):
            qs = _tenant_scoped(Module.all_objects, user.tenant_id).filter(subject_id=subject_id, is_published=True)
        else:
            qs = Module.objects.filter(subject_id=subject_id, is_published=True)
        serializer = ModuleSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)


class LessonViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DualServiceSubscribed]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['module', 'is_published']
    search_fields = ['title']
    ordering_fields = ['order', 'created_at']
    ordering = ['order']

    def get_queryset(self):
        user = self.request.user
        if isinstance(user, CentralAuthUser):
            qs = _tenant_scoped(Lesson.all_objects, user.tenant_id)
        else:
            qs = Lesson.objects.all()
        if not _is_content_manager(user):
            qs = qs.filter(is_published=True)
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return LessonCreateSerializer
        return LessonSerializer

    def perform_create(self, serializer):
        user = self.request.user
        if isinstance(user, CentralAuthUser):
            serializer.save(organization=None, tenant_id=user.tenant_id)
        else:
            serializer.save(organization=_get_org(user))

    def create(self, request, *args, **kwargs):
        if not _is_content_manager(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not _is_content_manager(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not _is_content_manager(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class ContentItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DualServiceSubscribed]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['lesson', 'content_type']
    ordering_fields = ['order', 'created_at']
    ordering = ['order']

    def get_queryset(self):
        user = self.request.user
        if isinstance(user, CentralAuthUser):
            return _tenant_scoped(ContentItem.all_objects, user.tenant_id)
        return ContentItem.objects.all()

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ContentItemCreateSerializer
        return ContentItemSerializer

    def perform_create(self, serializer):
        user = self.request.user
        # auto-set order
        lesson_id = self.request.data.get('lesson')
        next_order = ContentItem.objects.filter(lesson_id=lesson_id).count() + 1
        if isinstance(user, CentralAuthUser):
            serializer.save(organization=None, tenant_id=user.tenant_id, order=next_order)
        else:
            serializer.save(organization=_get_org(user), order=next_order)

    def create(self, request, *args, **kwargs):
        if not _is_content_manager(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not _is_content_manager(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not _is_content_manager(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class StudentProgressView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated, DualServiceSubscribed]
    serializer_class = StudentContentProgressSerializer

    def post(self, request):
        """Mark a lesson as completed for the current student."""
        if not _is_student(request.user):
            return Response({'detail': 'Only students can update progress.'}, status=status.HTTP_403_FORBIDDEN)
        lesson_id = request.data.get('lesson_id')
        is_completed = request.data.get('is_completed', True)
        try:
            lesson = Lesson.objects.get(id=lesson_id)
        except Lesson.DoesNotExist:
            return Response({'detail': 'Lesson not found.'}, status=status.HTTP_404_NOT_FOUND)

        user = request.user
        if isinstance(user, CentralAuthUser):
            lookup = {'central_user_id': user.id, 'lesson': lesson}
            defaults = {'organization': None, 'tenant_id': user.tenant_id}
        else:
            lookup = {'student_id': user.id, 'lesson': lesson}
            defaults = {'organization': _get_org(user)}
        progress, _ = StudentContentProgress.all_objects.get_or_create(**lookup, defaults=defaults)
        progress.is_completed = is_completed
        if is_completed and not progress.completion_date:
            progress.completion_date = timezone.now()
        progress.save()
        return Response(StudentContentProgressSerializer(progress).data)

    def get(self, request):
        """Get student's progress for a given subject."""
        if not _is_student(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        subject_id = request.query_params.get('subject_id')
        user = request.user
        if isinstance(user, CentralAuthUser):
            qs = StudentContentProgress.all_objects.filter(central_user_id=user.id)
        else:
            qs = StudentContentProgress.all_objects.filter(student_id=user.id)
        if subject_id:
            qs = qs.filter(lesson__module__subject_id=subject_id)
        return Response(StudentContentProgressSerializer(qs, many=True).data)
