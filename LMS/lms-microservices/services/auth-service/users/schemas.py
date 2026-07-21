from pydantic import BaseModel
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime

class SignupSchema(BaseModel):
    full_name: str
    cnic: str
    email: str
    phone: str
    password: str
    role: str
    course: Optional[UUID] = None
    lead_id: Optional[UUID] = None
    
    # 🔹 Student Profile Expansion
    father_name: Optional[str] = None
    address: Optional[str] = None
    whatsapp_number: Optional[str] = None
    level: Optional[str] = "Level 1"
    batch: Optional[str] = None
    gender: Optional[str] = None
    last_qualification: Optional[str] = None
    study_work_status: Optional[str] = None
    work_details: Optional[str] = None
    signature: Optional[str] = None
    studied_at_idara: Optional[bool] = False
    studying_at_idara: Optional[bool] = False
    guardian_name: Optional[str] = None
    guardian_contact: Optional[str] = None
    relationship: Optional[str] = None
    dob: Optional[str] = None

class CoordinatorUserSchema(BaseModel):
    first_name: Optional[str] = ""
    last_name: Optional[str] = ""
    full_name: Optional[str] = None
    email: str
    password: str
    role: str = "STUDENT"
    phone: Optional[str] = None
    cnic: Optional[str] = None
    whatsapp_number: Optional[str] = None
    father_name: Optional[str] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    must_change_password: bool = False
    is_staff: bool = False
    is_admin: bool = False
    
    # Financial/Deposit fields (if creating with deposit info)
    deposit_amount: Optional[int] = 3000
    bag_taken: Optional[bool] = True
    bag_fee: Optional[int] = 800
    id_card_taken: Optional[bool] = True
    id_card_fee: Optional[int] = 200
    certificate_fee: Optional[int] = 200
    branch_id: Optional[str] = None
    # 🔹 Multi-Tenancy
    organization_id: Optional[str] = None
    campus_id: Optional[str] = None
    test_score: Optional[int] = None
    has_paid_deposit: bool = False

class UserInfoSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    full_name: Optional[str] = ""
    email: str
    cnic: Optional[str] = ""
    phone: Optional[str] = ""
    role: str
    student_id: Optional[str] = ""
    profile_image: Optional[str] = ""
    # 🔹 Branch Assignment
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    branch_code: Optional[str] = None
    # 🔹 Multi-Tenancy
    organization_id: Optional[str] = None
    campus_id: Optional[str] = None
    # 🔹 Student Specific Details
    father_name: Optional[str] = ""
    address: Optional[str] = ""
    whatsapp_number: Optional[str] = ""
    gender: Optional[str] = ""
    test_score: Optional[int] = None
    has_paid_deposit: bool = False
    created_at: Optional[datetime] = None
    must_change_password: bool = False
    features_access: Optional[dict] = {}
    role_permissions: Optional[dict] = {}
    level: Optional[str] = ""
    batch: Optional[str] = ""
    specialization: Optional[str] = ""
    date_of_birth: Optional[str] = None


class SignupResponseSchema(BaseModel):
    user: UserInfoSchema
    token: str
    test_id: Optional[UUID] = None

class LoginSchema(BaseModel):
    email: str
    password: str

class TokenResponseSchema(BaseModel):
    user: UserInfoSchema
    access: str
    refresh: str
    token: Optional[str] = None
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None

class UserIdsSchema(BaseModel):
    ids: List[UUID]

class RoleListSchema(BaseModel):
    roles: List[str]

class PasswordResetRequestSchema(BaseModel):
    email: str

class PasswordResetConfirmSchema(BaseModel):
    token: str
    new_password: str

class ForcePasswordChangeSchema(BaseModel):
    email: str
    otp: str
    new_password: str

class UserUpdateSchema(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    gender: Optional[str] = None
    status: Optional[str] = None
    whatsapp_number: Optional[str] = None
    student_id: Optional[str] = None
    level: Optional[str] = None
    batch: Optional[str] = None
    specialization: Optional[str] = None
    course_code: Optional[str] = None
    study_work_status: Optional[str] = None
    study_work_details: Optional[str] = None
    studied_at_idara: Optional[bool] = None
    studying_at_idara: Optional[bool] = None
    signature: Optional[str] = None
    phone: Optional[str] = None
    cnic: Optional[str] = None
    father_name: Optional[str] = None
    address: Optional[str] = None
    guardian_name: Optional[str] = None
    guardian_contact: Optional[str] = None
    relationship: Optional[str] = None
    dob: Optional[str] = None
    branch_id: Optional[str] = None
    # 🔹 Multi-Tenancy
    organization_id: Optional[str] = None
    campus_id: Optional[str] = None

class PaginatedUserResponseSchema(BaseModel):
    items: List[UserInfoSchema]
    total: int
    page: int
    limit: int
    pages: int

class LeadLoginSchema(BaseModel):
    credential: Optional[str] = None
    email: Optional[str] = None
    password: str

class LeadCourseChangeSchema(BaseModel):
    course_id: UUID
    course_name: Optional[str] = None

class LeadProfileSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    full_name: str
    email: str
    phone: Optional[str] = ""
    cnic: Optional[str] = ""
    gender: Optional[str] = ""
    lead_auto_id: Optional[int] = None
    course_name_requested: Optional[str] = ""
    course_id: Optional[str] = None
    test_score: Optional[int] = None
    status: Optional[str] = "pending"
    has_paid_deposit: bool = False
    converted_to_student: bool = False
    lms_user_id: Optional[str] = None
    created_at: Optional[str] = None