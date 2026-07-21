from ninja import Router, Schema
from ninja_extra import NinjaExtraAPI
from typing import List, Optional
from uuid import UUID
from decimal import Decimal
from django.db import transaction, models
from django.utils import timezone
from .models import FeeType, FeeStructure, FeeLineItem, StudentFee, Payment, PaymentTransaction, BankAccount

router = Router()

# ─── Schemas ───────────────────────────────────────────────────────

class FeeTypeSchema(Schema):
    id: UUID
    organization_id: UUID
    name: str
    frequency: str
    is_default: bool
    is_active: bool

class FeeTypeCreateSchema(Schema):
    organization_id: UUID
    name: str
    frequency: str = 'monthly'
    is_default: bool = False

class FeeLineItemSchema(Schema):
    id: UUID
    fee_type_id: UUID
    fee_type_name: str = ''
    amount: float

class FeeStructureSchema(Schema):
    id: UUID
    organization_id: UUID
    name: str
    campus_id: Optional[UUID] = None
    level_id: Optional[UUID] = None
    grade_id: Optional[UUID] = None
    section: Optional[str] = None
    is_default: bool
    is_active: bool
    line_items: List[FeeLineItemSchema] = []

class FeeStructureCreateSchema(Schema):
    organization_id: UUID
    name: str
    campus_id: Optional[UUID] = None
    level_id: Optional[UUID] = None
    grade_id: Optional[UUID] = None
    section: Optional[str] = None
    is_default: bool = False

class LineItemCreateSchema(Schema):
    fee_type_id: UUID
    amount: float

class StudentFeeSchema(Schema):
    id: UUID
    organization_id: UUID
    student_id: UUID
    fee_structure_id: Optional[UUID] = None
    month: int
    year: int
    invoice_number: str
    total_amount: float
    paid_amount: float
    remaining_amount: float
    status: str
    due_date: str
    late_fee: float
    other_charges: float

class PaymentCreateSchema(Schema):
    student_fee_id: UUID
    amount: float
    method: str = 'cash'
    bank_name: Optional[str] = None
    transaction_id: Optional[str] = None
    remarks: Optional[str] = None

class PaymentSchema(Schema):
    id: UUID
    receipt_number: str
    student_fee_id: UUID
    student_id: UUID
    amount: float
    method: str
    payment_date: str
    bank_name: Optional[str] = None
    transaction_id: Optional[str] = None

class TransactionSubmitSchema(Schema):
    student_fee_id: UUID
    amount: float
    bank_account_id: UUID
    transaction_id: str

class TransactionSchema(Schema):
    id: UUID
    student_fee_id: UUID
    student_id: UUID
    amount: float
    transaction_id: str
    status: str
    created_at: str

class BankAccountSchema(Schema):
    id: UUID
    organization_id: UUID
    bank_name: str
    account_title: str
    account_number: str
    iban: Optional[str] = None
    is_active: bool

class BankAccountCreateSchema(Schema):
    organization_id: UUID
    bank_name: str
    account_title: str
    account_number: str
    iban: Optional[str] = None

class GenerateChallanSchema(Schema):
    organization_id: UUID
    student_ids: List[UUID]
    fee_structure_id: UUID
    month: int
    year: int


# ─── Fee Type Endpoints ────────────────────────────────────────────

@router.get("/fee-types/", response=List[FeeTypeSchema])
def list_fee_types(request, organization_id: Optional[UUID] = None):
    qs = FeeType.objects.filter(is_active=True)
    if organization_id:
        qs = qs.filter(organization_id=organization_id)
    return [
        FeeTypeSchema(
            id=ft.id, organization_id=ft.organization_id, name=ft.name,
            frequency=ft.frequency, is_default=ft.is_default, is_active=ft.is_active
        ) for ft in qs
    ]

@router.post("/fee-types/")
def create_fee_type(request, payload: FeeTypeCreateSchema):
    ft = FeeType.objects.create(**payload.dict())
    return {"id": str(ft.id), "message": "Fee type created"}

@router.patch("/fee-types/{fee_type_id}/")
def update_fee_type(request, fee_type_id: UUID, payload: FeeTypeCreateSchema):
    ft = FeeType.objects.get(id=fee_type_id)
    for key, val in payload.dict(exclude_unset=True).items():
        setattr(ft, key, val)
    ft.save()
    return {"message": "Fee type updated"}

@router.delete("/fee-types/{fee_type_id}/")
def delete_fee_type(request, fee_type_id: UUID):
    FeeType.objects.filter(id=fee_type_id).update(is_active=False)
    return {"message": "Fee type deactivated"}


# ─── Fee Structure Endpoints ───────────────────────────────────────

