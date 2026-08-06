from rest_framework import viewsets, status, views, serializers, mixins
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from django.db.models import Sum, Q
from django.utils import timezone
from .models import FeeType, FeeStructure, StudentFee, Payment, BankAccount, PaymentTransaction
from .serializers import (
    FeeTypeSerializer, FeeStructureSerializer,
    StudentFeeSerializer, PaymentSerializer,
    ChallanGenerationSerializer, BankAccountSerializer, PaymentTransactionSerializer
)
from .services import FeeService
from central_auth.authentication import CentralAuthUser
from .dual_auth import (
    DualHasDynamicPermission as HasDynamicPermission,
    DualServiceSubscribed,
    DualRequiresPermission,
    user_is_superadmin,
    user_role,
    user_display_name,
)

# Phase C2 endpoint -> sms.* permission map (full table + flagged catalog
# gap in docs/PHASE_C2_FEES_SERVICE_RESULT.md):
#   read-only endpoints gated by required_permission='view_fees'  -> sms.fee.view (EXISTS)
#   write endpoints gated by required_permission='manage_fees'    -> sms.fee.manage (FLAGGED, not in catalog)
#   PaymentTransactionViewSet.submit (student self-service payment) -> sms.fee.pay (EXISTS) — added below
# See fees/dual_auth.py's REQUIRED_PERMISSION_TO_SMS_CODENAME for the map
# used by 'manage_fees'/'view_fees'-gated views (DualHasDynamicPermission).


def _central_tenant_qs(base_manager, user):
    """Central-auth read path for models with their own tenant_id (BankAccount,
    FeeType, FeeStructure, StudentFee) — NOT the OrganizationManager-backed
    `objects` default (see dual_auth.py's module docstring / C1's finding:
    OrganizationMiddleware never populates its contextvars for central-auth
    requests, so `objects` would silently go empty)."""
    qs = base_manager.get_queryset() if hasattr(base_manager, 'get_queryset') else base_manager.all()
    if user_is_superadmin(user):
        return qs
    if not user.tenant_id:
        return qs.none()
    return qs.filter(Q(tenant_id=user.tenant_id) | Q(tenant_id__isnull=True))


class FeeTypeViewSet(viewsets.ModelViewSet):
    queryset = FeeType.objects.all()
    serializer_class = FeeTypeSerializer
    permission_classes = [IsAuthenticated, DualServiceSubscribed, HasDynamicPermission]
    required_permission = 'manage_fees'
    filterset_fields = ['frequency', 'is_default', 'is_active']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return FeeType.objects.none()
        if isinstance(user, CentralAuthUser):
            return _central_tenant_qs(FeeType._base_manager, user)

        from users.middleware import get_current_organization
        org = get_current_organization()
        # Use _base_manager.get_queryset() to bypass the OrganizationManager's automatic .none() filter
        qs = FeeType._base_manager.get_queryset()
        if user_is_superadmin(user):
            return qs
        if org:
            # Show records for current org OR global defaults (isnull)
            return qs.filter(Q(organization=org) | Q(organization__isnull=True))
        return FeeType.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if isinstance(user, CentralAuthUser):
            serializer.save(tenant_id=user.tenant_id)
            return
        from users.middleware import get_current_organization
        org = get_current_organization()
        if org:
            serializer.save(organization=org)
        else:
            serializer.save()

    def perform_destroy(self, instance):
        instance.delete()

class FeeStructureViewSet(viewsets.ModelViewSet):
    queryset = FeeStructure.objects.all().prefetch_related('line_items')
    serializer_class = FeeStructureSerializer
    permission_classes = [IsAuthenticated, DualServiceSubscribed, HasDynamicPermission]
    required_permission = 'manage_fees'
    filterset_fields = ['campus', 'level', 'grade', 'is_active', 'is_default']

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return FeeStructure.objects.none()
        if isinstance(user, CentralAuthUser):
            return _central_tenant_qs(FeeStructure._base_manager, user).prefetch_related('line_items')

        from users.middleware import get_current_organization
        org = get_current_organization()
        qs = FeeStructure._base_manager.get_queryset().prefetch_related('line_items')
        if user_is_superadmin(user):
            return qs
        if org:
            # Show records for current org only
            return qs.filter(organization=org)
        return FeeStructure.objects.none()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            with open("/tmp/drf_errors.txt", "w") as f:
                f.write(str(serializer.errors))
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        user = self.request.user
        if isinstance(user, CentralAuthUser):
            serializer.save(tenant_id=user.tenant_id)
            return
        from users.middleware import get_current_organization
        org = get_current_organization()
        if org:
            serializer.save(organization=org)
        else:
            serializer.save()

