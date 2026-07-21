from typing import List, Optional
from ninja import Router, File, Form
from ninja.files import UploadedFile
from ninja.security import HttpBearer
from django.shortcuts import get_object_or_404
from .models import Module, Lesson, ContentItem, UserContentProgress
from .schemas import ModuleOut, LessonOut, ModuleCreate, LessonCreate, ProgressUpdate
from uuid import UUID
import os
import jwt
from shared.common.enrollment_check import check_enrollment, is_preview_content

class JWTAuth(HttpBearer):
    def authenticate(self, request, token):
        try:
            secret = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
            payload = jwt.decode(token, secret, algorithms=['HS256'])
            request.user_id = payload.get('user_id')
            request.user_role = payload.get('role', 'STUDENT')
            return payload
        except Exception:
            return None

jwt_auth = JWTAuth()
router = Router()
from .schemas import ContentItemOut

@router.get("/", response=List[ContentItemOut], auth=None)
def list_content_items(request, course_id: Optional[UUID] = None, lesson_id: Optional[UUID] = None):
    """
    Legacy support for listing content items directly.
    If course_id is provided, filters across all modules/lessons of that course.
    Non-preview content requires enrollment.
    """
    queryset = ContentItem.objects.all()

    # Multi-Tenancy: Filter by organization_id
    org_id = request.headers.get('X-Org-Id')
    if org_id:
        queryset = queryset.filter(organization_id=org_id)

    if lesson_id:
        queryset = queryset.filter(lesson_id=lesson_id)
    elif course_id:
        queryset = queryset.filter(lesson__module__course_id=course_id)

    # Content Access Control: Filter out non-preview content for non-enrolled users
    user_role = getattr(request, 'user_role', 'STUDENT') or 'STUDENT'
    uid = getattr(request, 'user_id', None)
    if uid and user_role.upper() not in ("ADMIN", "COORDINATOR", "ACCOUNT_OFFICER", "LEAD") and course_id:
        is_enrolled, _ = check_enrollment(uid, str(course_id), user_role)
        if not is_enrolled:
            queryset = queryset.filter(is_preview=True)

    return list(queryset)

@router.post("/", response={201: ContentItemOut}, auth=jwt_auth)
def create_content_legacy(request, 
                          course_id: str = Form(...), 
                          title: str = Form(...), 
                          content_type: str = Form(...),
                          description: Optional[str] = Form(None),
                          scheduled_class_id: Optional[str] = Form(None),
                          url: Optional[str] = Form(None),
                          file: Optional[UploadedFile] = File(None)):
    """
    Legacy support for adding content directly to a course.
    Automatically creates a 'General Materials' module/lesson if not exists.
    """
    try:
        c_id = UUID(course_id)
    except:
        return 400, {"message": "Invalid course_id format"}
        
    # 1. Ensure Module exists
    module, _ = Module.objects.get_or_create(
        course_id=c_id,
        title="General Materials",
        defaults={'order': 999}
    )
    
    # 2. Ensure Lesson exists
    lesson, _ = Lesson.objects.get_or_create(
        module=module,
        title="Course Resources",
        defaults={'order': 0}
    )
    
    # 3. Create Content Item
    content = ContentItem.objects.create(
        lesson=lesson,
        title=title,
        content_type=content_type,
        url=url,
        file=file,
        order=ContentItem.objects.filter(lesson=lesson).count() + 1
    )
    
    return 201, content

# --- Public/Student Endpoints ---

