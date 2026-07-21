"""
Pydantic schemas for User Service.
"""
from ninja import Schema
from typing import Optional
from datetime import datetime


class UserOut(Schema):
    """User output schema."""
    id: str
    employee_code: str
    email: Optional[str]
    first_name: str
    last_name: str
    role: str
    is_ceo: bool
    department_id: Optional[str]
    created_at: datetime


class UserIn(Schema):
    """User input schema."""
    employee_code: str
    email: Optional[str]
    first_name: str
    last_name: str
    password: str
    role: str = "requestor"
    department_id: Optional[str] = None


class LoginIn(Schema):
    """Login input schema."""
    employee_code: str
    password: str


class LoginOut(Schema):
    """Login output schema."""
    access: str
    refresh: str
    user: UserOut


class UserImportIn(Schema):
    """User import input schema."""
    file_data: str  # Base64 encoded CSV/Excel


