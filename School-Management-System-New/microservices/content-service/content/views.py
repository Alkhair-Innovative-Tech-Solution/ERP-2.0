from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone
from .models import Module, Lesson, ContentItem, StudentContentProgress
from .serializers import (
    ModuleSerializer, ModuleCreateSerializer,
    LessonSerializer, LessonCreateSerializer,
    ContentItemSerializer, ContentItemCreateSerializer,
    StudentContentProgressSerializer,
)
from users.models import Organization


def _get_org(user):
    org_id = getattr(user, 'org_id', None)
    if not org_id:
        return None
    org, _ = Organization.all_objects.get_or_create(
        id=org_id, defaults={'name': f'Org-{org_id}'}
    )
    return org


def _is_teacher_or_above(user):
    return user.role in ('teacher', 'coordinator', 'principal', 'org_admin', 'admin', 'superadmin')


class ModuleViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['subject_id', 'is_published']
    search_fields = ['title', 'subject_name']
    ordering_fields = ['order', 'created_at']
    ordering = ['order']

    def get_queryset(self):
        user = self.request.user
        qs = Module.objects.all()
        if user.role == 'student':
            qs = qs.filter(is_published=True)
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ModuleCreateSerializer
        return ModuleSerializer

    def perform_create(self, serializer):
        serializer.save(organization=_get_org(self.request.user))

    def create(self, request, *args, **kwargs):
        if not _is_teacher_or_above(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not _is_teacher_or_above(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not _is_teacher_or_above(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='curriculum/(?P<subject_id>[0-9]+)')
    def curriculum(self, request, subject_id=None):
        """Full Module→Lesson→ContentItem tree for a subject, with student progress."""
        qs = Module.objects.filter(subject_id=subject_id, is_published=True)
        serializer = ModuleSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)


class LessonViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['module', 'is_published']
    search_fields = ['title']
    ordering_fields = ['order', 'created_at']
    ordering = ['order']

    def get_queryset(self):
        user = self.request.user
        qs = Lesson.objects.all()
        if user.role == 'student':
            qs = qs.filter(is_published=True)
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return LessonCreateSerializer
        return LessonSerializer

    def perform_create(self, serializer):
        serializer.save(organization=_get_org(self.request.user))

    def create(self, request, *args, **kwargs):
        if not _is_teacher_or_above(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not _is_teacher_or_above(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not _is_teacher_or_above(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class ContentItemViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = ['lesson', 'content_type']
    ordering_fields = ['order', 'created_at']
    ordering = ['order']

    def get_queryset(self):
        return ContentItem.objects.all()

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ContentItemCreateSerializer
        return ContentItemSerializer

    def perform_create(self, serializer):
        user = self.request.user
        org = _get_org(user)
        # auto-set order
        lesson_id = self.request.data.get('lesson')
        next_order = ContentItem.objects.filter(lesson_id=lesson_id).count() + 1
        serializer.save(organization=org, order=next_order)

    def create(self, request, *args, **kwargs):
        if not _is_teacher_or_above(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        if not _is_teacher_or_above(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not _is_teacher_or_above(request.user):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)


class StudentProgressView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = StudentContentProgressSerializer

    def post(self, request):
        """Mark a lesson as completed for the current student."""
        if request.user.role != 'student':
            return Response({'detail': 'Only students can update progress.'}, status=status.HTTP_403_FORBIDDEN)
        lesson_id = request.data.get('lesson_id')
        is_completed = request.data.get('is_completed', True)
        try:
            lesson = Lesson.objects.get(id=lesson_id)
        except Lesson.DoesNotExist:
            return Response({'detail': 'Lesson not found.'}, status=status.HTTP_404_NOT_FOUND)

        progress, _ = StudentContentProgress.all_objects.get_or_create(
            student_id=request.user.id,
            lesson=lesson,
            defaults={'organization': _get_org(request.user)},
        )
        progress.is_completed = is_completed
        if is_completed and not progress.completion_date:
            progress.completion_date = timezone.now()
        progress.save()
        return Response(StudentContentProgressSerializer(progress).data)

    def get(self, request):
        """Get student's progress for a given subject."""
        if request.user.role != 'student':
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        subject_id = request.query_params.get('subject_id')
        qs = StudentContentProgress.all_objects.filter(student_id=request.user.id)
        if subject_id:
            qs = qs.filter(lesson__module__subject_id=subject_id)
        return Response(StudentContentProgressSerializer(qs, many=True).data)
