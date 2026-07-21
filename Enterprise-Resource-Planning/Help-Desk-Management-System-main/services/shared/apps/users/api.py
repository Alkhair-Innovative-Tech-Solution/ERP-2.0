"""
User Service API endpoints.
"""
from ninja import Router
from typing import List
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from apps.users.schemas import UserOut, UserIn, LoginIn, LoginOut, UserImportIn

router = Router(tags=["users"])


@router.post("/login", response=LoginOut)
def login(request, payload: LoginIn):
    """User login endpoint."""
    user = authenticate(employee_code=payload.employee_code, password=payload.password)
    if user and user.is_active and not user.is_deleted:
        refresh = RefreshToken.for_user(user)
        return {
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "user": UserOut.from_orm(user)
        }
    return {"error": "Invalid credentials"}, 401


@router.get("/users", response=List[UserOut])
def list_users(request):
    """List all users."""
    from apps.users.models import User
    users = User.objects.all()
    return [UserOut.from_orm(user) for user in users]


@router.get("/users/{user_id}", response=UserOut)
def get_user(request, user_id: str):
    """Get user by ID."""
    from apps.users.models import User
    user = User.objects.get(id=user_id, is_deleted=False)
    return UserOut.from_orm(user)


@router.post("/users/import")
def import_users(request, payload: UserImportIn):
    """Import users from CSV/Excel."""
    from apps.users.services.import_service import ImportService
    service = ImportService()
    result = service.import_users(payload.file_data)
    return result


