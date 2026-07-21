from django.contrib import admin # type: ignore
from .models import User, Student, Teacher, ReceiptCode


# Register User model with custom user manager
class UserAdmin(admin.ModelAdmin):
    list_display = (
        "full_name",
        "email",
        "role",
        "is_active",
        "is_staff",
        "is_superuser",
        "created_at",
    )
    list_filter = ("role", "is_active", "is_staff", "is_superuser")
    search_fields = ("full_name", "email", "cnic")
    ordering = ("created_at",)

    fieldsets = (
        (None, {"fields": ("full_name", "email", "cnic", "phone", "role", "password")}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser")}),
    )

    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "full_name",
                    "email",
                    "cnic",
                    "phone",
                    "password",
                    "role",
                    "is_active",
                    "is_staff",
                    "is_superuser",
                ),
            },
        ),
    )

    search_fields = ("email", "full_name", "cnic")
    ordering = ("email",)


# Register Student model
class StudentAdmin(admin.ModelAdmin):
    list_display = ("user", "status", "receipt_code_verified", "lms_account_created", "created_at")
    list_filter = ("status", "receipt_code_verified", "lms_account_created")
    search_fields = ("user__full_name", "user__email", "receipt_code")
    ordering = ("created_at",)


# Register Teacher model
class TeacherAdmin(admin.ModelAdmin):
    list_display = (
        "user",
        "specialization",
        "qualification",
        "experience",
        "created_at",
    )
    list_filter = ("specialization",)
    search_fields = ("user__full_name", "user__email", "specialization")
    ordering = ("created_at",)


# Register ReceiptCode model
class ReceiptCodeAdmin(admin.ModelAdmin):
    list_display = (
        "code",
        "student_name",
        "student_email",
        "test_score",
        "verified",
        "lms_account_created",
        "generated_at",
    )
    list_filter = ("verified", "lms_account_created")
    search_fields = ("code", "student_name", "student_email")
    ordering = ("-generated_at",)
    readonly_fields = ("generated_at", "verified_at")


# Register models with the admin site
admin.site.register(User, UserAdmin)
admin.site.register(Student, StudentAdmin)
admin.site.register(Teacher, TeacherAdmin)


# NOTE: ReceiptCode in auth-service is a legacy mirror.
# The canonical source is admission-service. This admin is for reference only.
class ReceiptCodeAdmin(admin.ModelAdmin):
    list_display = (
        "code", "receipt_number", "student_name", "student_email",
        "deposit_amount", "bag_taken", "id_card_taken",
        "verified", "lms_account_created",
        "is_returned", "amount_returned",
        "generated_at",
    )
    list_filter = ("verified", "lms_account_created", "is_returned", "bag_taken", "id_card_taken", "is_deleted")
    search_fields = ("code", "receipt_number", "student_name", "student_email")
    ordering = ("-generated_at",)
    readonly_fields = ("generated_at", "verified_at", "returned_at")

admin.site.register(ReceiptCode, ReceiptCodeAdmin)
