"""
Django Ninja routers for File Service.
"""
from ninja import NinjaAPI
from apps.files.api import router as files_router

# Create API instance with version prefix
api = NinjaAPI(
    title="HDMS File Service API",
    version="1.0.0",
    description="File Service API for HDMS",
)

# Include routers
api.add_router('/files', files_router, tags=['files'])