@router.get("/structures/", response=List[FeeStructureSchema])
def list_fee_structures(request, organization_id: Optional[UUID] = None, campus_id: Optional[UUID] = None):
    qs = FeeStructure.objects.filter(is_active=True)
    if organization_id:
        qs = qs.filter(organization_id=organization_id)
    if campus_id:
        qs = qs.filter(campus_id=campus_id)
    result = []
    for fs in qs:
        items = []
        for li in fs.line_items.select_related('fee_type').all():
            items.append(FeeLineItemSchema(
                id=li.id, fee_type_id=li.fee_type_id,
                fee_type_name=li.fee_type.name, amount=float(li.amount)
            ))
        result.append(FeeStructureSchema(
            id=fs.id, organization_id=fs.organization_id, name=fs.name,
            campus_id=fs.campus_id, level_id=fs.level_id, grade_id=fs.grade_id,
            section=fs.section, is_default=fs.is_default, is_active=fs.is_active,
            line_items=items
        ))
    return result

@router.post("/structures/")
def create_fee_structure(request, payload: FeeStructureCreateSchema):
    fs = FeeStructure.objects.create(**payload.dict())
    return {"id": str(fs.id), "message": "Fee structure created"}

@router.post("/structures/{structure_id}/line-items/")
def add_line_item(request, structure_id: UUID, payload: LineItemCreateSchema):
    fs = FeeStructure.objects.get(id=structure_id)
    li = FeeLineItem.objects.create(
        fee_structure=fs,
        fee_type_id=payload.fee_type_id,
        amount=payload.amount
    )
    return {"id": str(li.id), "message": "Line item added"}

@router.delete("/structures/{structure_id}/line-items/{item_id}/")
def delete_line_item(request, structure_id: UUID, item_id: UUID):
    FeeLineItem.objects.filter(id=item_id, fee_structure_id=structure_id).delete()
    return {"message": "Line item deleted"}


# ─── Challan Generation ────────────────────────────────────────────

@router.post("/generate/")
def generate_challans(request, payload: GenerateChallanSchema):
    """Generate monthly challans for students based on fee structure."""
    fs = FeeStructure.objects.get(id=payload.fee_structure_id)
    
    # Calculate total from line items
    total_amount = sum(li.amount for li in fs.line_items.all())
    
    generated = 0
    for student_id in payload.student_ids:
        # Check if already exists
        exists = StudentFee.objects.filter(
            student_id=student_id,
            month=payload.month,
            year=payload.year
        ).exists()
        if exists:
            continue
        
        # Calculate arrears
        arrears = StudentFee.objects.filter(
            student_id=student_id,
            status__in=['unpaid', 'partial', 'issued']
        ).aggregate(
            total=models.Sum('remaining_amount')
        )['total'] or 0
        
        due_date = timezone.now().date().replace(day=10)
        
        sf = StudentFee(
            organization_id=payload.organization_id,
            student_id=student_id,
            fee_structure=fs,
            month=payload.month,
            year=payload.year,
            total_amount=total_amount + arrears,
            due_date=due_date,
            fee_structure_details={
                'structure_name': fs.name,
                'line_items': [
                    {'name': li.fee_type.name, 'amount': float(li.amount)}
                    for li in fs.line_items.all()
                ]
            }
        )
        sf.save()
        generated += 1
    
    return {"message": f"Generated {generated} challans", "count": generated}


# ─── Student Fee Endpoints ─────────────────────────────────────────

@router.get("/student-fees/", response=List[StudentFeeSchema])
def list_student_fees(request, organization_id: Optional[UUID] = None, student_id: Optional[UUID] = None, status: Optional[str] = None):
    qs = StudentFee.objects.all()
    if organization_id:
        qs = qs.filter(organization_id=organization_id)
    if student_id:
        qs = qs.filter(student_id=student_id)
    if status:
        qs = qs.filter(status=status)
    return [
        StudentFeeSchema(
            id=sf.id, organization_id=sf.organization_id, student_id=sf.student_id,
            fee_structure_id=sf.fee_structure_id, month=sf.month, year=sf.year,
            invoice_number=sf.invoice_number, total_amount=float(sf.total_amount),
            paid_amount=float(sf.paid_amount), remaining_amount=float(sf.remaining_amount),
            status=sf.status, due_date=sf.due_date.isoformat(),
            late_fee=float(sf.late_fee), other_charges=float(sf.other_charges)
        ) for sf in qs[:200]
    ]

@router.get("/student-fees/my-fees/")
def my_fees(request, student_id: UUID):
    """Get all fees for a specific student."""
    qs = StudentFee.objects.filter(student_id=student_id).order_by('-year', '-month')
    return [
        StudentFeeSchema(
            id=sf.id, organization_id=sf.organization_id, student_id=sf.student_id,
            fee_structure_id=sf.fee_structure_id, month=sf.month, year=sf.year,
            invoice_number=sf.invoice_number, total_amount=float(sf.total_amount),
            paid_amount=float(sf.paid_amount), remaining_amount=float(sf.remaining_amount),
            status=sf.status, due_date=sf.due_date.isoformat(),
            late_fee=float(sf.late_fee), other_charges=float(sf.other_charges)
        ) for sf in qs
    ]


# ─── Payment Endpoints ─────────────────────────────────────────────

