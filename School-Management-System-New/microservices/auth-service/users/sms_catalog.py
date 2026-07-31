"""
SMS permission + role-template catalog.

Namespaced permissions: sms.<module>.<action>
Mirrors the shape of Enterprise-Resource-Planning/Auth-service-main's
vms_catalog.py / hdms_catalog.py (VMS/HDMS Increments 0 & 2a) — a declared
catalog of permissions and per-role templates, ready for a later increment
to merge into central auth.

**This does NOT change runtime behavior.** SMS's actual permission store is
`users.models.RolePermission` (one row per org/role/permission, an
`is_allowed` toggle SuperAdmin can flip via the UI) — that model, and
`HasDynamicPermission`'s query against it, are unchanged. Every permission
here carries a `legacy_codename`: the bare name (`view_students`, etc.)
`seed_sms_catalog` actually writes into `RolePermission.permission_codename`,
because every `view.required_permission = '...'` attribute across the
codebase still checks against that bare name (untouched — out of scope,
see the increment prompt's rule against touching scattered role checks).
The namespaced `codename` is catalog-facing metadata only, for now.

Every permission and every role→permission mapping below was copied
verbatim from the `DEFAULT_PERMISSIONS` dict that used to live in
`users/management/commands/seed_permissions.py` — nothing invented, nothing
dropped, verified via a byte-for-byte diff of the RolePermission rows each
produced. That file has since been **deleted**: once the catalog was
proven equivalent (see docs/INCREMENT_3A_SMS_ROLES_RESULT.md for the
before/after proof) it became dead code with a single reader (itself), and
per explicit instruction nothing old is being kept "just in case" — this
catalog is now the only source. If you need the original dict's exact
historical text, it's in git history prior to Increment 3a.

**Known gap in the old dict, faithfully mirrored, not fixed**:
`User.ROLE_CHOICES` has 11 roles; the old dict only had 10 entries —
`'admin'` had no entry at all, so no `RolePermission` rows have ever
existed for it (an admin gets zero dynamic permissions today).
`SMS_ROLE_TEMPLATES['admin']` is therefore an empty dict, matching that
existing (likely accidental) behavior — not something to silently "fix" in
a same-behavior increment.
"""
from users.models import RolePermission, Organization

