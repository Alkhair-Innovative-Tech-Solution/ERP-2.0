# Ninja imports
from ninja_extra import NinjaExtraAPI
# My Files
from .router import batch_router


# API init
batch_api = NinjaExtraAPI(version="1.0.0", urls_namespace="batches")

# Including the router from course
batch_api.add_router("", batch_router)
