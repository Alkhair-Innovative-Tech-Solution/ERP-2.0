import json
from datetime import timedelta
from django.utils import timezone
from django.db.models import Count, Q
from django.contrib.auth import authenticate
from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken as SimpleJWTRefreshToken
from rest_framework_simplejwt.views import TokenRefreshView

from .models import Visitor, Host, Visit, Employee
from .serializers import (
    VisitorSerializer, HostSerializer, EmployeeSerializer, VisitListSerializer,
    VisitDetailSerializer, ReceptionistEntrySerializer,
    QRCheckinSerializer, ScheduledEntrySerializer, ScheduleVisitSerializer
)
from .utils import get_or_create_visitor, find_existing_visitor, check_duplicate_combo, format_cnic
from .email_utils import send_host_notification, send_overnight_notification, check_overnight_stays
from . import auth_service_client as auth_client
from .auth_service_client import AuthServiceUnavailable


# ── Auth Views ────────────────────────────────────────────────────────────────

class VmsLoginView(APIView):
    """
    POST /api/auth/login/

    Proxies login to auth-service. If auth-service is unreachable, falls back
    to local Django credentials and returns a warning in the response so the
    frontend can notify the user.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        employee_code = request.data.get('employee_code') or request.data.get('username', '')
        password = request.data.get('password', '')

        if not employee_code or not password:
            return Response({'error': 'employee_code and password are required.'}, status=400)

        # 1. Try auth-service first
        try:
            data = auth_client.login_vms(employee_code, password)
            return Response({**data, 'auth_source': 'auth_service'})
        except AuthServiceUnavailable:
            pass  # fall through to local fallback
        except PermissionError as e:
            return Response({'error': str(e)}, status=403)
        except ValueError as e:
            return Response({'error': str(e)}, status=401)

        # 2. Local Django fallback (auth-service was unreachable)
        user = authenticate(request, username=employee_code, password=password)
        if user is None:
            return Response(
                {
                    'error': 'Auth Service is currently unavailable and local credentials are invalid.',
                    'auth_source': 'local_fallback',
                },
                status=401,
            )

        refresh = SimpleJWTRefreshToken.for_user(user)
        return Response({
            'access_token': str(refresh.access_token),
            'refresh_token': str(refresh),
            'expires_in': 3600,
            'user': {
                'id': str(user.id),
                'name': user.get_full_name() or user.username,
                'email': user.email,
                'vms_role': _get_local_role(user),
            },
            'auth_source': 'local_fallback',
            'warning': 'Auth Service is currently unavailable. You are logged in with local credentials.',
        })


def _get_local_role(user) -> str:
    groups = set(user.groups.values_list('name', flat=True))
    if 'admin' in groups or user.is_staff:
        return 'admin'
    if 'receptionist' in groups:
        return 'receptionist'
    return 'security_staff'


class VmsTokenRefreshView(TokenRefreshView):
    """Passes refresh through; local Simple JWT tokens only (auth-service tokens auto-expire)."""
    pass


def notify_receptionist(visit):
    channel_layer = get_channel_layer()
    try:
        async_to_sync(channel_layer.group_send)('receptionist_dashboard', {
            'type': 'visit_notification',
            'visit': VisitListSerializer(visit).data,
        })
    except Exception:
        pass


def notify_visit_update(visit_id, new_status):
    channel_layer = get_channel_layer()
    try:
        async_to_sync(channel_layer.group_send)('receptionist_dashboard', {
            'type': 'visit_update',
            'visit_id': str(visit_id),
            'status': new_status,
        })
    except Exception:
        pass


def check_already_checked_in(visitor):
    """
    Issue #1: Block re-check-in if visitor has an active (checked_in or pending_approval) visit.
    Returns the active visit or None.
    """
    active = Visit.objects.filter(
        visitor=visitor,
        status__in=[Visit.Status.CHECKED_IN, Visit.Status.PENDING_APPROVAL]
    ).order_by('-created_at').first()
    return active


# ── QR Check-in ───────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def qr_checkin(request):
    """Visitor self check-in via QR. Strict identity validation."""
    serializer = QRCheckinSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    d = serializer.validated_data
    from .utils import validate_phone_pakistan

    # Normalize inputs
    fmt_cnic = format_cnic(d.get('cnic')) if d.get('cnic') else None
    _, _, clean_phone = validate_phone_pakistan(d.get('phone')) if d.get('phone') else (True, None, None)
    clean_email = d.get('email', '').strip().lower() or None

    # ── STRICT COMBO CHECK ──────────────────────────────────────────────────
    from django.db.models import Q as DQ
    id_query = DQ()
    if fmt_cnic:
        id_query |= DQ(cnic=fmt_cnic)
    if clean_phone:
        id_query |= DQ(phone=clean_phone)
    if clean_email:
        id_query |= DQ(email__iexact=clean_email)

    if id_query:
        matches = list(Visitor.objects.filter(id_query).distinct())
        if len(matches) > 1:
            return Response({
                'error': 'Multiple records found matching your details. Please contact the receptionist.',
                'identity_conflict': True,
            }, status=409)
        elif len(matches) == 1:
            existing_v = matches[0]
            conflicts = []
            if fmt_cnic and existing_v.cnic and existing_v.cnic != fmt_cnic:
                conflicts.append("CNIC")
            if clean_phone and existing_v.phone and existing_v.phone != clean_phone:
                conflicts.append("phone number")
            if clean_email and existing_v.email and existing_v.email.lower() != clean_email:
                conflicts.append("email")

            if conflicts:
                return Response({
                    'error': f'Your {" and ".join(conflicts)} does not match our records for this visitor. Please contact the receptionist.',
                    'identity_conflict': True,
                }, status=409)

            if existing_v.is_blacklisted:
                return Response({
                    'error': 'Entry denied. Please contact the receptionist.',
                    'blacklisted': True,
                }, status=403)

            # ── Issue #1: Block if already checked in or pending ──
            active_visit = check_already_checked_in(existing_v)
            if active_visit:
                status_msg = "pending approval" if active_visit.status == Visit.Status.PENDING_APPROVAL else "checked in"
                return Response({
                    'error': f'You already have an active visit ({status_msg}). Please check out before checking in again.',
                    'already_checked_in': True,
                    'active_visit_id': str(active_visit.id),
                    'active_status': active_visit.status,
                }, status=409)

    visitor, is_returning = get_or_create_visitor(
        full_name=d['full_name'],
        cnic=d.get('cnic'),
        phone=d.get('phone'),
        email=d.get('email'),
        company=d.get('company'),
    )

    # After creating/getting visitor, also check by visitor object
    active_visit = check_already_checked_in(visitor)
    if active_visit:
        status_msg = "pending approval" if active_visit.status == Visit.Status.PENDING_APPROVAL else "checked in"
        return Response({
            'error': f'You already have an active visit ({status_msg}). Please check out before checking in again.',
            'already_checked_in': True,
            'active_visit_id': str(active_visit.id),
            'active_status': active_visit.status,
        }, status=409)

    # Host resolution
    host = None
    employee_host = None
    is_internal = d.get('purpose') == 'internal'
    host_is_other = d.get('host_is_other', False) and not is_internal

    if not host_is_other and not is_internal and d.get('host_id'):
        host = Host.objects.filter(id=d['host_id']).first()

    visit = Visit.objects.create(
        visitor=visitor,
        host=host,
        employee_host=employee_host,
        host_name_manual='__OTHER__' if host_is_other else (d.get('host_name') if not host else None),
        purpose=d.get('purpose'),
        purpose_other=d.get('purpose_other'),
        interview_position=d.get('interview_position'),
        contractor_company=d.get('contractor_company'),
        contractor_designation=d.get('contractor_designation'),
        contractor_address=d.get('contractor_address'),
        delivery_company=d.get('delivery_company'),
        official_department=d.get('official_department'),
        official_rank=d.get('official_rank'),
        vip_category=d.get('vip_category'),
        internal_department=d.get('internal_department'),
        status=Visit.Status.PENDING_APPROVAL,
        entry_type=Visit.EntryType.QR_SELF,
        is_returning=is_returning,
    )

    notify_receptionist(visit)

    return Response({
        'visit_id': str(visit.id),
        'is_returning': is_returning,
        'status': 'pending_approval',
        'host_is_other': host_is_other,
        'message': 'Form submitted. Please wait for receptionist approval.',
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def visit_status(request, visit_id):
    try:
        visit = Visit.objects.select_related('visitor', 'host', 'employee_host').get(id=visit_id)
    except Visit.DoesNotExist:
        return Response({'error': 'Visit not found.'}, status=404)

    host_name = (
        visit.employee_host.name if visit.employee_host else
        visit.host.name if visit.host else
        visit.host_name_manual or None
    )

    return Response({
        'visit_id': str(visit.id),
        'visiting_id': visit.visiting_id or '',
        'status': visit.status,
        'card_expired': visit.card_expired,
        'visitor_name': visit.visitor.full_name if visit.visitor else '',
        'visitor_cnic': visit.visitor.cnic if visit.visitor else '',
        'visitor_phone': visit.visitor.phone if visit.visitor else '',
        'visitor_company': visit.visitor.company if visit.visitor else '',
        'host_name': host_name,
        'purpose': visit.purpose,
        'purpose_display': visit.get_purpose_display() if visit.purpose else (visit.purpose_other or ''),
        'checked_in_at': visit.checked_in_at,
        'expected_checkout_at': visit.expected_checkout_at,
        'checked_out_at': visit.checked_out_at,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def visit_verify(request, identifier):
    """
    Verify a visit by either UUID or visiting_id (VID-XXXXXXXX).
    Used by QR code scan on visitor card.
    """
    import uuid as uuid_lib
    visit = None

    # Try UUID first
    try:
        uid = uuid_lib.UUID(str(identifier))
        visit = Visit.objects.select_related('visitor', 'host', 'employee_host').get(id=uid)
    except (ValueError, Visit.DoesNotExist):
        pass

    # Fall back to visiting_id
    if visit is None:
        visit = Visit.objects.select_related('visitor', 'host', 'employee_host').filter(
            visiting_id__iexact=identifier
        ).first()

    if visit is None:
        return Response({'error': 'Visit not found.'}, status=404)

    host_name = (
        visit.employee_host.name if visit.employee_host else
        visit.host.name if visit.host else
        visit.host_name_manual or None
    )

    return Response({
        'visit_id': str(visit.id),
        'visiting_id': visit.visiting_id or '',
        'status': visit.status,
        'card_expired': visit.card_expired,
        'visitor_name': visit.visitor.full_name if visit.visitor else '',
        'visitor_cnic': visit.visitor.cnic if visit.visitor else '',
        'visitor_phone': visit.visitor.phone if visit.visitor else '',
        'visitor_company': visit.visitor.company if visit.visitor else '',
        'host_name': host_name,
        'purpose': visit.purpose,
        'purpose_display': visit.get_purpose_display() if visit.purpose else (visit.purpose_other or ''),
        'checked_in_at': visit.checked_in_at,
        'expected_checkout_at': visit.expected_checkout_at,
        'checked_out_at': visit.checked_out_at,
    })


# ── Receptionist Entry ────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def receptionist_entry(request):
    serializer = ReceptionistEntrySerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)

    d = serializer.validated_data

    # Blacklist check
    existing_v, _ = find_existing_visitor(cnic=d.get('cnic'), phone=d.get('phone'), email=d.get('email'))
    if existing_v and existing_v.is_blacklisted:
        return Response({
            'error': f'BLACKLISTED VISITOR: {existing_v.blacklist_reason or "Previous incident on record"}',
            'blacklisted': True,
            'visitor': VisitorSerializer(existing_v).data,
        }, status=403)

    visitor, is_returning = get_or_create_visitor(
        full_name=d['full_name'],
        cnic=d.get('cnic'),
        phone=d.get('phone'),
        email=d.get('email'),
        company=d.get('company'),
    )

    # Issue #1: Block if already checked in
    active_visit = check_already_checked_in(visitor)
    if active_visit:
        status_msg = "pending approval" if active_visit.status == Visit.Status.PENDING_APPROVAL else "checked in"
        return Response({
            'error': f'This visitor is already {status_msg}. Please check them out before checking in again.',
            'already_checked_in': True,
            'active_visit_id': str(active_visit.id),
            'active_status': active_visit.status,
        }, status=409)

    host = Host.objects.filter(id=d['host_id']).first() if d.get('host_id') else None
    employee_host = Employee.objects.filter(id=d['employee_host_id']).first() if d.get('employee_host_id') else None

    # Issue #8: expected_checkout_at is required
    if not d.get('expected_checkout_at'):
        return Response({'error': 'Expected checkout time is required.'}, status=400)

    visit = Visit.objects.create(
        visitor=visitor,
        host=host,
        employee_host=employee_host,
        host_name_manual=d.get('host_name_manual') if not host and not employee_host else None,
        purpose=d.get('purpose'),
        purpose_other=d.get('purpose_other'),
        interview_position=d.get('interview_position'),
        contractor_company=d.get('contractor_company'),
        contractor_designation=d.get('contractor_designation'),
        contractor_address=d.get('contractor_address'),
        delivery_company=d.get('delivery_company'),
        official_department=d.get('official_department'),
        official_rank=d.get('official_rank'),
        vip_category=d.get('vip_category'),
        status=Visit.Status.CHECKED_IN,
        entry_type=Visit.EntryType.RECEPTIONIST,
        checked_in_at=timezone.now(),
        expected_checkout_at=d.get('expected_checkout_at'),
        approved_by=request.user,
        notes=d.get('notes'),
        is_returning=is_returning,
        internal_department=d.get('internal_department'),
    )

    if (host or employee_host) and visit.purpose != 'internal':
        send_host_notification(visit)

    notify_receptionist(visit)

    return Response({
        'visit_id': str(visit.id),
        'visitor_id': str(visitor.id),
        'is_returning': is_returning,
        'status': 'checked_in',
    }, status=201)


# ── Approve / Reject ──────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def approve_visit(request, visit_id):
    try:
        visit = Visit.objects.get(id=visit_id)
    except Visit.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if visit.status != Visit.Status.PENDING_APPROVAL:
        return Response({'error': 'Not pending approval.'}, status=400)

    if visit.visitor.is_blacklisted:
        return Response({'error': f'BLACKLISTED: {visit.visitor.blacklist_reason}', 'blacklisted': True}, status=403)

    # Issue #8: require expected_checkout_at on approve
    expected_checkout = request.data.get('expected_checkout_at')
    if not expected_checkout and not visit.expected_checkout_at:
        return Response({'error': 'Expected checkout time is required before approving.'}, status=400)

    # If visitor selected "Other" host — receptionist assigns employee now
    emp_id = request.data.get('employee_host_id')
    if emp_id:
        emp = Employee.objects.filter(id=emp_id).first()
        if emp:
            visit.employee_host = emp
            visit.host_name_manual = None

    visit.status = Visit.Status.CHECKED_IN
    visit.checked_in_at = timezone.now()
    visit.approved_by = request.user
    if expected_checkout:
        visit.expected_checkout_at = expected_checkout
    visit.save()

    send_host_notification(visit)
    notify_visit_update(visit.id, visit.status)

    # Issue #7: Return visit_id so frontend can show card
    return Response({
        'status': 'checked_in',
        'visit_id': str(visit.id),
        'visitor_name': visit.visitor.full_name,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reject_visit(request, visit_id):
    try:
        visit = Visit.objects.get(id=visit_id)
    except Visit.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    visit.status = Visit.Status.REJECTED
    visit.notes = request.data.get('reason', '')
    visit.save()
    notify_visit_update(visit.id, visit.status)
    return Response({'status': 'rejected'})


# ── Checkout ──────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def checkout_visit(request, visit_id):
    try:
        visit = Visit.objects.get(id=visit_id)
    except Visit.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    if visit.status != Visit.Status.CHECKED_IN:
        return Response({'error': 'Visitor is not checked in.'}, status=400)

    # Issue #8: validate duration (checkin must exist)
    if not visit.checked_in_at:
        return Response({'error': 'Check-in time missing. Cannot checkout.'}, status=400)

    now = timezone.now()
    duration_minutes = int((now - visit.checked_in_at).total_seconds() / 60)
    if duration_minutes < 0:
        return Response({'error': 'Invalid checkout time.'}, status=400)

    visit.status = Visit.Status.CHECKED_OUT
    visit.checked_out_at = now
    visit.card_expired = True
    late_minutes = 0
    if visit.expected_checkout_at and now > visit.expected_checkout_at:
        visit.is_late = True
        late_minutes = int((now - visit.expected_checkout_at).total_seconds() / 60)
    visit.save()
    notify_visit_update(visit.id, visit.status)
    # Send late alert email
    if late_minutes > 0:
        from .email_utils import send_late_checkout_alert
        send_late_checkout_alert(visit, late_minutes)
    return Response({'status': 'checked_out', 'duration_minutes': duration_minutes, 'late_minutes': late_minutes})


# ── Scheduled ─────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def scheduled_entry(request):
    serializer = ScheduledEntrySerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    vid = serializer.validated_data['visiting_id'].upper().strip()
    try:
        visit = Visit.objects.get(visiting_id=vid, status=Visit.Status.SCHEDULED)
    except Visit.DoesNotExist:
        return Response({'error': 'Invalid visiting ID or already used.'}, status=404)
    if visit.visitor.is_blacklisted:
        return Response({'error': 'Entry denied. Contact receptionist.'}, status=403)
    # Issue #1: check if already active
    active = check_already_checked_in(visit.visitor)
    if active and active.id != visit.id:
        return Response({'error': 'This visitor is already checked in. Please checkout first.'}, status=409)
    visit.status = Visit.Status.CHECKED_IN
    visit.checked_in_at = timezone.now()
    visit.save()
    notify_visit_update(visit.id, visit.status)
    return Response({'visit_id': str(visit.id), 'visitor_name': visit.visitor.full_name, 'status': 'checked_in', 'message': f'Welcome, {visit.visitor.full_name}!'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def schedule_visit(request):
    serializer = ScheduleVisitSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    d = serializer.validated_data
    visitor, is_returning = get_or_create_visitor(
        full_name=d['full_name'], cnic=d.get('cnic'),
        phone=d.get('phone'), email=d.get('email'), company=d.get('company'),
    )
    host = Host.objects.filter(id=d['host_id']).first() if d.get('host_id') else None
    employee_host = Employee.objects.filter(id=d['employee_host_id']).first() if d.get('employee_host_id') else None
    visit = Visit.objects.create(
        visitor=visitor,
        host=host,
        employee_host=employee_host,
        host_name_manual=d.get('host_name_manual') if not host and not employee_host else None,
        purpose=d.get('purpose'),
        purpose_other=d.get('purpose_other'),
        interview_position=d.get('interview_position'),
        contractor_company=d.get('contractor_company'),
        contractor_designation=d.get('contractor_designation'),
        contractor_address=d.get('contractor_address'),
        delivery_company=d.get('delivery_company'),
        official_department=d.get('official_department'),
        official_rank=d.get('official_rank'),
        vip_category=d.get('vip_category'),
        internal_department=d.get('internal_department'),
        status=Visit.Status.SCHEDULED,
        entry_type=Visit.EntryType.SCHEDULED,
        scheduled_at=d['scheduled_at'],
        expected_checkout_at=d.get('expected_checkout_at'),
        notes=d.get('notes'),
        is_returning=is_returning,
    )
    return Response({'visit_id': str(visit.id), 'visiting_id': visit.visiting_id, 'visitor_name': visitor.full_name, 'scheduled_at': visit.scheduled_at}, status=201)


# ── Update host on "Other" visits ─────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_visit_host(request, visit_id):
    try:
        visit = Visit.objects.get(id=visit_id)
    except Visit.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    emp_id = request.data.get('employee_host_id')
    if emp_id:
        emp = Employee.objects.filter(id=emp_id).first()
        if emp:
            visit.employee_host = emp
            visit.host_name_manual = None
            visit.save()
    return Response({'status': 'updated'})


# ── Overwrite visit fields (Issue #11) ─────────────────────────────────────────

@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def overwrite_visit(request, visit_id):
    """Receptionist can overwrite any visit field."""
    try:
        visit = Visit.objects.get(id=visit_id)
    except Visit.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    allowed_fields = [
        'purpose', 'purpose_other', 'interview_position',
        'contractor_company', 'contractor_designation', 'contractor_address',
        'delivery_company', 'official_department', 'official_rank', 'vip_category',
        'expected_checkout_at', 'notes', 'host_name_manual',
    ]
    for field in allowed_fields:
        if field in request.data:
            setattr(visit, field, request.data[field])

    # Handle host update
    if 'host_id' in request.data:
        host = Host.objects.filter(id=request.data['host_id']).first()
        visit.host = host
        visit.employee_host = None
        visit.host_name_manual = None
    if 'employee_host_id' in request.data:
        emp = Employee.objects.filter(id=request.data['employee_host_id']).first()
        visit.employee_host = emp
        visit.host = None
        visit.host_name_manual = None

    # Handle visitor info overwrite
    if any(k in request.data for k in ['full_name', 'cnic', 'phone', 'email', 'company']):
        visitor = visit.visitor
        if 'full_name' in request.data:
            visitor.full_name = request.data['full_name']
        if 'cnic' in request.data:
            visitor.cnic = format_cnic(request.data['cnic']) if request.data['cnic'] else None
        if 'phone' in request.data:
            from .utils import validate_phone_pakistan
            _, _, cleaned = validate_phone_pakistan(request.data['phone'])
            visitor.phone = cleaned or request.data['phone']
        if 'email' in request.data:
            visitor.email = request.data['email'].lower() if request.data['email'] else None
        if 'company' in request.data:
            visitor.company = request.data['company']
        visitor.save()

    visit.save()
    return Response({'status': 'updated', 'visit_id': str(visit.id)})


# ── Visitor Lists ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def visit_list(request):
    visits = Visit.objects.select_related('visitor', 'host', 'employee_host').all()
    s = request.query_params.get('status')
    if s:
        visits = visits.filter(status=s)
    if request.query_params.get('today') == '1':
        visits = visits.filter(created_at__date=timezone.now().date())
    p = request.query_params.get('purpose')
    if p:
        visits = visits.filter(purpose=p)
    company = request.query_params.get('company')
    if company:
        visits = visits.filter(visitor__company__iexact=company)
    paginator = PageNumberPagination()
    paginator.page_size = 20
    page = paginator.paginate_queryset(visits, request)
    return paginator.get_paginated_response(VisitListSerializer(page, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def visit_detail(request, visit_id):
    try:
        visit = Visit.objects.select_related('visitor', 'host', 'employee_host', 'approved_by').get(id=visit_id)
    except Visit.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    return Response(VisitDetailSerializer(visit).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def search_visitor(request):
    q = request.query_params.get('q', '').strip()
    if not q:
        return Response({'results': []})
    visitors = Visitor.objects.filter(
        Q(cnic__icontains=q) | Q(phone__icontains=q) | Q(email__icontains=q) | Q(full_name__icontains=q)
    )[:10]
    return Response({'results': VisitorSerializer(visitors, many=True).data})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def visitor_list(request):
    visitors = Visitor.objects.all()
    bl = request.query_params.get('blacklisted')
    if bl:
        visitors = visitors.filter(is_blacklisted=bl.lower() == 'true')
    q = request.query_params.get('q')
    if q:
        visitors = visitors.filter(Q(full_name__icontains=q) | Q(cnic__icontains=q) | Q(phone__icontains=q) | Q(email__icontains=q))
    company = request.query_params.get('company')
    if company:
        visitors = visitors.filter(company__iexact=company)
    return Response(VisitorSerializer(visitors, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def visitor_history(request, visitor_id):
    try:
        visitor = Visitor.objects.get(id=visitor_id)
    except Visitor.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    visits = Visit.objects.filter(visitor=visitor).select_related('host', 'employee_host')

    # Issue #2: unique_days = count of distinct calendar days with a visit
    from django.db.models.functions import TruncDate
    unique_days = visits.annotate(visit_date=TruncDate('created_at')).values('visit_date').distinct().count()

    total_mins = sum(
        int((v.checked_out_at - v.checked_in_at).total_seconds() / 60)
        for v in visits if v.checked_in_at and v.checked_out_at
    )
    return Response({
        'visitor': VisitorSerializer(visitor).data,
        'visits': VisitListSerializer(visits, many=True).data,
        'total_visits': visits.count(),
        'unique_visit_days': unique_days,   # Issue #2: days-based count for frequent visitor
        'total_duration_minutes': total_mins,
    })


# ── CNIC instant check ────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def check_cnic_api(request):
    cnic = request.query_params.get('cnic', '').strip()
    if not cnic:
        return Response({'found': False})
    visitor = Visitor.objects.filter(cnic=format_cnic(cnic)).first()
    if not visitor:
        return Response({'found': False})
    # Issue #2: also return unique days
    from django.db.models.functions import TruncDate
    unique_days = visitor.visits.annotate(vd=TruncDate('created_at')).values('vd').distinct().count()
    return Response({
        'found': True,
        'is_blacklisted': visitor.is_blacklisted,
        'blacklist_reason': visitor.blacklist_reason if visitor.is_blacklisted else None,
        'visitor_name': visitor.full_name,
        'visit_count': visitor.visits.count(),
        'unique_visit_days': unique_days,
        'visitor_id': str(visitor.id),
    })


# ── Duplicate check ───────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def check_duplicate_api(request):
    """Check if a visitor with same CNIC/phone/email already exists."""
    cnic = request.data.get('cnic')
    phone = request.data.get('phone')
    email = request.data.get('email')
    exclude_id = request.data.get('exclude_visitor_id')

    matches = check_duplicate_combo(cnic=cnic, phone=phone, email=email, exclude_visitor_id=exclude_id)
    if not matches:
        return Response({'duplicate': False, 'matches': []})

    return Response({
        'duplicate': True,
        'matches': [
            {
                'id': str(v.id),
                'full_name': v.full_name,
                'cnic': v.cnic or '',
                'phone': v.phone or '',
                'email': v.email or '',
                'company': v.company or '',
                'is_blacklisted': v.is_blacklisted,
            }
            for v in matches
        ]
    })


# ── Blacklist ─────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def blacklist_visitor(request, visitor_id):
    try:
        visitor = Visitor.objects.get(id=visitor_id)
    except Visitor.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    visitor.is_blacklisted = True
    visitor.blacklist_reason = request.data.get('reason', '')
    visitor.save()
    return Response({'status': 'blacklisted'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def unblacklist_visitor(request, visitor_id):
    try:
        visitor = Visitor.objects.get(id=visitor_id)
    except Visitor.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)
    visitor.is_blacklisted = False
    visitor.blacklist_reason = ''
    visitor.save()
    return Response({'status': 'unblacklisted'})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def blacklisted_visitors(request):
    return Response(VisitorSerializer(Visitor.objects.filter(is_blacklisted=True), many=True).data)


# ── Dashboard ─────────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    today = timezone.now().date()
    tv = Visit.objects.filter(created_at__date=today)
    checked_in_now = Visit.objects.filter(status=Visit.Status.CHECKED_IN)

    # Active visitors with live duration
    active_visitors = []
    for v in checked_in_now.select_related('visitor')[:8]:
        mins = int((timezone.now() - v.checked_in_at).total_seconds() / 60) if v.checked_in_at else 0
        active_visitors.append({
            'visit_id': str(v.id),
            'visitor_name': v.visitor.full_name,
            'checked_in_at': v.checked_in_at,
            'duration_minutes': mins,
            'purpose': v.purpose,
            'is_overnight': v.is_overnight,
        })

    # Avg duration completed today
    completed = tv.filter(status=Visit.Status.CHECKED_OUT, checked_in_at__isnull=False, checked_out_at__isnull=False)
    avg_dur = 0
    if completed.exists():
        total = sum(int((v.checked_out_at - v.checked_in_at).total_seconds() / 60) for v in completed)
        avg_dur = total // completed.count()

    # Issue #2: frequent visitors by unique days
    from django.db.models.functions import TruncDate
    from django.db.models import Count as DCount
    most_visited = Visitor.objects.annotate(vc=DCount('visits')).filter(vc__gt=1).order_by('-vc')[:5]

    last_7 = []
    for i in range(6, -1, -1):
        day = today - timedelta(days=i)
        last_7.append({'date': str(day), 'count': Visit.objects.filter(created_at__date=day).count()})

    purpose_breakdown = [
        {'purpose': p.value, 'label': p.label, 'count': tv.filter(purpose=p.value).count()}
        for p in Visit.Purpose
    ]

    return Response({
        'today': {
            'total': tv.count(),
            'checked_in': tv.filter(status=Visit.Status.CHECKED_IN).count(),
            'checked_out': tv.filter(status=Visit.Status.CHECKED_OUT).count(),
            'scheduled': tv.filter(status=Visit.Status.SCHEDULED).count(),
            'pending_approval': tv.filter(status=Visit.Status.PENDING_APPROVAL).count(),
        },
        'currently_inside': checked_in_now.count(),
        'pending_approval': Visit.objects.filter(status=Visit.Status.PENDING_APPROVAL).count(),
        'avg_duration_minutes': avg_dur,
        'active_visitors': active_visitors,
        'most_visited': VisitorSerializer(most_visited, many=True).data,
        'last_7_days': last_7,
        'purpose_breakdown': purpose_breakdown,
    })


# ── Hosts & Employees ─────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])  # Public — needed for self-service QR check-in page (Issue #4)
def host_list(request):
    if request.method == 'GET':
        hosts = Host.objects.filter(is_active=True)
        q = request.query_params.get('q')
        if q:
            hosts = hosts.filter(Q(name__icontains=q) | Q(department__icontains=q))
        return Response(HostSerializer(hosts, many=True).data)


# Issue #5: Create host from employee only
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_host_from_employee(request):
    """Create a local Host record from an auth-service employee."""
    emp_id = request.data.get('employee_id')
    if not emp_id:
        return Response({'error': 'employee_id is required.'}, status=400)

    # Fetch from auth-service
    try:
        emp = auth_client.get_employee(emp_id)
    except AuthServiceUnavailable:
        return Response(
            {'error': 'Employee data unavailable (Auth Service is down).', 'auth_service_down': True},
            status=503,
        )

    if emp is None:
        return Response({'error': 'Employee not found.'}, status=404)

    emp_code = emp.get('employee_id') or emp.get('employee_code', '')
    emp_name = emp.get('full_name', emp.get('name', ''))
    emp_dept = emp.get('department') or (emp.get('primary_assignment') or {}).get('department', '')
    emp_email = emp.get('org_email') or emp.get('personal_email', '')
    emp_phone = emp.get('org_phone') or emp.get('personal_phone', '')

    existing = Host.objects.filter(employee_id=emp_code).first()
    if existing:
        return Response({'message': 'Host already exists.', 'host': HostSerializer(existing).data})

    host = Host.objects.create(
        name=emp_name,
        department=emp_dept,
        employee_id=emp_code,
        phone=emp_phone,
        email=emp_email,
        is_active=True,
    )
    return Response(HostSerializer(host).data, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def employee_list(request):
    """List employees from auth-service (live, Redis-cached 5 min)."""
    filters = {}
    q = request.query_params.get('q')
    if q:
        filters['search'] = q
    dept = request.query_params.get('department')
    if dept:
        filters['department'] = dept

    try:
        employees = auth_client.get_employees(filters)
    except AuthServiceUnavailable:
        return Response(
            {'error': 'Employee data unavailable (Auth Service is down).', 'auth_service_down': True},
            status=503,
        )
    return Response(employees)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def employee_detail(request, employee_id):
    """Get a single employee from auth-service."""
    try:
        emp = auth_client.get_employee(employee_id)
    except AuthServiceUnavailable:
        return Response(
            {'error': 'Employee data unavailable (Auth Service is down).', 'auth_service_down': True},
            status=503,
        )
    if emp is None:
        return Response({'error': 'Not found.'}, status=404)
    return Response(emp)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def department_list(request):
    """List departments from auth-service (live, Redis-cached 5 min)."""
    try:
        departments = auth_client.get_departments()
    except AuthServiceUnavailable:
        return Response(
            {'error': 'Department data unavailable (Auth Service is down).', 'auth_service_down': True},
            status=503,
        )
    return Response(departments)


# ── Issue #6: Companies report ────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def company_report(request):
    """List all companies that have sent visitors, with counts."""
    companies = (
        Visitor.objects
        .exclude(company__isnull=True)
        .exclude(company__exact='')
        .values('company')
        .annotate(
            visitor_count=Count('id'),
            total_visits=Count('visits'),
        )
        .order_by('-visitor_count')
    )
    # Enrich with last visit date
    result = []
    for c in companies:
        last_visit = (
            Visit.objects
            .filter(visitor__company=c['company'])
            .order_by('-created_at')
            .values_list('created_at', flat=True)
            .first()
        )
        result.append({
            'company': c['company'],
            'visitor_count': c['visitor_count'],
            'total_visits': c['total_visits'],
            'last_visit': last_visit,
        })
    return Response(result)


# ── Utilities ─────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def check_overnight(request):
    count = check_overnight_stays()
    return Response({'overnight_checks': count})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_visits_csv(request):
    import csv
    from django.http import HttpResponse
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = 'attachment; filename="visits.csv"'
    writer = csv.writer(response)
    writer.writerow(['Date', 'Visitor', 'CNIC', 'Phone', 'Company', 'Purpose', 'Host', 'Status', 'Check-in', 'Check-out', 'Duration(min)', 'Late'])
    for v in Visit.objects.select_related('visitor', 'host', 'employee_host').order_by('-created_at')[:2000]:
        host_name = v.employee_host.name if v.employee_host else (v.host.name if v.host else v.host_name_manual or '')
        dur = int((v.checked_out_at - v.checked_in_at).total_seconds() / 60) if v.checked_in_at and v.checked_out_at else ''
        writer.writerow([
            v.created_at.date(), v.visitor.full_name, v.visitor.cnic or '', v.visitor.phone or '',
            v.visitor.company or '', v.get_purpose_display() if v.purpose else v.purpose_other or '',
            host_name, v.status,
            v.checked_in_at.strftime('%Y-%m-%d %H:%M') if v.checked_in_at else '',
            v.checked_out_at.strftime('%Y-%m-%d %H:%M') if v.checked_out_at else '',
            dur, 'Yes' if v.is_late else '',
        ])
    return response


# ── Company detail ─────────────────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def company_detail(request, company_name):
    """All visitors and visits from a specific company."""
    from urllib.parse import unquote
    company = unquote(company_name)
    visitors = Visitor.objects.filter(company__iexact=company)
    visits = Visit.objects.filter(visitor__company__iexact=company).select_related('visitor', 'host', 'employee_host').order_by('-created_at')

    # Purpose breakdown for this company
    purpose_breakdown = {}
    for v in visits:
        key = v.purpose or 'other'
        purpose_breakdown[key] = purpose_breakdown.get(key, 0) + 1

    return Response({
        'company': company,
        'visitors': VisitorSerializer(visitors, many=True).data,
        'visits': VisitListSerializer(visits[:50], many=True).data,
        'total_visitors': visitors.count(),
        'total_visits': visits.count(),
        'purpose_breakdown': [{'purpose': k, 'count': v} for k, v in purpose_breakdown.items()],
    })


# ── Card sharing (Issue: email/whatsapp card) ─────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def send_card_email(request, visit_id):
    """Send visitor card by email."""
    try:
        visit = Visit.objects.select_related('visitor', 'host', 'employee_host').get(id=visit_id)
    except Visit.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    email = request.data.get('email') or (visit.visitor.email if visit.visitor.email else None)
    if not email:
        return Response({'error': 'No email address provided.'}, status=400)

    from .email_utils import send_card_by_email
    success = send_card_by_email(visit, email)
    if success:
        return Response({'status': 'sent', 'email': email})
    return Response({'error': 'Failed to send email. Check server email configuration.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def whatsapp_card_link(request, visit_id):
    """Generate WhatsApp share link for visitor card."""
    try:
        visit = Visit.objects.select_related('visitor', 'host', 'employee_host').get(id=visit_id)
    except Visit.DoesNotExist:
        return Response({'error': 'Not found.'}, status=404)

    host_name = (visit.employee_host.name if visit.employee_host else
                 visit.host.name if visit.host else visit.host_name_manual or 'N/A')

    # Use X-Forwarded-Proto/Host headers from nginx, else fallback to request
    proto = request.META.get('HTTP_X_FORWARDED_PROTO', request.scheme)
    host = request.META.get('HTTP_X_FORWARDED_HOST', request.META.get('HTTP_HOST', 'localhost'))
    base_url = f"{proto}://{host}"
    card_url = f"{base_url}/dashboard/visitor-card?visitId={visit.id}"

    message = (
        f"*VISITOR PASS*\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"*Name:* {visit.visitor.full_name}\n"
        f"*ID:* {visit.visiting_id or str(visit.id)[:8].upper()}\n"
        f"*Meeting:* {host_name}\n"
        f"*Purpose:* {visit.get_purpose_display() if visit.purpose else visit.purpose_other or 'N/A'}\n"
        f"*Check-in:* {visit.checked_in_at.strftime('%d %b, %I:%M %p') if visit.checked_in_at else 'N/A'}\n"
        f"━━━━━━━━━━━━━━━━━━━\n"
        f"View card: {card_url}"
    )

    phone = visit.visitor.phone or ''
    # Strip to digits for WhatsApp
    clean = ''.join(c for c in phone if c.isdigit())
    if clean.startswith('0'):
        clean = '92' + clean[1:]

    import urllib.parse
    wa_link = f"https://wa.me/{clean}?text={urllib.parse.quote(message)}" if clean else \
              f"https://wa.me/?text={urllib.parse.quote(message)}"

    return Response({'whatsapp_url': wa_link, 'message': message, 'phone': clean or None})
