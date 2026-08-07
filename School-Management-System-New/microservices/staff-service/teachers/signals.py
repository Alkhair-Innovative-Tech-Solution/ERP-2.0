from django.db.models.signals import post_save, pre_save, post_delete, m2m_changed
from django.dispatch import receiver
from .models import Teacher
from users.models import User
from services.user_creation_service import UserCreationService
from notifications.services import create_notification

@receiver(pre_save, sender=Teacher)
def _capture_previous_teacher_state(sender, instance, **kwargs):
    """Attach previous user_id and email to instance for use in post_save."""
    if not instance.pk:
        instance._previous_user_id = None
        instance._previous_email = None
        return
    try:
        old = Teacher.objects.filter(pk=instance.pk).only('user', 'email').first()
        instance._previous_user_id = old.user_id if old and old.user_id else None
        instance._previous_email = old.email if old else None
    except Exception:
        instance._previous_user_id = None
        instance._previous_email = None

@receiver(post_save, sender=Teacher)
def create_teacher_user(sender, instance, created, **kwargs):
    """Auto-create user when teacher is created or when email is updated on a teacher without a user."""
    try:
        actor = getattr(instance, '_actor', None)
        campus_name = instance.current_campus.campus_name if instance.current_campus else ''

        if created:
            existing_user = User.objects.filter(email=instance.email).first() if instance.email else None

            if existing_user:
                if existing_user.role == 'teacher':
                    # Same-role user — safe to link
                    Teacher.objects.filter(pk=instance.pk).update(user=existing_user)
                    create_notification(recipient=existing_user, actor=actor,
                                        verb="You have been added as a Teacher",
                                        target_text=f"at {campus_name}" if campus_name else "",
                                        data={"teacher_id": instance.id})
                else:
                    # Email belongs to a different role — skip linking, warn
                    print(f"[WARN] Teacher {instance.id} email '{instance.email}' belongs to "
                          f"an existing {existing_user.role} account. No user linked. "
                          f"Update the teacher's email to auto-create a user account.")
            else:
                user, message = UserCreationService.create_user_from_entity(instance, 'teacher')
                if not user:
                    print(f"[ERROR] Failed to create user for teacher {instance.id}: {message}")
                else:
                    Teacher.objects.filter(pk=instance.pk).update(user=user)
                    create_notification(recipient=user, actor=actor,
                                        verb="You have been added as a Teacher",
                                        target_text=f"at {campus_name}" if campus_name else "",
                                        data={"teacher_id": instance.id})
            return

        # ── UPDATE path ─────────────────────────────────────────────────────
        prev_user_id = getattr(instance, '_previous_user_id', None)
        prev_email = getattr(instance, '_previous_email', None)
        current_user = instance.user

        # If teacher still has no user AND email was changed → try to create user now
        if not current_user and instance.email and instance.email != prev_email:
            existing_user = User.objects.filter(email=instance.email).first()
            if existing_user:
                if existing_user.role == 'teacher':
                    Teacher.objects.filter(pk=instance.pk).update(user=existing_user)
                    create_notification(recipient=existing_user, actor=actor,
                                        verb="You have been assigned as a Teacher",
                                        target_text=f"at {campus_name}" if campus_name else "",
                                        data={"teacher_id": instance.id})
                else:
                    print(f"[WARN] Teacher {instance.id} new email '{instance.email}' still belongs "
                          f"to a {existing_user.role} account. User not linked.")
            else:
                user, message = UserCreationService.create_user_from_entity(instance, 'teacher')
                if not user:
                    print(f"[ERROR] Failed to create user for teacher {instance.id} on email update: {message}")
                else:
                    Teacher.objects.filter(pk=instance.pk).update(user=user)
                    create_notification(recipient=user, actor=actor,
                                        verb="You have been assigned as a Teacher",
                                        target_text=f"at {campus_name}" if campus_name else "",
                                        data={"teacher_id": instance.id})
            return

        # Notify if user was newly assigned (e.g. manual link)
        current_user_id = current_user.id if current_user else None
        if current_user_id and current_user_id != prev_user_id:
            create_notification(recipient=current_user, actor=actor,
                                verb="You have been assigned as a Teacher",
                                target_text=f"at {campus_name}" if campus_name else "",
                                data={"teacher_id": instance.id})

    except Exception as e:
        print(f"[ERROR] Error in create_teacher_user signal: {str(e)}")

@receiver(post_save, sender=Teacher)
def sync_teacher_to_user(sender, instance, created, **kwargs):
    """Sync Teacher profile changes back to the associated User account."""
    if created:
        return

    try:
        user = instance.user
        if not user and instance.employee_code:
            user = User.objects.filter(username=instance.employee_code).first()
        if not user and instance.email:
            user = User.objects.filter(email=instance.email).first()

        if user:
            changed = False
            # 1. Sync Email
            if user.email != instance.email:
                if not User.objects.exclude(pk=user.pk).filter(email=instance.email).exists():
                    user.email = instance.email
                    changed = True

            # 2. Sync Name
            if instance.full_name:
                name_parts = instance.full_name.strip().split(' ', 1)
                first_name = name_parts[0]
                last_name = name_parts[1] if len(name_parts) > 1 else ""
                
                if user.first_name != first_name or user.last_name != last_name:
                    user.first_name = first_name
                    user.last_name = last_name
                    changed = True

            # 3. Sync Campus
            if instance.current_campus and user.campus_id != instance.current_campus.id:
                user.campus = instance.current_campus
                changed = True

            if changed:
                user.save(update_fields=['email', 'first_name', 'last_name', 'campus'])
                
            # Ensure link exists
            if not instance.user:
                Teacher.objects.filter(pk=instance.pk).update(user=user)
    except Exception as e:
        print(f"[ERROR] Failed to sync teacher to user: {str(e)}")

