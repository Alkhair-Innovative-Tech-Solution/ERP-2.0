import re
from .models import Visitor


def format_cnic(cnic):
    """
    Format CNIC to XXXXX-XXXXXXX-X format.
    Accepts: 1234567890123, 12345-6789012-3, 123456789012-3
    Returns: 12345-6789012-3
    """
    if not cnic:
        return None
    # Remove all non-digit characters
    digits = re.sub(r'\D', '', cnic)
    if len(digits) == 13:
        return f"{digits[0:5]}-{digits[5:12]}-{digits[12]}"
    elif len(digits) == 12:
        # Assume last digit is missing
        return f"{digits[0:5]}-{digits[5:12]}-{digits[11]}"
    return cnic  # Return as-is if not standard length


def validate_cnic(cnic):
    """
    Validate CNIC format. Returns (is_valid, error_message).
    """
    if not cnic or not cnic.strip():
        return True, None  # CNIC is optional
    
    digits = re.sub(r'\D', '', cnic)
    if len(digits) not in (12, 13):
        return False, "CNIC must be 12 or 13 digits"
    
    return True, None


def validate_phone_pakistan(phone):
    """
    Validate Pakistan phone number format.
    Accepts: 0300-1234567, +923001234567, 923001234567, 03001234567
    Returns cleaned format with +92 prefix.
    """
    if not phone or not phone.strip():
        return True, None, None  # Phone is optional
    
    cleaned = re.sub(r'[\s\-\(\)]', '', phone)
    
    if cleaned.startswith('+92'):
        digits = cleaned[1:]  # Remove +
        if len(digits) != 12:
            return False, "Invalid phone number length", None
        return True, None, f"+{digits}"
    elif cleaned.startswith('92'):
        if len(cleaned) != 12:
            return False, "Invalid phone number length", None
        return True, None, f"+{cleaned}"
    elif cleaned.startswith('0'):
        if len(cleaned) != 11:
            return False, "Invalid phone number length", None
        # Convert 0300... to +92300...
        return True, None, f"+92{cleaned[1:]}"
    else:
        return False, "Phone must start with 0, +92, or 92", None


def find_existing_visitor(cnic=None, phone=None, email=None):
    """
    Returns (visitor, match_field) or (None, None).
    Priority: CNIC > phone > email
    Case-insensitive matching.
    """
    if cnic and cnic.strip():
        formatted = format_cnic(cnic)
        match = Visitor.objects.filter(cnic__iexact=formatted or cnic.strip()).first()
        if match:
            return match, 'cnic'
    if phone and phone.strip():
        _, _, cleaned_phone = validate_phone_pakistan(phone)
        if cleaned_phone:
            match = Visitor.objects.filter(phone=cleaned_phone).first()
            if match:
                return match, 'phone'
        else:
            match = Visitor.objects.filter(phone__iexact=phone.strip()).first()
            if match:
                return match, 'phone'
    if email and email.strip():
        match = Visitor.objects.filter(email__iexact=email.strip().lower()).first()
        if match:
            return match, 'email'
    return None, None


def check_duplicate_combo(cnic=None, phone=None, email=None, exclude_visitor_id=None):
    """
    Check for duplicate visitor using combination of CNIC, phone, and email.
    Returns list of matching visitors.
    """
    from django.db.models import Q
    
    if not any([cnic, phone, email]):
        return []
    
    query = Q()
    
    if cnic and cnic.strip():
        formatted = format_cnic(cnic)
        query |= Q(cnic__iexact=formatted or cnic.strip())
    
    if phone and phone.strip():
        _, _, cleaned_phone = validate_phone_pakistan(phone)
        if cleaned_phone:
            query |= Q(phone=cleaned_phone)
        else:
            query |= Q(phone__iexact=phone.strip())
    
    if email and email.strip():
        query |= Q(email__iexact=email.strip().lower())
    
    visitors = Visitor.objects.filter(query)
    
    if exclude_visitor_id:
        visitors = visitors.exclude(id=exclude_visitor_id)
    
    return visitors


def get_or_create_visitor(full_name, cnic=None, phone=None, email=None, company=None, tenant_id=None):
    """
    Find existing visitor or create new one.
    Returns (visitor, is_returning)
    All inputs are case-insensitive.

    Lookup (find_existing_visitor) is intentionally NOT tenant-scoped: `cnic`
    is globally unique on Visitor, so there is only ever one row per CNIC
    regardless of tenant — a repeat visitor is recognized across tenants by
    design. `tenant_id` is only stamped on newly-created rows. See
    AUTH_INTEGRATION.md "Tenant filtering — Visitor identity" for the caveat
    this implies once a second tenant exists.
    """
    # Format and validate inputs
    formatted_cnic = format_cnic(cnic) if cnic else None
    _, _, cleaned_phone = validate_phone_pakistan(phone) if phone else (True, None, None)
    cleaned_email = email.strip().lower() if email else None
    cleaned_name = full_name.strip()
    cleaned_company = company.strip() if company else None
    
    existing, _ = find_existing_visitor(cnic=formatted_cnic, phone=cleaned_phone, email=cleaned_email)
    if existing:
        # Update any missing fields
        updated = False
        if formatted_cnic and not existing.cnic:
            existing.cnic = formatted_cnic
            updated = True
        if cleaned_phone and not existing.phone:
            existing.phone = cleaned_phone
            updated = True
        if cleaned_email and not existing.email:
            existing.email = cleaned_email
            updated = True
        if updated:
            existing.save()
        return existing, True

    visitor = Visitor.objects.create(
        full_name=cleaned_name,
        cnic=formatted_cnic or None,
        phone=cleaned_phone or None,
        email=cleaned_email,
        company=cleaned_company,
        tenant_id=tenant_id,
    )
    return visitor, False