SMS_PERMISSIONS = [
    # Dashboards
    {"codename": "sms.dashboard.view", "legacy_codename": "view_dashboard", "name": "View Dashboard"},
    {"codename": "sms.dashboard.superadmin", "legacy_codename": "view_superadmin_dashboard", "name": "View SuperAdmin Dashboard"},
    {"codename": "sms.dashboard.admin", "legacy_codename": "view_admin_dashboard", "name": "View Admin Dashboard"},
    {"codename": "sms.dashboard.teacher", "legacy_codename": "view_teacher_dashboard", "name": "View Teacher Dashboard"},
    {"codename": "sms.dashboard.coordinator", "legacy_codename": "view_coordinator_dashboard", "name": "View Coordinator Dashboard"},
    {"codename": "sms.dashboard.principal", "legacy_codename": "view_principal_dashboard", "name": "View Principal Dashboard"},
    {"codename": "sms.dashboard.student", "legacy_codename": "view_student_dashboard", "name": "View Student Dashboard"},
    {"codename": "sms.dashboard.accounts", "legacy_codename": "view_accounts_dashboard", "name": "View Accounts Dashboard"},
    {"codename": "sms.dashboard.admissions", "legacy_codename": "view_admissions_dashboard", "name": "View Admissions Dashboard"},
    {"codename": "sms.dashboard.compliance", "legacy_codename": "view_compliance_dashboard", "name": "View Compliance Dashboard"},

    # Students
    {"codename": "sms.student.view", "legacy_codename": "view_students", "name": "View Students"},
    {"codename": "sms.student.create", "legacy_codename": "add_student", "name": "Add Student"},
    {"codename": "sms.student.edit", "legacy_codename": "edit_student", "name": "Edit Student"},

    # Teachers
    {"codename": "sms.teacher.view", "legacy_codename": "view_teachers", "name": "View Teachers"},
    {"codename": "sms.teacher.create", "legacy_codename": "add_teacher", "name": "Add Teacher"},

    # Campus
    {"codename": "sms.campus.view", "legacy_codename": "view_campus", "name": "View Campus"},
    {"codename": "sms.campus.create", "legacy_codename": "add_campus", "name": "Add Campus"},

    # Principals
    {"codename": "sms.principal.view", "legacy_codename": "view_principals", "name": "View Principals"},
    {"codename": "sms.principal.create", "legacy_codename": "add_principal", "name": "Add Principal"},

    # Coordinators
    {"codename": "sms.coordinator.view", "legacy_codename": "view_coordinators", "name": "View Coordinators"},
    {"codename": "sms.coordinator.create", "legacy_codename": "add_coordinator", "name": "Add Coordinator"},

    # Attendance
    {"codename": "sms.attendance.view", "legacy_codename": "view_attendance", "name": "View Attendance"},
    {"codename": "sms.attendance.mark", "legacy_codename": "mark_attendance", "name": "Mark Attendance"},
    {"codename": "sms.attendance.approve", "legacy_codename": "approve_attendance", "name": "Approve Attendance"},

    # Results
    {"codename": "sms.result.view", "legacy_codename": "view_results", "name": "View Results"},
    {"codename": "sms.result.approve", "legacy_codename": "approve_results", "name": "Approve Results"},
    {"codename": "sms.result.bulk_import", "legacy_codename": "bulk_import_results", "name": "Bulk Import Results"},
    {"codename": "sms.result.edit", "legacy_codename": "edit_results", "name": "Edit Results"},

    # Transfers / Timetable / Requests / Promotions / Subjects
    {"codename": "sms.transfer.view", "legacy_codename": "view_transfers", "name": "View Transfers"},
    {"codename": "sms.timetable.view", "legacy_codename": "view_timetable", "name": "View Timetable"},
    {"codename": "sms.request.view", "legacy_codename": "view_requests", "name": "View Requests"},
    {"codename": "sms.promotion.view", "legacy_codename": "view_promotions", "name": "View Promotions"},
    {"codename": "sms.subject.view", "legacy_codename": "view_subjects", "name": "View Subjects"},

    # Charts
    {"codename": "sms.chart.grade_distribution", "legacy_codename": "view_grade_distribution_chart", "name": "View Grade Distribution Chart"},
    {"codename": "sms.chart.gender_distribution", "legacy_codename": "view_gender_distribution_chart", "name": "View Gender Distribution Chart"},
    {"codename": "sms.chart.mother_tongue", "legacy_codename": "view_mother_tongue_chart", "name": "View Mother Tongue Chart"},
    {"codename": "sms.chart.religion", "legacy_codename": "view_religion_chart", "name": "View Religion Chart"},
    {"codename": "sms.chart.enrollment_trend", "legacy_codename": "view_enrollment_trend_chart", "name": "View Enrollment Trend Chart"},
    {"codename": "sms.chart.age_distribution", "legacy_codename": "view_age_distribution_chart", "name": "View Age Distribution Chart"},
    {"codename": "sms.chart.weekly_attendance", "legacy_codename": "view_weekly_attendance_chart", "name": "View Weekly Attendance Chart"},
    {"codename": "sms.chart.zakat_status", "legacy_codename": "view_zakat_status_chart", "name": "View Zakat Status Chart"},
    {"codename": "sms.chart.house_ownership", "legacy_codename": "view_house_ownership_chart", "name": "View House Ownership Chart"},
    {"codename": "sms.chart.network_performance", "legacy_codename": "view_network_performance_chart", "name": "View Network Performance Chart"},

    # KPIs
    {"codename": "sms.kpi.total_students", "legacy_codename": "view_total_students_kpi", "name": "View Total Students KPI"},
    {"codename": "sms.kpi.total_teachers", "legacy_codename": "view_total_teachers_kpi", "name": "View Total Teachers KPI"},
    {"codename": "sms.kpi.teacher_student_ratio", "legacy_codename": "view_teacher_student_ratio_kpi", "name": "View Teacher-Student Ratio KPI"},
    {"codename": "sms.kpi.avg_attendance", "legacy_codename": "view_avg_attendance_kpi", "name": "View Average Attendance KPI"},

    # Fees / Finance
    {"codename": "sms.fee.view", "legacy_codename": "view_fees", "name": "View Fees & Vouchers"},
    {"codename": "sms.fee.manage", "legacy_codename": "manage_fees", "name": "Manage Fees Collections"},

    # Management
    {"codename": "sms.permission.manage", "legacy_codename": "manage_permissions", "name": "Manage Permissions"},
    {"codename": "sms.form.manage", "legacy_codename": "manage_forms", "name": "Manage Forms"},
]

