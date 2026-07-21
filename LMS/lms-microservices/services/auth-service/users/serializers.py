from rest_framework import serializers
from users.models import User, Student, RolePermission
from .schemas import UserInfoSchema

def user_to_schema(user: User) -> UserInfoSchema:
    student_id = ""
    profile_image = ""
    father_name = ""
    address = ""
    whatsapp_number = ""
    gender = ""
    test_score = None
    has_paid_deposit = False
    branch_id = None
    branch_name = None
    branch_code = None
    
    # Branch info
    if user.branch:
        branch_id = str(user.branch.id)
        branch_name = user.branch.name
        branch_code = user.branch.code
    
    if user.role.lower() == 'student':
        student = Student.objects.filter(user=user).select_related('guardian_info', 'residential_info').first()
        if student:
            student_id = student.student_id or ""
            whatsapp_number = student.whatsapp_number or ""
            gender = student.gender or ""
            test_score = student.test_score
            
            # Check deposit status from both Student model and ReceiptCode model
            from users.models import ReceiptCode
            has_paid_deposit = student.has_paid_deposit or ReceiptCode.objects.filter(student_email=user.email, verified=True).exists()
            
            if student.image:
                profile_image = student.image.url
            
            # Fetch from related models
            if hasattr(student, 'guardian_info'):
                father_name = student.guardian_info.father_name or ""
            if hasattr(student, 'residential_info'):
                address = student.residential_info.address or ""

    # Fetch role-based permissions
    role_perm = RolePermission.objects.filter(role=user.role.upper()).first()
    role_permissions = role_perm.permissions if role_perm else {}

    return UserInfoSchema(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        cnic=user.cnic,
        phone=user.phone or whatsapp_number or "", # Fallback for UI visibility
        role=user.role.upper(),
        student_id=student_id,
        profile_image=profile_image,
        branch_id=branch_id,
        branch_name=branch_name,
        branch_code=branch_code,
        organization_id=str(user.organization_id) if user.organization_id else None,
        campus_id=str(user.campus_id) if user.campus_id else None,
        father_name=father_name,
        address=address,
        whatsapp_number=whatsapp_number,
        gender=gender,
        test_score=test_score,
        has_paid_deposit=has_paid_deposit,
        created_at=user.created_at,
        must_change_password=user.must_change_password,
        features_access=user.features_access or {},
        role_permissions=role_permissions,
        level=user.level,
        batch=user.batch,
        specialization=user.specialization,
        date_of_birth=str(user.date_of_birth) if user.date_of_birth else None,
    )


class StudentIdentityCardSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='user.full_name')
    father_name = serializers.SerializerMethodField()
    cnic = serializers.CharField(source='user.cnic')
    photo_url = serializers.SerializerMethodField()
    whatsapp = serializers.CharField(source='whatsapp_number')
    status = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            'name', 'father_name', 'student_id', 'level', 
            'specialization', 'batch', 'whatsapp', 'cnic', 
            'photo_url', 'status'
        ]

    def get_father_name(self, obj):
        if hasattr(obj, 'guardian_info'):
            return obj.guardian_info.father_name or "N/A"
        return "N/A"

    def get_photo_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None

    def get_status(self, obj):
        if obj.status == 'enrolled':
            return "Active Student"
        return obj.status.title() if obj.status else "Initial"

class StudentPhotoUploadSerializer(serializers.Serializer):
    photo = serializers.ImageField(required=True)

    def validate_photo(self, value):
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Image size cannot exceed 5MB.")
        return value
