from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.utils import timezone
from datetime import timedelta
import calendar
from .models import User, Organization, RolePermission


@receiver(post_delete, sender=User)
def cleanup_role_entities_on_user_delete(sender, instance: User, **kwargs):
    """When an auth user is removed, also remove role entity rows that reference the same email/employee code.
    This keeps duplicate checks accurate with current data only.
    """
    try:
        # Coordinator by email or employee_code
        from coordinator.models import Coordinator
        if instance.email:
            Coordinator.objects.filter(email__iexact=instance.email).delete()
        Coordinator.objects.filter(employee_code=instance.username).delete()
    except Exception:
        pass
    try:
        # Principal by email or employee_code
        from principals.models import Principal
        if instance.email:
            Principal.objects.filter(email__iexact=instance.email).delete()
        Principal.objects.filter(employee_code=instance.username).delete()
    except Exception:
        pass
    try:
        # Teacher by email or employee_code
        from teachers.models import Teacher
        if instance.email:
            Teacher.objects.filter(email__iexact=instance.email).delete()
        Teacher.objects.filter(employee_code=instance.username).delete()
    except Exception:
        pass


def _calculate_invoice_amount(org):
    """Calculate invoice amount from org's plan and quotas."""
    plan = org.plan
    if not plan:
        return 0
    return (
        plan.base_price
        + (org.max_students * plan.price_per_student)
        + (org.max_users * plan.price_per_user)
    )


def _generate_invoice_number(org):
    """Generate unique invoice number: INV-{CODE}-{YYYYMM}-{SEQ}"""
    from .models import Invoice
    prefix = org.code_prefix or str(org.id)
    period = timezone.now().strftime('%Y%m')
    base = f"INV-{prefix}-{period}"
    seq = Invoice.objects.filter(invoice_number__startswith=base).count() + 1
    return f"{base}-{seq:03d}"


@receiver(post_save, sender=Organization)
def auto_create_initial_invoice(sender, instance, created, **kwargs):
    """On new org creation: set payment_status=pending and create initial invoice."""
    if not created:
        return

    from .models import Invoice

    now = timezone.now()
    due_date = now + timedelta(days=7)
    period_start = now.date()
    last_day = calendar.monthrange(now.year, now.month)[1]
    period_end = now.date().replace(day=last_day)

    amount = _calculate_invoice_amount(instance)
    invoice_number = _generate_invoice_number(instance)

    Invoice.objects.create(
        organization=instance,
        plan=instance.plan,
        invoice_number=invoice_number,
        invoice_type='initial',
        amount=amount,
        status='pending',
        due_date=due_date,
        billing_period_start=period_start,
        billing_period_end=period_end,
    )

    # Set org payment_status=pending — use update to avoid re-triggering this signal
    Organization.all_objects.filter(pk=instance.pk).update(payment_status='pending')


@receiver(post_save, sender=Organization)
def seed_default_permissions_for_org(sender, instance, created, **kwargs):
    """
    Jab nai Organization create ho, automatically DEFAULT_PERMISSIONS se
    sab roles ki permissions seed kar do — manually command chalane ki zaroorat nahi.
    """
    if not created:
        return

    # 1. Default features set karo agar empty hain
    if not instance.enabled_features:
        instance.enabled_features = {
            "management": True,
            "students": True,
            "attendance": True,
            "academic": True,
            "analytics": True,
            "administration": True
        }
        instance.save(update_fields=['enabled_features'])

    # 2. DEFAULT_PERMISSIONS se sab roles ki permissions seed karo
    from users.management.commands.seed_permissions import DEFAULT_PERMISSIONS

    for role, permissions in DEFAULT_PERMISSIONS.items():
        for codename, is_allowed in permissions.items():
            RolePermission.objects.get_or_create(
                organization=instance,
                role=role,
                permission_codename=codename,
                defaults={'is_allowed': is_allowed}
            )
