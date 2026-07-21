"""
Business logic for notifications
"""
import logging
import os
from typing import Iterable, List, Dict, Any, Set
from django.db import transaction
from django.utils import timezone

from .models import (
    NotificationBroadcast,
    NotificationDelivery,
    AudienceType,
    RecipientRole,
    DeliveryStatus,
)
from .serializers import NotificationCreateSerializer
from shared.common.service_client import ServiceClient

logger = logging.getLogger(__name__)


class NotificationService:
    """Encapsulates notification broadcast/delivery logic"""

    def __init__(self):
        self.auth_client = ServiceClient(
            os.getenv('AUTH_SERVICE_URL', 'http://auth-service:8001'),
            timeout=5,
            max_retries=1,
        )
        self.course_client = ServiceClient(
            os.getenv('COURSE_SERVICE_URL', 'http://course-service:8002'),
            timeout=5,
            max_retries=1,
        )

    def create_broadcast(self, user, data: Dict[str, Any]) -> NotificationBroadcast:
        """
        Create a broadcast and corresponding deliveries.
        """
        logger.info("Creating broadcast with data: %s", data)
        serializer = NotificationCreateSerializer(data=data)
        if not serializer.is_valid():
            logger.error("Serializer validation failed: %s", serializer.errors)
            serializer.is_valid(raise_exception=True)

        payload = serializer.validated_data
        audience_type = payload['audience_type']

        try:
            self._validate_permissions(user, payload)
            recipients = self._resolve_recipients(payload, user)
        except Exception as e:
            logger.error("Error in recipient resolution: %s", e)
            raise

        if not recipients:
            logger.error("No recipients resolved for payload: %s", payload)
            raise ValueError('No recipients were resolved for this broadcast')

        with transaction.atomic():
            broadcast = NotificationBroadcast.objects.create(
                title=payload['title'],
                message=payload['message'],
                audience_type=audience_type,
                target_role=payload.get('target_role', RecipientRole.ALL),
                course_id=payload.get('course_id'),
                scheduled_class_id=payload.get('scheduled_class_id'),
                created_by_id=getattr(user, 'id', None),
                created_by_role=getattr(user, 'role', RecipientRole.ADMIN).upper(),
                metadata=payload.get('metadata', {}),
                batch_id=payload.get('batch_id'),
            )

            deliveries = [
                NotificationDelivery(
                    broadcast=broadcast,
                    recipient_id=recipient['id'],
                    recipient_role=recipient['role'],
                    status=DeliveryStatus.SENT,
                    metadata=recipient.get('metadata', {}),
                )
                for recipient in recipients
            ]
            NotificationDelivery.objects.bulk_create(deliveries, batch_size=500)
            logger.info(
                "Created broadcast '%s' for audience %s with %s recipients",
                broadcast.id,
                broadcast.audience_type,
                len(deliveries),
            )
            return broadcast

    def mark_delivery_read(self, delivery: NotificationDelivery, state: bool) -> NotificationDelivery:
        """Mark delivery as read/unread"""
        delivery.is_read = state
        delivery.read_at = timezone.now() if state else None
        delivery.save(update_fields=['is_read', 'read_at'])
        return delivery

    def _validate_permissions(self, user, payload: Dict[str, Any]):
        role = (getattr(user, 'role', '') or '').upper()
        audience = payload['audience_type']

        if role == 'TEACHER' and audience in {AudienceType.ALL, AudienceType.ROLE}:
            raise ValueError('Teachers can only broadcast to COURSE, CLASS, or CUSTOM audiences.')
        if role == 'TEACHER' and audience == AudienceType.CUSTOM:
            # Require explicit recipient IDs for teachers using CUSTOM
            if not payload.get('recipient_ids'):
                raise ValueError('Teachers must supply recipient_ids when using CUSTOM audience.')

    def _resolve_recipients(self, payload: Dict[str, Any], user) -> List[Dict[str, Any]]:
        audience = payload['audience_type']
        target_role = (payload.get('target_role') or RecipientRole.ALL).upper()

        if audience == AudienceType.ALL:
            return self._fetch_users_by_roles([RecipientRole.STUDENT, RecipientRole.TEACHER, RecipientRole.COORDINATOR, RecipientRole.ADMIN])
        if audience == AudienceType.ROLE:
            if target_role == RecipientRole.ALL:
                raise ValueError('target_role must be specified when audience_type is ROLE.')
            return self._fetch_users_by_roles([target_role])
        if audience == AudienceType.COURSE:
            return self._recipients_for_course(payload, target_role, user)
        if audience == AudienceType.CLASS:
            return self._recipients_for_class(payload, target_role, user)
        if audience == AudienceType.CUSTOM:
            return [
                {'id': rid, 'role': target_role if target_role != RecipientRole.ALL else RecipientRole.STUDENT}
                for rid in payload.get('recipient_ids', [])
            ]
        raise ValueError(f'Unsupported audience type: {audience}')

    # Recipient resolution helpers -------------------------------------------------

    def _fetch_users_by_roles(self, roles: Iterable[str]) -> List[Dict[str, Any]]:
        roles = [role.upper() for role in roles]
        try:
            response = self.auth_client.post(
                '/api/auth/users/by-role/',
                json={'roles': roles},
                headers={'Content-Type': 'application/json'},
            )
            if response.status_code == 200:
                users = response.json().get('users', [])
                result = [{'id': user['id'], 'role': (user.get('role') or '').upper() or RecipientRole.STUDENT} for user in users]
                logger.debug("Fetched %s users for roles %s", len(result), roles)
                return result
            logger.warning("Auth service by-role returned %s: %s", response.status_code, response.text)
        except Exception as exc:
            logger.error("Failed to fetch users by roles %s: %s", roles, exc, exc_info=True)
        return []

    def _recipients_for_course(self, payload: Dict[str, Any], target_role: str, user) -> List[Dict[str, Any]]:
        course_id = payload['course_id']
        recipients: List[Dict[str, Any]] = []

        if target_role in {RecipientRole.ALL, RecipientRole.STUDENT}:
            recipients.extend(self._fetch_course_students(course_id))

        if target_role in {RecipientRole.ALL, RecipientRole.TEACHER}:
            instructor = self._fetch_course_instructor(course_id)
            if instructor:
                recipients.append(instructor)

        if (getattr(user, 'role', '').upper() == 'TEACHER' and (instructor := self._fetch_course_instructor(course_id))):
            if instructor['id'] != getattr(user, 'id', None):
                raise ValueError('You can only notify students/teachers of courses you teach.')

        return self._deduplicate_recipients(recipients)

    def _recipients_for_class(self, payload: Dict[str, Any], target_role: str, user) -> List[Dict[str, Any]]:
        class_id = payload['scheduled_class_id']
        recipients: List[Dict[str, Any]] = []

        if target_role in {RecipientRole.ALL, RecipientRole.STUDENT}:
            recipients.extend(self._fetch_class_students(class_id))

        if target_role in {RecipientRole.ALL, RecipientRole.TEACHER}:
            instructor = self._fetch_class_instructor(class_id)
            if instructor:
                recipients.append(instructor)

        if (getattr(user, 'role', '').upper() == 'TEACHER' and (instructor := self._fetch_class_instructor(class_id))):
            if instructor['id'] != getattr(user, 'id', None):
                raise ValueError('You can only notify students/teachers of classes you teach.')

        return self._deduplicate_recipients(recipients)

    def _fetch_course_students(self, course_id) -> List[Dict[str, Any]]:
        try:
            response = self.course_client.get(f'/api/v1/courses/enrollments/?course_id={course_id}')
            if response.status_code == 200:
                data = response.json()
                enrollments = data.get('results', data if isinstance(data, list) else [])
                return [{'id': enrollment['student_id'], 'role': RecipientRole.STUDENT} for enrollment in enrollments if enrollment.get('student_id')]
            logger.warning("Course service enrollments returned %s: %s", response.status_code, response.text)
        except Exception as exc:
            logger.error("Failed to fetch course enrollments: %s", exc, exc_info=True)
        return []

    def _fetch_course_instructor(self, course_id) -> Dict[str, Any] | None:
        try:
            response = self.course_client.get(f'/api/v1/courses/courses/{course_id}/')
            if response.status_code == 200:
                course = response.json()
                instructor_id = course.get('instructor_id')
                if instructor_id:
                    return {'id': instructor_id, 'role': RecipientRole.TEACHER}
        except Exception as exc:
            logger.error("Failed to fetch course %s: %s", course_id, exc, exc_info=True)
        return None

    def _fetch_class_students(self, class_id) -> List[Dict[str, Any]]:
        try:
            response = self.course_client.get(f'/api/v1/courses/attendance/scheduled-class/{class_id}/students/')
            if response.status_code == 200:
                data = response.json()
                students = data.get('students', [])
                return [{'id': student['student_id'], 'role': RecipientRole.STUDENT} for student in students if student.get('student_id')]
            logger.warning("Course service class students returned %s: %s", response.status_code, response.text)
        except Exception as exc:
            logger.error("Failed to fetch scheduled class students: %s", exc, exc_info=True)
        return []

    def _fetch_class_instructor(self, class_id) -> Dict[str, Any] | None:
        try:
            response = self.course_client.get(f'/api/v1/courses/scheduled-classes/{class_id}/')
            if response.status_code == 200:
                scheduled_class = response.json()
                instructor_id = scheduled_class.get('instructor_id') or scheduled_class.get('course', {}).get('instructor_id')
                if instructor_id:
                    return {'id': instructor_id, 'role': RecipientRole.TEACHER}
        except Exception as exc:
            logger.error("Failed to fetch scheduled class %s: %s", class_id, exc, exc_info=True)
        return None

    @staticmethod
    def _deduplicate_recipients(recipients: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
        seen: Set[Any] = set()
        deduped: List[Dict[str, Any]] = []
        for recipient in recipients:
            recipient_id = recipient.get('id')
            if not recipient_id or recipient_id in seen:
                continue
            seen.add(recipient_id)
            deduped.append(recipient)
        return deduped

