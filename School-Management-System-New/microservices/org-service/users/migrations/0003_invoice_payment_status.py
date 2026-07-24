from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0002_add_org_code_prefix_pattern'),
    ]

    operations = [
        # 1. Add payment_status + activation_date to Organization
        migrations.AddField(
            model_name='organization',
            name='payment_status',
            field=models.CharField(
                choices=[('pending', 'Awaiting Payment'), ('paid', 'Paid'), ('overdue', 'Overdue')],
                default='paid',
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name='organization',
            name='activation_date',
            field=models.DateTimeField(blank=True, null=True),
        ),

        # 2. Create Invoice model
        migrations.CreateModel(
            name='Invoice',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('invoice_number', models.CharField(max_length=50, unique=True)),
                ('invoice_type', models.CharField(
                    choices=[('initial', 'Initial'), ('recurring', 'Recurring')],
                    default='initial',
                    max_length=10,
                )),
                ('amount', models.DecimalField(decimal_places=2, max_digits=12)),
                ('status', models.CharField(
                    choices=[
                        ('pending', 'Pending'),
                        ('receipt_uploaded', 'Receipt Uploaded'),
                        ('paid', 'Paid'),
                        ('rejected', 'Rejected'),
                        ('overdue', 'Overdue'),
                    ],
                    default='pending',
                    max_length=20,
                )),
                ('due_date', models.DateTimeField()),
                ('billing_period_start', models.DateField()),
                ('billing_period_end', models.DateField()),
                ('receipt', models.FileField(blank=True, null=True, upload_to='invoices/receipts/')),
                ('receipt_uploaded_at', models.DateTimeField(blank=True, null=True)),
                ('approved_at', models.DateTimeField(blank=True, null=True)),
                ('rejection_note', models.TextField(blank=True)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('organization', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='invoices',
                    to='users.organization',
                )),
                ('plan', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to='users.subscriptionplan',
                )),
                ('approved_by', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='approved_invoices',
                    to='users.user',
                )),
            ],
            options={
                'db_table': 'users_invoice',
                'ordering': ['-created_at'],
            },
        ),
    ]
