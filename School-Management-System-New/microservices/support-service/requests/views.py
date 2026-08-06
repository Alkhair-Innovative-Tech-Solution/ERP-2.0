from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Q, Count
from django.utils import timezone

from .models import RequestComplaint, RequestComment, RequestStatusHistory
from .serializers import (
    RequestComplaintCreateSerializer,
    RequestComplaintListSerializer,
    RequestComplaintDetailSerializer,
    RequestComplaintUpdateSerializer,
    RequestCommentCreateSerializer,
    RequestCommentSerializer,
    RequestForwardToPrincipalSerializer,
    RequestApprovalSerializer,
    RequestRejectionSerializer,
    RequestTeacherConfirmationSerializer
)
from notifications.services import create_notification
from django.contrib.auth import get_user_model
from central_auth.authentication import CentralAuthUser
from support_service.dual_auth import (
    DualServiceSubscribed, DualRequiresPermission,
    user_is_teacher, user_is_coordinator, user_is_principal, user_is_superuser,
    find_teacher, find_principal, get_coordinator, find_principal_for_campus,
    teacher_assigned_coordinators, get_org_and_tenant, central_tenant_qs,
)

# Phase C6 endpoint -> sms.* permission map (see
# docs/PHASE_C6_SUPPORT_SERVICE_RESULT.md). Central auth's catalog
# (permissions.sms_catalog.SMS_PERMISSIONS, Phase B3) has no support/
# complaint-shaped permission at all — these are referenced but NOT added
# to the catalog from this support-service-scoped task, fail-closed: every
# non-superadmin central-auth token 403s on every endpoint in this service
# today.
SUPPORT_VIEW_PERM = 'sms.support.view'
SUPPORT_CREATE_PERM = 'sms.support.create'
SUPPORT_MANAGE_PERM = 'sms.support.manage'


def _get_teacher_or_404(user):
    """Dual-safe replacement for the original `Teacher.objects.get(email=user.email)`.
    Raises Teacher.DoesNotExist on no match — same exception type as the
    original call, so the existing outer `except Exception` blocks in this
    file continue to convert it into a 400 unchanged."""
    from teachers.models import Teacher
    teacher = find_teacher(user)
    if not teacher:
        raise Teacher.DoesNotExist()
    return teacher


def _get_principal_or_404(user):
    """Dual-safe replacement for the original `Principal.objects.get(employee_code=user.username)`.
    Raises Principal.DoesNotExist on no match, matching every existing
    call site's own `try/except Principal.DoesNotExist:` unchanged."""
    from principals.models import Principal
    principal = find_principal(user)
    if not principal:
        raise Principal.DoesNotExist()
    return principal


def _result_base(user):
    """Dual-safe base queryset for RequestComplaint — RequestComplaint.objects
    is OrganizationManager-backed, empty for a central-auth request (see
    support_service/dual_auth.py's module docstring)."""
    if isinstance(user, CentralAuthUser):
        return central_tenant_qs(RequestComplaint.all_objects.all(), user)
    return RequestComplaint.objects.all()


# Helper function to get User object for a Coordinator
def get_coordinator_user(coordinator):
    """Find and return the User object associated with a Coordinator."""
    if not coordinator:
        return None
    
    User = get_user_model()
    coordinator_user = None
    
    # Try finding user by employee_code (username) or email
    if coordinator.employee_code:
        coordinator_user = User.objects.filter(username=coordinator.employee_code).first()
    
    if not coordinator_user and coordinator.email:
        coordinator_user = User.objects.filter(email=coordinator.email).first()
    
    return coordinator_user

