"""
JWT Authentication Middleware for Django Channels WebSocket connections.
Follows Django Channels best practices by handling authentication at middleware layer.
"""
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from urllib.parse import parse_qs
from django.contrib.auth import get_user_model

User = get_user_model()


class JWTAuthMiddleware(BaseMiddleware):
    """
    Custom middleware for JWT authentication via query parameters.
    
    Extracts and validates JWT token from query string, then populates
    the scope with user_id for use in consumers.
    """
    
    async def __call__(self, scope, receive, send):
        # Extract token from query string
        query_string = scope.get('query_string', b'').decode()
        query_params = parse_qs(query_string)
        token = query_params.get('token', [None])[0]
        
        if token:
            try:
                from django.conf import settings
                print(f"DEBUG: Validating token. Algorithm: {settings.SIMPLE_JWT.get('ALGORITHM')}", flush=True)
                print(f"DEBUG: Signing Key (first 10): {str(settings.SIMPLE_JWT.get('SIGNING_KEY'))[:10]}...", flush=True)
                
                # Validate and decode JWT
                access_token = AccessToken(token)
                print(f"DEBUG: Token payload: {access_token.payload}", flush=True)
                
                # Extract user ID (auth-service now uses UUID in 'user_id' claim)
                user_id = access_token.get('user_id')
                
                if user_id:
                    # JIT Sync: Look up or create user in HDMS database
                    user = await self.get_or_sync_user(access_token.payload)
                    if user:
                        scope['user'] = user
                        scope['user_id'] = str(user.id)
                        scope['token_validated'] = True
                        print(f"✅ JWT validated & JIT synced for user: {user.employee_code} (UUID: {user.id})")
                    else:
                        scope['user'] = None
                        scope['user_id'] = None
                        scope['token_validated'] = False
                        print(f"❌ Failed to sync user in HDMS for ID: {user_id}")
                else:
                    scope['user'] = None
                    scope['user_id'] = None
                    scope['token_validated'] = False
                    print(f"⚠️ JWT valid but no user_id claim found")
                    
            except (TokenError, InvalidToken) as e:
                scope['user'] = None
                scope['user_id'] = None
                scope['token_validated'] = False
                print(f"❌ JWT validation failed: {type(e).__name__}: {str(e)}", flush=True)
        else:
            scope['user'] = None
            scope['user_id'] = None
            scope['token_validated'] = False
            print(f"⚠️ No token provided in query string")
        
        return await super().__call__(scope, receive, send)

    @database_sync_to_async
    def get_or_sync_user(self, payload):
        """
        Just-In-Time (JIT) synchronization of user from JWT payload.
        Ensures HDMS local database has the user record.
        """
        try:
            user_id = payload.get('user_id')
            employee_code = payload.get('employee_code')
            full_name = payload.get('full_name', '')
            # Treat empty email as None so multiple users with no email don't
            # conflict on the unique constraint (NULLs are always allowed).
            email_raw = (payload.get('email') or '').strip()
            email = email_raw or None

            # Split full_name into first/last
            names = full_name.split(' ')
            first_name = names[0] if names else ''
            last_name = ' '.join(names[1:]) if len(names) > 1 else ''

            # JIT Sync: Try with original email, then mangled if duplicate
            emails_to_try = [email]
            if email:
                # Fallback email: {uuid}_{original_email}
                emails_to_try.append(f"{user_id}_{email}")
            
            last_error = None
            
            for try_email in emails_to_try:
                try:
                    # Build defaults — only include employee_code if non-empty
                    # (it's a NOT NULL UNIQUE field; None/empty would cause a DB error)
                    create_defaults = {
                        'first_name': first_name,
                        'last_name': last_name,
                        'email': try_email,
                        'role': payload.get('role', 'requestor'),
                        'is_active': payload.get('is_active', True),
                    }
                    if employee_code:
                        create_defaults['employee_code'] = employee_code

                    # Get or create user by ID (UUID)
                    user, created = User.objects.get_or_create(
                        id=user_id,
                        defaults=create_defaults,
                    )

                    if not created:
                        # Update existing user data — skip employee_code if empty
                        # to avoid NOT NULL / unique constraint violations
                        if employee_code:
                            user.employee_code = employee_code
                        user.first_name = first_name
                        user.last_name = last_name
                        if try_email: user.email = try_email
                        user.save()
                    
                    return user
                    
                except Exception as e:
                    last_error = e
                    # Check for integrity error (duplicate email)
                    if "unique constraint" in str(e).lower() and "email" in str(e).lower():
                        print(f"⚠️ JIT Sync Conflict: Email '{try_email}' already exists. Retrying with unique email.")
                        continue # Try next email format
                    else:
                        raise e # Other error, re-raise
            
            # If all attempts fail
            print(f"❌ JIT Sync failed handled attempts: {str(last_error)}")
            return None
        except Exception as e:
            print(f"❌ Error in JIT user sync: {str(e)}")
            import traceback
            traceback.print_exc()
            return None
