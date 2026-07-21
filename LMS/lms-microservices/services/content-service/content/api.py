from ninja_extra import NinjaExtraAPI
from .router import router

content_api = NinjaExtraAPI(urls_namespace="content")
content_api.add_router("", router)
