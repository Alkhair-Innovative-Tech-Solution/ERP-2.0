"""Enrollment KPI calculations built on the append-only EnrollmentEvent history.

Retention Rate (buildable now — needs only status history, not grade history):
    % of students enrolled at the start of Year Y who are still enrolled
    (anywhere, any grade) at the start of Year Y+1. Graduated students are
    excluded from the denominator (a success, not attrition).

`get_status_as_of(student, date)` walks the history and returns the applicable
status as of a date — the reusable primitive for all enrollment KPIs.
"""
from datetime import date

ACTIVE_STATUSES = {'enrolled', 're_enrolled'}


def academic_start_date(academic_year):
    """'2025-26' → date(2025, 4, 1). Academic year starts in April."""
    try:
        start_year = int(str(academic_year).split('-')[0])
        return date(start_year, 4, 1)
    except (ValueError, IndexError, TypeError):
        return None


def prev_academic_year(academic_year):
    """'2026-27' → '2025-26'."""
    try:
        start = int(str(academic_year).split('-')[0])
        return f"{start - 1}-{str(start)[-2:]}"
    except (ValueError, IndexError, TypeError):
        return None


def get_status_as_of(student, as_of):
    """Status of a student as of `as_of` (a date), walking enrollment_events.

    Uses student.enrollment_events.all() (Python filtering) so a prefetched
    queryset serves it without a per-student query. Falls back to 'enrolled'
    if the student had joined by then but has no prior event (e.g. backfilled
    history), or None if they hadn't joined yet.
    """
    prior = [e for e in student.enrollment_events.all() if e.event_date <= as_of]
    if prior:
        latest = max(prior, key=lambda e: (e.event_date, e.created_at or as_of))
        return latest.event_type
    joined = student.enrollment_year
    if joined and joined <= as_of.year:
        return 'enrolled'
    return None


def passed_final_last_year(student_ids, prev_year):
    """Ids (from `student_ids`) who PASSED the previous year's Final exam.

    "Passed out last year" = an approved Final-term Result for `prev_year` with
    pass_status='pass'. Result.objects is org-scoped by the request context, and
    we further restrict to the already-scoped student_ids, so this stays within
    the caller's campus/level scope.
    """
    from result.models import Result
    if not student_ids:
        return set()
    return set(
        Result.objects.filter(
            student_id__in=student_ids, academic_year=prev_year,
            exam_type='final', status='approved', pass_status='pass',
        ).values_list('student_id', flat=True)
    )


def calculate_retention_rate(students_qs, academic_year):
    """Retention rate for `academic_year` (Y+1) vs the previous year (Y).

    Cohort  = students who PASSED last year's Final exam (the "passed out last
              year" base). Graduated students are excluded — passing a terminal
              class and moving on is a success, not attrition.
    Retained = of that cohort, those enrolled at the start of Year Y+1.
    So retention now answers: of the students who passed last year, how many
    came back (enrolled) this year. `students_qs` should already be scoped
    (org / campus / level) and prefetch enrollment_events for efficiency.
    """
    prev = prev_academic_year(academic_year)
    start_y1 = academic_start_date(academic_year)
    empty = {
        'academic_year': academic_year, 'previous_year': prev,
        'cohort_size': 0, 'retained': 0, 'retention_rate': 0,
        'has_data': False,
    }
    if not prev or not start_y1:
        return empty

    students = list(students_qs)
    passed_ids = passed_final_last_year([s.id for s in students], prev)

    cohort = retained = 0
    for s in students:
        if s.id not in passed_ids:
            continue  # only students who passed last year form the base
        status_now = get_status_as_of(s, start_y1)
        if status_now == 'graduated':
            continue  # passed a terminal class and graduated — not attrition
        cohort += 1
        if status_now in ACTIVE_STATUSES:
            retained += 1

    return {
        'academic_year': academic_year,
        'previous_year': prev,
        'cohort_size': cohort,
        'retained': retained,
        'retention_rate': round(retained / cohort * 100, 1) if cohort else 0,
        'has_data': cohort > 0,
    }


def academic_end_date(academic_year):
    """'2025-26' → date(2026, 3, 31). Academic year ends in March of the next year."""
    try:
        start_year = int(str(academic_year).split('-')[0])
        return date(start_year + 1, 3, 31)
    except (ValueError, IndexError, TypeError):
        return None


