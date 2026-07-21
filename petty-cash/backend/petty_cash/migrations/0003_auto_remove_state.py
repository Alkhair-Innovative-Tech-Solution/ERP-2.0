from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('petty_cash', '0002_fundtype_alter_user_options_branch_address_and_more'),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel(name='AuditLog'),
                migrations.DeleteModel(name='Branch'),
                migrations.DeleteModel(name='CashFund'),
                migrations.DeleteModel(name='ExpenseCategory'),
                migrations.DeleteModel(name='FundType'),
                migrations.DeleteModel(name='FundTransfer'),
                migrations.DeleteModel(name='MonthlyBudget'),
                migrations.DeleteModel(name='Notification'),
                migrations.DeleteModel(name='Replenishment'),
                migrations.DeleteModel(name='ReplenishmentRequest'),
                migrations.DeleteModel(name='ReportTemplate'),
                migrations.DeleteModel(name='SystemSetting'),
                migrations.DeleteModel(name='Transaction'),
                migrations.DeleteModel(name='User'),
                migrations.DeleteModel(name='ApprovalRequest'),
            ],
            database_operations=[],
        ),
    ]
