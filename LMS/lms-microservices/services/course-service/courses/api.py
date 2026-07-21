# Ninja imports
from ninja_extra import NinjaExtraAPI
# My Files
from .router import course_router


# API init
from shared.common.authentication import JWTAuthentication

course_api = NinjaExtraAPI(
    urls_namespace="courses",
)

# Including the router from course
course_api.add_router("", course_router)
