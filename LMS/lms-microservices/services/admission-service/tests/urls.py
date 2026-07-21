from django.urls import path, re_path, include
from .views import (
    CheckRequirementView,
    GenerateTestLinkView,
    StartTestView,
    SubmitTestView,
    TestResultView,
    LeadView,
    LeadStatusView,
    LeadLookupView,
    EntranceTestQuestionsView,
    EntranceTestSubmitView,
    LeadListView,
    LeadListPaginatedView,
    LeadDetailView,
    LeadRestoreView,
    LeadByEmailView,
    LeadBySeqIdView,
    InterviewViewSet,
    ReceiptCodeListView,
    ReceiptCodeCreateView,
    ReceiptCodeDetailView,
    ReceiptCodeRestoreView,
    ReceiptCodeProcessReturnView,
    ReceiptCodeVerifyView,
    LeadConvertView,
    LeadStatsView,
    LeadScoreOverrideView,
    LeadManualScoreView,
    TestListView,
    TestDetailView,
    QuestionListView,
    QuestionDetailView,
    QuestionImageUploadView,
    QuestionReorderView,
    TestAttemptListView,
)
from rest_framework.routers import DefaultRouter

router = DefaultRouter()
router.register(r'interviews', InterviewViewSet, basename='interview')

urlpatterns = [
    # Standard Microservice API
    re_path(r'^check-requirement/?$', CheckRequirementView.as_view(), name='check-requirement'),
    re_path(r'^generate-link/?$', GenerateTestLinkView.as_view(), name='generate-link'),
    re_path(r'^start/?$', StartTestView.as_view(), name='start-test'),
    re_path(r'^submit/?$', SubmitTestView.as_view(), name='submit-test'),
    re_path(r'^result/(?P<attempt_id>[0-9a-f-]+)/?$', TestResultView.as_view(), name='test-result'),

    # Entrance Flow (for Registration)
    re_path(r'^lead-stats/?$', LeadStatsView.as_view(), name='lead-stats'),
    re_path(r'^lead/?$', LeadView.as_view(), name='lead-create'),
    re_path(r'^lead/lookup/?$', LeadLookupView.as_view(), name='lead-lookup'),
    re_path(r'^lead/by-email/?$', LeadByEmailView.as_view(), name='lead-by-email'),
    re_path(r'^lead/by-seq-id/?$', LeadBySeqIdView.as_view(), name='lead-by-seq-id'),
    re_path(r'^lead-list/?$', LeadListView.as_view(), name='lead-list'),
    re_path(r'^lead-list/paginated/?$', LeadListPaginatedView.as_view(), name='lead-list-paginated'),
    re_path(r'^lead/(?P<lead_id>[0-9a-f-]+)/status/?$', LeadStatusView.as_view(), name='lead-status'),
    re_path(r'^lead/(?P<lead_id>[0-9a-f-]+)/restore/?$', LeadRestoreView.as_view(), name='lead-restore'),
    re_path(r'^lead/(?P<lead_id>[0-9a-f-]+)/convert/?$', LeadConvertView.as_view(), name='lead-convert'),
    re_path(r'^lead/(?P<lead_id>[0-9a-f-]+)/score-override/?$', LeadScoreOverrideView.as_view(), name='lead-score-override'),
    re_path(r'^lead/(?P<lead_id>[0-9a-f-]+)/manual-score/?$', LeadManualScoreView.as_view(), name='lead-manual-score'),
    re_path(r'^lead/(?P<lead_id>[0-9a-f-]+)/?$', LeadDetailView.as_view(), name='lead-detail'),
    path('entrance-test/<uuid:lead_id>/submit/', EntranceTestSubmitView.as_view(), name='entrance-test-submit'),
    path('entrance-test/<uuid:lead_id>/', EntranceTestQuestionsView.as_view(), name='entrance-test-questions'),

    # Receipt Code Protocol
    re_path(r'^receipt-codes/add/?$', ReceiptCodeCreateView.as_view(), name='receipt-codes-create'),
    re_path(r'^receipt-codes/verify/(?P<code_str>[^/]+)/?$', ReceiptCodeVerifyView.as_view(), name='receipt-codes-verify'),
    re_path(r'^receipt-codes/(?P<code_id>[0-9a-f-]+)/restore/?$', ReceiptCodeRestoreView.as_view(), name='receipt-codes-restore'),
    re_path(r'^receipt-codes/(?P<code_id>[0-9a-f-]+)/process-return/?$', ReceiptCodeProcessReturnView.as_view(), name='receipt-codes-return'),
    re_path(r'^receipt-codes/(?P<code_id>[0-9a-f-]+)/?$', ReceiptCodeDetailView.as_view(), name='receipt-codes-detail'),
    re_path(r'^receipt-codes/?$', ReceiptCodeListView.as_view(), name='receipt-codes-list'),

    # Admin Test Management
    re_path(r'^tests/?$', TestListView.as_view(), name='test-list'),
    re_path(r'^tests/(?P<pk>[0-9a-f-]+)/?$', TestDetailView.as_view(), name='test-detail'),
    re_path(r'^tests/(?P<test_id>[0-9a-f-]+)/questions/?$', QuestionListView.as_view(), name='question-list'),
    re_path(r'^tests/questions/(?P<pk>[0-9a-f-]+)/?$', QuestionDetailView.as_view(), name='question-detail'),
    re_path(r'^tests/questions/(?P<question_id>[0-9a-f-]+)/upload-image/?$', QuestionImageUploadView.as_view(), name='question-image-upload'),
    re_path(r'^tests/(?P<test_id>[0-9a-f-]+)/reorder-questions/?$', QuestionReorderView.as_view(), name='question-reorder'),
    re_path(r'^attempts/?$', TestAttemptListView.as_view(), name='attempts-list'),

    path('', include(router.urls)),
]
