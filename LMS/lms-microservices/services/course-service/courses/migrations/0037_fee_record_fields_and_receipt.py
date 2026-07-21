# Generated manually - adds fee_type, discount fields, and receipt_number to fee models

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0036_whatsapp_groups_and_student_warnings'),
    ]

    operations = [
        migrations.AddField(
            model_name='studentfeerecord',
            name='fee_type',
            field=models.CharField(
                choices=[('monthly', 'Monthly'), ('full', 'Full Course')],
                default='monthly',
                max_length=20,
                help_text="Monthly installment or full course payment"
            ),
        ),
        migrations.AddField(
            model_name='studentfeerecord',
            name='original_amount',
            field=models.IntegerField(
                null=True,
                blank=True,
                help_text="Original amount before discount (for full payments)"
            ),
        ),
        migrations.AddField(
            model_name='studentfeerecord',
            name='discount_amount',
            field=models.IntegerField(
                default=0,
                help_text="Discount applied (for full payments)"
            ),
        ),
        migrations.AddField(
            model_name='studentfeerecord',
            name='receipt_number',
            field=models.CharField(
                max_length=50,
                null=True,
                blank=True,
                unique=True,
                help_text="Auto-generated receipt number"
            ),
        ),
    ]