class StudentFeeViewSet(viewsets.ModelViewSet):
    queryset = StudentFee.objects.all().select_related('student', 'fee_structure').prefetch_related('payments__received_by')
    serializer_class = StudentFeeSerializer
    permission_classes = [IsAuthenticated, DualServiceSubscribed]
    filterset_fields = ['student', 'student__campus', 'month', 'year', 'status']
    search_fields = ['invoice_number', 'student__name', 'student__student_code']

    def get_permissions(self):
        """
        Read operations (list, retrieve): any authenticated user can view.
        Write operations (create, update, delete): require manage_fees permission.
        This allows teachers to see student fee records on the profile page
        while only Accountants/Admins can create/modify/delete them.
        """
        from rest_framework.permissions import SAFE_METHODS
        if self.request.method in SAFE_METHODS:
            return [IsAuthenticated(), DualServiceSubscribed()]
        perm = HasDynamicPermission()
        perm.required_permission = 'manage_fees'
        return [IsAuthenticated(), DualServiceSubscribed(), perm]


    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return StudentFee.objects.none()

        # If a specific student_id is requested, bypass org/tenant filter to
        # avoid mismatch issues (fee org vs request org). The student's own
        # record is already access-controlled at the StudentViewSet level.
        student_id = self.request.query_params.get('student_id')
        if student_id:
            return StudentFee._base_manager.get_queryset().select_related('student', 'fee_structure').prefetch_related('payments__received_by').filter(student_id=student_id)

        if isinstance(user, CentralAuthUser):
            qs = _central_tenant_qs(StudentFee._base_manager, user).select_related('student', 'fee_structure').prefetch_related('payments__received_by')
            # No role/person_type claim on central-auth tokens yet (see
            # dual_auth.py's user_role() note) — campus-scoping below is
            # legacy-only, skipped here rather than guessed at.
            return qs

        from users.middleware import get_current_organization
        org = get_current_organization()
        qs = StudentFee._base_manager.get_queryset().select_related('student', 'fee_structure').prefetch_related('payments__received_by')
        if user_is_superadmin(user):
            pass # Keep full qs
        elif org:
            qs = qs.filter(organization=org)
        else:
            return StudentFee.objects.none()

        # Campus-scoped office staff (Accountant / Receptionist / Auditor) only
        # see fee records of students at their assigned campus.
        role = user_role(user)
        if role in ('accounts_officer', 'admissions_counselor', 'compliance_officer'):
            campus = getattr(user, 'campus', None)
            if campus:
                qs = qs.filter(student__campus=campus)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if isinstance(user, CentralAuthUser):
            serializer.save(tenant_id=user.tenant_id)
            return
        from users.middleware import get_current_organization
        org = get_current_organization()
        if org:
            serializer.save(organization=org)
        else:
            serializer.save()

    @action(detail=True, methods=['patch'], url_path='status')
    def update_status(self, request, pk=None):
        """Update status to 'issued' on download"""
        fee = self.get_object()
        if fee.status == 'unpaid':
            fee.status = 'issued'
            fee.save()
        return Response({'status': fee.status})

