from ninja import Schema, ModelSchema
from uuid import UUID
from datetime import datetime
from typing import List, Optional

class ContentItemOut(Schema):
    id: UUID
    title: str
    content_type: str
    file_url: Optional[str] = None
    url: Optional[str] = None
    is_preview: bool
    order: int
    created_at: datetime

    @staticmethod
    def resolve_file_url(obj):
        if obj.file:
            return obj.file.url
        return None

class LessonOut(Schema):
    id: UUID
    title: str
    description: Optional[str] = None
    order: int
    duration_minutes: int
    contents: List[ContentItemOut]
    is_completed: bool = False # Populated via progress check

class ModuleOut(Schema):
    id: UUID
    title: str
    description: Optional[str] = None
    order: int
    lessons: List[LessonOut]

class ProgressUpdate(Schema):
    lesson_id: UUID
    is_completed: bool

class ModuleCreate(Schema):
    course_id: UUID
    title: str
    description: Optional[str] = None
    order: int = 0

class LessonCreate(Schema):
    module_id: UUID
    title: str
    description: Optional[str] = None
    order: int = 0
    duration_minutes: int = 0
