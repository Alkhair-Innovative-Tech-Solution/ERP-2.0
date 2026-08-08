import csv
import io
import re
from django.db import transaction


def _safe_cnic(value):
    """Return cleaned 13-digit CNIC or None if invalid."""
    if not value:
        return None
    clean = re.sub(r'\D', '', str(value))
    return clean if len(clean) == 13 else None


def _safe_phone(value):
    """Return phone value if it looks valid, else None."""
    if not value:
        return None
    try:
        from phonenumber_field.phonenumber import PhoneNumber
        pn = PhoneNumber.from_string(value)
        if pn.is_valid():
            return value
        # Try with Pakistan country code
        pn2 = PhoneNumber.from_string(value, region='PK')
        return value if pn2.is_valid() else None
    except Exception:
        return None


def _safe_int(value, default=0):
    """Return int value or default if invalid."""
    try:
        return int(str(value).strip())
    except (ValueError, TypeError):
        return default


def _safe_email(value):
    """Return email if valid format, else None."""
    if not value:
        return None
    from django.core.validators import validate_email
    try:
        validate_email(value)
        return value
    except Exception:
        return None

REQUIRED_FIELDS = ['name', 'gender', 'dob', 'grade', 'section', 'shift', 'admission_year']

OPTIONAL_FIELDS = ['student_id', 'classroom', 'campus', 'dob', 'religion', 'mother_tongue', 'emergency_contact', 'address', 'siblings_count',
                   'email', 'phone_number', 'father_name', 'father_contact',
                   'mother_name', 'mother_contact', 'guardian_name', 'guardian_contact',
                   'blood_group', 'student_cnic', 'nationality', 'place_of_birth',
                   'father_cnic', 'mother_cnic', 'guardian_cnic', 'emergency_relationship']


TEMPLATE_HEADERS = REQUIRED_FIELDS + OPTIONAL_FIELDS

SAMPLE_ROW = {
    'name': 'Ahmed Khan',
    'student_id': 'KHI-001',
    'classroom': 'Grade 3 - A',
    'campus': 'Karachi Campus',
    'gender': 'male',
    'dob': '2015-03-15',
    'religion': 'Islam',
    'mother_tongue': 'Urdu',
    'emergency_contact': '+923001234567',
    'address': 'House 12 Street 4 Block A Karachi',
    'siblings_count': '2',
    'grade': 'Grade 3',
    'section': 'A',
    'shift': 'morning',
    'admission_year': '2024',
    'email': '',
    'phone_number': '',
    'father_name': 'Muhammad Khan',
    'father_contact': '+923009876543',
    'mother_name': 'Fatima Khan',
    'mother_contact': '',
    'guardian_name': '',
    'guardian_contact': '',
    'blood_group': 'B+',
    'student_cnic': '',
    'nationality': 'Pakistani',
    'place_of_birth': 'Karachi',
    'father_cnic': '',
    'mother_cnic': '',
    'guardian_cnic': '',
    'emergency_relationship': 'Father',
}



def generate_template_csv():
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=TEMPLATE_HEADERS)
    writer.writeheader()
    writer.writerow(SAMPLE_ROW)
    return output.getvalue()


BATCH_SIZE = 100  # bulk_create batch size