@receiver(post_delete, sender=Teacher)
def delete_user_when_teacher_deleted(sender, instance, **kwargs):
    """Cleanup user when teacher is deleted"""
    try:
        if instance.user:
            instance.user.delete()
        elif instance.email:
            User.objects.filter(email__iexact=instance.email).delete()
    except Exception as e:
        print(f"[ERROR] Error deleting teacher user: {str(e)}")

def _sync_class_teacher_to_campus_db(action, teacher_id, pk_set):
    """Push class_teacher_id changes to campus-service DB, upserting teacher row first.

    Phase C12 (the assign_teacher-hang fix): this used to open its own
    ad-hoc `psycopg2.connect()` per call, with no statement/lock timeout —
    if campus-service's tables were locked (or the host was slow/
    unreachable past the initial connect), the blocking `cur.execute(...)`
    call had no bound and could hang the whole gunicorn sync worker
    indefinitely ("hangs until killed", flagged in C5).

    Fixed by routing through Django's OWN connection framework instead —
    `django.db.connections['campus_db']` (a real second database alias,
    see staff_service/settings.py's DATABASES — CONN_MAX_AGE-pooled,
    lifecycle-managed by Django rather than a bespoke connect()/close()
    pair) — with a hard 5s statement_timeout / 3s lock_timeout set on
    that alias's connection OPTIONS. A blocked query is now forcibly
    killed by Postgres itself after 3-5s and raises a normal Python
    exception, caught by the existing try/except below exactly as any
    other failure already was — it can no longer hang the worker.

    The SQL itself is UNCHANGED (still raw, still the exact same
    statements) — deliberately not rewritten as ORM QuerySet calls.
    campus-service's `teachers_teacher` table is a narrower, independently
    -migrated schema (fewer columns than staff-service's own authoritative
    Teacher model — confirmed by reading campus-service's classes/views.py,
    which has its own central-auth-era columns staff-service's vendored
    Teacher/ClassRoom copies don't). Django's high-level `.save()`/
    `.create()` would attempt to write EVERY field on the model, which
    would break against that narrower table; the existing raw SQL already
    hand-picks the exact column set the target table actually has. Keeping
    it raw (just on a managed connection now) preserves the exact same
    data effect with no risk of a schema-mismatch regression.
    """
    from django.db import connection as local_conn
    from django.db import connections
    try:
        conn = connections['campus_db']
        with conn.cursor() as cur:
            if action == 'post_add' and pk_set:
                # Fetch teacher data from local staff DB to upsert into campus DB
                with local_conn.cursor() as lc:
                    lc.execute("""
                        SELECT id, full_name, dob, gender, contact_number, email, cnic, shift,
                               is_currently_active, save_status, date_created, date_updated,
                               is_deleted, is_class_teacher, is_teacher_assistant, is_subject_teacher,
                               current_campus_id, organization_id, employee_code
                        FROM teachers_teacher WHERE id = %s
                    """, [teacher_id])
                    row = lc.fetchone()
                if row:
                    cur.execute("""
                        INSERT INTO teachers_teacher
                            (id, full_name, dob, gender, contact_number, email, cnic, shift,
                             is_currently_active, save_status, date_created, date_updated,
                             is_deleted, is_class_teacher, is_teacher_assistant, is_subject_teacher,
                             current_campus_id, organization_id, employee_code)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                        ON CONFLICT (id) DO UPDATE SET
                            full_name=EXCLUDED.full_name, email=EXCLUDED.email,
                            is_class_teacher=EXCLUDED.is_class_teacher,
                            employee_code=EXCLUDED.employee_code
                    """, row)
                for cid in pk_set:
                    cur.execute(
                        "UPDATE classes_classroom SET class_teacher_id = %s WHERE id = %s",
                        [teacher_id, cid]
                    )
            elif action == 'post_remove' and pk_set:
                for cid in pk_set:
                    cur.execute(
                        "UPDATE classes_classroom SET class_teacher_id = NULL WHERE id = %s AND class_teacher_id = %s",
                        [cid, teacher_id]
                    )
            elif action == 'post_clear':
                cur.execute(
                    "UPDATE classes_classroom SET class_teacher_id = NULL WHERE class_teacher_id = %s",
                    [teacher_id]
                )
        conn.commit()
    except Exception as e:
        print(f"[WARN] _sync_class_teacher_to_campus_db: {e}")


@receiver(m2m_changed, sender=Teacher.assigned_classrooms.through)
def teacher_assigned_classrooms_changed(sender, instance, action, pk_set, **kwargs):
    """Recalculate is_class_teacher and sync classroom.class_teacher when assigned classrooms change"""
    if action not in ['post_add', 'post_remove', 'post_clear']:
        return

    try:
        from classes.models import ClassRoom
        if action == 'post_add' and pk_set:
            ClassRoom.all_objects.filter(pk__in=pk_set).update(class_teacher=instance)
        elif action == 'post_remove' and pk_set:
            ClassRoom.all_objects.filter(pk__in=pk_set, class_teacher=instance).update(class_teacher=None)
        elif action == 'post_clear':
            ClassRoom.all_objects.filter(class_teacher=instance).update(class_teacher=None)
    except Exception as e:
        print(f"[WARN] Failed to sync classroom.class_teacher: {e}")

    _sync_class_teacher_to_campus_db(action, instance.pk, pk_set)

    has_classes = instance.assigned_classroom_id is not None or instance.assigned_classrooms.exists() or (hasattr(instance, 'classroom_set') and instance.classroom_set.exists())
    if bool(instance.is_class_teacher) != has_classes:
        Teacher.objects.filter(pk=instance.pk).update(is_class_teacher=has_classes)
        instance.is_class_teacher = has_classes
