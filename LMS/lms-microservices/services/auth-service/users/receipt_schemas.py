import uuid
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class ReceiptCodeCreateSchema(BaseModel):
    code: str
    student_email: str
    student_name: str
    course_id: uuid.UUID
    test_score: Optional[int] = None
    deposit_amount: int = 3000
    bag_taken: bool = True
    bag_fee: int = 800
    bag_paid: bool = False
    bag_waived: bool = False
    id_card_taken: bool = True
    id_card_fee: int = 200
    id_card_paid: bool = False
    id_card_waived: bool = False
    certificate_taken: bool = True
    certificate_fee: int = 200
    certificate_paid: bool = False
    certificate_waived: bool = False
    is_waived: bool = False
    remarks: Optional[str] = None

class ReceiptCodeSchema(BaseModel):
    model_config = {"from_attributes": True}
    id: uuid.UUID
    code: str
    student_email: str
    student_name: str
    course_id: Optional[uuid.UUID] = None
    test_score: Optional[int] = None
    generated_at: datetime
    added_by_admin: Optional[uuid.UUID] = None
    added_to_system_at: Optional[datetime] = None
    verified: bool
    verified_at: Optional[datetime] = None
    lms_account_created: bool
    lms_user_id: Optional[uuid.UUID] = None
    deposit_amount: int
    bag_taken: bool
    bag_fee: int
    bag_paid: bool = False
    bag_waived: bool = False
    id_card_taken: bool
    id_card_fee: int
    id_card_paid: bool = False
    id_card_waived: bool = False
    certificate_taken: bool
    certificate_fee: int
    certificate_paid: bool = False
    certificate_waived: bool = False
    is_waived: bool = False
    receipt_number: Optional[str] = None
    is_returned: bool
    amount_returned: int
    returned_at: Optional[datetime] = None
    remarks: Optional[str] = None

class ReceiptCodeProcessReturnSchema(BaseModel):
    remarks: Optional[str] = None

class ReceiptCodeTransferSchema(BaseModel):
    new_course_id: uuid.UUID
    new_scheduled_class_id: Optional[uuid.UUID] = None
    old_scheduled_class_id: Optional[uuid.UUID] = None
    reason: Optional[str] = None

class ReceiptCodeVerifySchema(BaseModel):
    receipt_code: str
    email: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    cnic: Optional[str] = None
    password: Optional[str] = None
    date_of_birth: Optional[str] = None
    
    # New Registration Fields
    gender: Optional[str] = None
    whatsapp_number: Optional[str] = None
    father_guardian_name: Optional[str] = None
    guardian_contact: Optional[str] = None
    relationship_to_student: Optional[str] = None
    last_qualification: Optional[str] = None
    full_address: Optional[str] = None
    study_work_status: Optional[str] = None
    study_work_details: Optional[str] = None
    studied_at_idara: Optional[bool] = False
    studying_at_idara: Optional[bool] = False
    signature: Optional[str] = None
    is_terms_agreed: Optional[bool] = False
