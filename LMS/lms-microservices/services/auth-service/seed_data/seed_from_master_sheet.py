import os, sys, re, json, django, requests

sys.path.append('/app')
sys.path.append('/app/seed_data')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from users.models import User, Student, GuardianInfo, ResidentialInfo, StudentAcademicRecord, ReceiptCode, Branch
from sheet_utils import (
    COURSE_NAME_MAP,
    tr, clean_phone, map_gender, parse_status, parse_certificate_status, clean_score,
    decode_student_id, build_enrollment_entry, fetch_course_map,
    generate_receipt_code,
)
try:
    from google_sheets_util import read_csv_data
except ImportError:
    from .google_sheets_util import read_csv_data

CSV_FILE = os.environ.get('STUDENTS_CSV', '/app/seed_data/students.csv')

ADMISSION_SERVICE_URL = os.environ.get("ADMISSION_SERVICE_URL", "http://admission-service:8003")
CERTIFICATION_SERVICE_URL = os.environ.get("CERTIFICATION_SERVICE_URL", "http://certification-service:8004")


def seed():
    print("=" * 60)
    print("  SEEDING: Students only")
    print("=" * 60)

    print(f"\n1. Reading Students data from {CSV_FILE}...")
    rows = read_csv_data(CSV_FILE)
    if not rows:
        print("   No data fetched.")
        return
    print(f"   {len(rows)} rows fetched.")

    course_map = fetch_course_map()

    existing_by_email = {u.email: u for u in User.objects.all()}
    existing_by_phone = {u.phone: u for u in User.objects.filter(phone__isnull=False).exclude(phone='')}
    existing_by_cnic  = {u.cnic: u for u in User.objects.filter(cnic__isnull=False).exclude(cnic='')}
    print(f"   Cached {len(existing_by_email)} existing users.")

    students_data = {}
    skipped_no_name = 0
    skipped_no_contact = 0
    skipped_not_student = 0

    print("\n2. Pass 1: Classifying rows...")
    for i, row in enumerate(rows):
        name  = tr(row.get('Name'))
        email = tr(row.get('Email')).lower()
        phone = clean_phone(row.get('WhatsApp Number'))

        if not name:
            skipped_no_name += 1
            continue
        if not email and not phone:
            skipped_no_contact += 1
            continue

        has_real_email = bool(row.get('Email', '').strip())
        dp_raw = str(row.get('DP', '')).strip().upper()
        is_paid   = dp_raw in ['Y', 'YES']
        is_waiver = dp_raw in ['WAIVER', 'W']
        has_batch = bool(
            str(row.get('Batch', '')).strip() or
            str(row.get('New Beginner Batch', '')).strip() or
            str(row.get('New Advance Batch', '')).strip()
        )
        slip_no = tr(row.get('ID', ''))

        if has_batch:
            _classify_student(row, i, name, email, phone, has_real_email,
                              is_paid, is_waiver, slip_no, students_data,
                              existing_by_email, existing_by_phone, existing_by_cnic)
        else:
            skipped_not_student += 1

    print(f"\n   Classification results:")
    print(f"     Students        : {len(students_data)}")
    print(f"     Skipped (no student criteria) : {skipped_not_student}")
    print(f"     Skipped (no name)    : {skipped_no_name}")
    print(f"     Skipped (no contact) : {skipped_no_contact}")

    print("\n3. Processing students...")
    student_result = _process_students(
        list(students_data.values()), existing_by_email,
        existing_by_phone, existing_by_cnic, course_map
    )

    print("\n4. Writing enrollment mapping JSON...")
    _write_enrollment_json(student_result['enrollment_data'])

    _print_summary(student_result)


