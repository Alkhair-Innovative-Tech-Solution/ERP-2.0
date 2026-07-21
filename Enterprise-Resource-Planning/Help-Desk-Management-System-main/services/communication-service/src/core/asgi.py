"""
ASGI config for Communication Service.
"""
import os
# Set Django settings module BEFORE any Django imports
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
# Initialize Django FIRST - this loads all apps and settings
from django.core.asgi import get_asgi_application
django_asgi_app = get_asgi_application()
# NOW import routing (after Django is initialized)
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from apps.chat.middleware import JWTAuthMiddleware
from apps.chat.routing import websocket_urlpatterns
application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        JWTAuthMiddleware(
            URLRouter(websocket_urlpatterns)
        )
    ),
})