def calculate_leavers(students_qs, academic_year):
    """How many students left DURING `academic_year` (April Y → March Y+1),
    broken down by exit type. Derived from EnrollmentEvent — no snapshot needed.
    """
    start = academic_start_date(academic_year)
    end = academic_end_date(academic_year)
    if not start or not end:
        return {'left': 0, 'transferred': 0, 'graduated': 0, 'total_exits': 0}

    counts = {'left': 0, 'transferred': 0, 'graduated': 0}
    for s in students_qs:
        for e in s.enrollment_events.all():
            if start <= e.event_date <= end and e.event_type in counts:
                counts[e.event_type] += 1
    counts['total_exits'] = counts['left'] + counts['transferred'] + counts['graduated']
    return counts


def calculate_dropout_rate(students_qs, academic_year):
    """Dropout % split by gender for `academic_year`.

    Dropout %(gender X) = (students, gender X, who LEFT with reason_code='dropout'
    within the year) / (students, gender X, enrolled at the start of the year) × 100.
    Computed against each gender's OWN enrolled population (not the total dropout
    count) — the common mistake that skews the ratio. "Dropout" is only the coded
    subset of Left (transfers/other excluded).
    """
    start = academic_start_date(academic_year)
    end = academic_end_date(academic_year)
    buckets = {
        'male':   {'enrolled': 0, 'dropouts': 0},
        'female': {'enrolled': 0, 'dropouts': 0},
    }
    if start and end:
        for s in students_qs:
            g = (getattr(s, 'gender', '') or '').lower()
            if g not in buckets:
                continue
            if get_status_as_of(s, start) in ACTIVE_STATUSES:
                buckets[g]['enrolled'] += 1
            if any(
                e.event_type == 'left' and e.reason_code == 'dropout' and start <= e.event_date <= end
                for e in s.enrollment_events.all()
            ):
                buckets[g]['dropouts'] += 1

    for g, b in buckets.items():
        b['dropout_rate'] = round(b['dropouts'] / b['enrolled'] * 100, 1) if b['enrolled'] else 0
    buckets['total_dropouts'] = buckets['male']['dropouts'] + buckets['female']['dropouts']
    return buckets


def calculate_progression_rate(students_qs, academic_year):
    """Grade progression for `academic_year` vs the previous year.

    Progressed = of students with a frozen grade in BOTH years (from
    EnrollmentSnapshot), those whose grade moved UP. Grade order comes from
    Grade.order, mapped by grade name because the snapshot stores the name, not
    the FK.

    `has_data` is False until start/end-of-year snapshots exist — this KPI reads
    the snapshot history, so it is empty until `capture_enrollment_snapshot` has
    run for the two years being compared.
    """
    from students.models import EnrollmentSnapshot
    from classes.models import Grade

    prev = prev_academic_year(academic_year)
    empty = {
        'academic_year': academic_year, 'previous_year': prev,
        'eligible': 0, 'progressed': 0, 'repeated': 0,
        'progression_rate': 0, 'has_data': False,
    }
    if not prev:
        return empty

    # grade name → order (first wins if a name repeats across campuses/levels).
    # _base_manager, not .objects: Grade uses OrganizationManager, which returns
    # nothing without a request user (e.g. from a command). The order map is just
    # a name→order lookup and org-agnostic, so bypassing the tenant filter is safe.
    order_map = {}
    for name, order in Grade._base_manager.values_list('name', 'order'):
        if name is not None:
            order_map.setdefault(name, order)

    student_ids = [s.id for s in students_qs]
    if not student_ids:
        return empty

    # Latest snapshot per (student, year): order by date so the last one wins,
    # i.e. their grade at the end of that year's activity.
    by_student = {}
    for sid, ay, grade in (
        EnrollmentSnapshot.all_objects
        .filter(student_id__in=student_ids, academic_year__in=[prev, academic_year])
        .order_by('snapshot_date')
        .values_list('student_id', 'academic_year', 'grade')
    ):
        by_student.setdefault(sid, {})[ay] = grade

    eligible = progressed = repeated = 0
    for years in by_student.values():
        g_prev, g_curr = years.get(prev), years.get(academic_year)
        o_prev, o_curr = order_map.get(g_prev), order_map.get(g_curr)
        if o_prev is None or o_curr is None:
            continue
        eligible += 1
        if o_curr > o_prev:
            progressed += 1
        elif o_curr == o_prev:
            repeated += 1

    return {
        'academic_year': academic_year,
        'previous_year': prev,
        'eligible': eligible,
        'progressed': progressed,
        'repeated': repeated,
        'progression_rate': round(progressed / eligible * 100, 1) if eligible else 0,
        'has_data': eligible > 0,
    }
