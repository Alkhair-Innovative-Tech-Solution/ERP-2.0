from django.db import transaction
from django.utils import timezone


class IDGenerator:
    """
    Centralized ID generator for all user roles and entities.

    Formats:
        Super Admin  : S-YY-XXXX       e.g. S-26-0001
        Admin        : A-YY-XXXX       e.g. A-26-0001
        Org Admin    : OA-YY-XXXX      e.g. OA-26-0001
        Employee     : C01-M-YY-T-XXXX e.g. C01-M-26-T-0042
        Student      : C01-M-YY-XXXXX  e.g. C01-M-26-00456
    """

    ROLE_CODES = {
        'teacher':              'T',
        'coordinator':          'C',
        'principal':            'P',
        'accounts_officer':     'AO',
        'admissions_counselor': 'AC',
        'compliance_officer':   'CO',
        'student':              'ST',
    }

    @classmethod
    def _year_short(cls):
        return str(timezone.now().year)[-2:]

    @classmethod
    def _next_counter(cls, key, organization=None):
        from services.models import GlobalCounter
        with transaction.atomic():
            # Always filter by organization explicitly (including None) to avoid
            # PostgreSQL NULL != NULL uniqueness issue with OrganizationManager.
            counter, _ = GlobalCounter.objects.select_for_update().get_or_create(
                key=key, organization=organization,
                defaults={'value': 0}
            )
            counter.value += 1
            counter.save(update_fields=['value'])
            return counter.value

    @classmethod
    def generate_superadmin_code(cls):
        n = cls._next_counter('superadmin')
        return f"S-{cls._year_short()}-{n:04d}"

    @classmethod
    def generate_admin_code(cls):
        n = cls._next_counter('admin')
        return f"A-{cls._year_short()}-{n:04d}"

    @classmethod
    def generate_orgadmin_code(cls, organization=None):
        n = cls._next_counter('org_admin', organization)
        return f"OA-{cls._year_short()}-{n:04d}"

    @classmethod
    def generate_unique_employee_code(cls, campus, shift, year, role):
        """
        Generate campus-level employee code.
        Format: {campus_code}-{shift_code}-{YY}-{role_code}-{XXXX}
        Example: C01-M-26-T-0042
        If campus.organization has code_prefix set, uses org-pattern instead.
        """
        organization = getattr(campus, 'organization', None)
        prefix = getattr(organization, 'code_prefix', None) if organization else None
        if prefix:
            return cls.generate_org_employee_code(organization, role, year)

        year_short = str(year)[-2:]
        shift_code = cls._get_shift_code(shift)
        role_code = cls.ROLE_CODES.get(role, 'T')
        campus_code = getattr(campus, 'campus_code', 'C00')

        counter_key = f'employee_{campus_code}_{role}'
        n = cls._next_counter(counter_key, organization)
        return f"{campus_code}-{shift_code}-{year_short}-{role_code}-{n:04d}"

    @classmethod
    def generate_org_employee_code(cls, organization, role, year=None):
        """
        Generate employee code using org's chosen prefix + pattern.
        5 supported patterns:
          PREFIX_YY_ROLE_SEQ4        → IAK-26-T-0001
          PREFIX_YYYY_SEQ4           → IAK-2026-0001
          PREFIX_ROLE_SEQ4           → IAK-T-0001
          PREFIX_SEQ4                → IAK-0001
          PREFIX_YYYY_ROLE_SEQ5_SLASH→ IAK/2026/T/00001
        """
        from django.utils import timezone as tz
        prefix = getattr(organization, 'code_prefix', None) or 'EMP'
        pattern = getattr(organization, 'code_pattern', 'PREFIX_YY_ROLE_SEQ4') or 'PREFIX_YY_ROLE_SEQ4'
        now_year = tz.now().year
        year_short = str(year or now_year)[-2:]
        year_full = str(year or now_year)
        role_code = cls.ROLE_CODES.get(role, 'T')

        # Patterns that embed role code can use role-specific counters safely.
        # Patterns without role code must share one counter across all roles so
        # different roles don't produce the same output (e.g. FOX-2026-0001 for
        # both teacher and principal when using PREFIX_YYYY_SEQ4).
        ROLE_IN_CODE = {'PREFIX_YY_ROLE_SEQ4', 'PREFIX_ROLE_SEQ4'}
        if pattern in ROLE_IN_CODE:
            counter_key = f'org_emp_{prefix}_{role}'
        else:
            counter_key = f'org_emp_{prefix}'  # shared — keeps sequence unique across all roles
        n = cls._next_counter(counter_key, organization)

        if pattern == 'PREFIX_YYYY_SEQ4':
            return f"{prefix}-{year_full}-{n:04d}"
        elif pattern == 'PREFIX_ROLE_SEQ4':
            return f"{prefix}-{role_code}-{n:04d}"
        elif pattern == 'PREFIX_SEQ4':
            return f"{prefix}-{n:04d}"
        elif pattern == 'PREFIX_NOSEP_SEQ4':
            return f"{prefix}{n:04d}"
        else:  # PREFIX_YY_ROLE_SEQ4 (default)
            return f"{prefix}-{year_short}-{role_code}-{n:04d}"

    @classmethod
    def generate_org_student_id(cls, organization, enrollment_year=None, shift=None):
        """
        Generate student ID using org's student_id_pattern (5-digit serial).
        Returns (student_id, gr_no) tuple — gr_no is the zero-padded serial number.
        """
        from django.utils import timezone as tz
        prefix = getattr(organization, 'code_prefix', None) or 'STD'
        pattern = getattr(organization, 'student_id_pattern', None) or 'STD_PREFIX_YY_SEQ5'
        now_year = tz.now().year
        year_short = str(enrollment_year or now_year)[-2:]
        year_full = str(enrollment_year or now_year)
        shift_code = cls._get_shift_code(shift or 'morning')

        counter_key = f'org_std_{prefix}'
        n = cls._next_counter(counter_key, organization)
        gr_no = f"{n:05d}"

        if pattern == 'STD_PREFIX_YYYY_SEQ5':
            student_id = f"{prefix}-{year_full}-{n:05d}"
        elif pattern == 'STD_PREFIX_SEQ5':
            student_id = f"{prefix}-{n:05d}"
        elif pattern == 'STD_PREFIX_SHIFT_YY_SEQ5':
            student_id = f"{prefix}-{shift_code}-{year_short}-{n:05d}"
        elif pattern == 'STD_PREFIX_NOSEP_SEQ5':
            student_id = f"{prefix}{n:05d}"
        else:  # STD_PREFIX_YY_SEQ5 (default)
            student_id = f"{prefix}-{year_short}-{n:05d}"

        return student_id, gr_no

    @classmethod
    def generate_student_id(cls, campus, shift, enrollment_year):
        """
        Generate student ID.
        Format: {campus_code}-{shift_code}-{YY}-{XXXXX}
        Example: C01-M-26-00456
        If campus.organization has code_prefix set, uses org-pattern instead.
        Returns (student_id, gr_no) tuple.
        """
        organization = getattr(campus, 'organization', None)
        prefix = getattr(organization, 'code_prefix', None) if organization else None
        if prefix:
            return cls.generate_org_student_id(organization, enrollment_year, shift)

        year_short = str(enrollment_year)[-2:]
        shift_code = cls._get_shift_code(shift)
        campus_code = getattr(campus, 'campus_code', 'C00')

        counter_key = f'student_org_{getattr(organization, "id", 0)}'
        n = cls._next_counter(counter_key, organization)
        student_id = f"{campus_code}-{shift_code}-{year_short}-{n:05d}"
        gr_no = f"{n:05d}"
        return student_id, gr_no

    @staticmethod
    def _get_shift_code(shift):
        return {
            'morning':   'M',
            'Morning':   'M',
            'afternoon': 'A',
            'Afternoon': 'A',
            'both':      'M',
            'Both':      'M',
        }.get(shift, 'M')
