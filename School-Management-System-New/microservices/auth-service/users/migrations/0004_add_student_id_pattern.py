from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_add_is_deleted_to_user'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql="""
                        ALTER TABLE users_organization
                        ADD COLUMN IF NOT EXISTS student_id_pattern
                        VARCHAR(30) NOT NULL DEFAULT 'STD_PREFIX_YY_SEQ5';
                    """,
                    reverse_sql="""
                        ALTER TABLE users_organization
                        DROP COLUMN IF EXISTS student_id_pattern;
                    """,
                ),
            ],
            state_operations=[
                migrations.AddField(
                    model_name='organization',
                    name='student_id_pattern',
                    field=models.CharField(
                        blank=True,
                        choices=[
                            ('STD_PREFIX_YY_SEQ5',       'KPS-26-00001    (Prefix · Year · Serial)'),
                            ('STD_PREFIX_YYYY_SEQ5',     'KPS-2026-00001  (Prefix · Full Year · Serial)'),
                            ('STD_PREFIX_SEQ5',          'KPS-00001       (Prefix · Serial only)'),
                            ('STD_PREFIX_SHIFT_YY_SEQ5', 'KPS-M-26-00001  (Prefix · Shift · Year · Serial)'),
                            ('STD_PREFIX_NOSEP_SEQ5',    'KPS00001        (Prefix + Serial, no separator)'),
                        ],
                        default='STD_PREFIX_YY_SEQ5',
                        max_length=30,
                    ),
                ),
            ],
        ),
    ]
