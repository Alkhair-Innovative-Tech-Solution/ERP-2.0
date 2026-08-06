"""
Unified Attendance Review API

Single endpoint:  GET /api/attendance/review/
Supports query params:
    ?from=YYYY-MM-DD&to=YYYY-MM-DD       – date range (defaults to current month)
    ?expand=campus|level|grade|classroom  – entity type to expand
    ?parent_id=<int>                      – ID of entity being expanded
    ?classroom_id=<int>                   – fetch student-date matrix for a classroom
"""
from datetime import date, timedelta, datetime
from calendar import monthrange

from django.db.models import (
    Count, Q, F, Value, CharField, IntegerField,
    Avg, Sum, Case, When, Subquery, OuterRef
)
from django.db.models.functions import Round

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from attendance.models import Attendance, StudentAttendance, Holiday
# Phase C10: dual-safe wrapper — legacy behavior (the RolePermission-table
# `view_attendance` toggle) delegates unchanged; central-auth resolves via
# local-DB role match (find_teacher/find_coordinator/find_principal) since
# no sms.attendance.* catalog permission exists to check instead. Imported
# under the original name so every `HasAttendanceViewPermission` reference
# below (including the docstring at line ~742) stays valid without a
# call-site-by-call-site rewrite.
from attendance_service.dual_auth import DualHasAttendanceViewPermission as HasAttendanceViewPermission
from attendance.services import calendar_utils
from attendance.services.metrics import attendance_percentage, percentage_from_statuses
from attendance.services.scope_resolver import resolve_scope

# The widest range the API will aggregate in one request.
MAX_RANGE_DAYS = 366

# Workflow states that count as "the teacher has handed this in". `draft` does
# not: a half-marked register nobody submitted is exactly what a missing-day
# alert is for.
SUBMITTED_OR_HIGHER = ('submitted', 'under_review', 'approved')


# ─────────────────────────────────────────────────────────────────────────────
#  Errors
# ─────────────────────────────────────────────────────────────────────────────

class ReviewParamError(Exception):
    """A query param the caller can fix — carries the code the frontend reads."""

    def __init__(self, code, message):
        super().__init__(message)
        self.code = code
        self.message = message


