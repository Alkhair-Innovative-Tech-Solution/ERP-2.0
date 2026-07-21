"""
DRF serializers for certifications
"""
from rest_framework import serializers
from .models import Certification


class CertificationSerializer(serializers.ModelSerializer):
    """Serializer for Certification model"""
    
    class Meta:
        model = Certification
        fields = [
            'id',
            'student_id',
            'course_id',
            'enrollment_id',
            'certificate_number',
            'verification_code',
            'student_name',
            'course_title',
            'course_code',
            'grade',
            'percentile',
            'institution_name',
            'certificate_pdf',
            'qr_code',
            'is_verified',
            'verified_at',
            'verified_by',
            'issued_date',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'certificate_number',
            'verification_code',
            'issued_date',
            'updated_at',
        ]


class CertificationListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for listing certificates"""
    
    class Meta:
        model = Certification
        fields = [
            'id',
            'certificate_number',
            'student_name',
            'course_title',
            'course_code',
            'grade',
            'issued_date',
        ]


class CertificateGenerationSerializer(serializers.Serializer):
    """Serializer for certificate generation request"""
    student_id = serializers.CharField(required=True)
    course_id = serializers.UUIDField(required=True)
    enrollment_id = serializers.UUIDField(required=False, allow_null=True)
    grade = serializers.FloatField(required=False, allow_null=True, min_value=0, max_value=100)
    percentile = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=100)


class CertificateVerificationSerializer(serializers.Serializer):
    """Serializer for certificate verification"""
    verification_code = serializers.CharField(required=False, allow_blank=True)
    student_id = serializers.CharField(required=False, allow_null=True)
    course_code = serializers.CharField(required=False, allow_blank=True)
    
    def validate(self, data):
        """Ensure at least one verification method is provided"""
        if not data.get('verification_code') and not (data.get('student_id') and data.get('course_code')):
            raise serializers.ValidationError(
                "Either verification_code or (student_id + course_code) must be provided"
            )
        return data