class PaymentViewSet(viewsets.ModelViewSet):
    queryset = Payment.objects.all().select_related('student_fee__student', 'received_by')
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, DualServiceSubscribed, HasDynamicPermission]
    required_permission = 'manage_fees'

    def get_queryset(self):
        user = self.request.user
        qs = Payment.objects.all().select_related('student_fee__student', 'received_by')
        if not user.is_authenticated:
            return Payment.objects.none()

        if isinstance(user, CentralAuthUser):
            if user_is_superadmin(user):
                return qs
            if not user.tenant_id:
                return Payment.objects.none()
            return qs.filter(Q(student_fee__tenant_id=user.tenant_id) | Q(student_fee__tenant_id__isnull=True))

        if user_is_superadmin(user):
            return qs

        from users.middleware import get_current_organization
        org = get_current_organization()
        if org:
            qs = qs.filter(student_fee__organization=org)
        else:
            return Payment.objects.none()

        # Campus-scoped office staff only see payments for their campus.
        role = user_role(user)
        if role in ('accounts_officer', 'admissions_counselor', 'compliance_officer'):
            campus = getattr(user, 'campus', None)
            if campus:
                qs = qs.filter(student_fee__student__campus=campus)

        return qs

    def perform_create(self, serializer):
        # We use the service for recording payment to ensure logic consistency
        data = serializer.validated_data
        bank_details = None
        if data.get('method') == 'bank':
            bank_details = {
                'bank_name': data.get('bank_name'),
                'transaction_id': data.get('transaction_id'),
                'deposit_date': data.get('deposit_date'),
            }

        user = self.request.user
        is_central = isinstance(user, CentralAuthUser)
        # NOTE (flagged, not fully closed here): data['student_fee'] was
        # resolved by the serializer's own PrimaryKeyRelatedField, which
        # still queries StudentFee.objects (OrganizationManager-filtered) —
        # for a central-auth request this could 400 at validation time
        # before reaching this method at all, same root cause as
        # CashPaymentView's fix above. CashPaymentView (raw challan_id, no
        # DRF FK field) is the one proven end-to-end for Phase C2; this
        # path's serializer-level resolution is a known follow-up, see
        # docs/PHASE_C2_FEES_SERVICE_RESULT.md.
        FeeService.record_payment(
            student_fee_id=data['student_fee'].id,
            amount=data['amount'],
            method=data['method'],
            received_by=None if is_central else user,
            central_user_id=user.id if is_central else None,
            bank_details=bank_details,
            student_fee=data['student_fee'] if is_central else None,
        )