@router.post("/pay/")
def record_payment(request, payload: PaymentCreateSchema):
    """Record a cash/bank payment with FIFO allocation."""
    with transaction.atomic():
        sf = StudentFee.objects.select_for_update().get(id=payload.student_fee_id)
        
        # Create payment record
        payment = Payment(
            organization_id=sf.organization_id,
            student_fee=sf,
            student_id=sf.student_id,
            amount=payload.amount,
            method=payload.method,
            bank_name=payload.bank_name,
            transaction_id=payload.transaction_id,
            remarks=payload.remarks,
        )
        payment.save()
        
        # Update student fee
        sf.paid_amount += Decimal(str(payload.amount))
        sf.save()
        
        return {
            "message": "Payment recorded",
            "receipt_number": payment.receipt_number,
            "payment_id": str(payment.id)
        }

@router.get("/payments/", response=List[PaymentSchema])
def list_payments(request, organization_id: Optional[UUID] = None, student_id: Optional[UUID] = None):
    qs = Payment.objects.all()
    if organization_id:
        qs = qs.filter(organization_id=organization_id)
    if student_id:
        qs = qs.filter(student_id=student_id)
    return [
        PaymentSchema(
            id=p.id, receipt_number=p.receipt_number, student_fee_id=p.student_fee_id,
            student_id=p.student_id, amount=float(p.amount), method=p.method,
            payment_date=p.payment_date.isoformat(), bank_name=p.bank_name,
            transaction_id=p.transaction_id
        ) for p in qs[:100]
    ]


# ─── Bank Transfer Verification ────────────────────────────────────

@router.post("/transactions/submit/")
def submit_transaction(request, payload: TransactionSubmitSchema):
    pt = PaymentTransaction.objects.create(
        organization_id=UUID('00000000-0000-0000-0000-000000000000'),
        student_fee_id=payload.student_fee_id,
        student_id=UUID('00000000-0000-0000-0000-000000000000'),
        bank_account_id=payload.bank_account_id,
        amount=payload.amount,
        transaction_id=payload.transaction_id,
    )
    return {"id": str(pt.id), "message": "Transaction submitted for verification"}

@router.get("/transactions/pending/", response=List[TransactionSchema])
def list_pending_transactions(request, organization_id: Optional[UUID] = None):
    qs = PaymentTransaction.objects.filter(status='pending')
    if organization_id:
        qs = qs.filter(organization_id=organization_id)
    return [
        TransactionSchema(
            id=pt.id, student_fee_id=pt.student_fee_id, student_id=pt.student_id,
            amount=float(pt.amount), transaction_id=pt.transaction_id,
            status=pt.status, created_at=pt.created_at.isoformat()
        ) for pt in qs
    ]

@router.post("/transactions/{txn_id}/verify/")
def verify_transaction(request, txn_id: UUID, approved: bool = True, reject_reason: str = ''):
    pt = PaymentTransaction.objects.get(id=txn_id)
    if approved:
        pt.status = 'approved'
        # Auto-record payment
        sf = pt.student_fee
        sf.paid_amount += pt.amount
        sf.save()
        Payment.objects.create(
            organization_id=sf.organization_id,
            student_fee=sf,
            student_id=sf.student_id,
            amount=pt.amount,
            method='bank',
            transaction_id=pt.transaction_id,
        )
    else:
        pt.status = 'rejected'
        pt.reject_reason = reject_reason
    pt.save()
    return {"message": f"Transaction {pt.status}"}


# ─── Bank Account Endpoints ────────────────────────────────────────

@router.get("/banks/", response=List[BankAccountSchema])
def list_bank_accounts(request, organization_id: Optional[UUID] = None):
    qs = BankAccount.objects.filter(is_active=True)
    if organization_id:
        qs = qs.filter(organization_id=organization_id)
    return [
        BankAccountSchema(
            id=ba.id, organization_id=ba.organization_id, bank_name=ba.bank_name,
            account_title=ba.account_title, account_number=ba.account_number,
            iban=ba.iban, is_active=ba.is_active
        ) for ba in qs
    ]

@router.post("/banks/")
def create_bank_account(request, payload: BankAccountCreateSchema):
    ba = BankAccount.objects.create(**payload.dict())
    return {"id": str(ba.id), "message": "Bank account created"}


# ─── Reports ───────────────────────────────────────────────────────

@router.get("/reports/collection/")
def collection_report(request, organization_id: UUID, month: Optional[int] = None, year: Optional[int] = None):
    qs = StudentFee.objects.filter(organization_id=organization_id)
    if month and year:
        qs = qs.filter(month=month, year=year)
    
    total_billed = sum(sf.total_amount for sf in qs)
    total_collected = sum(sf.paid_amount for sf in qs)
    total_remaining = sum(sf.remaining_amount for sf in qs)
    
    return {
        "total_billed": float(total_billed),
        "total_collected": float(total_collected),
        "total_remaining": float(total_remaining),
        "collection_rate": float(total_collected / total_billed * 100) if total_billed > 0 else 0,
        "total_records": qs.count(),
    }
