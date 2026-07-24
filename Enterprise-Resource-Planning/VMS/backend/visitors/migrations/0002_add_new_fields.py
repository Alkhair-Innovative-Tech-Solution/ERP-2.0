# Generated migration

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('visitors', '0001_initial'),
    ]

    operations = [
        # Visitor model changes
        migrations.AddField(
            model_name='visitor',
            name='is_blacklisted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='visitor',
            name='blacklist_reason',
            field=models.TextField(blank=True, null=True),
        ),
        
        # Visit model changes
        migrations.AddField(
            model_name='visit',
            name='is_overnight',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='visit',
            name='overnight_notified',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='visit',
            name='expected_checkout_at',
            field=models.DateTimeField(blank=True, help_text='Expected/estimated checkout time', null=True),
        ),
        migrations.AddField(
            model_name='visit',
            name='is_late',
            field=models.BooleanField(default=False, help_text='True if checkout is 30+ minutes late'),
        ),
        migrations.AddField(
            model_name='visit',
            name='purpose_other',
            field=models.TextField(blank=True, help_text="Custom purpose when 'Other' is selected", null=True),
        ),
        migrations.AddField(
            model_name='visit',
            name='interview_position',
            field=models.CharField(blank=True, help_text='For Interview: position applied for', max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='visit',
            name='contractor_company',
            field=models.CharField(blank=True, help_text='For Contractor: company name', max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='visit',
            name='contractor_designation',
            field=models.CharField(blank=True, help_text='For Contractor: designation', max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='visit',
            name='contractor_address',
            field=models.TextField(blank=True, help_text='For Contractor: company address', null=True),
        ),
        migrations.AddField(
            model_name='visit',
            name='delivery_company',
            field=models.CharField(blank=True, help_text='For Delivery: delivery company name', max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='visit',
            name='official_department',
            field=models.CharField(blank=True, help_text='For Official: department/organization', max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='visit',
            name='official_rank',
            field=models.CharField(blank=True, help_text='For Official: rank/designation', max_length=200, null=True),
        ),
        migrations.AddField(
            model_name='visit',
            name='vip_category',
            field=models.CharField(blank=True, help_text='For VIP: category (VIP/Client/Donor)', max_length=200, null=True),
        ),
        migrations.AlterField(
            model_name='visit',
            name='purpose',
            field=models.CharField(blank=True, choices=[('interview', 'Interview'), ('meeting', 'Meeting'), ('delivery', 'Delivery/Courier'), ('contractor', 'Contractor/Worker'), ('official', 'Official Visit'), ('vip', 'VIP/Client/Donor'), ('other', 'Other')], max_length=20, null=True),
        ),
        migrations.AddIndex(
            model_name='visit',
            index=models.Index(fields=['purpose'], name='visitors_vi_purpose_123456_idx'),
        ),
    ]
