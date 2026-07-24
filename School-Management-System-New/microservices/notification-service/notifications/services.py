import json
import threading
from typing import Optional
# pyrefly: ignore [missing-import]
from django.conf import settings
# pyrefly: ignore [missing-import]
from .models import Notification
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync


_pywebpush_cache = {}


def _get_pywebpush():
    """Import pywebpush with the REAL `requests` library.

    This project has a Django app also named `requests` (`backend/requests/`)
    that shadows the PyPI `requests` lib on sys.path. pywebpush binds `requests`
    at import time, so we temporarily drop the backend dir from sys.path, import
    the real lib + pywebpush (which binds it permanently in its cached module),
    then restore the local `requests` app for the rest of the project.
    """
    if _pywebpush_cache:
        return _pywebpush_cache.get("webpush"), _pywebpush_cache.get("exc")

    import sys
    import os
    import importlib

    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # .../backend
    saved_path = list(sys.path)
    saved_requests = {
        k: sys.modules.pop(k) for k in list(sys.modules)
        if k == "requests" or k.startswith("requests.")
    }
    sys.path = [p for p in sys.path if os.path.abspath(p or os.getcwd()) != backend_dir]
    try:
        importlib.import_module("requests")  # resolves to the real site-packages lib now
        from pywebpush import webpush, WebPushException
        _pywebpush_cache["webpush"] = webpush
        _pywebpush_cache["exc"] = WebPushException
    except Exception as e:
        print(f"[web-push] pywebpush import failed: {e}")
        _pywebpush_cache["webpush"] = None
        _pywebpush_cache["exc"] = Exception
    finally:
        sys.path = saved_path
        # Restore the local Django `requests` app modules
        for k in list(sys.modules):
            if k == "requests" or k.startswith("requests."):
                del sys.modules[k]
        sys.modules.update(saved_requests)

    return _pywebpush_cache.get("webpush"), _pywebpush_cache.get("exc")


def _ensure_vapid_key_file():
    """Materialise the VAPID private key PEM at VAPID_PRIVATE_KEY_PATH.

    The PEM is gitignored and may not be copied onto every server, so if the file
    is missing we write the embedded settings.VAPID_PRIVATE_KEY fallback to it.
    Returns the path on success, else None.
    """
    import os
    path = getattr(settings, "VAPID_PRIVATE_KEY_PATH", "")
    if path and os.path.exists(path):
        return path
    pem = getattr(settings, "VAPID_PRIVATE_KEY", "") or ""
    if not path or not pem.strip():
        return path or None
    try:
        with open(path, "w") as fh:
            fh.write(pem)
        return path
    except Exception as e:
        print(f"[web-push] could not write VAPID key file: {e}")
        return None


def _send_web_push_sync(sub, payload):
    """Send one web push; delete the subscription if its endpoint is gone."""
    webpush, WebPushException = _get_pywebpush()
    if webpush is None:
        return
    key_path = _ensure_vapid_key_file()
    if not key_path:
        return
    try:
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            },
            data=json.dumps(payload),
            vapid_private_key=key_path,
            vapid_claims={"sub": f"mailto:{getattr(settings, 'VAPID_CLAIM_EMAIL', 'no-reply@example.com')}"},
            timeout=10,
        )
    except WebPushException as ex:
        status = getattr(getattr(ex, "response", None), "status_code", None)
        if status in (404, 410):  # subscription expired / unsubscribed
            try:
                sub.delete()
            except Exception:
                pass
    except Exception:
        pass


def push_to_user(user, title, body="", url="/admin/notifications", tag=None):
    """Send a Web Push to all of a user's subscriptions, off the request thread."""
    # pyrefly: ignore [missing-import]
    from .models import PushSubscription
    try:
        subs = list(PushSubscription.objects.filter(user=user))
    except Exception:
        return
    if not subs:
        return
    payload = {"title": title, "body": body or "", "url": url or "/admin/notifications"}
    if tag:
        payload["tag"] = tag

    def _run():
        for s in subs:
            _send_web_push_sync(s, payload)

    threading.Thread(target=_run, daemon=True).start()


def create_notification(recipient, actor: Optional[settings.AUTH_USER_MODEL] = None, verb: str = '', target_text: str = '', data: dict = None):
    """Helper to create a notification record and send via WebSocket."""
    if recipient is None:
        return
    if data is None:
        data = {}
    # recipient may be a user instance or id
    try:
        # Get recipient user ID
        if hasattr(recipient, 'id'):
            recipient_id = recipient.id
            recipient_user = recipient
        else:
            recipient_id = recipient
            # pyrefly: ignore [missing-import]
            from django.contrib.auth import get_user_model
            User = get_user_model()
            recipient_user = User.objects.get(id=recipient_id)
        
        # Get actor name
        actor_name = None
        if actor:
            if hasattr(actor, 'get_full_name'):
                actor_name = actor.get_full_name() or str(actor)
            else:
                actor_name = str(actor)
        
        notification = Notification.objects.create(
            recipient=recipient_user,
            actor=actor,
            verb=verb,
            target_text=target_text or '',
            data=data or {},
        )
        
        # Send notification via WebSocket
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                # Serialize notification data
                notification_data = {
                    'id': notification.id,
                    'verb': notification.verb,
                    'target_text': notification.target_text,
                    'actor_name': actor_name,
                    'timestamp': notification.timestamp.isoformat(),
                    'data': notification.data,
                    'unread': notification.unread,
                }
                
                # Send to user's channel group
                async_to_sync(channel_layer.group_send)(
                    f'user_{recipient_id}',
                    {
                        'type': 'notification_message',
                        'message': notification_data
                    }
                )
        except Exception as ws_error:
            print(f"[DEBUG] Failed to send WebSocket notification: {ws_error}")
            # Don't fail notification creation if WebSocket fails

        # Web push (OS-level notification, even if the app/tab is closed)
        try:
            url = (data or {}).get('url') or '/admin/notifications'
            push_to_user(recipient_user, verb, target_text or '', url)
        except Exception:
            pass

        return notification
    except Exception as e:
        return None
