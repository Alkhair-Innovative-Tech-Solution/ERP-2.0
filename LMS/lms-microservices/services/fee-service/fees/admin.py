from django.contrib import admin
from .models import FeeType, FeeStructure, FeeLineItem, StudentFee, Payment, PaymentTransaction, BankAccount

admin.site.register(FeeType)
admin.site.register(FeeStructure)
admin.site.register(FeeLineItem)
admin.site.register(StudentFee)
admin.site.register(Payment)
admin.site.register(PaymentTransaction)
admin.site.register(BankAccount)