@api_view(['POST'])
@permission_classes([IsAuthenticated, DualServiceSubscribed, DualRequiresPermission(SUPPORT_CREATE_PERM)])
def create_request(request):
    """Create a new request/complaint"""
    try:
        serializer = RequestComplaintCreateSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            request_obj = serializer.save()
            
            # Create initial status history
            RequestStatusHistory.objects.create(
                request=request_obj,
                new_status='submitted',
                changed_by='teacher',
                notes='Request submitted'
            )
            
            # Send notification to coordinator
            coordinator_user = get_coordinator_user(request_obj.coordinator)
            if coordinator_user:
                create_notification(
                    recipient=coordinator_user,
                    actor=request.user,
                    verb='submitted a new request',
                    target_text=f'{request_obj.get_category_display()}: {request_obj.subject}',
                    data={
                        'request_id': request_obj.id,
                        'category': request_obj.category,
                        'priority': request_obj.priority,
                        'type': 'request_created'
                    }
                )
            
            return Response({
                'message': 'Request created successfully',
                'request_id': request_obj.id
            }, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated, DualServiceSubscribed, DualRequiresPermission(SUPPORT_VIEW_PERM)])
def get_my_requests(request):
    """Get teacher's own requests"""
    try:
        user = request.user
        if not user_is_teacher(user):
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get teacher's requests
        from teachers.models import Teacher
        teacher = _get_teacher_or_404(user)
        requests = _result_base(user).filter(teacher=teacher)
        
        serializer = RequestComplaintListSerializer(requests, many=True)
        return Response(serializer.data)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated, DualServiceSubscribed, DualRequiresPermission(SUPPORT_VIEW_PERM)])
def get_request_detail(request, request_id):
    """Get detailed view of a request"""
    try:
        user = request.user
        request_obj = get_object_or_404(_result_base(user), id=request_id)
        
        # Check permissions
        if user_is_teacher(user):
            from teachers.models import Teacher
            teacher = _get_teacher_or_404(user)
            if request_obj.teacher != teacher:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        elif user_is_coordinator(user):
            from coordinator.models import Coordinator
            coordinator = get_coordinator(user)
            if not coordinator or request_obj.coordinator != coordinator:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        elif not user_is_superuser(user):
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = RequestComplaintDetailSerializer(request_obj)
        return Response(serializer.data)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated, DualServiceSubscribed, DualRequiresPermission(SUPPORT_VIEW_PERM)])
def get_coordinator_requests(request):
    """Get requests assigned to coordinator"""
    try:
        user = request.user
        if not user_is_coordinator(user):
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        from coordinator.models import Coordinator
        coordinator = get_coordinator(user)
        if not coordinator:
            # Coordinator not in local DB (cross-service sync pending) — return empty
            return Response([])
        requests = _result_base(user).filter(coordinator=coordinator)
        
        # Get filter parameters
        status_filter = request.GET.get('status')
        priority_filter = request.GET.get('priority')
        category_filter = request.GET.get('category')
        
        if status_filter:
            requests = requests.filter(status=status_filter)
        if priority_filter:
            requests = requests.filter(priority=priority_filter)
        if category_filter:
            requests = requests.filter(category=category_filter)
        
        serializer = RequestComplaintListSerializer(requests, many=True)
        return Response(serializer.data)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['PUT'])
