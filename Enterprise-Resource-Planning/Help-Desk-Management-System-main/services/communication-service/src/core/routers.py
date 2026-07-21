"""
Django Ninja routers for Communication Service.
"""
from ninja import NinjaAPI
from apps.chat.api import router as chat_router
from apps.notifications.api import router as notifications_router

# Create API instance with version prefix
api = NinjaAPI(
    title="HDMS Communication Service API",
    version="1.0.0",
    description="Communication Service API for HDMS",
)

# Include routers
api.add_router('/chat', chat_router, tags=['chat'])
api.add_router('/notifications', notifications_router, tags=['notifications'])


