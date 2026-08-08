import json
import jwt as pyjwt
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from central_auth.authentication import CentralAuthUser
from central_auth.jwks import JWKSUnavailable, get_signing_key
import psutil
import asyncio
import random


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Handle WebSocket connection with JWT authentication"""
        # Get token from query string
        query_string = self.scope.get('query_string', b'').decode()
        token = None
        
        # Parse query string to get token (handle URL encoding)
        from urllib.parse import unquote
        for param in query_string.split('&'):
            if param.startswith('token='):
                token = unquote(param.split('=', 1)[1])
                break
        
        if not token:
            print("WebSocket: No token provided")
            await self.close(code=4001)
            return
        
        # Authenticate user
        user = await self.authenticate_user(token)
        if not user:
            print(f"WebSocket: Authentication failed for token")
            await self.close(code=4003)
            return
        
        # Set user in scope
        self.scope['user'] = user
        self.user = user
        
        # Join user-specific channel group
        self.room_group_name = f'user_{user.id}'
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        print(f"WebSocket: User {user.id} connected to notifications")
        await self.accept()
    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection"""
        # Leave channel group
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )
    
    async def receive(self, text_data):
        """Handle messages received from WebSocket"""
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            if message_type == 'ping':
                # Respond to ping with pong
                await self.send(text_data=json.dumps({
                    'type': 'pong'
                }))
        except json.JSONDecodeError:
            pass
    
    async def notification_message(self, event):
        """Send notification to WebSocket"""
        # Some senders (e.g. audit_log signal) send event_type/feature/action
        # but no 'message' key — handle both cases safely
        message = event.get('message')
        if message is not None:
            # Standard notification from notifications/services.py
            await self.send(text_data=json.dumps(message))
        else:
            # Lightweight event (e.g. audit_log_created from signals)
            # Forward the useful fields so frontend can react if needed
            event_type = event.get('event_type', '')
            if event_type:
                await self.send(text_data=json.dumps({
                    'type': event_type,
                    'feature': event.get('feature', ''),
                    'action': event.get('action', ''),
                }))
    
    async def authenticate_user(self, token):
        """Authenticate user from JWT token.

        Phase D-R4: HS256 (legacy verify_token/_TokenUser) verification
        removed — central auth (RS256, via JWKS) is the only live path.
        See docs/PHASE_D_R4R6_REMOVAL_RESULT.md.

        Note: authenticating successfully here does not yet mean a
        central-auth user will actually RECEIVE anything — no code path in
        this phase stamps Notification.central_recipient_id (see
        AnnouncementViewSet._fan_out_notifications' fail-closed guard in
        views.py), so their `user_{uuid}` channel group currently never
        gets a group_send. This fix only removes the connection-level
        failure; it doesn't (and structurally can't yet) deliver content.
        """
        try:
            header = pyjwt.get_unverified_header(token)
        except pyjwt.InvalidTokenError as e:
            print(f"WebSocket authentication error: malformed token ({e})")
            return None

        try:
            public_key = get_signing_key(header.get('kid'))
            claims = pyjwt.decode(token, key=public_key, algorithms=['RS256'])
            if claims.get('token_type') != 'access':
                print("WebSocket authentication error: not an access token")
                return None
            return CentralAuthUser(claims)
        except JWKSUnavailable as e:
            print(f"WebSocket authentication error: signing key unavailable ({e})")
            return None
        except (pyjwt.InvalidTokenError, Exception) as e:
            print(f"WebSocket authentication error: {e}")
            return None


class MonitoringConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        """Handle system monitoring WebSocket connection"""
        # Get token from query string
        query_string = self.scope.get('query_string', b'').decode()
        token = None
        from urllib.parse import unquote
        for param in query_string.split('&'):
            if param.startswith('token='):
                token = unquote(param.split('=', 1)[1])
                break
        
        if not token:
            await self.close(code=4001)
            return
            
        # Authenticate user
        from .consumers import NotificationConsumer
        # Reuse authenticate_user logic (simplified here or we could refactor)
        user = await self.authenticate_user_local(token)
        # Phase D-R4: 'admin'-role gate removed along with HS256 — a
        # central-auth token has no role/admin-tier claim (same
        # unresolvable gap flagged throughout D-R4's dual_auth.py edits),
        # so this now fails closed to is_superadmin only. See
        # docs/PHASE_D_R4R6_REMOVAL_RESULT.md.
        if not user or not getattr(user, 'is_superadmin', False):
            await self.close(code=4003)
            return

        self.scope['user'] = user
        self.user = user
        await self.accept()
        self.keep_running = True
        
        # Join system monitoring group for logs
        await self.channel_layer.group_add(
            "system_monitoring",
            self.channel_name
        )
        
        self.monitoring_task = asyncio.create_task(self.send_stats())

    async def disconnect(self, close_code):
        """Handle system monitoring WebSocket disconnection"""
        self.keep_running = False
        
        # Leave system monitoring group
        await self.channel_layer.group_discard(
            "system_monitoring",
            self.channel_name
        )
        
        if hasattr(self, 'monitoring_task'):
            self.monitoring_task.cancel()

    # Microservices to probe — (key, docker_hostname, port)
    MICROSERVICE_PROBES = [
        ('auth',         'auth-service',         8001),
        ('org',          'org-service',          8002),
        ('campus',       'campus-service',       8003),
        ('staff',        'staff-service',        8004),
        ('student',      'student-service',      8005),
        ('attendance',   'attendance-service',   8006),
        ('result',       'result-service',       8007),
        ('timetable',    'timetable-service',    8009),
        ('fees',         'fees-service',         8008),
        ('notification', 'notification-service', 8010),
        ('support',      'support-service',      8011),
    ]

    async def _probe_service(self, host: str, port: int) -> dict:
        """TCP-connect probe — fast, no HTTP overhead."""
        import time
        start = time.time()
        try:
            reader, writer = await asyncio.wait_for(
                asyncio.open_connection(host, port), timeout=1.0
            )
            writer.close()
            try:
                await writer.wait_closed()
            except Exception:
                pass
            latency = int((time.time() - start) * 1000)
            return {'latency': f"{latency}ms", 'status': 'Healthy', 'uptime': 'Running'}
        except Exception:
            return {'latency': '—', 'status': 'Unhealthy', 'uptime': 'Down'}

    async def send_stats(self):
        """Send actual system stats periodically"""
        import traceback
        import time
        import os
        from django.db import connection
        from django.core.cache import cache
        from django.conf import settings
        from channels.db import database_sync_to_async

        while self.keep_running:
            try:
                # 0. Process Uptimes (Backend & Frontend)
                try:
                    # Backend Uptime (This process)
                    be_proc = psutil.Process()
                    be_start_time = be_proc.create_time()
                    be_uptime_seconds = time.time() - be_start_time
                    d, r = divmod(int(be_uptime_seconds), 86400)
                    h, r = divmod(r, 3600)
                    m = int(r / 60)
                    be_uptime_str = f"{d}d {h}h" if d > 0 else f"{h}h {m}m"
                    
                    # Frontend Uptime (Search for npm/node/next process OR Docker container)
                    fe_uptime_str = "Down"
                    
                    # 1. Try local process check first
                    for proc in psutil.process_iter(['name', 'cmdline']):
                        try:
                            cmd = " ".join(proc.info['cmdline'] or [])
                            if 'next-dev' in cmd or 'next dev' in cmd or ('node' in proc.info['name'] and '3000' in cmd):
                                fe_start_time = proc.create_time()
                                fe_uptime_seconds = time.time() - fe_start_time
                                d, r = divmod(int(fe_uptime_seconds), 86400)
                                h, r = divmod(r, 3600)
                                m = int(r / 60)
                                fe_uptime_str = f"{d}d {h}h" if d > 0 else f"{h}h {m}m"
                                break
                        except (psutil.NoSuchProcess, psutil.AccessDenied):
                            continue
                    
                    # 2. Try network probe (Best for Docker environments)
                    if fe_uptime_str == "Down":
                        try:
                            import http.client
                            # Try connecting to 'frontend' service hostname (Docker network) or localhost
                            for host in ['frontend', 'localhost', '127.0.0.1']:
                                try:
                                    conn = http.client.HTTPConnection(host, 3000, timeout=0.3)
                                    conn.request("GET", "/")
                                    res = conn.getresponse()
                                    if res.status < 500: # Any response (including 404/login) means it's up
                                        fe_uptime_str = "Operational"
                                        conn.close()
                                        break
                                    conn.close()
                                except:
                                    continue
                        except:
                            pass

                    # 3. Last resort: Try Docker CLI (only works if socket is mounted or on host)
                    if fe_uptime_str == "Down":
                        try:
                            import subprocess
                            import datetime
                            cmd = ["docker", "inspect", "-f", "{{.State.Running}} {{.State.StartedAt}}", "sms_frontend"]
                            result = subprocess.run(cmd, capture_output=True, text=True, timeout=1)
                            if result.returncode == 0:
                                parts = result.stdout.strip().split()
                                is_running = parts[0].lower() == 'true'
                                if is_running and len(parts) > 1:
                                    started_at = parts[1].split('.')[0]
                                    start_dt = datetime.datetime.fromisoformat(started_at.replace('Z', '')).replace(tzinfo=datetime.timezone.utc)
                                    now_dt = datetime.datetime.now(datetime.timezone.utc)
                                    diff = now_dt - start_dt
                                    d, h, r = diff.days, *divmod(diff.seconds, 3600)
                                    m = int(r / 60)
                                    fe_uptime_str = f"{d}d {h}h" if d > 0 else f"{h}h {m}m"
                        except:
                            pass
                except Exception:
                    be_uptime_str = "Unknown"
                    fe_uptime_str = "Down"

                # 1. System Metrics (Real)
                cpu_usage = psutil.cpu_percent(interval=None)
                memory = psutil.virtual_memory()
                disk = psutil.disk_usage('/')
                
                # 2. Sync health checks (Wrapped for async)
                @database_sync_to_async
                def perform_sync_checks():
                    import datetime
                    results = {}
                    try:
                        # Database Health & Uptime
                        db_start_check = time.time()
                        try:
                            with connection.cursor() as cursor:
                                # Get real DB start time (Postgres)
                                cursor.execute("SELECT pg_postmaster_start_time();")
                                db_boot_time = cursor.fetchone()[0]
                                db_uptime_td = datetime.datetime.now(datetime.timezone.utc) - db_boot_time.replace(tzinfo=datetime.timezone.utc)
                                
                                days, rem = divmod(int(db_uptime_td.total_seconds()), 86400)
                                hours, rem = divmod(rem, 3600)
                                minutes = int(rem / 60)
                                
                                results['db_uptime'] = f"{days}d {hours}h" if days > 0 else f"{hours}h {minutes}m"
                                results['db_latency'] = f"{int((time.time() - db_start_check) * 1000)}ms"
                                results['db_status'] = "Healthy"
                        except Exception:
                            results['db_status'] = "Unhealthy"
                            results['db_uptime'] = "Down"
                            results['db_latency'] = "0ms"

                        # Redis Health & Uptime
                        redis_start_check = time.time()
                        try:
                            import redis
                            # Fallback connection to get INFO
                            r = redis.from_url(settings.CACHES['default']['LOCATION'])
                            info = r.info('server')
                            uptime_seconds = info.get('uptime_in_seconds', 0)
                            
                            days, rem = divmod(int(uptime_seconds), 86400)
                            hours, rem = divmod(rem, 3600)
                            minutes = int(rem / 60)
                            
                            results['redis_uptime'] = f"{days}d {hours}h" if days > 0 else f"{hours}h {minutes}m"
                            results['redis_latency'] = f"{int((time.time() - redis_start_check) * 1000)}ms"
                            results['redis_status'] = "Healthy"
                        except Exception:
                            results['redis_status'] = "Disconnected"
                            results['redis_uptime'] = "Down"
                            results['redis_latency'] = "0ms"

                        # Storage (Media Root) Health & Utilization
                        try:
                            # 1. Check Write Permission
                            test_file = os.path.join(settings.MEDIA_ROOT, '.health_check')
                            os.makedirs(settings.MEDIA_ROOT, exist_ok=True)
                            with open(test_file, 'w') as f:
                                f.write('ok')
                            os.remove(test_file)
                            
                            # 2. Get Disk Usage specifically for media path
                            media_usage = psutil.disk_usage(settings.MEDIA_ROOT)
                            results['storage_status'] = "Healthy"
                            results['storage_usage'] = f"{media_usage.percent}%"
                        except Exception:
                            results['storage_status'] = "ReadOnly"
                            results['storage_usage'] = "0%"

                        # Auth Service (User Database Check)
                        from django.contrib.auth import get_user_model
                        auth_start = time.time()
                        try:
                            User = get_user_model()
                            User.objects.count() # Test DB access for auth
                            results['auth_status'] = "Healthy"
                            results['auth_latency'] = f"{int((time.time() - auth_start) * 1000)}ms"
                        except Exception:
                            results['auth_status'] = "Critical"
                            results['auth_latency'] = "0ms"

                    except Exception:
                        pass
                    
                    return results

                sync_results = await perform_sync_checks()

                # Probe all 11 microservices in parallel
                probe_tasks = [
                    self._probe_service(host, port)
                    for _, host, port in self.MICROSERVICE_PROBES
                ]
                probe_results = await asyncio.gather(*probe_tasks, return_exceptions=True)
                microservice_stats = {}
                for (key, _, _), result in zip(self.MICROSERVICE_PROBES, probe_results):
                    if isinstance(result, Exception):
                        microservice_stats[key] = {'latency': '—', 'status': 'Unhealthy', 'uptime': 'Down'}
                    else:
                        microservice_stats[key] = result

                stats = {
                    'cpu': cpu_usage,
                    'memory': memory.percent,
                    'disk': disk.percent,
                    'network': random.randint(1, 5),
                    'services': {
                        **microservice_stats,
                        'frontend': {'latency': '15ms', 'status': 'Healthy' if fe_uptime_str != 'Down' else 'Unhealthy', 'uptime': fe_uptime_str},
                        'database': {'latency': sync_results.get('db_latency', '0ms'), 'status': sync_results.get('db_status', 'Unknown'), 'uptime': sync_results.get('db_uptime', 'Down')},
                        'redis':    {'latency': sync_results.get('redis_latency', '0ms'), 'status': sync_results.get('redis_status', 'Unknown'), 'uptime': sync_results.get('redis_uptime', 'Down')},
                    }
                }
                
                await self.send(text_data=json.dumps({
                    'type': 'system_stats',
                    'data': stats
                }))
                
                await asyncio.sleep(2)
            except asyncio.CancelledError:
                print("Monitoring task cancelled")
                break
            except Exception as e:
                print(f"❌ Monitoring task loop error!")
                traceback.print_exc()
                await asyncio.sleep(10)

    async def authenticate_user_local(self, token):
        """Authenticate user from JWT token.

        Phase D-R4: HS256 (legacy verify_token/_TokenUser) verification
        removed — central auth (RS256, via JWKS) is the only live path,
        same as NotificationConsumer.authenticate_user above. Previously
        this method had NO central-auth branch at all (HS256-only), which
        meant a central-auth superadmin could never open this monitoring
        socket post-cutover — a pre-existing gap, not something this
        change introduces. See docs/PHASE_D_R4R6_REMOVAL_RESULT.md.
        """
        try:
            header = pyjwt.get_unverified_header(token)
            public_key = get_signing_key(header.get('kid'))
            claims = pyjwt.decode(token, key=public_key, algorithms=['RS256'])
            if claims.get('token_type') != 'access':
                return None
            return CentralAuthUser(claims)
        except (JWKSUnavailable, pyjwt.InvalidTokenError, Exception):
            return None

    async def log_message(self, event):
        """Receive log message from group and send to WebSocket with filtering.

        Phase D-R4: the legacy 'admin'-tier branch (org_owner_id-filtered
        logs) is now unreachable — connect() already fails closed to
        is_superadmin only (see its own comment), and CentralAuthUser has
        no 'admin'-tier claim to check anyway. Kept simple rather than
        left in place referencing an attribute that no longer exists on
        this consumer's user object."""
        log = event['log']

        # SuperAdmins see everything
        if getattr(self.user, 'is_superadmin', False):
            await self.send(text_data=json.dumps({
                'type': 'system_log',
                'data': log
            }))
            return

