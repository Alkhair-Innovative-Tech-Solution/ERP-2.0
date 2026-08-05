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
from central_auth.authentication import CentralAuthUser
from subject_service.dual_auth import (
    DualServiceSubscribed, DualRequiresPermission,
    user_role, user_display_name, get_org_and_tenant,
    legacy_person_id, central_person_id, central_tenant_qs,
)

# Phase C4 endpoint -> sms.* permission map (see
# docs/PHASE_C4_SUBJECT_SERVICE_RESULT.md). Unlike subjects/, assignments
# has TWO clean catalog matches from Phase B3: sms.assignment.view (reads)
# and sms.assignment.upload (the student's own submit action — wired
# directly, not through a generic "manage" gate). Assignment *management*
# (create/update/destroy, grading) has no clean match — sms.assignment.manage
# is referenced but NOT added to the catalog from this task, same
# fail-closed pattern as SUBJECT_MANAGE_PERM in subjects/views.py.
ASSIGNMENT_VIEW_PERM = 'sms.assignment.view'
ASSIGNMENT_UPLOAD_PERM = 'sms.assignment.upload'
ASSIGNMENT_MANAGE_PERM = 'sms.assignment.manage'


def _submission_base(user):
    """Dual-safe base queryset for Submission — Submission.objects is
    OrganizationManager-backed, empty for a central-auth request (see
    subject_service/dual_auth.py's module docstring)."""
    if isinstance(user, CentralAuthUser):
        return central_tenant_qs(Submission.all_objects.all(), user)
    return Submission.objects.all()


def _own_submission(assignment, user):
    """The requesting user's own Submission row for an assignment, if any —
    dual-safe (student_id=user.id would crash for CentralAuthUser: a UUID
    can't compare against an IntegerField)."""
    if isinstance(user, CentralAuthUser):
        return Submission.all_objects.filter(assignment=assignment, central_student_id=user.id).first()
    return Submission.all_objects.filter(assignment=assignment, student_id=user.id).first()


class AssignmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DualServiceSubscribed]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['subject', 'classroom_id', 'is_published', 'assignment_type']
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'due_date', 'title']
    ordering = ['-created_at']

    def get_permissions(self):
        base = [IsAuthenticated(), DualServiceSubscribed()]
        if self.action in ('create', 'update', 'partial_update', 'destroy', 'grade_submission'):
            return base + [DualRequiresPermission(ASSIGNMENT_MANAGE_PERM)()]
        if self.action == 'submit':
            return base + [DualRequiresPermission(ASSIGNMENT_UPLOAD_PERM)()]
        if self.action in ('list', 'retrieve', 'mark_seen', 'list_submissions'):
            return base + [DualRequiresPermission(ASSIGNMENT_VIEW_PERM)()]
        return base

    def get_queryset(self):
        user = self.request.user
        is_central = isinstance(user, CentralAuthUser)
        qs = central_tenant_qs(Assignment.all_objects.all(), user) if is_central else Assignment.objects.all()
        role = user_role(user)

        if role == 'teacher':
            # Teachers see their own assignments
            if is_central:
                qs = qs.filter(central_created_by_id=user.id)
            else:
                qs = qs.filter(created_by_id=user.id)
        elif role == 'student':
            # Students see published assignments for their classroom
            classroom_id = self.request.query_params.get('classroom_id')
            if classroom_id:
                qs = qs.filter(classroom_id=classroom_id, is_published=True)
            else:
                qs = qs.filter(is_published=True)
        # Admin/principal/coordinator see all within org (OrganizationManager
        # handles it on legacy; central_tenant_qs already scoped it above)
        return qs

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return AssignmentCreateSerializer
        return AssignmentSerializer

    def perform_create(self, serializer):
        user = self.request.user
        org, tenant_id = get_org_and_tenant(user)
        serializer.save(
            organization=org,
            tenant_id=tenant_id,
            created_by_id=legacy_person_id(user),
            central_created_by_id=central_person_id(user),
            created_by_name=user_display_name(user),
        )

    @action(detail=True, methods=['post'], url_path='seen')
    def mark_seen(self, request, pk=None):
        """Student auto-marks a Material assignment as seen when they open it."""
        assignment = self.get_object()
        user = request.user
        if user_role(user) != 'student':
            return Response({'detail': 'Only students can mark as seen.'}, status=status.HTTP_403_FORBIDDEN)
        existing = _own_submission(assignment, user)
        if existing:
            return Response(SubmissionSerializer(existing, context={'request': request}).data)
        org, tenant_id = get_org_and_tenant(user)
        submission = Submission(
            assignment=assignment,
            organization=org,
            tenant_id=tenant_id,
            student_id=legacy_person_id(user),
            central_student_id=central_person_id(user),
            student_name=user_display_name(user),
            status='SEEN',
        )
        submission.save()
        return Response(SubmissionSerializer(submission, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get'], url_path='submissions')
    def list_submissions(self, request, pk=None):
        """Teacher sees all submissions; student sees only their own."""
        assignment = self.get_object()
        user = request.user
        if user_role(user) == 'student':
            qs = _own_submission(assignment, user)
            qs = [qs] if qs else []
        else:
            qs = _submission_base(user).filter(assignment=assignment) if isinstance(user, CentralAuthUser) else assignment.submissions.all()
        serializer = SubmissionSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='submit',
            parser_classes=[MultiPartParser, FormParser, JSONParser])
    def submit(self, request, pk=None):
        """Student submits an assignment."""
        assignment = self.get_object()
        user = request.user
        if user_role(user) != 'student':
            return Response({'detail': 'Only students can submit.'}, status=status.HTTP_403_FORBIDDEN)

        existing = _own_submission(assignment, user)
        if existing:
            return Response({'detail': 'You have already submitted this assignment.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = SubmissionCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        org, tenant_id = get_org_and_tenant(user)
        submission = serializer.save(
            assignment=assignment,
            organization=org,
            tenant_id=tenant_id,
            student_id=legacy_person_id(user),
            central_student_id=central_person_id(user),
            student_name=user_display_name(user),
        )
        return Response(SubmissionSerializer(submission, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='submissions/(?P<sub_id>[0-9]+)/grade')
    def grade_submission(self, request, pk=None, sub_id=None):
        """Teacher grades a submission.

        Legacy: role in (teacher, org_admin, superadmin) — unchanged.
        CentralAuthUser: no org_admin-equivalent distinction exists in
        central auth's Employee model (no principal_type claim — same gap
        flagged since B3), so this narrows to teacher OR superadmin
        (is_superadmin bool attribute, unlike legacy's role string) — a
        coordinator/principal/plain-employee central-auth token gets 403
        here even though legacy's org_admin might have passed. Flagged in
        docs/PHASE_C4_SUBJECT_SERVICE_RESULT.md, not silently narrowed.
        """
        user = request.user
        if isinstance(user, CentralAuthUser):
            allowed = user_role(user) == 'teacher' or user.is_superadmin
        else:
            allowed = user.role in ('teacher', 'org_admin', 'superadmin')
        if not allowed:
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        submission = get_object_or_404(_submission_base(user), id=sub_id, assignment_id=pk)
        serializer = SubmissionGradeSerializer(
            submission, data=request.data, partial=True, context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(SubmissionSerializer(submission, context={'request': request}).data)


class MySubmissionsView(generics.ListAPIView):
    """Student: see all my submissions across assignments."""
    permission_classes = [IsAuthenticated, DualServiceSubscribed, DualRequiresPermission(ASSIGNMENT_VIEW_PERM)]
    serializer_class = SubmissionSerializer

    def get_queryset(self):
        user = self.request.user
        if isinstance(user, CentralAuthUser):
            return central_tenant_qs(Submission.all_objects.all(), user).filter(central_student_id=user.id)
        return Submission.objects.filter(student_id=user.id)
