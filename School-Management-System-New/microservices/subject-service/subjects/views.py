from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from django.utils import timezone
from .models import Subject, SubjectTeacherAssignment
from .serializers import (
    SubjectSerializer, SubjectCreateSerializer,
    SubjectTeacherAssignmentSerializer, SubjectTeacherAssignmentCreateSerializer,
)
from users.models import Organization
from central_auth.authentication import CentralAuthUser
from subject_service.dual_auth import (
    DualServiceSubscribed, DualRequiresPermission,
    user_role, get_org_and_tenant, resolve_staff_teacher_id,
    legacy_person_id, central_person_id, central_tenant_qs,
)

# Phase C4 endpoint -> sms.* permission map (see
# docs/PHASE_C4_SUBJECT_SERVICE_RESULT.md's "Endpoint -> permission map" for
# the full table). No sms.subject.* permission exists in central auth's
# catalog at all (only sms.assignment.*, sms.fee.*, sms.result.view — none
# is a match for subject/curriculum management). Per the rules, no
# permission was invented/added to the catalog from this subject-service-
# scoped task — referencing this codename means every non-superadmin
# central-auth token currently gets 403 on subject/assignment-of-teacher
# writes, fail-closed, until a future catalog step adds it. Reads (list/
# retrieve/my-subjects/my-classrooms) are gated by DualServiceSubscribed
# only, matching "endpoints requiring no special perm should work".
SUBJECT_MANAGE_PERM = 'sms.subject.manage'


def _resolve_teacher_id(user):
    """Resolve the Teacher entity PK (an int) for the logged-in user.

    Assignments store teacher_id = Teacher entity PK (from staff-service),
    but the JWT only carries the User PK. We map them via the employee_code,
    which equals the JWT username. Looked up directly in staff_db (psycopg2).

    Legacy: falls back to user.id if the lookup fails — unchanged, exact
    original behavior.

    Phase C4 / CentralAuthUser: the lookup itself is dual-safe (delegates to
    subject_service.dual_auth.resolve_staff_teacher_id, identifier is
    CentralAuthUser.employee_code instead of legacy .username — same SQL).
    If it fails to resolve, returns None rather than falling back to
    user.id — a UUID can't be used as this int PK, and doing so would send
    a UUID string into a raw SQL query against an integer column
    (timetable_db's teacher_id) in _derive_classrooms_from_timetable,
    erroring or silently matching nothing. Callers on the central-auth path
    check for None explicitly.
    """
    resolved = resolve_staff_teacher_id(user)
    if resolved is not None:
        return resolved
    if isinstance(user, CentralAuthUser):
        return None
    return user.id