class GenerateChallansView(views.APIView):
    permission_classes = [IsAuthenticated, DualServiceSubscribed, HasDynamicPermission]
    required_permission = 'manage_fees'

    def post(self, request):
        serializer = ChallanGenerationSerializer(data=request.data)
        if serializer.is_valid():
            gen, err = FeeService.generate_challans(
                month=serializer.validated_data['month'],
                year=serializer.validated_data['year'],
                campus_id=serializer.validated_data.get('campus_id'),
                student_id=serializer.validated_data.get('student_id'),
                level_id=serializer.validated_data.get('level_id'),
                grade_id=serializer.validated_data.get('grade_id'),
                structure_id=serializer.validated_data.get('structure_id'),
                level_ids=serializer.validated_data.get('level_ids'),
                grade_ids=serializer.validated_data.get('grade_ids'),
                section_ids=serializer.validated_data.get('section_ids'),
            )
            return Response({
                "message": f"Successfully generated {gen} challans. Errors: {err}",
                "generated": gen,
                "errors": err
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class FeeReportCollectionView(views.APIView):
    permission_classes = [IsAuthenticated, DualServiceSubscribed, HasDynamicPermission]
    required_permission = 'view_fees'

    def get(self, request):
        from django.db.models import Sum, Q, Case, When, Value, CharField, F
        from django.utils import timezone
        import calendar
        from decimal import Decimal

        user = request.user
        if isinstance(user, CentralAuthUser):
            if not user.tenant_id:
                return Response({"error": "No tenant found"}, status=400)
            base_qs = StudentFee._base_manager.filter(
                Q(tenant_id=user.tenant_id) | Q(tenant_id__isnull=True)
            )
        else:
            from users.middleware import get_current_organization
            org = get_current_organization()
            if not org:
                return Response({"error": "No organization found"}, status=400)
            base_qs = StudentFee._base_manager.filter(organization=org)

        # Default to current month/year if not provided
        now = timezone.now()
        # Convert query params to integers safely
        def to_int(val):
            try: return int(val)
            except: return None

        m_from = to_int(request.query_params.get('month_from'))
        y_from = to_int(request.query_params.get('year_from'))
        m_to = to_int(request.query_params.get('month_to'))
        y_to = to_int(request.query_params.get('year_to'))

        campus_id = request.query_params.get('campus_id')
        grade_id = request.query_params.get('grade_id')

        # Campus-scoped office staff (Accountant / Receptionist / Auditor) are
        # locked to their own campus regardless of any campus_id they request.
        # (Legacy-only — no role/person_type claim on central-auth tokens yet.)
        role = user_role(user)
        if role in ('accounts_officer', 'admissions_counselor', 'compliance_officer'):
            user_campus = getattr(user, 'campus', None)
            if user_campus:
                campus_id = user_campus.id

        # Scope every metric (summary, trend and list) to the campus so a
        # campus accountant sees only their campus' collection numbers.
        _c_id_base = to_int(campus_id)
        if _c_id_base:
            base_qs = base_qs.filter(student__campus_id=_c_id_base)

        # 1. Summary Metrics for the targeted filters (Range or Single Month)
        if m_from and y_from and m_to and y_to:
            start_period = y_from * 100 + m_from
            end_period = y_to * 100 + m_to
            summary_qs = base_qs.annotate(
                period=F('year') * 100 + F('month')
            ).filter(period__gte=start_period, period__lte=end_period)
        else:
            # Fallback to current behavior or single month if provided
            m = to_int(request.query_params.get('month')) or now.month
            y = to_int(request.query_params.get('year')) or now.year
            summary_qs = base_qs.filter(month=m, year=y)

        g_id = to_int(grade_id)

        # Campus is already applied to base_qs above (so it also scopes the
        # trend); only the grade drill-down needs applying to the summary here.
        if g_id:
            # Join through classroom -> grade for accuracy
            summary_qs = summary_qs.filter(student__classroom__grade_id=g_id)

        metrics = summary_qs.aggregate(
            total_sum=Sum('total_amount'),
            late_sum=Sum('late_fee'),
            other_sum=Sum('other_charges'),
            paid_sum=Sum('paid_amount')
        )

        total_expected = (metrics['total_sum'] or Decimal('0.00')) + \
                         (metrics['late_sum'] or Decimal('0.00')) + \
                         (metrics['other_sum'] or Decimal('0.00'))
        collected_total = metrics['paid_sum'] or Decimal('0.00')
        pending_total = total_expected - collected_total

        # 2. 12 Months Trend (6 back, current, 5 forward)
        trend_data = []
        for i in range(6, -6, -1):
            # Accurate Month/Year subtract/add logic
            total_months = (now.year * 12 + now.month - 1) - i
            y_idx = total_months // 12
            m_idx = (total_months % 12) + 1

            month_label = calendar.month_name[m_idx][:3]
            year_label = str(y_idx)[-2:] # show short year if needed? No, sticking to month label mainly.

            t_qs = base_qs.filter(month=m_idx, year=y_idx)
            t_metrics = t_qs.aggregate(
                t_exp=Sum('total_amount'),
                t_lt=Sum('late_fee'),
                t_oth=Sum('other_charges'),
                t_paid=Sum('paid_amount')
            )

            t_exp = (t_metrics['t_exp'] or Decimal('0.00')) + \
                    (t_metrics['t_lt'] or Decimal('0.00')) + \
                    (t_metrics['t_oth'] or Decimal('0.00'))
            t_coll = t_metrics['t_paid'] or Decimal('0.00')

            display_label = f"{month_label} '{year_label}"
            trend_data.append({
                "name": display_label,
                "expected": float(t_exp),
                "collected": float(t_coll)
            })

        # 3. Student Wise List
        student_list = summary_qs.values(
            'student_id',
            student_name=F('student__name'),
            student_code=F('student__student_id')
        ).annotate(
            total=Sum('total_amount') + Sum('late_fee') + Sum('other_charges'),
            paid=Sum('paid_amount'),
            pending=Sum('total_amount') + Sum('late_fee') + Sum('other_charges') - Sum('paid_amount')
        ).annotate(
            status=Case(
                When(paid__gte=F('total'), then=Value('paid')),
                When(paid__gt=0, then=Value('partial')),
                default=Value('unpaid'),
                output_field=CharField(),
            )
        )

        return Response({
            "collected": float(collected_total),
            "total_expected": float(total_expected),
            "pending": float(pending_total),
            "trend_data": trend_data,
            "student_wise_list": list(student_list)
        })


class BankAccountViewSet(viewsets.ModelViewSet):
    """CRUD for bank accounts. Read: any authenticated. Write: manage_fees."""
    serializer_class = BankAccountSerializer

    def get_permissions(self):
        from rest_framework.permissions import SAFE_METHODS
        if self.request.method in SAFE_METHODS:
            return [IsAuthenticated(), DualServiceSubscribed()]
        perm = HasDynamicPermission()
        perm.required_permission = 'manage_fees'
        return [IsAuthenticated(), DualServiceSubscribed(), perm]

    def get_queryset(self):
        user = self.request.user
        if not user.is_authenticated:
            return BankAccount.objects.none()
        if isinstance(user, CentralAuthUser):
            return _central_tenant_qs(BankAccount._base_manager, user)
        if user_is_superadmin(user):
            return BankAccount.objects.all()
        from users.middleware import get_current_organization
        org = get_current_organization()
        if org:
            return BankAccount.objects.filter(organization=org)
        return BankAccount.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if isinstance(user, CentralAuthUser):
            serializer.save(tenant_id=user.tenant_id)
            return
        from users.middleware import get_current_organization
        org = get_current_organization()
        serializer.save(organization=org)

    @action(detail=False, methods=['get'], url_path='active')
    def active(self, request):
        """Return only active bank accounts for current org."""
        qs = self.get_queryset().filter(is_active=True)
        serializer = self.get_serializer(qs, many=True)
        return Response(serializer.data)


class PaymentTransactionViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """
    Student submits payment proof; officer verifies.
    """
    serializer_class = PaymentTransactionSerializer
    permission_classes = [IsAuthenticated, DualServiceSubscribed]
    filterset_fields = ['status', 'student', 'challan']
    ordering_fields = ['submitted_at', 'verified_at', 'amount']
    ordering = ['-submitted_at']

    def get_queryset(self):
        user = self.request.user
        qs = PaymentTransaction.objects.select_related(
            'student', 'challan', 'bank_account', 'verified_by'
        )
        if not user.is_authenticated:
            return PaymentTransaction.objects.none()
        if isinstance(user, CentralAuthUser):
            if user_is_superadmin(user):
                return qs
            if not user.tenant_id:
                return PaymentTransaction.objects.none()
            return qs.filter(Q(challan__tenant_id=user.tenant_id) | Q(challan__tenant_id__isnull=True))
        if user_is_superadmin(user):
            return qs
        from users.middleware import get_current_organization
        org = get_current_organization()
        if org:
            return qs.filter(challan__organization=org)
        return PaymentTransaction.objects.none()

    @action(detail=False, methods=['post'], url_path='submit', permission_classes=[IsAuthenticated, DualServiceSubscribed, DualRequiresPermission('sms.fee.pay')])
    def submit(self, request):
        """Student submits bank transfer proof for a challan.
        DualRequiresPermission('sms.fee.pay') only enforces for central-auth
        tokens (sms.fee.pay exists in the catalog, Phase B3) — legacy tokens
        keep the original IsAuthenticated-only gate, unchanged."""
        challan_id = request.data.get('challan_id')
        bank_account_id = request.data.get('bank_account_id')
        transaction_id = request.data.get('transaction_id', '').strip()
        screenshot = request.FILES.get('screenshot')
        amount = request.data.get('amount')

        if not challan_id or not transaction_id or not amount:
            return Response(
                {'error': 'challan_id, transaction_id, and amount are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            challan = StudentFee.objects.get(id=challan_id)
        except StudentFee.DoesNotExist:
            try:
                challan = StudentFee._base_manager.get(id=challan_id)
            except StudentFee.DoesNotExist:
                return Response({'error': 'Challan not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Block duplicate pending submission
        if PaymentTransaction.objects.filter(challan=challan, status='pending').exists():
            return Response(
                {'error': 'A pending verification already exists for this challan.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        bank_account = None
        if bank_account_id:
            try:
                bank_account = BankAccount.objects.get(id=bank_account_id)
            except BankAccount.DoesNotExist:
                pass

        txn = PaymentTransaction.objects.create(
            challan=challan,
            student=challan.student,
            bank_account=bank_account,
            amount=amount,
            transaction_id=transaction_id,
            screenshot=screenshot,
        )
        serializer = self.get_serializer(txn, context={'request': request})
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='pending')
    def pending(self, request):
        """Officer: list all pending payment transactions."""
        qs = self.get_queryset().filter(status='pending').order_by('-submitted_at')
        serializer = self.get_serializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='verify')
    def verify(self, request, pk=None):
        """Officer: approve or reject a payment transaction."""
        from django.utils import timezone as tz

        try:
            txn = self.get_queryset().get(pk=pk)
        except PaymentTransaction.DoesNotExist:
            return Response({'error': 'Transaction not found.'}, status=status.HTTP_404_NOT_FOUND)

        action_type = request.data.get('action')
        if action_type not in ('approve', 'reject'):
            return Response(
                {'error': "action must be 'approve' or 'reject'."},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = request.user
        if isinstance(user, CentralAuthUser):
            txn.central_verified_by_id = user.id
        else:
            txn.verified_by = user
        txn.verified_at = tz.now()

        if action_type == 'approve':
            txn.status = 'approved'
            txn.save()
            # Mark challan as fully paid
            challan = txn.challan
            challan.paid_amount = challan.total_amount
            challan.save()
        else:
            reject_reason = request.data.get('reject_reason', '').strip()
            if not reject_reason:
                return Response(
                    {'error': 'reject_reason is required when rejecting.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            txn.status = 'rejected'
            txn.reject_reason = reject_reason
            txn.save()

        serializer = self.get_serializer(txn, context={'request': request})
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='by-challan')
    def by_challan(self, request):
        """Return latest payment transaction for a specific challan_id."""
        challan_id = request.query_params.get('challan_id')
        if not challan_id:
            return Response({'error': 'challan_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        qs = PaymentTransaction.objects.filter(
            challan_id=challan_id
        ).select_related('student', 'challan', 'bank_account', 'verified_by').order_by('-submitted_at')
        serializer = self.get_serializer(qs, many=True, context={'request': request})
        return Response(serializer.data)


class CashPaymentView(views.APIView):
    """
    One-click cash payment recording.
    Officer sends: challan_id, student_id, amount
    System adds:   payment_method=cash, received_by=request.user, paid_at=now
    """
    permission_classes = [IsAuthenticated, DualServiceSubscribed, HasDynamicPermission]
    required_permission = 'manage_fees'

    def post(self, request):
        challan_id = request.data.get('challan_id')
        amount = request.data.get('amount')

        if not challan_id or not amount:
            return Response(
                {'success': False, 'error': 'challan_id and amount are required.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            now = timezone.now()
            user = request.user
            is_central = isinstance(user, CentralAuthUser)

            verified_student_fee = None
            if is_central:
                # StudentFee.objects (OrganizationManager) goes empty for
                # central-auth requests (see services.py's record_payment
                # docstring) — pre-fetch + tenant-verify here, same filter
                # views.py's get_querysets use, before the service ever runs.
                verified_student_fee = _central_tenant_qs(StudentFee._base_manager, user).filter(id=int(challan_id)).first()
                if not verified_student_fee:
                    return Response(
                        {'success': False, 'error': 'Challan not found.'},
                        status=status.HTTP_404_NOT_FOUND
                    )

            payment = FeeService.record_payment(
                student_fee_id=int(challan_id),
                amount=amount,
                method='cash',
                received_by=None if is_central else user,
                central_user_id=user.id if is_central else None,
                student_fee=verified_student_fee,
            )
            fee = payment.student_fee
            officer_name = user_display_name(user)

            return Response({
                'success': True,
                'challan_id': fee.id,
                'invoice_number': fee.invoice_number,
                'student': fee.student.name,
                'amount': float(payment.amount),
                'payment_method': 'cash',
                'paid_at': now.strftime('%Y-%m-%d %H:%M'),
                'paid_date': now.strftime('%d %b %Y'),
                'paid_time': now.strftime('%I:%M %p'),
                'received_by': officer_name,
                'receipt_no': payment.receipt_number,
                'challan_status': fee.status,
            }, status=status.HTTP_201_CREATED)

        except StudentFee.DoesNotExist:
            return Response(
                {'success': False, 'error': 'Challan not found.'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            return Response(
                {'success': False, 'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
