"""
Django Ninja routers for Ticket Service.
"""
from ninja import NinjaAPI
from apps.tickets.api import router as tickets_router
from apps.approvals.api import router as approvals_router

# Create API instance with version prefix
api = NinjaAPI(
    title="HDMS Ticket Service API",
    version="1.0.0",
    description="Ticket Service API for HDMS",
)

# Include routers
api.add_router('/tickets', tickets_router, tags=['tickets'])
api.add_router('/approvals', approvals_router, tags=['approvals'])