@router.get("/{course_id}/curriculum/", response=List[ModuleOut], auth=None)
def get_course_curriculum(request, course_id: UUID, user_id: Optional[UUID] = None):
    """
    Returns the full curriculum (Modules -> Lessons -> Content) for a course.
    If user_id is provided, includes completion status.
    Enrollment check: non-admin users must be enrolled to view non-preview content.
    """
    modules = Module.objects.filter(course_id=course_id, is_published=True)
    
    # Multi-Tenancy: Filter by organization_id
    org_id = request.headers.get('X-Org-Id')
    if org_id:
        modules = modules.filter(organization_id=org_id)
    
    # Content Access Control: Check enrollment for non-admin users
    user_role = getattr(request, 'user_role', 'STUDENT') or 'STUDENT'
    uid = str(user_id) if user_id else getattr(request, 'user_id', None)
    is_enrolled = True
    if uid and user_role.upper() not in ("ADMIN", "COORDINATOR", "ACCOUNT_OFFICER", "LEAD"):
        is_enrolled, _ = check_enrollment(uid, str(course_id), user_role)
    
    response_data = []
    for module in modules:
        module_data = {
            "id": module.id,
            "title": module.title,
            "description": module.description,
            "order": module.order,
            "lessons": []
        }
        for lesson in module.lessons.filter(is_published=True):
            # Check progress if user_id is present
            is_completed = False
            if user_id:
                is_completed = UserContentProgress.objects.filter(
                    user_id=user_id, lesson=lesson, is_completed=True
                ).exists()
                
            lesson_data = {
                "id": lesson.id,
                "title": lesson.title,
                "description": lesson.description,
                "order": lesson.order,
                "duration_minutes": lesson.duration_minutes,
                "is_completed": is_completed,
                "contents": lesson.contents.all()
            }
            
            # If not enrolled, only show preview content
            if not is_enrolled:
                lesson_data["contents"] = [
                    c for c in lesson_data["contents"] if is_preview_content(c)
                ]
            
            module_data["lessons"].append(lesson_data)
        response_data.append(module_data)
        
    return response_data

@router.post("/progress/", response={200: str}, auth=jwt_auth)
def update_progress(request, data: ProgressUpdate):
    """Marks a lesson as completed for the authenticated user."""
    lesson = get_object_or_404(Lesson, id=data.lesson_id)
    progress, created = UserContentProgress.objects.get_or_create(
        user_id=request.user_id,
        lesson=lesson
    )
    progress.is_completed = data.is_completed
    if data.is_completed:
        from django.utils import timezone
        progress.completion_date = timezone.now()
    progress.save()
    return 200, "Progress updated"

# --- Admin/Teacher Endpoints ---

@router.post("/modules/", response=ModuleOut, auth=jwt_auth)
def create_module(request, data: ModuleCreate):
    if request.user_role not in ['ADMIN', 'TEACHER']:
        return 403, {"message": "Forbidden"}
    
    # Multi-Tenancy: Set organization_id from request headers
    org_id = request.headers.get('X-Org-Id')
    module_data = data.dict()
    if org_id:
        module_data['organization_id'] = org_id
    
    return Module.objects.create(**module_data)

@router.post("/lessons/", response=LessonOut, auth=jwt_auth)
def create_lesson(request, data: LessonCreate):
    if request.user_role not in ['ADMIN', 'TEACHER']:
        return 403, {"message": "Forbidden"}
    module = get_object_or_404(Module, id=data.module_id)
    lesson_data = data.dict()
    lesson_data.pop('module_id')
    
    # Multi-Tenancy: Inherit organization_id from module
    if module.organization_id:
        lesson_data['organization_id'] = module.organization_id
    
    return Lesson.objects.create(module=module, **lesson_data)

@router.post("/items/", response={201: ContentItemOut}, auth=jwt_auth)
def create_content_item(request, 
                        lesson_id: str = Form(...), 
                        title: str = Form(...), 
                        content_type: str = Form(...),
                        url: Optional[str] = Form(None),
                        file: Optional[UploadedFile] = File(None)):
    if request.user_role not in ['ADMIN', 'TEACHER']:
        return 403, {"message": "Forbidden"}
    
    lesson = get_object_or_404(Lesson, id=lesson_id)
    
    # Multi-Tenancy: Inherit organization_id from lesson
    org_id = lesson.organization_id
    
    content = ContentItem.objects.create(
        lesson=lesson,
        title=title,
        content_type=content_type,
        url=url,
        file=file,
        order=ContentItem.objects.filter(lesson=lesson).count() + 1,
        organization_id=org_id
    )
    return 201, content

