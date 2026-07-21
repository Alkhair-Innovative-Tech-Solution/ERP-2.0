"""
WebSocket routing for chat.
"""
from django.urls import path
from apps.chat.consumers import ChatConsumer

websocket_urlpatterns = [
    path('ws/chat/<uuid:ticket_id>/', ChatConsumer.as_asgi()),
]