# legacy_codename -> namespaced codename, for translating DEFAULT_PERMISSIONS
# (which is keyed by legacy_codename) into the catalog shape below.
_LEGACY_TO_NAMESPACED = {p["legacy_codename"]: p["codename"] for p in SMS_PERMISSIONS}

# role -> {legacy_codename: bool}, copied verbatim (keys AND values, both
# True and False) from the old DEFAULT_PERMISSIONS dict (deleted, see the
# module docstring above).
#
# IMPORTANT: this preserves the *exact* per-role key set, not just the True
# ones. The old dict was sparse and inconsistent on purpose (or by accident)
# — e.g. 'accounts_officer' only listed 5 keys total, while 'superadmin'
# listed all 51; a missing key there meant no RolePermission row got
# created for it at all, whereas a listed `False` key DID get
# an explicit row with is_allowed=False. Both are behaviorally identical to
# HasDynamicPermission's `is_allowed=True` filter (missing row and
# is_allowed=False both evaluate the check to False) — but the SuperAdmin
# permissions-toggle UI most likely renders switches from *existing rows*,
# so an earlier version of this catalog that only wrote the True rows
# produced 212 rows instead of the old dict's 282 — same effective
# permission checks, but a real difference in what toggles are visible in
# the admin UI. Fixed by preserving the exact key set below, verified by
# generating this dict directly from DEFAULT_PERMISSIONS via AST parsing
# (not hand-transcribed a second time) — see
# docs/INCREMENT_3A_SMS_ROLES_RESULT.md for the row-for-row diff proof.
SMS_ROLE_TEMPLATES = {
    'superadmin': {
        'view_dashboard': True, 'view_students': True, 'add_student': True, 'edit_student': True,
        'view_teachers': True, 'add_teacher': True, 'view_campus': True, 'add_campus': True,
        'view_principals': True, 'add_principal': True, 'view_coordinators': True, 'add_coordinator': True,
        'view_attendance': True, 'mark_attendance': True, 'approve_attendance': True, 'view_results': True,
        'approve_results': True, 'bulk_import_results': True, 'edit_results': True, 'view_transfers': True,
        'view_timetable': True, 'view_requests': True, 'view_promotions': True, 'view_subjects': True,
        'view_grade_distribution_chart': True, 'view_gender_distribution_chart': True,
        'view_mother_tongue_chart': True, 'view_religion_chart': True, 'view_enrollment_trend_chart': True,
        'view_age_distribution_chart': True, 'view_weekly_attendance_chart': True,
        'view_zakat_status_chart': True, 'view_house_ownership_chart': True,
        'view_network_performance_chart': True, 'view_total_students_kpi': True,
        'view_total_teachers_kpi': True, 'view_teacher_student_ratio_kpi': True,
        'view_avg_attendance_kpi': True, 'view_fees': True, 'manage_fees': True,
        'view_admin_dashboard': True, 'view_teacher_dashboard': True, 'view_coordinator_dashboard': True,
        'view_principal_dashboard': True, 'view_student_dashboard': True, 'view_superadmin_dashboard': True,
        'manage_permissions': True, 'manage_forms': True,
    },
    # 'admin' has no entry in DEFAULT_PERMISSIONS at all — empty dict,
    # matches existing (likely accidental) zero-RolePermission-rows behavior.
    'admin': {},
    'org_admin': {
        'view_dashboard': True, 'view_students': True, 'add_student': True, 'edit_student': True,
        'view_teachers': True, 'add_teacher': True, 'view_campus': True, 'add_campus': True,
        'view_principals': True, 'add_principal': True, 'view_coordinators': True, 'add_coordinator': True,
        'view_attendance': True, 'mark_attendance': True, 'approve_attendance': True, 'view_results': True,
        'approve_results': True, 'view_transfers': True, 'view_timetable': True, 'view_requests': True,
        'view_promotions': True, 'view_subjects': True,
        'view_grade_distribution_chart': True, 'view_gender_distribution_chart': True,
        'view_mother_tongue_chart': True, 'view_religion_chart': True, 'view_enrollment_trend_chart': True,
        'view_age_distribution_chart': True, 'view_weekly_attendance_chart': True,
        'view_zakat_status_chart': True, 'view_house_ownership_chart': True,
        'view_network_performance_chart': True, 'view_total_students_kpi': True,
        'view_total_teachers_kpi': True, 'view_teacher_student_ratio_kpi': True,
        'view_avg_attendance_kpi': True, 'view_fees': True, 'manage_fees': True,
        'view_admin_dashboard': True, 'view_teacher_dashboard': True, 'view_coordinator_dashboard': True,
        'view_principal_dashboard': True, 'view_student_dashboard': True,
        'manage_permissions': True, 'manage_forms': True,
    },
    'principal': {
        'view_dashboard': True, 'view_students': True, 'add_student': True, 'edit_student': True,
        'view_teachers': True, 'add_teacher': True, 'view_campus': True, 'add_campus': True,
        'view_principals': False, 'add_principal': False, 'view_coordinators': True, 'add_coordinator': True,
        'view_attendance': True, 'mark_attendance': False, 'approve_attendance': True, 'view_results': True,
        'approve_results': True, 'bulk_import_results': True, 'edit_results': True, 'view_transfers': True,
        'view_timetable': True, 'view_requests': True, 'view_promotions': True, 'view_subjects': True,
        'view_fees': True, 'manage_fees': True,
        'view_grade_distribution_chart': True, 'view_gender_distribution_chart': True,
        'view_mother_tongue_chart': True, 'view_religion_chart': True, 'view_enrollment_trend_chart': True,
        'view_age_distribution_chart': True, 'view_weekly_attendance_chart': True,
        'view_zakat_status_chart': True, 'view_house_ownership_chart': True,
        'view_network_performance_chart': True, 'view_total_students_kpi': True,
        'view_total_teachers_kpi': True, 'view_teacher_student_ratio_kpi': True,
        'view_avg_attendance_kpi': True, 'view_principal_dashboard': True,
        'manage_permissions': False, 'manage_forms': False,
    },
    'coordinator': {
        'view_dashboard': True, 'view_students': True, 'add_student': True, 'edit_student': True,
        'view_teachers': True, 'add_teacher': False, 'view_campus': False, 'add_campus': False,
        'view_principals': False, 'add_principal': False, 'view_coordinators': False, 'add_coordinator': False,
        'view_attendance': True, 'mark_attendance': False, 'approve_attendance': True, 'view_results': True,
        'approve_results': True, 'bulk_import_results': True, 'edit_results': True, 'view_transfers': True,
        'view_timetable': True, 'view_requests': True, 'view_promotions': False, 'view_subjects': True,
        'view_fees': True, 'manage_fees': False,
        'view_grade_distribution_chart': True, 'view_gender_distribution_chart': True,
        'view_mother_tongue_chart': True, 'view_religion_chart': True, 'view_enrollment_trend_chart': True,
        'view_age_distribution_chart': True, 'view_weekly_attendance_chart': True,
        'view_zakat_status_chart': True, 'view_house_ownership_chart': True,
        'view_network_performance_chart': True, 'view_total_students_kpi': True,
        'view_total_teachers_kpi': True, 'view_teacher_student_ratio_kpi': True,
        'view_avg_attendance_kpi': True, 'view_coordinator_dashboard': True,
        'manage_permissions': False, 'manage_forms': False,
    },
    'teacher': {
        'view_dashboard': False, 'view_students': True, 'add_student': False, 'edit_student': False,
        'view_teachers': True, 'add_teacher': False, 'view_campus': False, 'add_campus': False,
        'view_principals': False, 'add_principal': False, 'view_coordinators': False, 'add_coordinator': False,
        'view_attendance': True, 'mark_attendance': True, 'approve_attendance': False, 'view_results': True,
        'approve_results': False, 'bulk_import_results': True, 'edit_results': True, 'view_transfers': True,
        'view_timetable': True, 'view_requests': True, 'view_promotions': False, 'view_subjects': False,
        'view_fees': False, 'manage_fees': False,
        'view_grade_distribution_chart': False, 'view_gender_distribution_chart': False,
        'view_mother_tongue_chart': False, 'view_religion_chart': False, 'view_enrollment_trend_chart': False,
        'view_age_distribution_chart': False, 'view_weekly_attendance_chart': False,
        'view_zakat_status_chart': False, 'view_house_ownership_chart': False,
        'view_network_performance_chart': True, 'view_total_students_kpi': False,
        'view_total_teachers_kpi': False, 'view_teacher_student_ratio_kpi': False,
        'view_avg_attendance_kpi': False, 'view_teacher_dashboard': True,
        'manage_permissions': False, 'manage_forms': False,
    },
    'donor': {
        'view_dashboard': True, 'view_superadmin_dashboard': False, 'view_students': True,
        'add_student': False, 'edit_student': False, 'view_teachers': True, 'add_teacher': False,
        'view_coordinators': True, 'add_coordinator': False, 'view_principals': True, 'add_principal': False,
        'view_campus': True, 'add_campus': False,
        'view_attendance': False, 'mark_attendance': False, 'approve_attendance': False, 'view_results': False,
        'approve_results': False, 'bulk_import_results': False, 'edit_results': False, 'view_transfers': False,
        'view_timetable': False, 'view_requests': False, 'view_promotions': False, 'view_subjects': False,
        'view_grade_distribution_chart': True, 'view_gender_distribution_chart': True,
        'view_mother_tongue_chart': True, 'view_religion_chart': True, 'view_enrollment_trend_chart': True,
        'view_age_distribution_chart': True, 'view_weekly_attendance_chart': True,
        'view_zakat_status_chart': False, 'view_house_ownership_chart': True,
        'view_network_performance_chart': True, 'view_total_students_kpi': True,
        'view_total_teachers_kpi': True, 'view_teacher_student_ratio_kpi': True,
        'view_avg_attendance_kpi': True,
        'manage_permissions': False, 'manage_forms': False,
    },
    'accounts_officer': {
        'view_dashboard': True, 'view_students': True, 'view_fees': True, 'manage_fees': True,
        'view_accounts_dashboard': True,
    },
    'admissions_counselor': {
        'view_dashboard': True, 'view_students': True, 'add_student': True, 'edit_student': True,
        'view_campus': True, 'view_admissions_dashboard': True,
    },
    'compliance_officer': {
        'view_dashboard': True, 'view_students': True, 'view_attendance': True, 'view_results': True,
        'view_campus': True, 'view_compliance_dashboard': True,
    },
    'student': {
        'view_dashboard': True, 'view_student_dashboard': True,
    },
}


