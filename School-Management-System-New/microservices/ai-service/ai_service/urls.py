from django.urls import path, include

urlpatterns = [
    path("api/ai/", include("ai_chat.urls")),
]