def _classify_student(row, i, name, email, phone, has_real_email,
                      is_paid, is_waiver, slip_no, students_data,
                      existing_by_email, existing_by_phone, existing_by_cnic):
    if not email:
        safe = re.sub(r'[^a-z0-9]', '', name.lower())
        email = f"student.{safe}_{i}@iak.ngo"

    if email in students_data:
        safe = re.sub(r'[^a-z0-9]', '', name.lower())
        email = f"student.{safe}_{i}@iak.ngo"

    old_sid_raw = tr(row.get('Student ID'), 50)
    new_sid_raw = tr(row.get('New Student ID'), 50)

    old_decoded = decode_student_id(old_sid_raw)
    new_decoded = decode_student_id(new_sid_raw)

    if not new_decoded:
        course_name_col = (tr(row.get('New Course Name'))
                          or tr(row.get('Select Specialization Course'))
                          or tr(row.get('Choose Language Course')))
        if course_name_col:
            name_lower = course_name_col.strip().lower()
            for code, cname in COURSE_NAME_MAP.items():
                if cname.lower() == name_lower or name_lower in cname.lower():
                    section = tr(row.get('New Advance Batch')
                                or row.get('New Beginner Batch')
                                or row.get('Batch'), 10)
                    new_decoded = {
                        'course_code': code,
                        'section': section or '1',
                        'seq': '',
                    }
                    break

    bag_status       = parse_status(row.get('Bag Purchased'))
    id_card_status   = parse_status(row.get('ID Card/Certificate Fee'))
    deposit_returned = parse_status(row.get('Deposit Returned'))
    certificate_status = parse_certificate_status(row.get('Certificate Status'))

    enrollments = []
    completed_courses = []

    new_is_language = new_decoded and new_decoded['course_code'].startswith('LE')
    old_is_language = old_decoded and old_decoded['course_code'].startswith('LE')

    if new_decoded:
        entry = build_enrollment_entry(new_decoded, 'enrolled')
        entry['bag_status'] = bag_status
        entry['id_card_status'] = id_card_status
        entry['deposit_returned'] = deposit_returned
        entry['is_paid'] = is_paid
        entry['is_waiver'] = is_waiver
        entry['certificate_status'] = certificate_status
        enrollments.append(entry)

    if old_decoded and new_decoded:
        if old_decoded['course_code'] != new_decoded['course_code']:
            if new_is_language and not old_is_language:
                old_entry = build_enrollment_entry(old_decoded, 'enrolled')
                old_entry['bag_status'] = bag_status
                old_entry['id_card_status'] = id_card_status
                old_entry['deposit_returned'] = deposit_returned
                old_entry['is_paid'] = is_paid
                old_entry['is_waiver'] = is_waiver
                old_entry['certificate_status'] = certificate_status
                enrollments.append(old_entry)
            else:
                completed_entry = build_enrollment_entry(old_decoded, 'completed')
                completed_entry['student_id'] = old_sid_raw
                completed_courses.append(completed_entry)
    elif old_decoded and not new_decoded:
        entry = build_enrollment_entry(old_decoded, 'enrolled')
        entry['bag_status'] = bag_status
        entry['id_card_status'] = id_card_status
        entry['deposit_returned'] = deposit_returned
        entry['is_paid'] = is_paid
        entry['is_waiver'] = is_waiver
        entry['certificate_status'] = certificate_status
        enrollments.append(entry)

    if new_decoded:
        active_section = new_decoded['section']
    else:
        active_section = tr(row.get('New Advance Batch')
                           or row.get('New Beginner Batch')
                           or row.get('Batch'), 50)

    course_req = (tr(row.get('New Course Name'))
                 or tr(row.get('Select Specialization Course'))
                 or tr(row.get('Choose Language Course'))
                 or tr(row.get('Course Name')))

    rd = {
        'full_name':         tr(name),
        'email':             email,
        'phone':             phone,
        'cnic':              tr(row.get('CNIC/B-Form Number'), 15),
        'gender':            map_gender(row.get('Gender')),
        'batch':             active_section or 'Unassigned',
        'student_id':        new_sid_raw or old_sid_raw or None,
        'father_name':       tr(row.get('Father/Guardian Name')),
        'address':           tr(row.get('Full Address'), 500),
        'guardian_name':     tr(row.get('Guardian Name')),
        'guardian_phone':    clean_phone(row.get('Contact Number')),
        'relationship':      tr(row.get('Relationship to Student'), 100),
        'qualification':     tr(row.get('Last Qualification'), 100),
        'slip_no':           slip_no,
        'enrollments':       enrollments,
        'completed_courses': completed_courses,
        'has_real_email':    has_real_email,
        'is_paid':           is_paid,
        'is_waiver':         is_waiver,
        'bag_status':        bag_status,
        'id_card_status':    id_card_status,
        'deposit_returned':  deposit_returned,
        'certificate_status': certificate_status,
        'course_req':        course_req,
        'test_score':        clean_score(row.get('Test')) or 85,
        'has_paid_deposit':  is_paid or is_waiver,
    }

    user = (existing_by_email.get(email)
            or (existing_by_phone.get(phone) if phone else None))
    students_data[email] = (user, rd)