def _derive_classrooms_from_timetable(teacher_id, org, tenant_id=None):
    """Build the teacher's (subject, classroom) list from their TIMETABLE.

    The timetable (set by the coordinator) is the single source of truth for
    what a teacher teaches. We read distinct (subject_name, classroom) pairs
    from timetable_db and map each subject name to a local subjects.Subject
    (get_or_create), because LMS assignments FK to subjects.Subject.
    Returns dicts shaped like SubjectTeacherAssignmentSerializer output.

    Phase C4: teacher_id may be None on the central-auth path (no matching
    staff-service Teacher row — see _resolve_teacher_id) — nothing to query
    the timetable by, so return [] immediately rather than sending None into
    the raw SQL WHERE clause. tenant_id (only set for a CentralAuthUser
    caller) makes the Subject get_or_create dual-safe: Subject.objects is
    OrganizationManager-backed (see subject_service/dual_auth.py's module
    docstring) — empty for a central-auth request regardless of the
    organization=org (=None) filter, so this uses Subject.all_objects +
    explicit tenant_id filtering on that path instead, unchanged on legacy.
    """
    import os
    if teacher_id is None:
        return []
    rows = []
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=os.environ.get('TIMETABLE_DB_HOST', 'postgres-timetable'),
            dbname=os.environ.get('TIMETABLE_DB_NAME', 'timetable_db'),
            user=os.environ.get('TIMETABLE_DB_USER', 'timetable_user'),
            password=os.environ.get('TIMETABLE_DB_PASSWORD', 'timetable_pass'),
            connect_timeout=5,
        )
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT DISTINCT s.name AS subject_name, t.classroom_id,
                           g.name AS grade_name, c.section, c.shift, c.code
                    FROM timetable_teachertimetable t
                    JOIN timetable_subject s ON s.id = t.subject_id
                    JOIN classes_classroom c ON c.id = t.classroom_id
                    JOIN classes_grade g ON g.id = c.grade_id
                    WHERE t.teacher_id = %s
                      AND t.is_break = false
                      AND t.subject_id IS NOT NULL
                      AND t.classroom_id IS NOT NULL
                    """,
                    (teacher_id,),
                )
                cols = [d[0] for d in cur.description]
                rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        finally:
            conn.close()
    except Exception:
        return []

    result = []
    seen = set()
    for r in rows:
        name = (r.get('subject_name') or '').strip()
        classroom_id = r.get('classroom_id')
        if not name or not classroom_id:
            continue
        key = (name.lower(), classroom_id)
        if key in seen:
            continue
        seen.add(key)
        # Map timetable subject name -> local subjects.Subject (for the assignment FK)
        if tenant_id:
            subject = Subject.all_objects.filter(
                tenant_id=tenant_id, name__iexact=name, is_deleted=False
            ).first()
            if not subject:
                subject = Subject.all_objects.create(organization=org, tenant_id=tenant_id, name=name)
        else:
            subject = Subject.objects.filter(organization=org, name__iexact=name, is_deleted=False).first()
            if not subject:
                subject = Subject.objects.create(organization=org, name=name)
        shift = (r.get('shift') or '').capitalize()
        label_core = f"{r.get('grade_name') or ''} - {r.get('section') or ''}".strip(' -')
        classroom_label = f"{label_core} ({shift})" if shift else label_core
        result.append({
            'id': None,
            'subject': subject.id,
            'subject_name': subject.name,
            'subject_code': subject.subject_code,
            'teacher_id': teacher_id,
            'classroom_id': classroom_id,
            'classroom_code': r.get('code'),
            'classroom_label': classroom_label,
            'academic_year': '',
            'is_active': True,
        })
    return result


class SubjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DualServiceSubscribed]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['grade_id', 'campus_id', 'is_active']
    search_fields = ['name', 'subject_code']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_permissions(self):
        # Writes need SUBJECT_MANAGE_PERM (flagged — not yet in the
        # catalog, see module docstring); reads need only the subscription
        # check already in permission_classes.
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), DualServiceSubscribed(), DualRequiresPermission(SUBJECT_MANAGE_PERM)()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        if isinstance(user, CentralAuthUser):
            # Subject.objects is OrganizationManager-backed — empty for a
            # central-auth request (see subject_service/dual_auth.py's
            # module docstring).
            return central_tenant_qs(Subject.all_objects.filter(is_deleted=False), user)
        return Subject.objects.filter(is_deleted=False)

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return SubjectCreateSerializer
        return SubjectSerializer

    def perform_create(self, serializer):
        org, tenant_id = get_org_and_tenant(self.request.user)
        serializer.save(organization=org, tenant_id=tenant_id)

    def destroy(self, request, *args, **kwargs):
        subject = self.get_object()
        subject.is_deleted = True
        subject.deleted_at = timezone.now()
        subject.save()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'], url_path='my-subjects')
    def my_subjects(self, request):
        """Teacher sees their assigned subjects; student sees subjects for their classroom."""
        user = request.user
        is_central = isinstance(user, CentralAuthUser)
        org, tenant_id = get_org_and_tenant(user)
        subject_base = (
            central_tenant_qs(Subject.all_objects.filter(is_deleted=False), user)
            if is_central else Subject.objects.filter(is_deleted=False)
        )
        assignment_base = (
            central_tenant_qs(SubjectTeacherAssignment.all_objects.all(), user)
            if is_central else SubjectTeacherAssignment.objects.all()
        )
        role = user_role(user)
        if role == 'teacher':
            teacher_id = _resolve_teacher_id(user)
            derived = _derive_classrooms_from_timetable(teacher_id, org, tenant_id=tenant_id)
            subject_ids = [d['subject'] for d in derived]
            qs = subject_base.filter(id__in=subject_ids)
        elif role == 'student':
            classroom_id = getattr(user, 'campus_id', None)  # campus_id claim used as classroom_id
            # classroom_id comes from query param for student
            classroom_id = request.query_params.get('classroom_id', classroom_id)
            if not classroom_id:
                return Response([])
            assignments = assignment_base.filter(classroom_id=classroom_id, is_active=True)
            subject_ids = assignments.values_list('subject_id', flat=True).distinct()
            qs = subject_base.filter(id__in=subject_ids)
        else:
            qs = subject_base
        serializer = SubjectSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='my-classrooms')
    def my_classrooms(self, request):
        """Return SubjectTeacherAssignment records for the current teacher (with classroom info)."""
        user = request.user
        if user_role(user) != 'teacher':
            return Response([])
        teacher_id = _resolve_teacher_id(user)
        org, tenant_id = get_org_and_tenant(user)
        # Timetable is the source of truth — derive classes+subjects from it.
        return Response(_derive_classrooms_from_timetable(teacher_id, org, tenant_id=tenant_id))


class SubjectTeacherAssignmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, DualServiceSubscribed]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['teacher_id', 'classroom_id', 'subject', 'academic_year', 'is_active']
    search_fields = ['teacher_name', 'classroom_label', 'subject__name']

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), DualServiceSubscribed(), DualRequiresPermission(SUBJECT_MANAGE_PERM)()]
        return super().get_permissions()

    def get_queryset(self):
        user = self.request.user
        if isinstance(user, CentralAuthUser):
            return central_tenant_qs(SubjectTeacherAssignment.all_objects.all(), user)
        return SubjectTeacherAssignment.objects.all()

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return SubjectTeacherAssignmentCreateSerializer
        return SubjectTeacherAssignmentSerializer

    def perform_create(self, serializer):
        user = self.request.user
        org, tenant_id = get_org_and_tenant(user)
        serializer.save(
            organization=org,
            tenant_id=tenant_id,
            assigned_by_id=legacy_person_id(user),
            central_assigned_by_id=central_person_id(user),
        )
