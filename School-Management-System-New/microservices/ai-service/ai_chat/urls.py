from django.urls import path
from .views import AIChatView, AIChatConversationsView, AIChatHistoryView

urlpatterns = [
    path("chat/", AIChatView.as_view(), name="ai_chat"),
    path("conversations/", AIChatConversationsView.as_view(), name="ai_conversations"),
    path("history/", AIChatHistoryView.as_view(), name="ai_history"),
]