def _process_students(items, existing_by_email, existing_by_phone,
                      existing_by_cnic, course_map):
    created_count = 0
    updated_count = 0
    errors = 0
    enrollment_data = []

    from django.db import transaction as db_transaction

    # Resolve Main branch once for all students
    main_branch = Branch.objects.filter(code='MAIN').first()

    for i, (user, rd) in enumerate(items):
        try:
            with db_transaction.atomic():
                if user is None:
                    user = User(
                        email=rd['email'],
                        full_name=rd['full_name'],
                        role='student',
                        branch=main_branch,
                    )
                    user.set_password('ait_student_123')
                    if rd['phone'] and rd['phone'] not in existing_by_phone:
                        user.phone = rd['phone']
                        existing_by_phone[rd['phone']] = user
                    if rd['cnic'] and rd['cnic'] not in existing_by_cnic:
                        user.cnic = rd['cnic']
                        existing_by_cnic[rd['cnic']] = user
                    user.save()
                    existing_by_email[rd['email']] = user
                    created_count += 1
                else:
                    user.full_name = rd['full_name']
                    upd = ['full_name']
                    if rd['phone'] and not user.phone:
                        if rd['phone'] not in existing_by_phone:
                            user.phone = rd['phone']
                            upd.append('phone')
                    if rd['cnic'] and not user.cnic:
                        if rd['cnic'] not in existing_by_cnic:
                            user.cnic = rd['cnic']
                            upd.append('cnic')
                    if user.role not in ['student', 'teacher', 'admin']:
                        user.role = 'student'
                        upd.append('role')
                    user.save(update_fields=upd)
                    updated_count += 1

                student_obj, _ = Student.objects.update_or_create(
                    user=user,
                    defaults={
                        'branch':           main_branch,
                        'whatsapp_number':  rd['phone'],
                        'status':           'enrolled',
                        'gender':           rd['gender'],
                        'batch':            rd['batch'],
                        'student_id':       rd['student_id'] or None,
                        'level':            COURSE_NAME_MAP.get(rd['enrollments'][0]['course_code'], 'Level 1') if rd['enrollments'] else 'Level 1',
                        'specialization':   COURSE_NAME_MAP.get(rd['enrollments'][0]['course_code'], '') if rd['enrollments'] else '',
                        'test_score':       rd['test_score'],
                        'has_paid_deposit': rd['has_paid_deposit'],
                    }
                )

                if rd['completed_courses']:
                    existing_completed = student_obj.completed_courses or []
                    existing_codes = {e.get('course_code') for e in existing_completed if isinstance(e, dict)}
                    for entry in rd['completed_courses']:
                        if entry.get('course_code') not in existing_codes:
                            existing_completed.append(entry)
                            existing_codes.add(entry.get('course_code'))
                    student_obj.completed_courses = existing_completed
                    student_obj.save(update_fields=['completed_courses'])

                if rd['father_name'] or rd['guardian_name'] or rd['guardian_phone']:
                    g, _ = GuardianInfo.objects.get_or_create(student=student_obj)
                    if rd['father_name']:    g.father_name = rd['father_name']
                    if rd['guardian_name']:  g.emergency_contact_name = rd['guardian_name']
                    if rd['guardian_phone']: g.father_phone = rd['guardian_phone']
                    if rd['relationship']:   g.relationship_to_student = rd['relationship']
                    g.save()

                if rd['address']:
                    r, _ = ResidentialInfo.objects.get_or_create(student=student_obj)
                    r.address = rd['address']
                    r.save()

                if rd['qualification']:
                    a, _ = StudentAcademicRecord.objects.get_or_create(student=student_obj)
                    a.highest_qualification = rd['qualification']
                    a.save()

                code = generate_receipt_code(rd['slip_no'], rd['is_paid'], rd['is_waiver'])
                if code:
                    bag_taken    = rd['bag_status'] in ['yes', 'y', 'paid', 'waiver', 'waived']
                    bag_fee      = 0 if rd['bag_status'] in ['waiver', 'waived'] else 800
                    id_card_taken = rd['id_card_status'] in ['yes', 'y', 'paid', 'waiver', 'waived']
                    id_card_fee  = 0 if rd['id_card_status'] in ['waiver', 'waived'] else 200
                    is_returned  = rd['deposit_returned'] in ['yes', 'y', 'returned']
                    deposit_paid_or_waived = rd['is_paid'] or rd['is_waiver']
                    deposit_remarks = 'Waiver' if rd['is_waiver'] else ('' if rd['is_paid'] else 'Deposit unpaid')

                    course_id = None
                    if rd['enrollments']:
                        cc = rd['enrollments'][0].get('course_code')
                        course_id = course_map.get(cc)

                    receipt_payload = {
                        'code': code,
                        'student_name': rd['full_name'],
                        'student_email': user.email,
                        'course_id': str(course_id) if course_id else None,
                        'deposit_amount': 0 if rd['is_waiver'] else 3000,
                        'bag_taken': bag_taken,
                        'bag_fee': bag_fee,
                        'bag_paid': bag_taken and bag_fee > 0,
                        'bag_waived': bag_taken and bag_fee == 0,
                        'id_card_taken': id_card_taken,
                        'id_card_fee': id_card_fee,
                        'id_card_paid': id_card_taken and id_card_fee > 0,
                        'id_card_waived': id_card_taken and id_card_fee == 0,
                        'is_returned': is_returned,
                        'is_waived': rd['is_waiver'],
                        'verified': deposit_paid_or_waived,
                        'lms_account_created': True,
                        'lms_user_id': str(user.id),
                        'remarks': deposit_remarks,
                        'skip_email': True,
                    }

                    try:
                        resp = requests.post(
                            f"{ADMISSION_SERVICE_URL}/api/tests/receipt-codes/add/",
                            json=receipt_payload, timeout=5
                        )
                        if resp.status_code not in (200, 201):
                            try:
                                verify = requests.get(
                                    f"{ADMISSION_SERVICE_URL}/api/tests/receipt-codes/verify/{code}/",
                                    timeout=5
                                )
                                if verify.status_code == 200:
                                    cid = verify.json().get('id')
                                    if cid:
                                        requests.patch(
                                            f"{ADMISSION_SERVICE_URL}/api/tests/receipt-codes/{cid}/",
                                            json=receipt_payload, timeout=5
                                        )
                            except Exception:
                                pass
                    except Exception as ex:
                        if errors < 5:
                            print(f"     Receipt sync failed for {user.email}: {ex}")

                    ReceiptCode.objects.update_or_create(
                        student_email=user.email,
                        defaults={
                            'code': code,
                            'student_name': rd['full_name'],
                            'course_id': course_id,
                            'deposit_amount': 0 if rd['is_waiver'] else 3000,
                            'bag_taken': bag_taken,
                            'bag_fee': bag_fee,
                            'id_card_taken': id_card_taken,
                            'id_card_fee': id_card_fee,
                            'is_returned': is_returned,
                            'is_waived': rd['is_waiver'],
                            'verified': deposit_paid_or_waived,
                            'remarks': deposit_remarks,
                            'lms_account_created': True,
                            'lms_user_id': user.id,
                        }
                    )

                if rd['certificate_status'] == 'issue' and rd['enrollments']:
                    cert_course_code = rd['enrollments'][0].get('course_code')
                    cert_course_id = course_map.get(cert_course_code)
                    if cert_course_id:
                        try:
                            requests.post(
                                f"{CERTIFICATION_SERVICE_URL}/api/certifications/webhook/completion/",
                                json={
                                    'student_id': str(user.id),
                                    'course_id': str(cert_course_id),
                                    'grade': rd['test_score'],
                                },
                                timeout=10,
                            )
                        except Exception as ex:
                            if errors < 5:
                                print(f"     Certificate generation failed for {user.email}: {ex}")
                    else:
                        print(f"     Skipping certificate for {user.email}: no course_id resolved for {cert_course_code}")

                all_enrollments = list(rd['enrollments'])
                if rd['completed_courses']:
                    for ce in rd['completed_courses']:
                        if ce.get('course_code') and not any(e.get('course_code') == ce.get('course_code') for e in all_enrollments):
                            all_enrollments.append(ce)

                if all_enrollments:
                    enrollment_data.append({
                        'email':           user.email,
                        'student_user_id': str(user.id),
                        'slip_no':         rd['slip_no'],
                        'enrollments':     all_enrollments,
                    })

        except Exception as e:
            errors += 1
            if errors <= 10:
                print(f"     ERROR {rd['email']}: {e}")

        if (i + 1) % 100 == 0:
            print(f"     [{i+1}/{len(items)}] Created: {created_count} | Updated: {updated_count} | Errors: {errors}")

    return {
        'created_count': created_count,
        'updated_count': updated_count,
        'errors': errors,
        'enrollment_data': enrollment_data,
    }




