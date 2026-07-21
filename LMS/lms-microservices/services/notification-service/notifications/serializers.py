"""
Serializers for notification service
"""
from rest_framework import serializers
from .models import NotificationBroadcast, NotificationDelivery, AudienceType, RecipientRole


class NotificationBroadcastSummarySerializer(serializers.ModelSerializer):
    """Lightweight broadcast serializer used by delivery responses"""

    class Meta:
        model = NotificationBroadcast
        fields = ('id', 'title', 'message', 'audience_type', 'target_role', 'created_at')
        read_only_fields = fields


class NotificationBroadcastListSerializer(serializers.ModelSerializer):
    """
    Optimized serializer for listing broadcasts.
    Excludes 'deliveries' to prevent N+1 performance issues.
    """
    delivery_count = serializers.SerializerMethodField()

    class Meta:
        model = NotificationBroadcast
        fields = [
            'id',
            'title',
            'message',
            'audience_type',
            'target_role',
            'course_id',
            'scheduled_class_id',
            'created_by_id',
            'created_by_role',
            'metadata',
            'batch_id',
            'created_at',
            'updated_at',
            'delivery_count',
        ]
        read_only_fields = fields

    def get_delivery_count(self, obj):
        return obj.deliveries.count()



class NotificationDeliverySimpleSerializer(serializers.ModelSerializer):
    """Simplified delivery serializer (no nested broadcast)"""

    class Meta:
        model = NotificationDelivery
        fields = [
            'id',
            'recipient_id',
            'recipient_role',
            'status',
            'is_read',
            'read_at',
            'delivered_at',
        ]
        read_only_fields = fields


class NotificationDeliverySerializer(serializers.ModelSerializer):
    """Delivery serializer exposed to recipients"""
    broadcast = NotificationBroadcastSummarySerializer(read_only=True)

    class Meta:
        model = NotificationDelivery
        fields = [
            'id',
            'broadcast',
            'recipient_id',
            'recipient_role',
            'status',
            'is_read',
            'read_at',
            'delivered_at',
            'metadata',
        ]
        read_only_fields = fields


class NotificationBroadcastSerializer(serializers.ModelSerializer):
    """Serialize broadcast with nested delivery summaries for admin views"""
    deliveries = NotificationDeliverySimpleSerializer(many=True, read_only=True)
    delivery_count = serializers.SerializerMethodField()

    class Meta:
        model = NotificationBroadcast
        fields = [
            'id',
            'title',
            'message',
            'audience_type',
            'target_role',
            'course_id',
            'scheduled_class_id',
            'created_by_id',
            'created_by_role',
            'metadata',
            'batch_id',
            'created_at',
            'updated_at',
            'delivery_count',
            'deliveries',
        ]
        read_only_fields = [
            'id',
            'created_by_id',
            'created_by_role',
            'created_at',
            'updated_at',
            'delivery_count',
            'deliveries',
        ]

    def get_delivery_count(self, obj):
        return obj.deliveries.count()


class NotificationCreateSerializer(serializers.Serializer):
    """Payload for creating broadcasts"""

    title = serializers.CharField(max_length=255)
    message = serializers.CharField()
    audience_type = serializers.ChoiceField(choices=AudienceType.choices)
    target_role = serializers.ChoiceField(
        choices=RecipientRole.choices,
        required=False,
        default=RecipientRole.ALL,
    )
    course_id = serializers.UUIDField(required=False, allow_null=True)
    scheduled_class_id = serializers.UUIDField(required=False, allow_null=True)
    recipient_ids = serializers.ListField(
        child=serializers.UUIDField(),
        required=False,
        allow_empty=False,
        help_text='Explicit recipient IDs - required for CUSTOM audience',
    )
    metadata = serializers.DictField(required=False, default=dict)
    batch_id = serializers.CharField(required=False, allow_blank=True, allow_null=True, max_length=64)

    def validate(self, attrs):
        audience = attrs.get('audience_type')
        course_id = attrs.get('course_id')
        class_id = attrs.get('scheduled_class_id')
        recipients = attrs.get('recipient_ids')

        if audience == AudienceType.COURSE and not course_id:
            raise serializers.ValidationError('course_id is required when audience_type is COURSE')
        if audience == AudienceType.CLASS and not class_id:
            raise serializers.ValidationError('scheduled_class_id is required when audience_type is CLASS')
        if audience == AudienceType.CUSTOM and not recipients:
            raise serializers.ValidationError('recipient_ids is required when audience_type is CUSTOM')
        return attrs


class NotificationMarkReadSerializer(serializers.Serializer):
    """Serializer for marking notifications as read"""
    is_read = serializers.BooleanField()

