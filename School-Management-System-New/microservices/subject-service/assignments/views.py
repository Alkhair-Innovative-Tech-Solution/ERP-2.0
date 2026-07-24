from rest_framework import viewsets, generics, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.shortcuts import get_object_or_404
from .models import Assignment, Submission
from .serializers import (
    AssignmentSerializer, AssignmentCreateSerializer,
    SubmissionSerializer, SubmissionCreateSerializer, SubmissionGradeSerializer,
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


class AssignmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['subject', 'classroom_id', 'is_published', 'assignment_type']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'due_date', 'title']
    ordering = ['-created_at']

    def get_queryset(self):
        user = self.request.user
        qs = Assignment.objects.all()

        if user.role == 'teacher':
            # Teachers see their own assignments
            qs = qs.filter(created_by_id=user.id)
        elif user.role == 'student':
            # Students see published assignments for their classroom
            classroom_id = self.request.query_params.get('classroom_id')
            if classroom_id:
                qs = qs.filter(classroom_id=classroom_id, is_published=True)
            else:
                qs = qs.filter(is_published=True)
        # Admin/principal/coordinator see all within org (OrganizationManager handles it)
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return AssignmentCreateSerializer
        return AssignmentSerializer

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(
            organization=_get_org(user),
            created_by_id=user.id,
            created_by_name=user.username,
        )

    @action(detail=True, methods=['post'], url_path='seen')
    def mark_seen(self, request, pk=None):
        """Student auto-marks a Material assignment as seen when they open it."""
        assignment = self.get_object()
        user = request.user
        if user.role != 'student':
            return Response({'detail': 'Only students can mark as seen.'}, status=status.HTTP_403_FORBIDDEN)
        existing = Submission.all_objects.filter(assignment=assignment, student_id=user.id).first()
        if existing:
            return Response(SubmissionSerializer(existing, context={'request': request}).data)
        submission = Submission(
            assignment=assignment,
            organization=_get_org(user),
            student_id=user.id,
            student_name=user.username,
            status='SEEN',
        )
        submission.save()
        return Response(SubmissionSerializer(submission, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='submissions')
    def list_submissions(self, request, pk=None):
        """Teacher sees all submissions; student sees only their own."""
        assignment = self.get_object()
        user = request.user
        if user.role == 'student':
            qs = assignment.submissions.filter(student_id=user.id)
        else:
            qs = assignment.submissions.all()
        serializer = SubmissionSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='submit',
            parser_classes=[MultiPartParser, FormParser, JSONParser])
    def submit(self, request, pk=None):
        """Student submits an assignment."""
        assignment = self.get_object()
        user = request.user
        if user.role != 'student':
            return Response({'detail': 'Only students can submit.'}, status=status.HTTP_403_FORBIDDEN)

        existing = Submission.all_objects.filter(assignment=assignment, student_id=user.id).first()
        if existing:
            return Response({'detail': 'You have already submitted this assignment.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SubmissionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        submission = serializer.save(
            assignment=assignment,
            organization=_get_org(user),
            student_id=user.id,
            student_name=user.username,
        )
        return Response(SubmissionSerializer(submission, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='submissions/(?P<sub_id>[0-9]+)/grade')
    def grade_submission(self, request, pk=None, sub_id=None):
        """Teacher grades a submission."""
        user = request.user
        if user.role not in ('teacher', 'org_admin', 'superadmin'):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        submission = get_object_or_404(Submission, id=sub_id, assignment_id=pk)
        serializer = SubmissionGradeSerializer(
            submission, data=request.data, partial=True, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SubmissionSerializer(submission, context={'request': request}).data)


class MySubmissionsView(generics.ListAPIView):
    """Student: see all my submissions across assignments."""
    permission_classes = [IsAuthenticated]
    serializer_class = SubmissionSerializer

    def get_queryset(self):
        user = self.request.user
        return Submission.objects.filter(student_id=user.id)
