from django.contrib import admin
from .models import Test, Question, TestAttempt, EntranceLead, Interview, ReceiptCode


class QuestionInline(admin.TabularInline):
    model = Question
    extra = 1


@admin.register(Test)
class TestAdmin(admin.ModelAdmin):
    list_display = ('title', 'course_id', 'is_required', 'passing_marks', 'duration')
    list_filter = ('is_required',)
    search_fields = ('title', 'course_id', 'specialization_id')
    inlines = [QuestionInline]


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ('test', 'question_text', 'marks', 'difficulty')
    list_filter = ('test', 'difficulty')
    search_fields = ('question_text',)


@admin.register(TestAttempt)
class TestAttemptAdmin(admin.ModelAdmin):
    list_display = ('user_email', 'test', 'score', 'percentage', 'status', 'is_passed', 'enrollment_status', 'attempt_number', 'start_time')
    list_filter = ('status', 'is_passed', 'enrollment_status', 'test')
    search_fields = ('user_email', 'user_id', 'lms_enrollment_id')
    readonly_fields = ('start_time',)


@admin.register(EntranceLead)
class EntranceLeadAdmin(admin.ModelAdmin):
    list_display = (
        'lead_auto_id', 'name', 'email', 'phone', 'course_name_requested',
        'status', 'test_score', 'has_paid_deposit',
        'converted_to_student', 'lms_user_id', 'created_at'
    )
    list_filter = ('status', 'has_paid_deposit', 'converted_to_student', 'is_deleted', 'created_at')
    search_fields = ('name', 'email', 'phone', 'cnic_number')
    readonly_fields = ('created_at', 'lms_user_id', 'converted_at')
    ordering = ('-created_at',)


@admin.register(Interview)
class InterviewAdmin(admin.ModelAdmin):
    list_display = ('lead', 'interviewer_name', 'interview_date', 'score', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('lead__name', 'lead__email', 'interviewer_name')
    ordering = ('-created_at',)


@admin.register(ReceiptCode)
class ReceiptCodeAdmin(admin.ModelAdmin):
    list_display = (
        'code', 'receipt_number', 'student_name', 'student_email', 'cnic_number',
        'test_score', 'deposit_amount',
        'bag_taken', 'bag_paid', 'bag_waived',
        'id_card_taken', 'id_card_paid', 'id_card_waived',
        'is_waived', 'verified', 'lms_account_created',
        'is_returned', 'amount_returned',
        'generated_at',
    )
    list_filter = ('verified', 'lms_account_created', 'is_returned', 'is_waived', 'is_deleted', 'bag_taken', 'id_card_taken')
    search_fields = ('code', 'receipt_number', 'student_name', 'student_email', 'cnic_number')
    ordering = ('-generated_at',)
    readonly_fields = ('generated_at', 'verified_at', 'returned_at')
    raw_id_fields = ('lead',)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related('lead')