def seed_sms_permissions():
    """
    Idempotent, no-op by design: SMS has no separate Permission model to
    populate (unlike central-auth's `permissions.Permission`) — the catalog
    IS this Python module. Kept for shape-parity with vms_catalog.py /
    hdms_catalog.py's seed_*_permissions() so the calling command reads the
    same either way. Returns (0, len(SMS_PERMISSIONS)).
    """
    return 0, len(SMS_PERMISSIONS)


def seed_sms_role_templates(reset: bool = False):
    """
    Idempotent. Writes RolePermission rows using each permission's
    `legacy_codename` — NOT the namespaced `codename` — so
    HasDynamicPermission's existing bare-name lookups keep working
    unchanged. Writes one row per (org, role, legacy_codename) for every
    key present in SMS_ROLE_TEMPLATES[role] (True AND False).

    Seeds per-organization if any exist, else a single org=None global set.

    Returns (created_count, updated_count, skipped_count).
    """
    orgs = list(Organization.all_objects.all())
    targets = orgs if orgs else [None]

    created_count = 0
    updated_count = 0
    skipped_count = 0

    for org in targets:
        for role, legacy_perms in SMS_ROLE_TEMPLATES.items():
            for legacy_codename, is_allowed in legacy_perms.items():
                obj, created = RolePermission.objects.get_or_create(
                    organization=org,
                    role=role,
                    permission_codename=legacy_codename,
                    defaults={'is_allowed': is_allowed},
                )
                if created:
                    created_count += 1
                elif reset:
                    if obj.is_allowed != is_allowed:
                        obj.is_allowed = is_allowed
                        obj.save(update_fields=['is_allowed'])
                    updated_count += 1
                else:
                    skipped_count += 1

    return created_count, updated_count, skipped_count
