from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0006_org_pattern_nullable'),
    ]

    operations = [
        migrations.AlterField(
            model_name='organization',
            name='code_pattern',
            field=models.CharField(blank=True, choices=[('PREFIX_YY_ROLE_SEQ4', 'IAK-26-T-0001  (Prefix · Year · Role · Serial)'), ('PREFIX_YYYY_SEQ4', 'IAK-2026-0001  (Prefix · FullYear · Serial)'), ('PREFIX_ROLE_SEQ4', 'IAK-T-0001     (Prefix · Role · Serial)'), ('PREFIX_SEQ4', 'IAK-0001       (Prefix · Serial only)'), ('PREFIX_NOSEP_SEQ4', 'KPS0001        (Prefix + Serial, no separator)')], default='PREFIX_YY_ROLE_SEQ4', max_length=30),
        ),
    ]
