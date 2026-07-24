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


def _resolve_teacher_id(user):
    """Resolve the Teacher entity PK for the logged-in user.

    Assignments store teacher_id = Teacher entity PK (from staff-service),
    but the JWT only carries the User PK. We map them via the employee_code,
    which equals the JWT username. Looked up directly in staff_db (psycopg2).
    Falls back to user.id if the lookup fails.
    """
    import os
    username = getattr(user, 'username', None)
    if not username:
        return user.id
    try:
        import psycopg2
        conn = psycopg2.connect(
            host=os.environ.get('STAFF_DB_HOST', 'postgres-staff'),
            dbname=os.environ.get('STAFF_DB_NAME', 'staff_db'),
            user=os.environ.get('STAFF_DB_USER', 'staff_user'),
            password=os.environ.get('STAFF_DB_PASSWORD', 'staff_pass'),
            connect_timeout=5,
        )
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM teachers_teacher WHERE employee_code = %s AND is_deleted = false LIMIT 1",
                    (username,),
                )
                row = cur.fetchone()
                if row:
                    return row[0]
        finally:
            conn.close()
    except Exception:
        pass
    return user.id


def _derive_classrooms_from_timetable(teacher_id, org):
    """Build the teacher's (subject, classroom) list from their TIMETABLE.

    The timetable (set by the coordinator) is the single source of truth for
    what a teacher teaches. We read distinct (subject_name, classroom) pairs
    from timetable_db and map each subject name to a local subjects.Subject
    (get_or_create), because LMS assignments FK to subjects.Subject.
    Returns dicts shaped like SubjectTeacherAssignmentSerializer output.
    """
    import os
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


def _get_org(user):
    org_id = getattr(user, 'org_id', None)
    if not org_id:
        return None
    org, _ = Organization.all_objects.get_or_create(
        id=org_id, defaults={'name': f'Org-{org_id}'}
    )
    return org


class SubjectViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['grade_id', 'campus_id', 'is_active']
    search_fields = ['name', 'subject_code']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']

    def get_queryset(self):
        return Subject.objects.filter(is_deleted=False)

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return SubjectCreateSerializer
        return SubjectSerializer

    def perform_create(self, serializer):
        serializer.save(organization=_get_org(self.request.user))

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
        if user.role == 'teacher':
            teacher_id = _resolve_teacher_id(user)
            derived = _derive_classrooms_from_timetable(teacher_id, _get_org(user))
            subject_ids = [d['subject'] for d in derived]
            qs = Subject.objects.filter(id__in=subject_ids, is_deleted=False)
        elif user.role == 'student':
            classroom_id = getattr(user, 'campus_id', None)  # campus_id claim used as classroom_id
            # classroom_id comes from query param for student
            classroom_id = request.query_params.get('classroom_id', classroom_id)
            if not classroom_id:
                return Response([])
            assignments = SubjectTeacherAssignment.objects.filter(
                classroom_id=classroom_id, is_active=True
            )
            subject_ids = assignments.values_list('subject_id', flat=True).distinct()
            qs = Subject.objects.filter(id__in=subject_ids, is_deleted=False)
        else:
            qs = Subject.objects.filter(is_deleted=False)
        serializer = SubjectSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='my-classrooms')
    def my_classrooms(self, request):
        """Return SubjectTeacherAssignment records for the current teacher (with classroom info)."""
        user = request.user
        if user.role != 'teacher':
            return Response([])
        teacher_id = _resolve_teacher_id(user)
        # Timetable is the source of truth — derive classes+subjects from it.
        return Response(_derive_classrooms_from_timetable(teacher_id, _get_org(user)))


class SubjectTeacherAssignmentViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter]
    filterset_fields = ['teacher_id', 'classroom_id', 'subject', 'academic_year', 'is_active']
    search_fields = ['teacher_name', 'classroom_label', 'subject__name']

    def get_queryset(self):
        return SubjectTeacherAssignment.objects.all()

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return SubjectTeacherAssignmentCreateSerializer
        return SubjectTeacherAssignmentSerializer

    def perform_create(self, serializer):
        user = self.request.user
        serializer.save(
            organization=_get_org(user),
            assigned_by_id=user.id,
        )