@permission_classes([IsAuthenticated, DualServiceSubscribed, DualRequiresPermission(SUPPORT_MANAGE_PERM)])
def update_request_status(request, request_id):
    """Update request status/priority (coordinator only)"""
    try:
        user = request.user
        if not user_is_coordinator(user):
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        from coordinator.models import Coordinator
        coordinator = get_coordinator(user)
        if not coordinator:
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        request_obj = get_object_or_404(_result_base(user), id=request_id, coordinator=coordinator)
        
        serializer = RequestComplaintUpdateSerializer(request_obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response({'message': 'Request updated successfully'})
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated, DualServiceSubscribed, DualRequiresPermission(SUPPORT_CREATE_PERM)])
def add_comment(request, request_id):
    """Add comment to request"""
    try:
        user = request.user
        request_obj = get_object_or_404(_result_base(user), id=request_id)
        
        # Check permissions
        if user_is_teacher(user):
            from teachers.models import Teacher
            teacher = _get_teacher_or_404(user)
            if request_obj.teacher != teacher:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        elif user_is_coordinator(user):
            from coordinator.models import Coordinator
            coordinator = get_coordinator(user)
            if not coordinator or request_obj.coordinator != coordinator:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        elif not user_is_superuser(user):
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = RequestCommentCreateSerializer(
            data=request.data, 
            context={'request': request, 'request_obj': request_obj}
        )
        if serializer.is_valid():
            comment = serializer.save()
            return Response({
                'message': 'Comment added successfully',
                'comment_id': comment.id
            }, status=status.HTTP_201_CREATED)
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated, DualServiceSubscribed, DualRequiresPermission(SUPPORT_VIEW_PERM)])
def get_coordinator_dashboard_stats(request):
    """Get coordinator dashboard statistics"""
    try:
        user = request.user
        if not user_is_coordinator(user):
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        from coordinator.models import Coordinator
        coordinator = get_coordinator(user)
        if not coordinator:
            # Coordinator not in local DB — return zero stats
            return Response({
                'total_requests': 0, 'submitted': 0, 'under_review': 0,
                'in_progress': 0, 'waiting': 0, 'pending_principal': 0,
                'approved': 0, 'pending_confirmation': 0, 'resolved': 0, 'rejected': 0,
            })

        requests = _result_base(user).filter(coordinator=coordinator)

        stats = {
            'total_requests': requests.count(),
            'submitted': requests.filter(status='submitted').count(),
            'under_review': requests.filter(status='under_review').count(),
            'in_progress': requests.filter(status='in_progress').count(),
            'waiting': requests.filter(status='waiting').count(),
            'pending_principal': requests.filter(status='pending_principal').count(),
            'approved': requests.filter(status='approved').count(),
            'pending_confirmation': requests.filter(status='pending_confirmation').count(),
            'resolved': requests.filter(status='resolved').count(),
            'rejected': requests.filter(status='rejected').count(),
        }
        
        return Response(stats)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated, DualServiceSubscribed, DualRequiresPermission(SUPPORT_MANAGE_PERM)])
