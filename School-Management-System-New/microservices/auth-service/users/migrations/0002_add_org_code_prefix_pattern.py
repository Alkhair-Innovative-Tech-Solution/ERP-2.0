from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='organization',
            name='code_prefix',
            field=models.CharField(blank=True, max_length=6, null=True, unique=True),
        ),
        migrations.AddField(
            model_name='organization',
            name='code_pattern',
            field=models.CharField(
                blank=True,
                choices=[
                    ('PREFIX_YY_ROLE_SEQ4', 'IAK-26-T-0001   (Prefix · Year · Role · Serial)'),
                    ('PREFIX_YYYY_SEQ4', 'IAK-2026-0001   (Prefix · FullYear · Serial)'),
                    ('PREFIX_ROLE_SEQ4', 'IAK-T-0001      (Prefix · Role · Serial)'),
                    ('PREFIX_SEQ4', 'IAK-0001        (Prefix · Serial only)'),
                    ('PREFIX_YYYY_ROLE_SEQ5_SLASH', 'IAK/2026/T/00001 (International slash style)'),
                ],
                default='PREFIX_YY_ROLE_SEQ4',
                max_length=30,
            ),
        ),
    ]