def import_students_from_csv(path, user):
    """
    Read CSV at `path` and create Student records for each row.
    Phase 1: Validate all rows — collect valid Student objects.
    Phase 2: bulk_create in batches of BATCH_SIZE (fast, minimal DB calls).
    Phase 3: Create user accounts for all inserted students.
    Returns a list of per-row report dicts: {row, status, message, name?}
    """
    from students.models import Student
    from campus.models import Campus
    from django.utils.dateparse import parse_date
    from datetime import datetime as _dt
    from django.db.models import Q
    import re

    # Resolve org and optional campus scope from user
    org = getattr(user, 'organization', None)
    if org is None:
        org_id = getattr(user, 'org_id', None)
        if org_id:
            try:
                from users.models import Organization
                org = Organization.all_objects.get(pk=org_id)
            except Exception:
                pass
    user_campus = None
    if user.is_principal():
        user_campus = getattr(user, 'campus', None)
        if not user_campus:
            try:
                from principals.models import Principal
                p = Principal.objects.get(employee_code=user.username)
                user_campus = p.campus
            except Exception:
                pass

    reports = []

    rows = None
    for enc in ('utf-8-sig', 'cp1252', 'latin-1'):
        try:
            with open(path, 'r', encoding=enc) as f:
                reader = csv.DictReader(f)
                rows = list(reader)
            break
        except UnicodeDecodeError:
            continue
        except Exception as e:
            return [{'row': 0, 'status': 'error', 'message': f'Could not read file: {e}'}]
    if rows is None:
        return [{'row': 0, 'status': 'error', 'message': 'Could not read file: unsupported encoding. Save as UTF-8 or Excel CSV.'}]

    if not rows:
        return [{'row': 0, 'status': 'error', 'message': 'CSV file is empty or has no data rows.'}]

    if reader.fieldnames:
        missing_headers = [h for h in REQUIRED_FIELDS if h not in reader.fieldnames]
        if missing_headers:
            return [{'row': 0, 'status': 'error',
                     'message': f'Missing required columns: {", ".join(missing_headers)}'}]

    # ── Pre-fetch existing student IDs (one query instead of N) ──────────────
    existing_ids = set(
        Student.objects.filter(organization=org).values_list('student_id', flat=True)
    ) if org else set()

    # ── Pre-fetch existing CNICs ──────────────────────────────────────────────
    existing_cnics = set(
        Student.objects.filter(organization=org)
        .exclude(student_cnic__isnull=True).exclude(student_cnic='')
        .values_list('student_cnic', flat=True)
    ) if org else set()

    # ── Quota check once ──────────────────────────────────────────────────────
    current_count = Student.objects.filter(organization=org).count() if org else 0
    quota_limit = org.max_students if org else None

    VALID_BLOOD_GROUPS = {'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'}

    def _parse_date(raw):
        d = parse_date(raw)
        if d:
            return d
        for fmt in ('%d/%m/%Y', '%m/%d/%Y', '%d-%m-%Y', '%Y/%m/%d'):
            try:
                return _dt.strptime(raw, fmt).date()
            except ValueError:
                continue
        return None

    def opt(row, key):
        v = (row.get(key) or '').strip()
        return v if v else None

    # ── Campus / classroom resolution cache (avoid repeat DB hits) ────────────
    _campus_cache = {}
    _classroom_cache = {}

    def _resolve_campus(campus_name_val):
        if campus_name_val in _campus_cache:
            return _campus_cache[campus_name_val]
        campus = Campus.objects.filter(
            Q(campus_name__icontains=campus_name_val) |
            Q(campus_code__iexact=campus_name_val) |
            Q(campus_code__icontains=campus_name_val.replace(' ', '')),
            organization=org
        ).first()
        if not campus and any(c.isdigit() for c in campus_name_val):
            digits = re.findall(r'\d+', campus_name_val)
            if digits:
                num = str(int(digits[0]))
                campus = Campus.objects.filter(
                    Q(campus_name__icontains=num) | Q(campus_code__icontains=num),
                    organization=org
                ).first()
        _campus_cache[campus_name_val] = campus
        return campus

    def _resolve_classroom(classroom_str, campus, shift=None):
        cache_key = (classroom_str, campus.pk if campus else None, shift)
        if cache_key in _classroom_cache:
            return _classroom_cache[cache_key]
        from classes.models import ClassRoom
        base_query = ClassRoom.objects.filter(organization=org)
        if campus:
            base_query = base_query.filter(grade__level__campus=campus)
        if shift:
            base_query = base_query.filter(shift=shift)
        cr = base_query.filter(Q(code=classroom_str) | Q(code__icontains=classroom_str)).first()
        if not cr:
            norm = classroom_str.lower().replace('grade', '').replace('class', '').strip()
            if ' - ' in norm:
                g_part, s_part = norm.split(' - ', 1)
                cr = base_query.filter(
                    Q(grade__name__icontains=g_part.strip()) & Q(section__iexact=s_part.strip())
                ).first()
            if not cr:
                # Fallback: match by grade name and section without classroom column
                cr = base_query.filter(
                    Q(grade__name__icontains=norm.strip()) | Q(grade__name__iexact=classroom_str.strip())
                ).first()
        _classroom_cache[cache_key] = cr
        return cr

    # ─────────────────────────────────────────────────────────────────────────
    # PHASE 1 — Validate all rows, build list of valid Student objects
    # ─────────────────────────────────────────────────────────────────────────
    valid_students = []   # list of (row_num, name, Student instance)
    seen_ids_this_batch = set()   # avoid duplicate student_id within same CSV
    seen_cnics_this_batch = set() # avoid duplicate CNIC within same CSV

    for idx, row in enumerate(rows, start=2):
        row_num = idx
        name = (row.get('name') or '').strip()

        try:
            # Required fields
            missing = [f for f in REQUIRED_FIELDS if not (row.get(f) or '').strip()]
            if missing:
                reports.append({'row': row_num, 'status': 'error', 'name': name or '—',
                                'message': f'Missing required fields: {", ".join(missing)}'})
                continue

            grade_name  = row['grade'].strip()
            section     = row['section'].strip().upper()
            shift       = row['shift'].strip().lower()
            admission_year_str = row['admission_year'].strip()

            if shift not in ('morning', 'afternoon'):
                reports.append({'row': row_num, 'status': 'error', 'name': name,
                                'message': f'Invalid shift "{shift}". Use "morning" or "afternoon".'})
                continue

            if section not in ('A', 'B', 'C', 'D', 'E', 'F'):
                reports.append({'row': row_num, 'status': 'error', 'name': name,
                                'message': f'Invalid section "{section}". Use A-F.'})
                continue

            try:
                admission_year = int(admission_year_str)
                if not (2000 <= admission_year <= 2030):
                    raise ValueError()
            except ValueError:
                reports.append({'row': row_num, 'status': 'error', 'name': name,
                                'message': f'Invalid admission_year "{admission_year_str}". Must be 2000–2030.'})
                continue

            gender = row['gender'].strip().lower()
            if gender not in ('male', 'female'):
                reports.append({'row': row_num, 'status': 'error', 'name': name,
                                'message': f'Invalid gender "{gender}". Use "male" or "female".'})
                continue

            dob = _parse_date(row['dob'].strip())
            if not dob:
                reports.append({'row': row_num, 'status': 'error', 'name': name,
                                'message': f'Invalid dob "{row["dob"]}". Use YYYY-MM-DD or DD/MM/YYYY.'})
                continue

            student_id_val  = opt(row, 'student_id')
            classroom_str   = opt(row, 'classroom')
            campus_name_val = opt(row, 'campus')

            # Blood group
            raw_bg = opt(row, 'blood_group')
            blood_group_val = raw_bg if raw_bg and raw_bg.upper() in VALID_BLOOD_GROUPS else None

            # Duplicate student_id check (O(1) against pre-fetched set)
            if student_id_val:
                if student_id_val in existing_ids or student_id_val in seen_ids_this_batch:
                    reports.append({'row': row_num, 'status': 'skipped', 'name': name,
                                    'message': f'Student ID "{student_id_val}" already exists. Skipped.'})
                    continue
                seen_ids_this_batch.add(student_id_val)

            # Duplicate CNIC check
            raw_cnic = opt(row, 'student_cnic')
            cnic_val = _safe_cnic(raw_cnic)
            if cnic_val:
                if cnic_val in existing_cnics or cnic_val in seen_cnics_this_batch:
                    reports.append({'row': row_num, 'status': 'error', 'name': name,
                                    'message': f'CNIC "{raw_cnic}" already exists. Student not added.'})
                    continue
                seen_cnics_this_batch.add(cnic_val)

            # Quota check (counter updated as we collect valid students)
            if quota_limit is not None and (current_count + len(valid_students)) >= quota_limit:
                reports.append({'row': row_num, 'status': 'error', 'name': name,
                                'message': 'Student quota exceeded. Upgrade your plan to enroll more students.'})
                continue

            # Campus resolution (cached)
            campus = user_campus
            if campus_name_val and org:
                campus = _resolve_campus(campus_name_val)

            # Classroom resolution (cached)
            assigned_classroom = None
            if classroom_str:
                assigned_classroom = _resolve_classroom(classroom_str, campus, shift=shift)
                if assigned_classroom and not campus:
                    campus = assigned_classroom.campus

            # Auto-assign classroom from grade+section+shift if not explicitly given
            if not assigned_classroom and campus:
                from classes.models import ClassRoom
                norm_grade = grade_name.lower().replace('grade', '').replace('class', '').strip()
                assigned_classroom = ClassRoom.objects.filter(
                    organization=org,
                    grade__level__campus=campus,
                    section__iexact=section,
                    shift__iexact=shift,
                ).filter(
                    Q(grade__name__iexact=grade_name) | Q(grade__name__icontains=norm_grade)
                ).first()

            # Grade fallback
            if not campus and org:
                from classes.models import Grade
                norm_grade = grade_name.lower().replace('grade', '').replace('class', '').strip()
                mg = Grade.objects.filter(
                    Q(name__icontains=grade_name) | Q(name__icontains=norm_grade),
                    organization=org
                ).select_related('campus').first()
                if mg and mg.campus:
                    campus = mg.campus

            if not campus:
                reports.append({'row': row_num, 'status': 'error', 'name': name,
                                'message': f'Could not resolve campus for grade "{grade_name}".'})
                continue

            student = Student(
                name=name,
                student_id=student_id_val,
                classroom=assigned_classroom,
                gender=gender,
                dob=dob,
                religion=(row.get('religion') or 'Islam').strip(),
                mother_tongue=(row.get('mother_tongue') or 'Urdu').strip(),
                emergency_contact=_safe_phone(opt(row, 'emergency_contact')),
                address=(row.get('address') or '').strip(),
                siblings_count=_safe_int(row.get('siblings_count'), default=0),
                current_grade=grade_name,
                section=section,
                shift=shift,
                enrollment_year=admission_year,
                campus=campus,
                organization=org,
                is_draft=False,
                email=_safe_email(opt(row, 'email')),
                phone_number=_safe_phone(opt(row, 'phone_number')),
                father_name=opt(row, 'father_name'),
                father_contact=_safe_phone(opt(row, 'father_contact')),
                mother_name=opt(row, 'mother_name'),
                mother_contact=_safe_phone(opt(row, 'mother_contact')),
                guardian_name=opt(row, 'guardian_name'),
                guardian_contact=_safe_phone(opt(row, 'guardian_contact')),
                blood_group=blood_group_val,
                student_cnic=cnic_val,
                nationality=opt(row, 'nationality'),
                place_of_birth=opt(row, 'place_of_birth'),
                father_cnic=_safe_cnic(opt(row, 'father_cnic')),
                mother_cnic=_safe_cnic(opt(row, 'mother_cnic')),
                guardian_cnic=_safe_cnic(opt(row, 'guardian_cnic')),
                emergency_relationship=opt(row, 'emergency_relationship'),
            )

            # Validate fields before bulk insert.
            # If only optional fields fail validation, blank them and retry
            # so the row is still uploaded rather than rejected.
            try:
                student.full_clean()
            except Exception as ve:
                if hasattr(ve, 'message_dict'):
                    failing = set(ve.message_dict.keys()) - {'__all__'}
                    required_failing = failing - set(OPTIONAL_FIELDS)
                    if required_failing:
                        msg = '; '.join(f'{f}: {", ".join(e)}' for f, e in ve.message_dict.items() if f in required_failing)
                        reports.append({'row': row_num, 'status': 'error', 'name': name, 'message': msg})
                        continue
                    # Only optional fields failed — blank them and retry
                    for field in failing:
                        setattr(student, field, None)
                    try:
                        student.full_clean()
                    except Exception as ve2:
                        msg = str(ve2)
                        if hasattr(ve2, 'message_dict'):
                            msg = '; '.join(f'{f}: {", ".join(e)}' for f, e in ve2.message_dict.items())
                        reports.append({'row': row_num, 'status': 'error', 'name': name, 'message': msg})
                        continue
                else:
                    msg = '; '.join(ve.messages) if hasattr(ve, 'messages') else str(ve)
                    reports.append({'row': row_num, 'status': 'error', 'name': name, 'message': msg})
                    continue

            valid_students.append((row_num, name, student))

        except Exception as e:
            msg = str(e)
            if hasattr(e, 'message_dict'):
                msg = '; '.join(f'{f}: {", ".join(err)}' for f, err in e.message_dict.items())
            elif hasattr(e, 'messages'):
                msg = '; '.join(e.messages)
            reports.append({'row': row_num, 'status': 'error', 'name': name, 'message': msg})

    # ─────────────────────────────────────────────────────────────────────────
    # PHASE 2 — bulk_create in batches of BATCH_SIZE
    # ─────────────────────────────────────────────────────────────────────────
    # Pre-generate student_id for students that don't have one — bulk_create
    # bypasses model.save() so auto-generation won't run otherwise.
    try:
        from users.utils import generate_student_id, get_shift_code, get_next_student_number
        for _, _, student in valid_students:
            if not student.student_id and all([student.campus, student.shift, student.enrollment_year]):
                try:
                    campus_code = student.campus.campus_code or f"C{student.campus.id:02d}"
                    shift_code = get_shift_code(student.shift)
                    year = str(student.enrollment_year)[-2:]
                    seq = get_next_student_number(student.campus, student.enrollment_year)
                    student.student_id = generate_student_id(campus_code, shift_code, year, seq)
                    if not student.gr_no:
                        student.gr_no = f"GR-{seq:05d}"
                except Exception as e:
                    print(f"[BULK IMPORT] Could not generate student_id: {e}")
    except ImportError:
        pass

    inserted = []
    for i in range(0, len(valid_students), BATCH_SIZE):
        chunk = valid_students[i:i + BATCH_SIZE]
        student_objs = [s for _, _, s in chunk]
        try:
            with transaction.atomic():
                created = Student.objects.bulk_create(student_objs, batch_size=BATCH_SIZE)
            inserted.extend(zip([r for r, _, _ in chunk], [n for _, n, _ in chunk], created))
        except Exception as e:
            # Fallback: save one-by-one so we get per-row errors
            for row_num, name, student in chunk:
                try:
                    with transaction.atomic():
                        student.save()
                    inserted.append((row_num, name, student))
                except Exception as se:
                    reports.append({'row': row_num, 'status': 'error', 'name': name, 'message': str(se)})

    # ─────────────────────────────────────────────────────────────────────────
    # PHASE 3 — Generate IDs (bulk_create bypasses save()), create user accounts
    # ─────────────────────────────────────────────────────────────────────────
    for row_num, name, student in inserted:
        # bulk_create bypasses model save(), so _auto_assign_classroom never ran
        # (it only runs during is_create, but bulk_create sets pk). Call it now
        # before save() so the "unassigned" branch in save() doesn't clear section.
        classroom_just_found = False
        if not student.classroom and all([student.campus, student.current_grade, student.section, student.shift]):
            student._auto_assign_classroom()
            classroom_just_found = bool(student.classroom)

        # Re-save if IDs are missing or classroom was just resolved
        if not student.student_id or not student.student_code or classroom_just_found:
            try:
                student.save()
            except Exception as e:
                print(f"[CSV IMPORT] Could not re-save student {name} for ID generation: {e}")
        _ensure_student_user_account(student)
        # bulk_create bypasses post_save signals, so publish the upsert event
        # explicitly — this is what auto-syncs the student to attendance & others.
        try:
            from students.signals import publish_student_upserted
            publish_student_upserted(student)
        except Exception as e:
            print(f"[CSV IMPORT] Could not publish student.upserted for {name}: {e}")
        reports.append({'row': row_num, 'status': 'ok', 'name': name,
                        'message': f'Student created successfully (ID: {student.student_id or student.id})'})

    # Best-effort HTTP nudge (event publishing above is the primary sync path)
    if inserted:
        _sync_students_to_attendance()

    # Sort reports by row number so UI shows them in order
    reports.sort(key=lambda r: r.get('row', 0))
    return reports


