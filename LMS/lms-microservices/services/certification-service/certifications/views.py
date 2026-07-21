"""
API views for certifications
"""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from .models import Certification
from .serializers import (
    CertificationSerializer,
    CertificationListSerializer,
    CertificateGenerationSerializer,
    CertificateVerificationSerializer
)
from .services import CertificateService
from .exceptions import NotFoundError, ValidationError, ConflictError

logger = logging.getLogger(__name__)


class CertificationViewSet(viewsets.ModelViewSet):
    """ViewSet for certification management"""
    queryset = Certification.objects.all()
    permission_classes = [IsAuthenticated]
    
    def get_serializer_class(self):
        if self.action == 'list':
            return CertificationListSerializer
        return CertificationSerializer
    
    def get_queryset(self):
        """Filter certificates by student_id if provided"""
        queryset = super().get_queryset()
        
        # 🔹 Multi-Tenancy: Filter by organization_id
        org_id = self.request.headers.get('X-Org-Id')
        if org_id:
            queryset = queryset.filter(organization_id=org_id)
        
        student_id = self.request.query_params.get('student_id')
        
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        
        return queryset.order_by('-issued_date')
    
    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download certificate PDF"""
        certification = self.get_object()
        
        if not certification.certificate_pdf:
            raise NotFoundError('Certificate PDF not found')
        
        try:
            file_path = certification.certificate_pdf.path
            return FileResponse(
                open(file_path, 'rb'),
                content_type='application/pdf',
                filename=f"{certification.certificate_number}.pdf"
            )
        except Exception as e:
            logger.error(f"Error downloading certificate: {e}", exc_info=True)
            raise NotFoundError('Certificate file not found')
    
    @action(detail=False, methods=['post'])
    def generate(self, request):
        """Generate a new certificate"""
        serializer = CertificateGenerationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # 🔹 Multi-Tenancy: Set organization_id from request headers
        org_id = request.headers.get('X-Org-Id')
        
        service = CertificateService()
        try:
            certification = service.generate_certificate(
                student_id=serializer.validated_data['student_id'],
                course_id=serializer.validated_data['course_id'],
                enrollment_id=serializer.validated_data.get('enrollment_id'),
                grade=serializer.validated_data.get('grade'),
                percentile=serializer.validated_data.get('percentile'),
                organization_id=org_id
            )
            
            response_serializer = CertificationSerializer(certification)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Error generating certificate: {e}", exc_info=True)
            raise ValidationError(f'Failed to generate certificate: {str(e)}')


@api_view(['GET'])
@permission_classes([AllowAny])
def verify_certificate(request, verification_code=None):
    """
    Public endpoint to verify certificate
    
    Can be accessed via:
    - GET /api/v1/certifications/verify/{verification_code}/
    - GET /api/v1/certifications/verify/?verification_code=xxx
    - GET /api/v1/certifications/verify/?student_id=xxx&course_code=xxx
    """
    service = CertificateService()
    
    try:
        if verification_code:
            # Direct verification code in URL
            certification = service.verify_certificate(verification_code=verification_code)
        else:
            # Query parameters
            serializer = CertificateVerificationSerializer(data=request.query_params)
            serializer.is_valid(raise_exception=True)
            
            certification = service.verify_certificate(
                verification_code=serializer.validated_data.get('verification_code'),
                student_id=serializer.validated_data.get('student_id'),
                course_code=serializer.validated_data.get('course_code')
            )
        
        response_serializer = CertificationSerializer(certification)
        return Response({
            'verified': True,
            'certificate': response_serializer.data
        })
    except Certification.DoesNotExist:
        return Response({
            'verified': False,
            'error': 'Certificate not found'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"Error verifying certificate: {e}", exc_info=True)
        return Response({
            'verified': False,
            'error': str(e)
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([AllowAny])
def webhook_course_completion(request):
    """
    Webhook endpoint for course-service to trigger certificate generation
    when a course is completed
    
    Expected payload:
    {
        "student_id": 123,
        "course_id": "uuid",
        "enrollment_id": "uuid",
        "grade": 85.5,
        "percentile": 75
    }
    """
    serializer = CertificateGenerationSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    
    service = CertificateService()
    try:
        certification = service.generate_certificate(
            student_id=serializer.validated_data['student_id'],
            course_id=serializer.validated_data['course_id'],
            enrollment_id=serializer.validated_data.get('enrollment_id'),
            grade=serializer.validated_data.get('grade'),
            percentile=serializer.validated_data.get('percentile')
        )
        
        logger.info(
            f"Certificate generated via webhook: {certification.certificate_number} "
            f"for student {serializer.validated_data['student_id']}"
        )
        
        response_serializer = CertificationSerializer(certification)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"Error generating certificate via webhook: {e}", exc_info=True)
        return Response(
            {'error': f'Failed to generate certificate: {str(e)}'},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

