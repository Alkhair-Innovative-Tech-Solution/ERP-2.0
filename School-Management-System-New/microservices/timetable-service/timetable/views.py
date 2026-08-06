from rest_framework import viewsets, filters, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, SAFE_METHODS
from timetable_service.dual_auth import IsPrincipal, DualServiceSubscribed, central_tenant_qs
from central_auth.authentication import CentralAuthUser
from django_filters.rest_framework import DjangoFilterBackend
from django.db import IntegrityError

from .models import Subject, ClassTimeTable, TeacherTimeTable, ShiftTiming
from .serializers import (
    SubjectSerializer,
    ClassTimeTableSerializer,
    ClassTimeTableCreateSerializer,
    TeacherTimeTableSerializer,
    TeacherTimeTableCreateSerializer,
    ShiftTimingSerializer
)

# Phase C9: every view in this service already queries via `_base_manager`
# (bypassing OrganizationManager entirely, even on the legacy path — a
# pre-existing pattern unrelated to central-auth, since `_base_manager` has
# no thread-local dependency at all). That means there's no read-side
# "blind, empty queryset" hazard here like every prior phase's `.objects`
# fix — but it ALSO means `_base_manager` has no tenant scoping whatsoever,
# which is fine for legacy (single-tenant-per-deployment trust model) but
# would be a cross-tenant LEAK for central-auth specifically. `_central_tenant_filter`
# layers an explicit tenant_id filter on top of the existing `_base_manager`
# queryset ONLY for a CentralAuthUser request — legacy's already-established
# unscoped-by-org-context `_base_manager` reads are left completely
# unchanged.


def _central_tenant_filter(queryset, user):
    if isinstance(user, CentralAuthUser):
        return central_tenant_qs(queryset, user)
    return queryset