@router.delete("/items/{item_id}/", response={204: None}, auth=jwt_auth)
def delete_content_item(request, item_id: UUID):
    if request.user_role not in ['ADMIN', 'TEACHER']:
        return 403, {"message": "Forbidden"}
    item = get_object_or_404(ContentItem, id=item_id)
    item.delete()
    return 204, None

@router.delete("/lessons/{lesson_id}/", response={204: None}, auth=jwt_auth)
def delete_lesson(request, lesson_id: UUID):
    if request.user_role not in ['ADMIN', 'TEACHER']:
        return 403, {"message": "Forbidden"}
    lesson = get_object_or_404(Lesson, id=lesson_id)
    lesson.delete()
    return 204, None

# -----------------------------------------------------------
# ACTIVITY LOG ENDPOINTS
# -----------------------------------------------------------

@router.post("/activity/log/", auth=jwt_auth)
def log_activity(request, data: dict):
    """Log a user activity event for analytics and progress tracking."""
    from .models import ActivityLog
    
    user_id = getattr(request, 'user_id', None)
    user_role = getattr(request, 'user_role', '')
    
    if not user_id:
        return 401, {"message": "Authentication required"}
    
    activity = ActivityLog.objects.create(
        organization_id=request.headers.get('X-Org-Id'),
        user_id=user_id,
        user_role=user_role,
        action=data.get('action', 'view'),
        entity_type=data.get('entity_type', 'lesson'),
        entity_id=data.get('entity_id'),
        course_id=data.get('course_id'),
        metadata=data.get('metadata', {}),
        ip_address=request.client.host if request.client else None,
    )
    
    return 201, {"id": str(activity.id), "message": "Activity logged"}


@router.get("/activity/log/my/", auth=jwt_auth)
def get_my_activity(request, course_id: Optional[str] = None, limit: int = 50):
    """Get the authenticated user's activity log."""
    from .models import ActivityLog
    from django.utils import timezone
    from datetime import timedelta
    
    user_id = getattr(request, 'user_id', None)
    if not user_id:
        return 401, {"message": "Authentication required"}
    
    queryset = ActivityLog.objects.filter(user_id=user_id)
    
    if course_id:
        queryset = queryset.filter(course_id=course_id)
    
    # Last 30 days by default
    thirty_days_ago = timezone.now() - timedelta(days=30)
    queryset = queryset.filter(created_at__gte=thirty_days_ago)
    
    activities = queryset[:limit]
    
    return [
        {
            "id": str(a.id),
            "action": a.action,
            "entity_type": a.entity_type,
            "entity_id": str(a.entity_id),
            "course_id": str(a.course_id) if a.course_id else None,
            "metadata": a.metadata,
            "created_at": a.created_at.isoformat(),
        }
        for a in activities
    ]


@router.get("/activity/stats/{course_id}/", auth=jwt_auth)
def get_course_activity_stats(request, course_id: UUID):
    """Get activity statistics for a course (admin/coordinator/teacher only)."""
    from .models import ActivityLog
    from django.db.models import Count, Q
    from django.utils import timezone
    from datetime import timedelta
    
    user_role = getattr(request, 'user_role', 'STUDENT').upper()
    if user_role not in ('ADMIN', 'COORDINATOR', 'TEACHER', 'LEAD'):
        return 403, {"message": "Permission denied"}
    
    thirty_days_ago = timezone.now() - timedelta(days=30)
    
    activities = ActivityLog.objects.filter(
        course_id=course_id,
        created_at__gte=thirty_days_ago
    )
    
    total_views = activities.filter(action='view').count()
    total_completions = activities.filter(action='complete').count()
    unique_viewers = activities.filter(action='view').values('user_id').distinct().count()
    
    # Most viewed content
    popular_content = (
        activities.filter(action='view', entity_type='content_item')
        .values('entity_id')
        .annotate(view_count=Count('id'))
        .order_by('-view_count')[:10]
    )
    
    return {
        "course_id": str(course_id),
        "period": "last_30_days",
        "total_views": total_views,
        "total_completions": total_completions,
        "unique_viewers": unique_viewers,
        "popular_content": list(popular_content),
    }