def _error(code, message, http_status):
    """Build an error response in the project's standard envelope.

    Shape matches utils.exceptions.custom_exception_handler, which the frontend
    already parses (see handleApiError in lib/api.ts). That handler only runs
    for *raised* DRF exceptions, so a Response returned directly has to build
    the envelope itself or the client silently loses `code` and folds it into
    the message text.

    `code` is what callers switch on; `message` is prose and may be reworded.
    """
    return Response(
        {
            'success': False,
            'error': {
                'code': code,
                'message': message,
                'details': {},
                'status': http_status,
            },
        },
        status=http_status,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Scope enforcement
# ─────────────────────────────────────────────────────────────────────────────

def _classroom_in_scope(scope, classroom_id):
    """Is *classroom_id* inside the user's scope?

    Returns True / False, or None when the classroom does not exist.

    Fails closed: every branch must find a positive reason to allow. A scope
    with no IDs at all reaches the final `return False`.
    """
    if scope.classroom_ids:
        # Teacher — scoped to an explicit list, nothing else to resolve.
        return classroom_id in scope.classroom_ids

    from classes.models import ClassRoom
    classroom = ClassRoom.objects.select_related('grade__level').filter(
        id=classroom_id,
    ).first()
    if classroom is None:
        return None

    if scope.grade_ids and classroom.grade_id in scope.grade_ids:
        return True
    if scope.level_ids and classroom.grade.level_id in scope.level_ids:
        return True
    if scope.campus_ids and classroom.grade.level.campus_id in scope.campus_ids:
        return True
    return False


def _parent_in_scope(scope, expand, parent_id):
    """Is the drill-down target *parent_id* inside the user's scope?

    `expand` names the child type being requested, so parent_id is one level up:
    expand=level → parent is a campus, expand=grade → parent is a level, and so on.

    Without this, any authenticated user could read aggregates for arbitrary
    campuses by guessing IDs — the drill-down params come from the client and
    are not trustworthy.
    """
    if parent_id is None:
        return True  # no drill-down target; the row builders fall back to scope

    if expand == 'level':                       # parent is a campus
        return parent_id in scope.campus_ids

    if expand == 'grade':                       # parent is a level
        if parent_id in scope.level_ids:
            return True
        if scope.campus_ids:
            from classes.models import Level
            return Level.objects.filter(
                id=parent_id, campus_id__in=scope.campus_ids,
            ).exists()
        return False

    if expand == 'classroom':                   # parent is a grade
        if parent_id in scope.grade_ids:
            return True
        from classes.models import Grade
        if scope.level_ids and Grade.objects.filter(
            id=parent_id, level_id__in=scope.level_ids,
        ).exists():
            return True
        if scope.campus_ids and Grade.objects.filter(
            id=parent_id, level__campus_id__in=scope.campus_ids,
        ).exists():
            return True
        return False

    return False


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _parse_int(raw, field_name):
    """Parse an optional integer query param. Returns None when absent."""
    if raw in (None, ''):
        return None
    try:
        return int(raw)
    except (TypeError, ValueError):
        raise ReviewParamError('INVALID_PARAM', f"'{field_name}' must be an integer.")


def _parse_one_date(raw, field_name):
    try:
        return datetime.strptime(raw, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        raise ReviewParamError(
            'INVALID_DATE_RANGE',
            f"'{field_name}' must be a date in YYYY-MM-DD format.",
        )


def _parse_date_range(request):
    """Return a validated (from_date, to_date), defaulting to month-start → today.

    This is a review of what already happened, so the range may never reach into
    the future. The previous default ran to the last day of the current month,
    which meant the out-of-the-box request was itself asking for future dates.
    """
    today = date.today()
    from_str = request.query_params.get('from')
    to_str = request.query_params.get('to')

    from_date = _parse_one_date(from_str, 'from') if from_str else today.replace(day=1)
    to_date = _parse_one_date(to_str, 'to') if to_str else today

    if from_date > to_date:
        raise ReviewParamError(
            'INVALID_DATE_RANGE', "'from' cannot be later than 'to'.",
        )
    if to_date > today:
        raise ReviewParamError(
            'INVALID_DATE_RANGE', 'Attendance cannot be reviewed for future dates.',
        )
    if (to_date - from_date).days + 1 > MAX_RANGE_DAYS:
        raise ReviewParamError(
            'RANGE_TOO_WIDE',
            f'Date range cannot exceed {MAX_RANGE_DAYS} days.',
        )

    return from_date, to_date


def _status_counts(qs, from_date, to_date):
    """Aggregate status breakdown across a queryset of Attendance records."""
    agg = qs.filter(
        date__gte=from_date,
        date__lte=to_date,
        is_deleted=False,
    ).aggregate(
        total_students=Sum('total_students'),
        present=Sum('present_count'),
        absent=Sum('absent_count'),
        late=Sum('late_count'),
        leave=Sum('leave_count'),
        excused=Sum('excused_count'),
    )
    return {k: v or 0 for k, v in agg.items()}


def _scoped_classroom_qs(scope):
    """Every classroom the user may see, whatever level their scope sits at.

    Fails closed: a scope carrying no IDs gets none(), not everything.
    """
    from classes.models import ClassRoom

    if scope.classroom_ids:
        return ClassRoom.objects.filter(id__in=scope.classroom_ids)
    if scope.grade_ids:
        return ClassRoom.objects.filter(grade_id__in=scope.grade_ids)
    if scope.level_ids:
        return ClassRoom.objects.filter(grade__level_id__in=scope.level_ids)
    if scope.campus_ids:
        return ClassRoom.objects.filter(grade__level__campus_id__in=scope.campus_ids)
    return ClassRoom.objects.none()


def _missing_days(scope, from_date, to_date, holiday_index):
    """Working days with no submitted attendance, per classroom in scope.

    A day counts as missing when it is a teaching day for *that* classroom and
    no Attendance row for it has reached `submitted`. Holidays are resolved per
    classroom, so a level on exam break is not reported as delinquent.

    Days before a classroom existed are skipped — it cannot have missed a
    register it had no register for. Note this leans on ClassRoom.created_at,
    which for imported data is the import date rather than the real one; such a
    classroom under-reports missing days for its imported history.
    """
    classrooms = list(
        _scoped_classroom_qs(scope).select_related('grade__level', 'class_teacher')
    )
    if not classrooms:
        return []

    submitted = set(
        Attendance.objects.filter(
            classroom_id__in=[c.id for c in classrooms],
            date__gte=from_date,
            date__lte=to_date,
            is_deleted=False,
            status__in=SUBMITTED_OR_HIGHER,
        ).values_list('classroom_id', 'date')
    )

    missing = []
    for classroom in classrooms:
        holidays = holiday_index.for_classroom(
            classroom.grade.level_id, classroom.grade_id,
        )
        created_on = (
            classroom.created_at.date() if classroom.created_at else from_date
        )
        dates = [
            str(day)
            for day in calendar_utils.working_days_in_range(from_date, to_date, holidays)
            if day >= created_on and (classroom.id, day) not in submitted
        ]
        if not dates:
            continue

        teacher = classroom.class_teacher
        missing.append({
            'classroom_id': classroom.id,
            'classroom_label': str(classroom),
            'class_teacher': (
                {'id': teacher.id, 'name': teacher.full_name} if teacher else None
            ),
            'dates': dates,
        })
    return missing


def _scope_label(scope):
    """Human description of what the user is looking at, for the page subtitle.

    Read-only cosmetics — never let this decide what data is returned.
    """
    from campus.models import Campus
    from classes.models import ClassRoom, Level
    from users.models import Organization

    if scope.role == 'teacher':
        names = list(
            ClassRoom.objects.filter(id__in=scope.classroom_ids)
            .select_related('grade')
        )
        return ', '.join(str(c) for c in names) or 'No classes assigned'

    if scope.role == 'coordinator':
        names = list(
            Level.objects.filter(id__in=scope.level_ids).values_list('name', flat=True)
        )
        return ' & '.join(names) or 'No levels assigned'

    if scope.role == 'principal':
        campus = Campus.objects.filter(id__in=scope.campus_ids).first()
        return campus.campus_name if campus else 'No campus assigned'

    if scope.role == 'org_admin':
        org = Organization.objects.filter(id=scope.organization_id).first()
        campus_count = len(scope.campus_ids)
        if org:
            return f'{org.name} — {campus_count} campus{"es" if campus_count != 1 else ""}'
        return 'All campuses'

    return ''


def _summary(scope, from_date, to_date, missing_days):
    """Top-of-page totals for the requested range."""
    from students.models import Student

    classrooms = _scoped_classroom_qs(scope)
    counts = _status_counts(
        Attendance.objects.filter(classroom__in=classrooms), from_date, to_date,
    )
    return {
        'total_students': Student.objects.filter(
            classroom__in=classrooms, is_draft=False,
        ).count(),
        'avg_rate': _pct_from_counts(counts),
        # One count per classroom-day, matching what the alert lists — three
        # classes each missing two days reads as 6, not 3.
        'missing_submissions': sum(len(m['dates']) for m in missing_days),
    }


def _date_range_payload(scope, from_date, to_date, holiday_index):
    """The `date_range` block, including how many teaching days it covers.

    working_days is scope-aware: it subtracts the holidays that apply to this
    user's own levels, not every holiday in the organization.
    """
    holidays = holiday_index.for_scope(
        level_ids=scope.level_ids, grade_ids=scope.grade_ids,
    )
    return {
        'from': str(from_date),
        'to': str(to_date),
        'working_days': len(
            calendar_utils.working_days_in_range(from_date, to_date, holidays)
        ),
    }


def _pct_from_counts(counts):
    """Attendance percentage for a row, from its own aggregated counts.

    Takes the counts the row already computed rather than re-querying, so a row
    can never report a percentage that disagrees with the breakdown beside it.
    """
    return attendance_percentage(
        present=counts['present'],
        total=counts['total_students'],
        leave=counts['leave'],
        excused=counts['excused'],
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Campus-Level rows (Org Admin start)
# ─────────────────────────────────────────────────────────────────────────────

def _campus_rows(scope, from_date, to_date):
    from campus.models import Campus
    campuses = Campus.objects.filter(id__in=scope.campus_ids).order_by('campus_name')

    rows = []
    for c in campuses:
        att_qs = Attendance.objects.filter(
            classroom__grade__level__campus_id=c.id,
        )
        counts = _status_counts(att_qs, from_date, to_date)
        pct = _pct_from_counts(counts)

        rows.append({
            'id': c.id,
            'type': 'campus',
            'name': c.campus_name,
            'code': c.campus_code,
            'attendance_pct': pct,
            'counts': counts,
            'has_children': True,
            'child_type': 'level',
        })
    return rows


# ─────────────────────────────────────────────────────────────────────────────
#  Level rows  (Principal start / Campus drill-down)
# ─────────────────────────────────────────────────────────────────────────────

def _level_rows(scope, from_date, to_date, campus_id=None):
    from classes.models import Level

    if campus_id:
        levels = Level.objects.filter(campus_id=campus_id).order_by('name')
    elif scope.level_ids:
        levels = Level.objects.filter(id__in=scope.level_ids).order_by('name')
    elif scope.campus_ids:
        levels = Level.objects.filter(campus_id__in=scope.campus_ids).order_by('name')
    else:
        levels = Level.objects.none()

    rows = []
    for lv in levels:
        att_qs = Attendance.objects.filter(
            classroom__grade__level_id=lv.id,
        )
        counts = _status_counts(att_qs, from_date, to_date)
        pct = _pct_from_counts(counts)

        # Coordinator name(s)
        coord_name = lv.coordinator_name

        rows.append({
            'id': lv.id,
            'type': 'level',
            'name': lv.name,
            'shift': lv.shift,
            'campus_id': lv.campus_id,
            'coordinator': coord_name,
            'attendance_pct': pct,
            'counts': counts,
            'has_children': True,
            'child_type': 'grade',
        })
    return rows


# ─────────────────────────────────────────────────────────────────────────────
#  Grade rows  (Coordinator start / Level drill-down)
# ─────────────────────────────────────────────────────────────────────────────

def _grade_rows(scope, from_date, to_date, level_id=None):
    from classes.models import Grade

    if level_id:
        grades = Grade.objects.filter(level_id=level_id).order_by('order', 'name')
    elif scope.level_ids:
        grades = Grade.objects.filter(level_id__in=scope.level_ids).order_by('order', 'name')
    elif scope.grade_ids:
        grades = Grade.objects.filter(id__in=scope.grade_ids).order_by('order', 'name')
    else:
        grades = Grade.objects.none()

    rows = []
    for g in grades:
        att_qs = Attendance.objects.filter(
            classroom__grade_id=g.id,
        )
        counts = _status_counts(att_qs, from_date, to_date)
        pct = _pct_from_counts(counts)

        rows.append({
            'id': g.id,
            'type': 'grade',
            'name': g.name,
            'code': g.code,
            'level_id': g.level_id,
            'attendance_pct': pct,
            'counts': counts,
            'has_children': True,
            'child_type': 'classroom',
        })
    return rows


# ─────────────────────────────────────────────────────────────────────────────
#  Classroom rows (Grade drill-down)
# ─────────────────────────────────────────────────────────────────────────────

def _classroom_rows(scope, from_date, to_date, grade_id=None):
    from classes.models import ClassRoom

    if grade_id:
        classrooms = ClassRoom.objects.filter(grade_id=grade_id)
    elif scope.classroom_ids:
        classrooms = ClassRoom.objects.filter(id__in=scope.classroom_ids)
    else:
        classrooms = ClassRoom.objects.none()

    classrooms = classrooms.select_related(
        'grade', 'class_teacher', 'grade__level'
    ).order_by('grade__name', 'section')

    rows = []
    for cr in classrooms:
        att_qs = Attendance.objects.filter(classroom_id=cr.id)
        counts = _status_counts(att_qs, from_date, to_date)
        pct = _pct_from_counts(counts)

        # Latest attendance status for this classroom
        latest_att = att_qs.filter(
            date__gte=from_date,
            date__lte=to_date,
            is_deleted=False,
        ).order_by('-date').first()

        teacher_info = None
        if cr.class_teacher:
            teacher_info = {
                'id': cr.class_teacher.id,
                'name': cr.class_teacher.full_name,
                'employee_code': cr.class_teacher.employee_code,
            }

        rows.append({
            'id': cr.id,
            'type': 'classroom',
            'name': str(cr),
            'code': cr.code,
            'section': cr.section,
            'shift': cr.shift,
            'grade_name': cr.grade.name if cr.grade else '',
            'class_teacher': teacher_info,
            'student_count': cr.students.filter(is_draft=False).count(),
            'attendance_pct': pct,
            'counts': counts,
            'latest_status': latest_att.status if latest_att else None,
            'latest_date': str(latest_att.date) if latest_att else None,
            'has_children': True,
            'child_type': 'student_matrix',
        })
    return rows


# ─────────────────────────────────────────────────────────────────────────────
#  Student Monthly Matrix (Classroom drill-down — final level)
# ─────────────────────────────────────────────────────────────────────────────

def _student_matrix(scope, from_date, to_date, classroom_id):
    """Build the date-wise student attendance matrix for a single classroom."""
    from students.models import Student

    # Get all students in this classroom
    students = Student.objects.filter(
        classroom_id=classroom_id,
        is_draft=False,
    ).order_by('name')

    # Get all attendance records for this classroom in the date range
    attendances = Attendance.objects.filter(
        classroom_id=classroom_id,
        date__gte=from_date,
        date__lte=to_date,
        is_deleted=False,
    ).values_list('id', 'date', 'status')

    att_map = {}  # date -> (attendance_id, workflow_status)
    for att_id, att_date, att_status in attendances:
        att_map[att_date] = (att_id, att_status)

    # Get all student attendances in bulk
    sa_qs = StudentAttendance.objects.filter(
        attendance__classroom_id=classroom_id,
        attendance__date__gte=from_date,
        attendance__date__lte=to_date,
        attendance__is_deleted=False,
        is_deleted=False,
    ).select_related('student', 'attendance').values(
        'student_id',
        'attendance__date',
        'status',
    )

    # Build lookup: student_id -> {date_str: status}
    sa_lookup = {}
    for sa in sa_qs:
        sid = sa['student_id']
        d = str(sa['attendance__date'])
        s = sa['status']
        sa_lookup.setdefault(sid, {})[d] = s

    # Holidays are resolved for *this* classroom's grade and level. Asking
    # org-wide would paint another level's exam break onto these students and
    # quietly inflate their percentage.
    from classes.models import ClassRoom
    classroom = ClassRoom.objects.select_related('grade__level').get(id=classroom_id)
    holidays = calendar_utils.holidays_in_range(
        organization_id=scope.organization_id,
        from_date=from_date,
        to_date=to_date,
        level_ids=[classroom.grade.level_id],
        grade_ids=[classroom.grade_id],
    )

    dates = [
        {
            'date': str(day),
            'day': day.strftime('%a'),
            'type': calendar_utils.classify_day(day, holidays),
        }
        for day in calendar_utils.date_range(from_date, to_date)
    ]

    # Build student rows
    matrix = []
    for student in students:
        student_dates = sa_lookup.get(student.id, {})
        date_statuses = {}

        for date_info in dates:
            ds = date_info['date']
            if date_info['type'] == 'weekend':
                date_statuses[ds] = 'weekend'
            elif date_info['type'] == 'holiday':
                date_statuses[ds] = 'holiday'
            else:
                date_statuses[ds] = student_dates.get(ds, 'unmarked')

        # Count stats for this student
        status_counts = {'present': 0, 'absent': 0, 'late': 0, 'leave': 0, 'excused': 0}
        for st in student_dates.values():
            if st in status_counts:
                status_counts[st] += 1

        student_pct = percentage_from_statuses(status_counts)

        student_data = {
            'student_id': student.id,
            'student_name': student.name if not scope.anonymised else f"Student #{student.id}",
            'father_name': getattr(student, 'father_name', '') if not scope.anonymised else '',
            'gr_no': getattr(student, 'student_id', '') if not scope.anonymised else '',
            'dates': date_statuses,
            'stats': status_counts,
            'attendance_pct': student_pct,
        }
        matrix.append(student_data)

    # Workflow info per date
    workflow = {}
    for d_str_date, (att_id, att_wf_status) in att_map.items():
        workflow[str(d_str_date)] = {
            'attendance_id': att_id,
            'status': att_wf_status,
        }

    return {
        'dates': dates,
        'students': matrix,
        'workflow': workflow,
        'total_students': len(matrix),
        'working_days': sum(1 for d in dates if d['type'] == 'working'),
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Main View
# ─────────────────────────────────────────────────────────────────────────────

def _guard(request):
    """Resolve the caller's scope, or the error response that denies them.

    Returns (scope, None) when the request may proceed, or (None, response).
    Shared so a second endpoint cannot forget one of the checks.
    """
    scope = resolve_scope(request.user)
    if scope.is_empty:
        return None, _error(
            'SCOPE_EMPTY',
            'No attendance records are within your access scope.',
            status.HTTP_403_FORBIDDEN,
        )
    return scope, None


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAttendanceViewPermission])
def attendance_review_missing(request):
    """
    Classrooms in scope with no submitted attendance, per working day.

    GET /api/attendance/review/missing/?from=YYYY-MM-DD&to=YYYY-MM-DD

    The same list the main payload embeds, on its own — for the dedicated
    "Missing submissions" tab, which paginates and refreshes separately from
    the grid.
    """
    scope, denied = _guard(request)
    if denied:
        return denied

    try:
        from_date, to_date = _parse_date_range(request)
    except ReviewParamError as exc:
        return _error(exc.code, exc.message, status.HTTP_400_BAD_REQUEST)

    holiday_index = calendar_utils.holiday_index_in_range(
        scope.organization_id, from_date, to_date,
    )
    missing_days = _missing_days(scope, from_date, to_date, holiday_index)

    return Response({
        'type': 'missing_days',
        'missing_days': missing_days,
        'total_missing': sum(len(m['dates']) for m in missing_days),
        'meta': scope.to_meta(_scope_label(scope)),
        'date_range': _date_range_payload(scope, from_date, to_date, holiday_index),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated, HasAttendanceViewPermission])
def attendance_review(request):
    """
    Unified Attendance Review endpoint.

    Query params:
      - from, to         date range (default: current month)
      - expand            entity type to drill into: campus | level | grade | classroom
      - parent_id         ID of the parent entity being expanded
      - classroom_id      fetch student matrix for this classroom

    Access is enforced in three layers, all server-side:
      1. HasAttendanceViewPermission — the `view_attendance` role toggle.
      2. scope.is_empty — the user resolves to no scope at all.
      3. Per-request checks below — the requested IDs are inside that scope.

    `meta` in the response is a UI hint for the frontend, never the enforcement
    point. A client that ignores meta.show_roll still cannot read a roll.
    """
    scope = resolve_scope(request.user)

    # Layer 2: a role we do not recognise, or a profile with nothing assigned
    # (e.g. a teacher whose Teacher record is missing), sees nothing.
    if scope.is_empty:
        return _error(
            'SCOPE_EMPTY',
            'No attendance records are within your access scope.',
            status.HTTP_403_FORBIDDEN,
        )

    try:
        from_date, to_date = _parse_date_range(request)
        parent_id = _parse_int(request.query_params.get('parent_id'), 'parent_id')
        classroom_id = _parse_int(request.query_params.get('classroom_id'), 'classroom_id')
    except ReviewParamError as exc:
        return _error(exc.code, exc.message, status.HTTP_400_BAD_REQUEST)

    expand = request.query_params.get('expand')

    # Loaded once and passed down: missing-day detection asks about holidays for
    # every classroom in scope, and querying per classroom would be one query
    # per row.
    holiday_index = calendar_utils.holiday_index_in_range(
        scope.organization_id, from_date, to_date,
    )

    # ── Student matrix request ───────────────────────────────────────────────
    if classroom_id is not None:
        # Roll access is a property of the role, checked before we look at the
        # classroom at all — these roles may never read student-level data,
        # regardless of which classroom they ask for.
        if not scope.show_roll:
            return _error(
                'ROLL_ACCESS_DENIED',
                'Your role cannot view individual student attendance.',
                status.HTTP_403_FORBIDDEN,
            )

        access = _classroom_in_scope(scope, classroom_id)
        if access is None:
            return _error(
                'CLASSROOM_NOT_FOUND',
                'Classroom not found.',
                status.HTTP_404_NOT_FOUND,
            )
        if not access:
            return _error(
                'SCOPE_VIOLATION',
                'This classroom is outside your access scope.',
                status.HTTP_403_FORBIDDEN,
            )

        matrix = _student_matrix(scope, from_date, to_date, classroom_id)
        return Response({
            'type': 'student_matrix',
            'data': matrix,
            'meta': scope.to_meta(_scope_label(scope)),
            'date_range': _date_range_payload(scope, from_date, to_date, holiday_index),
        })

    # ── Drill-down expansion ─────────────────────────────────────────────────
    if expand and not _parent_in_scope(scope, expand, parent_id):
        return _error(
            'SCOPE_VIOLATION',
            'The requested item is outside your access scope.',
            status.HTTP_403_FORBIDDEN,
        )

    if expand == 'level':
        rows = _level_rows(scope, from_date, to_date, campus_id=parent_id)
    elif expand == 'grade':
        rows = _grade_rows(scope, from_date, to_date, level_id=parent_id)
    elif expand == 'classroom':
        rows = _classroom_rows(scope, from_date, to_date, grade_id=parent_id)
    elif expand == 'campus':
        rows = _campus_rows(scope, from_date, to_date)
    else:
        # ── Initial load: return top-level based on role ─────────────────────
        start = scope.start_level
        if start == 'campus':
            rows = _campus_rows(scope, from_date, to_date)
        elif start == 'level':
            rows = _level_rows(scope, from_date, to_date)
        elif start == 'grade':
            rows = _grade_rows(scope, from_date, to_date)
        elif start == 'classroom':
            rows = _classroom_rows(scope, from_date, to_date)
        elif start == 'org':
            # Donor: single org summary row
            att_qs = Attendance.objects.filter(
                organization_id=scope.organization_id,
            )
            counts = _status_counts(att_qs, from_date, to_date)
            pct = _pct_from_counts(counts)
            rows = [{
                'id': scope.organization_id,
                'type': 'org',
                'name': 'Organization',
                'attendance_pct': pct,
                'counts': counts,
                'has_children': False,
            }]
        else:
            rows = []

    payload = {
        'type': 'tree',
        'rows': rows,
        'meta': scope.to_meta(_scope_label(scope)),
        'date_range': _date_range_payload(scope, from_date, to_date, holiday_index),
    }

    # Only the initial load carries the page-level blocks. A drill-down expand
    # returns rows for one branch; recomputing whole-scope totals for it would
    # be work the caller already has and is about to throw away.
    if not expand:
        missing_days = _missing_days(scope, from_date, to_date, holiday_index)
        payload['missing_days'] = missing_days
        payload['summary'] = _summary(scope, from_date, to_date, missing_days)

    return Response(payload)