class ShiftTimingViewSet(viewsets.ModelViewSet):
    """
    ViewSet for ShiftTiming CRUD operations
    Only Principals can add/edit/delete timings. Others (e.g., Coordinators) can only view.
    """
    serializer_class = ShiftTimingSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    # campus is NOT in filterset_fields to avoid ModelChoiceFilter validation
    # errors caused by OrganizationManager restricting the choices queryset
    filterset_fields = ['shift', 'timetable_type']
    ordering_fields = ['order', 'start_time']
    ordering = ['order', 'start_time']

    def get_queryset(self):
        # _base_manager bypasses OrganizationManager tenant filter
        # so shift timings are always visible regardless of org context
        queryset = _central_tenant_filter(ShiftTiming._base_manager.get_queryset(), self.request.user)
        campus_id = self.request.query_params.get('campus')
        if campus_id:
            try:
                queryset = queryset.filter(campus_id=int(campus_id))
            except (ValueError, TypeError):
                pass
        return queryset

    def get_permissions(self):
        # Only allow unsafe methods (POST, PUT, PATCH, DELETE) for Principals
        if self.request.method in SAFE_METHODS:
            return [IsAuthenticated(), DualServiceSubscribed()]
        return [IsAuthenticated(), DualServiceSubscribed(), IsPrincipal()]

    @action(detail=False, methods=['post'], url_path='apply-to-classrooms')
    def apply_to_classrooms(self, request):
        """
        Auto-generate ClassTimeTable slots from ShiftTimings for selected classrooms.
        Subject and teacher are left null — assigned manually later.
        """
        from .models import ClassTimeTable
        from django.db import transaction

        campus_id = request.data.get('campus_id')
        shift = request.data.get('shift')
        timetable_type = request.data.get('timetable_type', 'class')
        classroom_ids = request.data.get('classroom_ids', [])
        overwrite = bool(request.data.get('overwrite', False))

        if not campus_id or not shift:
            return Response({'detail': 'campus_id and shift are required'}, status=status.HTTP_400_BAD_REQUEST)

        timings = ShiftTiming._base_manager.filter(
            campus_id=campus_id, shift=shift, timetable_type=timetable_type
        ).order_by('order', 'start_time')

        if not timings.exists():
            return Response({'detail': 'No shift timings found for this campus/shift/type'}, status=status.HTTP_404_NOT_FOUND)

        # Resolve classrooms
        try:
            from classes.models import ClassRoom
            if classroom_ids:
                classrooms = ClassRoom._base_manager.filter(id__in=classroom_ids, grade__campus_id=campus_id)
            else:
                classrooms = ClassRoom._base_manager.filter(grade__campus_id=campus_id, shift=shift)
        except Exception as e:
            return Response({'detail': f'Could not resolve classrooms: {e}'}, status=status.HTTP_400_BAD_REQUEST)

        if not classrooms.exists():
            return Response({'detail': 'No classrooms found'}, status=status.HTTP_404_NOT_FOUND)

        ALL_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

        org = getattr(request.user, 'organization', None)
        if org is None:
            org_id = getattr(request.user, 'org_id', None)
            if org_id:
                try:
                    from users.models import Organization
                    org = Organization._base_manager.filter(pk=org_id).first()
                except Exception:
                    pass
        # Phase C9: no organization concept for a CentralAuthUser (no
        # org_id claim, only tenant_id) — org stays None on that path,
        # same as before; tenant_id is stamped instead.
        tenant_id = request.user.tenant_id if isinstance(request.user, CentralAuthUser) else None

        created = 0
        skipped = 0

        with transaction.atomic():
            for classroom in classrooms:
                for timing in timings:
                    days = [d.lower() for d in timing.days] if timing.days else ALL_DAYS
                    for day in days:
                        if overwrite:
                            # Full overwrite: delete then recreate (clears subject/teacher)
                            ClassTimeTable.all_objects.filter(
                                classroom=classroom, day=day,
                                start_time=timing.start_time
                            ).delete()
                            ClassTimeTable.all_objects.create(
                                classroom=classroom,
                                day=day,
                                start_time=timing.start_time,
                                end_time=timing.end_time,
                                is_break=timing.is_break,
                                organization=org,
                                tenant_id=tenant_id,
                                subject=None,
                                teacher=None,
                            )
                            created += 1
                        else:
                            # Non-overwrite: update structural fields (end_time, is_break)
                            # but preserve any existing subject/teacher assignments.
                            # Also clears stale overlapping slots for this start_time.
                            ClassTimeTable.all_objects.filter(
                                classroom=classroom, day=day,
                                start_time__lt=timing.end_time,
                                end_time__gt=timing.start_time,
                            ).exclude(start_time=timing.start_time).delete()

                            _, was_created = ClassTimeTable.all_objects.update_or_create(
                                classroom=classroom,
                                day=day,
                                start_time=timing.start_time,
                                defaults={
                                    'end_time': timing.end_time,
                                    'is_break': timing.is_break,
                                    'organization': org,
                                    'tenant_id': tenant_id,
                                },
                            )
                            if was_created:
                                created += 1
                            else:
                                skipped += 1

        return Response({
            'created': created,
            'skipped': skipped,
            'classrooms': classrooms.count(),
            'periods_per_day': timings.count(),
        }, status=status.HTTP_201_CREATED)


class SubjectViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Subject CRUD operations
    """
    queryset = Subject.objects.all()
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated, DualServiceSubscribed]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    # campus filtering is handled manually in get_queryset to avoid ModelChoiceFilter
    # validation errors caused by OrganizationManager restricting the choices queryset
    filterset_fields = ['is_active']
    search_fields = ['name', 'code']
    ordering_fields = ['name', 'created_at']
    ordering = ['name']
    
    def get_queryset(self):
        """Filter subjects based on user role and query params.

        LEVEL FILTERING:
        - If ?level=<id> is passed, return ONLY subjects for that level (strict)
        - Never mix subjects from different levels
        """
        # Use _base_manager to bypass OrganizationManager tenant filter
        # (subjects added via admin may have NULL organization)
        queryset = _central_tenant_filter(Subject._base_manager.get_queryset(), self.request.user)
        user = self.request.user
        params = self.request.query_params

        # Allow explicit campus filtering via query params (frontend can pass campus id)
        campus_param = params.get('campus')

        if campus_param:
            queryset = queryset.filter(campus_id=campus_param)
        elif isinstance(user, CentralAuthUser):
            # Phase C9: `user.is_staff`/`.is_superuser` (legacy branch,
            # below) don't exist on CentralAuthUser at all — would
            # AttributeError. Central branch: superadmin sees everything
            # (mirrors is_staff/is_superuser's bypass intent); otherwise
            # resolve campus via a local principal/coordinator/teacher
            # match, same technique as find_teacher/find_principal.
            if not user.is_superadmin:
                from timetable_service.dual_auth import find_principal, find_coordinator, find_teacher
                campus = None
                principal = find_principal(user)
                coordinator = find_coordinator(user)
                teacher = find_teacher(user)
                if principal and getattr(principal, 'campus', None):
                    campus = principal.campus
                elif coordinator and getattr(coordinator, 'campus', None):
                    campus = coordinator.campus
                elif teacher and getattr(teacher, 'current_campus', None):
                    campus = teacher.current_campus
                if campus:
                    queryset = queryset.filter(campus=campus)
        elif not (user.is_staff or user.is_superuser):
            # Scope to the requesting user's campus. Coordinators link to their
            # User via get_for_user (no direct FK), so resolve that first; fall
            # back to a teacher profile for teacher-only users. (The old
            # user.coordinator_profile lookup never matched, so a coordinator got
            # every campus's subjects and the level filter then hid them all.)
            campus = None
            from coordinator.models import Coordinator
            coord = Coordinator.get_for_user(user)
            if coord and coord.campus:
                campus = coord.campus
            elif hasattr(user, 'teacher_profile') and getattr(user.teacher_profile, 'current_campus', None):
                campus = user.teacher_profile.current_campus
            if campus:
                queryset = queryset.filter(campus=campus)

        # Strict level filtering — never mix subjects from different levels
        level_param = params.get('level')
        if level_param:
            queryset = queryset.filter(level_id=level_param)

        return queryset.select_related('campus', 'level')

    def destroy(self, request, *args, **kwargs):
        """Delete a Subject and report how many related timetable periods were removed.

        The database already uses CASCADE on the timetable foreign keys, so
        deleting the Subject will remove related ClassTimeTable and
        TeacherTimeTable rows. This method counts them before deletion and
        returns those counts in the response for UI feedback.
        """
        instance = self.get_object()

        # Count related periods before deletion
        class_periods_count = instance.class_periods.count()
        teacher_periods_count = instance.teacher_periods.count()

        # Perform deletion
        self.perform_destroy(instance)

        return Response(
            {
                'deleted': True,
                'subject_id': kwargs.get('pk') or getattr(instance, 'pk', None),
                'class_periods_deleted': class_periods_count,
                'teacher_periods_deleted': teacher_periods_count,
            },
            status=status.HTTP_200_OK
        )


class ClassTimeTableViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Class Time Table CRUD operations
    """
    queryset = ClassTimeTable.objects.all()
    permission_classes = [IsAuthenticated, DualServiceSubscribed]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['classroom', 'teacher', 'subject', 'day', 'is_break']
    search_fields = ['teacher__full_name', 'subject__name', 'classroom__code']
    ordering_fields = ['day', 'start_time']
    ordering = ['day', 'start_time']
    
    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return ClassTimeTableCreateSerializer
        return ClassTimeTableSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            instance = serializer.save()
        except IntegrityError:
            # Slot already exists for this classroom+day+start_time — update it instead
            vd = serializer.validated_data
            instance = ClassTimeTable.all_objects.filter(
                classroom=vd['classroom'],
                day=vd['day'],
                start_time=vd['start_time'],
            ).first()
            if instance is None:
                raise
            for field in ('subject', 'teacher', 'end_time', 'is_break', 'notes'):
                if field in vd:
                    setattr(instance, field, vd[field])
            instance.save()
        out = ClassTimeTableSerializer(instance, context={'request': request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        """Filter periods based on query parameters"""
        # _base_manager bypasses OrganizationManager tenant filter
        queryset = _central_tenant_filter(ClassTimeTable._base_manager.get_queryset(), self.request.user)
        
        # Filter by grade
        grade = self.request.query_params.get('grade', None)
        if grade:
            queryset = queryset.filter(classroom__grade__name=grade)
        
        # Filter by section
        section = self.request.query_params.get('section', None)
        if section:
            queryset = queryset.filter(classroom__section=section)
        
        # Filter by level
        level = self.request.query_params.get('level', None)
        if level:
            queryset = queryset.filter(classroom__grade__level__id=level)
        
        return queryset.select_related(
            'classroom', 'classroom__grade', 'classroom__grade__level',
            'teacher', 'subject', 'created_by'
        )
    
    @action(detail=False, methods=['get'])
    def by_classroom(self, request):
        """Get all periods for a specific classroom"""
        classroom_id = request.query_params.get('classroom_id')
        if not classroom_id:
            return Response(
                {'error': 'classroom_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        periods = self.get_queryset().filter(classroom_id=classroom_id)
        serializer = self.get_serializer(periods, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Create multiple periods at once"""
        periods_data = request.data.get('periods', [])
        
        if not periods_data:
            return Response(
                {'error': 'No periods data provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created_periods = []
        errors = []
        
        for idx, period_data in enumerate(periods_data):
            serializer = ClassTimeTableCreateSerializer(
                data=period_data,
                context={'request': request}
            )
            
            if serializer.is_valid():
                try:
                    period = serializer.save()
                    created_periods.append(period)
                except Exception as e:
                    errors.append({'index': idx, 'error': str(e)})
            else:
                errors.append({'index': idx, 'errors': serializer.errors})
        
        response_serializer = ClassTimeTableSerializer(created_periods, many=True)
        
        return Response({
            'created': len(created_periods),
            'failed': len(errors),
            'periods': response_serializer.data,
            'errors': errors
        }, status=status.HTTP_201_CREATED if created_periods else status.HTTP_400_BAD_REQUEST)


class TeacherTimeTableViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Teacher Time Table CRUD operations
    """
    queryset = TeacherTimeTable.objects.all()
    permission_classes = [IsAuthenticated, DualServiceSubscribed]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['teacher', 'subject', 'classroom', 'day', 'is_break']
    search_fields = ['teacher__full_name', 'teacher__employee_code', 'subject__name']
    ordering_fields = ['day', 'start_time']
    ordering = ['day', 'start_time']
    
    def get_serializer_class(self):
        if self.action == 'create':
            return TeacherTimeTableCreateSerializer
        return TeacherTimeTableSerializer
    
    def get_queryset(self):
        """Filter periods based on query parameters"""
        # _base_manager bypasses OrganizationManager tenant filter
        queryset = _central_tenant_filter(TeacherTimeTable._base_manager.get_queryset(), self.request.user)
        
        # Filter by teacher
        teacher_id = self.request.query_params.get('teacher_id', None)
        if teacher_id:
            queryset = queryset.filter(teacher_id=teacher_id)
        
        return queryset.select_related(
            'teacher', 'teacher__current_campus',
            'classroom', 'classroom__grade',
            'subject', 'created_by'
        )
    
    @action(detail=False, methods=['get'])
    def by_teacher(self, request):
        """Get all periods for a specific teacher"""
        teacher_id = request.query_params.get('teacher_id')
        if not teacher_id:
            return Response(
                {'error': 'teacher_id parameter is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        periods = self.get_queryset().filter(teacher_id=teacher_id)
        serializer = self.get_serializer(periods, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['get'])
    def my_timetable(self, request):
        """Get timetable for the logged-in teacher"""
        user = request.user
        
        if not hasattr(user, 'teacher_profile'):
            return Response(
                {'error': 'User is not a teacher'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        teacher = user.teacher_profile
        periods = self.get_queryset().filter(teacher=teacher)
        serializer = self.get_serializer(periods, many=True)
        return Response(serializer.data)
    
    @action(detail=False, methods=['post'])
    def bulk_create(self, request):
        """Create multiple periods at once"""
        periods_data = request.data.get('periods', [])
        
        if not periods_data:
            return Response(
                {'error': 'No periods data provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        created_periods = []
        errors = []
        
        for idx, period_data in enumerate(periods_data):
            serializer = TeacherTimeTableCreateSerializer(
                data=period_data,
                context={'request': request}
            )
            
            if serializer.is_valid():
                try:
                    period = serializer.save()
                    created_periods.append(period)
                except Exception as e:
                    errors.append({'index': idx, 'error': str(e)})
            else:
                errors.append({'index': idx, 'errors': serializer.errors})
        
        response_serializer = TeacherTimeTableSerializer(created_periods, many=True)
        
        return Response({
            'created': len(created_periods),
            'failed': len(errors),
            'periods': response_serializer.data,
            'errors': errors
        }, status=status.HTTP_201_CREATED if created_periods else status.HTTP_400_BAD_REQUEST)