def _sync_students_to_attendance():
    import os, requests as req_lib
    attendance_url = os.environ.get('ATTENDANCE_SERVICE_URL', 'http://attendance-service:8006')
    secret = os.environ.get('INTERNAL_SERVICE_SECRET', '')
    try:
        resp = req_lib.post(
            f"{attendance_url}/api/internal/sync-students/",
            headers={'X-Internal-Secret': secret},
            timeout=10,
        )
        if resp.status_code != 200:
            print(f"[BULK STUDENT SYNC] Attendance-service sync returned {resp.status_code}: {resp.text}")
    except Exception as e:
        print(f"[BULK STUDENT SYNC] Could not reach attendance-service: {e}")


def _ensure_student_user_account(student):
    if not student.student_id:
        return
    actual_email = student.email if student.email else f"{student.student_id}@student.portal"
    # Sync auto-generated email back to Student record so profile page shows it
    if not student.email:
        try:
            type(student).objects.filter(pk=student.pk).update(email=actual_email)
            student.email = actual_email
        except Exception:
            pass

    # Phase D-R6: the auth-8001 write (POST /api/internal/create-user/,
    # flag-gated by WRITE_TO_AUTH_8001) is removed — auth-8001 no longer
    # exists (D-R5). The central dual-write below already covers this. See
    # docs/PHASE_D_R4R6_REMOVAL_RESULT.md.

    # Phase D-R0 dual-write: also land this student in central auth's SMS01
    # tenant, flag-gated on SYNC_TO_CENTRAL_AUTH (same flag as every other
    # sync in this codebase). Flagged as a gap in D-b2 ("no local password
    # hash, why it was deferred") — on closer look that reasoning didn't
    # hold: this function already uses a fixed default password ('12345',
    # matching perform_create's own _ensure_student_user_account and
    # central_auth_sync_service.DEFAULT_PASSWORD), so a hash CAN be
    # produced the same way D-b2's central-auth-branch case did — no reason
    # left to defer. student.id (this service's own local PK) is used as
    # legacy_user_id, same idempotency-key repurposing as every other
    # central-auth-branch sync in this codebase (there's no literal
    # auth-8001 users_user.id involved in this CSV path either).
    from django.contrib.auth.hashers import make_password
    from services.central_auth_sync_service import sync_student_to_central_auth, DEFAULT_PASSWORD
    sync_student_to_central_auth(
        legacy_user_id=student.id,
        email=actual_email,
        username=student.student_id,
        password_hash=make_password(DEFAULT_PASSWORD),
        full_name=student.full_name or student.name,
        role='student',
        is_active=True,
    )
