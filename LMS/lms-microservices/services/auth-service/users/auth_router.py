from ninja import Router
from ninja_jwt.authentication import JWTAuth  # type: ignore # ✅ Import JWT authentication
from ninja_jwt.controller import NinjaJWTDefaultController  # type: ignore # ✅ Default JWT endpoints
from ninja_jwt.tokens import RefreshToken # type: ignore

# Create router
auth_router = Router()


def generate_access_token(user):
    refresh = RefreshToken.for_user(user)
    # Add custom claims to both refresh and access tokens
    role = getattr(user, 'role', 'student').upper()
    refresh['role'] = role
    refresh['email'] = user.email
    refresh['username'] = user.email
    # 🔹 Multi-Tenancy: Add org_id and campus_id to JWT
    org_id = getattr(user, 'organization_id', None)
    campus_id = getattr(user, 'campus_id', None)
    refresh['org_id'] = str(org_id) if org_id else None
    refresh['campus_id'] = str(campus_id) if campus_id else None
    
    # SimpleJWT usually copies claims to access token, but let's be explicit
    access_token = refresh.access_token
    access_token['role'] = role
    access_token['email'] = user.email
    access_token['username'] = user.email
    access_token['org_id'] = str(org_id) if org_id else None
    access_token['campus_id'] = str(campus_id) if campus_id else None
    
    access_t = str(access_token)
    refresh_t = str(refresh)
    return {
        "access": access_t,
        "refresh": refresh_t,
    }


# Protected route example
@auth_router.get("/protected", auth=JWTAuth())
def protected_route(request):
    return {"message": f"Hello, {request.auth.username}!"}

# Identity endpoint for frontend to get full profile including student_id
from .serializers import user_to_schema
from .schemas import UserInfoSchema

@auth_router.get("/me/", response=UserInfoSchema, auth=JWTAuth())
def get_me(request):
    """
    Returns the current user's full information including student_id and profile_image.
    """
    return user_to_schema(request.auth)
