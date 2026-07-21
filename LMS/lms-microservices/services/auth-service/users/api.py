# Ninja imports
from ninja_extra import NinjaExtraAPI
from ninja_jwt.controller import NinjaJWTDefaultController  # type: ignore

# My Files
from .router import router as user_router

# API init
user_api = NinjaExtraAPI(urls_namespace="users", csrf=False)

# Add your custom router first…
user_api.add_router("", user_router)

# …then register the JWT controller
user_api.register_controllers(NinjaJWTDefaultController)
