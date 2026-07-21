from ninja import Schema
from uuid import UUID
from typing import Optional


class EnrollmentCheckSchema(Schema):
    enrolled: bool
    status: Optional[str] = None
    enrollment_id: Optional[str] = None
    scheduled_class_id: Optional[str] = None
    roll_number: Optional[str] = None
