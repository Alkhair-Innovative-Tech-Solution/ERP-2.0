"""
API views for notifications
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404

import logging
from .models import NotificationBroadcast, NotificationDelivery

logger = logging.getLogger(__name__)
from .serializers import (
    NotificationBroadcastSerializer,
    NotificationBroadcastListSerializer,
    NotificationDeliverySerializer,
    NotificationMarkReadSerializer,
)
from .permissions import IsBroadcaster
from .services import NotificationService


class NotificationBroadcastViewSet(viewsets.ModelViewSet):
    """CRUD for notification broadcasts (admin/coordinator/teacher)"""

    queryset = NotificationBroadcast.objects.all().order_by('-created_at')
    serializer_class = NotificationBroadcastSerializer
    permission_classes = [IsAuthenticated, IsBroadcaster]
    service_class = NotificationService

    def get_serializer_class(self):
        if self.action == 'list':
            return NotificationBroadcastListSerializer
        return NotificationBroadcastSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # 🔹 Multi-Tenancy: Filter by organization_id
        org_id = self.request.headers.get('X-Org-Id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        
        creator_id = self.request.query_params.get('created_by')
        audience_type = self.request.query_params.get('audience_type')
        if creator_id:
            queryset = queryset.filter(created_by_id=creator_id)
        if audience_type:
            queryset = queryset.filter(audience_type=audience_type)
        return queryset

    def create(self, request, *args, **kwargs):
        logger.info("NotificationBroadcastViewSet.create: user=%s, data=%s", request.user, request.data)
        
        # 🔹 Multi-Tenancy: Set organization_id from request headers
        org_id = request.headers.get('X-Org-Id')
        if org_id:
            request.data._mutable = True
            request.data['organization_id'] = org_id
            request.data._mutable = False
        
        service = self.service_class()
        try:
            broadcast = service.create_broadcast(request.user, request.data)
            serializer = self.get_serializer(broadcast)
            headers = self.get_success_headers(serializer.data)
            return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)
        except Exception as exc:
            logger.error("Error creating broadcast: %s", exc, exc_info=True)
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)


class NotificationDeliveryViewSet(viewsets.ReadOnlyModelViewSet):
    """Per-user notifications"""

    serializer_class = NotificationDeliverySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user_id = getattr(self.request.user, 'id', None)
        if not user_id:
            return NotificationDelivery.objects.none()
        
        # Ensure user_id is a valid UUID to avoid DB errors
        try:
            from uuid import UUID
            if isinstance(user_id, str):
                user_id = UUID(user_id)
            elif not isinstance(user_id, UUID):
                # If it's not a string and not a UUID object, it's invalid
                return NotificationDelivery.objects.none()
        except (ValueError, TypeError):
            logger.error("Invalid user_id in token: %s", user_id)
            return NotificationDelivery.objects.none()

        queryset = NotificationDelivery.objects.filter(recipient_id=user_id).select_related('broadcast')
        
        # 🔹 Multi-Tenancy: Filter by organization_id
        org_id = self.request.headers.get('X-Org-Id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        
        is_read = self.request.query_params.get('is_read')
        if is_read in {'true', 'false', '1', '0'}:
            queryset = queryset.filter(is_read=is_read in {'true', '1'})
        return queryset.order_by('-delivered_at')

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        delivery = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = NotificationMarkReadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = NotificationService()
        service.mark_delivery_read(delivery, serializer.validated_data['is_read'])
        return Response(NotificationDeliverySerializer(delivery).data)


# -----------------------------------------------------------
# EMAIL NOTIFICATION ENDPOINTS
# -----------------------------------------------------------

from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from .email_service import email_service


class EmailNotificationViewSet(NotificationBroadcastViewSet):
    """Extended viewset with email notification capabilities."""
    
    @action(detail=False, methods=['post'], url_path='send-email')
    def send_email(self, request):
        """Send a direct email notification."""
        email_type = request.data.get('email_type', '')
        recipient_email = request.data.get('recipient_email', '')
        recipient_name = request.data.get('recipient_name', '')
        
        if not recipient_email:
            return Response(
                {"error": "recipient_email is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Map email_type to the appropriate service method
        email_methods = {
            'welcome': lambda: email_service.send_welcome_email(
                recipient_email, recipient_name,
                request.data.get('course_name', 'Course')
            ),
            'grade': lambda: email_service.send_grade_notification(
                recipient_email, recipient_name,
                request.data.get('assignment_title', 'Assignment'),
                request.data.get('grade', 0),
                request.data.get('total_marks', 100),
                request.data.get('feedback', '')
            ),
            'assignment': lambda: email_service.send_assignment_notification(
                recipient_email, recipient_name,
                request.data.get('assignment_title', 'Assignment'),
                request.data.get('course_name', 'Course'),
                request.data.get('due_date', 'N/A')
            ),
            'certificate': lambda: email_service.send_certificate_notification(
                recipient_email, recipient_name,
                request.data.get('course_name', 'Course'),
                request.data.get('certificate_number', '')
            ),
            'password_reset': lambda: email_service.send_password_reset_email(
                recipient_email, recipient_name,
                request.data.get('reset_link', '')
            ),
        }
        
        if email_type not in email_methods:
            return Response(
                {"error": f"Unknown email type: {email_type}. Valid types: {list(email_methods.keys())}"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            success = email_methods[email_type]()
            if success:
                # Log the email
                from .models import EmailLog
                EmailLog.objects.create(
                    organization_id=request.headers.get('X-Org-Id'),
                    recipient_email=recipient_email,
                    recipient_id=request.data.get('recipient_id'),
                    subject=f"Email: {email_type}",
                    email_type=email_type,
                    status='sent',
                )
                return Response({"message": "Email sent successfully", "status": "sent"})
            else:
                return Response(
                    {"error": "Failed to send email"},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
