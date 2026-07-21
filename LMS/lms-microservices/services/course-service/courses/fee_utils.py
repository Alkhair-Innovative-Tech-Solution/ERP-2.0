"""
Shared helpers for monthly fee generation, used by both the recurring
`generate_monthly_fees` command and the one-off `backfill_monthly_fees` command.
"""
from datetime import timedelta


def next_month(d):
    """First day of the month after d."""
    return (d.replace(day=28) + timedelta(days=4)).replace(day=1)


def resolve_course_start(course, scheduled_class):
    if scheduled_class and scheduled_class.course_start_date:
        return scheduled_class.course_start_date
    return course.course_start_date


def resolve_course_end(course, scheduled_class):
    if scheduled_class and scheduled_class.course_end_date:
        return scheduled_class.course_end_date
    return course.course_end_date


def deposit_gate_ok(fee, student_id):
    """Whether a student passes the fee's require_deposit_paid gate."""
    if not fee.require_deposit_paid:
        return True
    from .models import StudentDeposit
    try:
        deposit = StudentDeposit.objects.get(student_id=student_id, course=fee.course)
    except StudentDeposit.DoesNotExist:
        return False
    return deposit.is_waived or deposit.deposit_paid


def generate_fee_record(fee, enrollment, fee_month):
    """
    Create a StudentFeeRecord for (fee, enrollment, fee_month) if eligible and not
    already present. Returns 'created' or a skip reason string.
    """
    from .models import StudentFeeRecord

    student_id = enrollment.student_id

    if not deposit_gate_ok(fee, student_id):
        return 'no_deposit'

    sc = fee.scheduled_class if fee.scope == 'scheduled_class' else enrollment.scheduled_class

    if StudentFeeRecord.objects.filter(
        student_id=student_id, course=fee.course, scheduled_class=sc, fee_month=fee_month,
    ).exists():
        return 'exists'

    due_day = min(fee.due_day_of_month, 28)
    due_date = fee_month.replace(day=due_day)
    amount = fee.monthly_maintenance_fee if fee.payment_plan == 'monthly' else fee.one_time_fee

    if amount <= 0:
        return 'zero_amount'

    StudentFeeRecord.objects.create(
        student_id=student_id, course=fee.course,
        scheduled_class=sc, fee_structure=fee,
        fee_month=fee_month, amount_due=amount,
        amount_paid=0, outstanding_balance=amount,
        due_date=due_date, payment_status='pending',
    )
    return 'created'