def _write_enrollment_json(enrollment_data):
    enrollment_data_path = '/app/seed_data/master_enrollment_mapping.json'
    with open(enrollment_data_path, 'w') as f:
        json.dump(enrollment_data, f, indent=2)
    print(f"   Written: {enrollment_data_path} ({len(enrollment_data)} records)")

    simple_data = []
    for e in enrollment_data:
        for enroll in e.get('enrollments', []):
            simple_data.append({
                'email': e['email'],
                'student_id': e['student_user_id'],
                'course_name': enroll.get('course_name', ''),
                'section': enroll.get('section', '1'),
            })
    simple_path = '/app/seed_data/enrollment_mapping.json'
    with open(simple_path, 'w') as f:
        json.dump(simple_data, f, indent=2)
    print(f"   Written: {simple_path} ({len(simple_data)} records)")


def _print_summary(student_result):
    total_enrollments = sum(len(e['enrollments']) for e in student_result['enrollment_data'])
    print(f"\n{'=' * 60}")
    print("  SEED COMPLETE")
    print(f"{'=' * 60}")
    print(f"  STUDENTS:")
    print(f"     Created  : {student_result['created_count']}")
    print(f"     Updated  : {student_result['updated_count']}")
    print(f"     Errors   : {student_result['errors']}")
    print(f"     Enrolled : {len(student_result['enrollment_data'])}")
    print(f"     Records  : {total_enrollments}")
    print(f"{'=' * 60}")


if __name__ == '__main__':
    seed()
