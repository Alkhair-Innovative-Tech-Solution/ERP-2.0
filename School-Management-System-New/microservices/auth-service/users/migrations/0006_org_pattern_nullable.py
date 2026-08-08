from django.db import migrations


class Migration(migrations.Migration):
    """
    Make student_id_pattern (and code_pattern) nullable in synced DBs.
    student-service and attendance-service import this via COPY of auth-service/users/.
    org-service schema does not have student_id_pattern, so synced inserts can't set it.
    """

    dependencies = [
        ('users', '0005_org_payment_status'),
    ]

    operations = [
        migrations.RunSQL(
            sql="""
                ALTER TABLE users_organization
                    ALTER COLUMN student_id_pattern DROP NOT NULL,
                    ALTER COLUMN student_id_pattern SET DEFAULT 'STD_PREFIX_YY_SEQ5';
                ALTER TABLE users_organization
                    ALTER COLUMN code_pattern DROP NOT NULL,
                    ALTER COLUMN code_pattern SET DEFAULT '';
            """,
            reverse_sql="""
                ALTER TABLE users_organization
                    ALTER COLUMN student_id_pattern SET NOT NULL,
                    ALTER COLUMN student_id_pattern DROP DEFAULT;
                ALTER TABLE users_organization
                    ALTER COLUMN code_pattern SET NOT NULL,
                    ALTER COLUMN code_pattern DROP DEFAULT;
            """,
        ),
    ]