def forward_to_principal(request, request_id):
    """Forward request to principal (coordinator only)"""
    try:
        user = request.user
        if not user_is_coordinator(user):
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        from coordinator.models import Coordinator
        coordinator = get_coordinator(user)
        if not coordinator:
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        request_obj = get_object_or_404(_result_base(user), id=request_id, coordinator=coordinator)
        
        serializer = RequestForwardToPrincipalSerializer(
            data=request.data,
            context={'request_obj': request_obj}
        )
        
        if serializer.is_valid():
            # Get principal for the coordinator's campus. Dual-safe (see
            # support_service/dual_auth.py's find_principal_for_campus —
            # Principal.objects is OrganizationManager-backed, empty for a
            # central-auth request).
            principal = find_principal_for_campus(coordinator.campus, user)
            if not principal:
                return Response({'error': 'No active principal found for this campus'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Update request
            old_status = request_obj.status
            request_obj.principal = principal
            request_obj.forwarding_note = serializer.validated_data['forwarding_note']
            request_obj.status = 'pending_principal'
            request_obj.requires_principal_approval = True
            request_obj.save()
            
            # Create status history
            RequestStatusHistory.objects.create(
                request=request_obj,
                old_status=old_status,
                new_status='pending_principal',
                changed_by='coordinator',
                notes=f"Forwarded to principal: {serializer.validated_data['forwarding_note']}"
            )
            
            # Send notification to principal
            if principal.user:
                create_notification(
                    recipient=principal.user,
                    actor=user,
                    verb='forwarded a request for your approval',
                    target_text=f'{request_obj.get_category_display()}: {request_obj.subject}',
                    data={
                        'request_id': request_obj.id,
                        'category': request_obj.category,
                        'priority': request_obj.priority,
                        'type': 'request_forwarded_to_principal'
                    }
                )
            
            # Send notification to teacher
            if request_obj.teacher.user:
                create_notification(
                    recipient=request_obj.teacher.user,
                    actor=user,
                    verb='forwarded your request to principal for approval',
                    target_text=request_obj.subject,
                    data={
                        'request_id': request_obj.id,
                        'type': 'request_status_changed'
                    }
                )
            
            return Response({'message': 'Request forwarded to principal successfully'})
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated, DualServiceSubscribed, DualRequiresPermission(SUPPORT_MANAGE_PERM)])
def approve_request(request, request_id):
    """Approve request (coordinator or principal)"""
    try:
        user = request.user
        request_obj = get_object_or_404(_result_base(user), id=request_id)
        
        # Check permissions
        approved_by_role = None
        if user_is_coordinator(user):
            from coordinator.models import Coordinator
            coordinator = get_coordinator(user)
            if not coordinator or request_obj.coordinator != coordinator:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            approved_by_role = 'coordinator'
        elif user_is_principal(user):
            from principals.models import Principal
            try:
                principal = _get_principal_or_404(user)
                if request_obj.principal != principal:
                    return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
                approved_by_role = 'principal'
            except Principal.DoesNotExist:
                return Response({'error': 'Principal profile not found'}, status=status.HTTP_403_FORBIDDEN)
        else:
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = RequestApprovalSerializer(
            data=request.data,
            context={'request_obj': request_obj}
        )
        
        if serializer.is_valid():
            old_status = request_obj.status
            
            # Update request
            if serializer.validated_data.get('resolution_notes'):
                request_obj.resolution_notes = serializer.validated_data['resolution_notes']
            
            request_obj.approved_by = approved_by_role
            
            # Set status based on send_for_confirmation flag
            if serializer.validated_data.get('send_for_confirmation', True):
                request_obj.status = 'pending_confirmation'
            else:
                request_obj.status = 'approved'
            
            request_obj.save()
            
            # Create status history
            RequestStatusHistory.objects.create(
                request=request_obj,
                old_status=old_status,
                new_status=request_obj.status,
                changed_by=approved_by_role,
                notes=f"Request approved by {approved_by_role}"
            )
            
            # Send notification to teacher
            if request_obj.teacher.user:
                create_notification(
                    recipient=request_obj.teacher.user,
                    actor=user,
                    verb='approved your request',
                    target_text=request_obj.subject,
                    data={
                        'request_id': request_obj.id,
                        'approved_by': approved_by_role,
                        'type': 'request_approved'
                    }
                )
            
            # If approved by principal, also notify coordinator
            if approved_by_role == 'principal':
                coordinator_user = get_coordinator_user(request_obj.coordinator)
                if coordinator_user:
                    create_notification(
                        recipient=coordinator_user,
                        actor=user,
                        verb='approved the forwarded request',
                        target_text=request_obj.subject,
                        data={
                            'request_id': request_obj.id,
                            'type': 'request_approved_by_principal'
                        }
                    )
            
            return Response({'message': 'Request approved successfully'})
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated, DualServiceSubscribed, DualRequiresPermission(SUPPORT_MANAGE_PERM)])
def reject_request(request, request_id):
    """Reject request (coordinator or principal)"""
    try:
        user = request.user
        request_obj = get_object_or_404(_result_base(user), id=request_id)
        
        # Check permissions
        rejected_by_role = None
        if user_is_coordinator(user):
            from coordinator.models import Coordinator
            coordinator = get_coordinator(user)
            if not coordinator or request_obj.coordinator != coordinator:
                return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
            rejected_by_role = 'coordinator'
        elif user_is_principal(user):
            from principals.models import Principal
            try:
                principal = _get_principal_or_404(user)
                if request_obj.principal != principal:
                    return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
                rejected_by_role = 'principal'
            except Principal.DoesNotExist:
                return Response({'error': 'Principal profile not found'}, status=status.HTTP_403_FORBIDDEN)
        else:
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = RequestRejectionSerializer(
            data=request.data,
            context={'request_obj': request_obj}
        )
        
        if serializer.is_valid():
            old_status = request_obj.status
            
            # Update request
            request_obj.rejection_reason = serializer.validated_data['rejection_reason']
            request_obj.status = 'rejected'
            request_obj.save()
            
            # Create status history
            RequestStatusHistory.objects.create(
                request=request_obj,
                old_status=old_status,
                new_status='rejected',
                changed_by=rejected_by_role,
                notes=f"Rejected: {serializer.validated_data['rejection_reason']}"
            )
            
            # Send notification to teacher
            if request_obj.teacher.user:
                create_notification(
                    recipient=request_obj.teacher.user,
                    actor=user,
                    verb='rejected your request',
                    target_text=request_obj.subject,
                    data={
                        'request_id': request_obj.id,
                        'rejection_reason': serializer.validated_data['rejection_reason'],
                        'rejected_by': rejected_by_role,
                        'type': 'request_rejected'
                    }
                )
            
            # If rejected by principal, also notify coordinator
            if rejected_by_role == 'principal':
                coordinator_user = get_coordinator_user(request_obj.coordinator)
                if coordinator_user:
                    create_notification(
                        recipient=coordinator_user,
                        actor=user,
                        verb='rejected the forwarded request',
                        target_text=request_obj.subject,
                        data={
                            'request_id': request_obj.id,
                            'rejection_reason': serializer.validated_data['rejection_reason'],
                            'type': 'request_rejected_by_principal'
                        }
                    )
            
            return Response({'message': 'Request rejected successfully'})
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
@permission_classes([IsAuthenticated, DualServiceSubscribed, DualRequiresPermission(SUPPORT_MANAGE_PERM)])
def confirm_completion(request, request_id):
    """Teacher confirms request completion"""
    try:
        user = request.user
        if not user_is_teacher(user):
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        from teachers.models import Teacher
        teacher = _get_teacher_or_404(user)
        request_obj = get_object_or_404(_result_base(user), id=request_id, teacher=teacher)
        
        serializer = RequestTeacherConfirmationSerializer(
            data=request.data,
            context={'request_obj': request_obj}
        )
        
        if serializer.is_valid():
            old_status = request_obj.status
            
            # Update request
            request_obj.teacher_confirmed = True
            if serializer.validated_data.get('teacher_satisfaction_note'):
                request_obj.teacher_satisfaction_note = serializer.validated_data['teacher_satisfaction_note']
            request_obj.save()  # This will auto-set status to resolved
            
            # Create status history
            RequestStatusHistory.objects.create(
                request=request_obj,
                old_status=old_status,
                new_status='resolved',
                changed_by='teacher',
                notes='Teacher confirmed completion'
            )
            
            # Send notification to coordinator
            coordinator_user = get_coordinator_user(request_obj.coordinator)
            if coordinator_user:
                create_notification(
                    recipient=coordinator_user,
                    actor=user,
                    verb='confirmed completion of request',
                    target_text=request_obj.subject,
                    data={
                        'request_id': request_obj.id,
                        'type': 'request_confirmed'
                    }
                )
            
            return Response({'message': 'Request confirmed and resolved successfully'})
        else:
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
@permission_classes([IsAuthenticated, DualServiceSubscribed, DualRequiresPermission(SUPPORT_VIEW_PERM)])
def get_principal_requests(request):
    """Get requests forwarded to principal"""
    try:
        user = request.user
        if not user_is_principal(user):
            return Response({'error': 'Access denied'}, status=status.HTTP_403_FORBIDDEN)
        
        from principals.models import Principal
        try:
            principal = _get_principal_or_404(user)
        except Principal.DoesNotExist:
            return Response({'error': 'Principal profile not found'}, status=status.HTTP_403_FORBIDDEN)
        
        requests = _result_base(user).filter(principal=principal)
        
        # Get filter parameters
        status_filter = request.GET.get('status')
        priority_filter = request.GET.get('priority')
        category_filter = request.GET.get('category')
        
        if status_filter:
            requests = requests.filter(status=status_filter)
        if priority_filter:
            requests = requests.filter(priority=priority_filter)
        if category_filter:
            requests = requests.filter(category=category_filter)
        
        serializer = RequestComplaintListSerializer(requests, many=True)
        return Response(serializer.data)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
