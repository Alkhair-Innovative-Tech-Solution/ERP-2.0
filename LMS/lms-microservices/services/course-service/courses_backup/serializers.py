"""
Serializers for courses
"""
from rest_framework import serializers
from .models import Course, CourseEnrollment, Assignment, ScheduledClass, Announcement, AssignmentSubmission, TimeSlot, Attendance, StudentAttendance


class CourseSerializer(serializers.ModelSerializer):
    """Serializer for Course model"""
    thumbnail_url = serializers.SerializerMethodField()
    attachment_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Course
        fields = [
            'id', 'course_code', 'title', 'description', 'instructor_id',
            'category', 'level', 'duration', 'duration_unit',
            'thumbnail', 'thumbnail_url', 'attachment', 'attachment_url', 'intro_video',
            'created_at', 'updated_at', 'is_published'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'thumbnail_url', 'attachment_url']
    
    def get_thumbnail_url(self, obj):
        if obj.thumbnail:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.thumbnail.url)
            return obj.thumbnail.url
        return None
    
    def get_attachment_url(self, obj):
        if obj.attachment:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None


class CourseEnrollmentSerializer(serializers.ModelSerializer):
    """Serializer for CourseEnrollment model"""
    course = CourseSerializer(read_only=True)
    course_id = serializers.UUIDField(write_only=True, required=False)
    scheduled_class = serializers.SerializerMethodField()
    scheduled_class_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    
    class Meta:
        model = CourseEnrollment
        fields = [
            'id', 'course', 'course_id', 'student_id', 'enrolled_at', 
            'is_active', 'completion_status', 'completed_at',
            'progress', 'last_accessed', 'scheduled_class', 'scheduled_class_id'
        ]
        read_only_fields = ['id', 'enrolled_at', 'completed_at', 'last_accessed', 'scheduled_class']
    
    def get_scheduled_class(self, obj):
        """Return lightweight scheduled class info for dashboards"""
        if not obj.scheduled_class:
            return None
        
        scheduled_class = obj.scheduled_class
        course = scheduled_class.course
        time_slot = scheduled_class.time_slot
        
        return {
            'id': str(scheduled_class.id),
            'class_name': scheduled_class.class_name,
            'course_code': course.course_code if course else None,
            'course_title': course.title if course else None,
            'instructor_id': scheduled_class.instructor_id,
            'time_slot': time_slot.slot_name if time_slot else None,
            'room': scheduled_class.room,
            'days': scheduled_class.days,
        }
    
    def _assign_foreign_keys(self, validated_data):
        """Attach course and scheduled class instances based on provided IDs"""
        course_id = validated_data.pop('course_id', None)
        if course_id:
            validated_data['course'] = Course.objects.get(id=course_id)
        
        scheduled_class_id = validated_data.pop('scheduled_class_id', None)
        if scheduled_class_id:
            validated_data['scheduled_class'] = ScheduledClass.objects.get(id=scheduled_class_id)
    
    def create(self, validated_data):
        self._assign_foreign_keys(validated_data)
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        self._assign_foreign_keys(validated_data)
        return super().update(instance, validated_data)


class AssignmentSerializer(serializers.ModelSerializer):
    """Serializer for Assignment model"""
    course = CourseSerializer(read_only=True)
    course_id = serializers.UUIDField(write_only=True, required=False)
    attachment_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Assignment
        fields = [
            'id', 'course', 'course_id', 'title', 'description', 'instructions', 
            'total_marks', 'due_date', 'assignment_type', 'is_published',
            'created_by_id', 'attachment', 'attachment_url', 
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'attachment_url', 'course']
    
    def create(self, validated_data):
        """Override create to handle course_id or course"""
        # Handle course_id (preferred)
        course_id = validated_data.pop('course_id', None)
        if course_id:
            validated_data['course'] = Course.objects.get(id=course_id)
        # Also handle 'course' field if sent as UUID string
        elif 'course' in validated_data:
            course_value = validated_data.get('course')
            if isinstance(course_value, str):
                # If it's a string UUID, convert to Course object
                try:
                    validated_data['course'] = Course.objects.get(id=course_value)
                except (Course.DoesNotExist, ValueError):
                    pass
        return super().create(validated_data)
    
    def update(self, instance, validated_data):
        """Override update to handle course_id or course"""
        # Handle course_id (preferred)
        course_id = validated_data.pop('course_id', None)
        if course_id:
            validated_data['course'] = Course.objects.get(id=course_id)
        # Also handle 'course' field if sent as UUID string
        elif 'course' in validated_data:
            course_value = validated_data.get('course')
            if isinstance(course_value, str):
                # If it's a string UUID, convert to Course object
                try:
                    validated_data['course'] = Course.objects.get(id=course_value)
                except (Course.DoesNotExist, ValueError):
                    pass
        return super().update(instance, validated_data)
    
    def get_attachment_url(self, obj):
        """Return full URL for attachment file"""
        if obj.attachment:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.attachment.url)
            return obj.attachment.url
        return None


class TimeSlotSerializer(serializers.ModelSerializer):
    """Serializer for TimeSlot model"""
    class Meta:
        model = TimeSlot
        fields = [
            'id', 'slot_name', 'start_time', 'end_time', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class ScheduledClassSerializer(serializers.ModelSerializer):
    """Serializer for ScheduledClass model"""
    course = CourseSerializer(read_only=True)
    time_slot = TimeSlotSerializer(read_only=True)
    days_display = serializers.SerializerMethodField()
    
    class Meta:
        model = ScheduledClass
        fields = [
            'id', 'course', 'class_name', 'instructor_id',
            'time_slot', 'days', 'days_display', 'room', 'max_students',
            'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'days_display']
    
    def get_days_display(self, obj):
        """Return days as comma-separated string"""
        if isinstance(obj.days, list):
            return ', '.join(obj.days)
        return ''


class AnnouncementSerializer(serializers.ModelSerializer):
    """Serializer for Announcement model"""
    course = CourseSerializer(read_only=True)
    
    class Meta:
        model = Announcement
        fields = [
            'id', 'course', 'title', 'content', 'created_at'
        ]
        read_only_fields = ['id', 'created_at']


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    """Serializer for AssignmentSubmission model"""
    assignment = AssignmentSerializer(read_only=True)
    assignment_id = serializers.UUIDField(write_only=True, required=True)
    submitted_file_url = serializers.SerializerMethodField()
    is_late = serializers.SerializerMethodField()
    
    class Meta:
        model = AssignmentSubmission
        fields = [
            'id', 'assignment', 'assignment_id', 'student_id', 'submission_file_url', 'submitted_file_url',
            'submission_text', 'submitted_at', 'status', 'marks_obtained', 'feedback',
            'graded_by_id', 'graded_at', 'is_late'
        ]
        read_only_fields = ['id', 'submitted_at', 'graded_at', 'is_late', 'submitted_file_url', 'assignment']
    
    def create(self, validated_data):
        """Override create to handle assignment_id"""
        assignment_id = validated_data.pop('assignment_id')
        validated_data['assignment'] = Assignment.objects.get(id=assignment_id)
        return super().create(validated_data)
    
    def get_submitted_file_url(self, obj):
        """Return full URL for submitted file"""
        if obj.submission_file_url:
            request = self.context.get('request')
            if request:
                # If it's already a full URL, return as is
                if obj.submission_file_url.startswith('http'):
                    return obj.submission_file_url
                # Otherwise, build absolute URI
                return request.build_absolute_uri(obj.submission_file_url)
            return obj.submission_file_url
        return None
    
    def get_is_late(self, obj):
        """Check if submission is late"""
        return obj.is_late()


class StudentAttendanceSerializer(serializers.ModelSerializer):
    """Serializer for StudentAttendance model"""
    student_name = serializers.SerializerMethodField()
    
    class Meta:
        model = StudentAttendance
        fields = [
            'id', 'student_id', 'student_name', 'status', 'remarks',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'student_name']
    
    def get_student_name(self, obj):
        """Get student name from enrollment if available"""
        try:
            # Try to get student name from enrollment
            enrollment = CourseEnrollment.objects.filter(
                student_id=obj.student_id,
                scheduled_class=obj.attendance.scheduled_class,
                is_active=True
            ).first()
            if enrollment:
                # If we have enrollment, we can potentially fetch from auth-service
                # For now, return student_id as name
                return f"Student {obj.student_id}"
        except Exception:
            pass
        return f"Student {obj.student_id}"


class AttendanceSerializer(serializers.ModelSerializer):
    """Serializer for Attendance model"""
    scheduled_class = ScheduledClassSerializer(read_only=True)
    student_attendance = StudentAttendanceSerializer(source='student_attendances', many=True, read_only=True)
    
    class Meta:
        model = Attendance
        fields = [
            'id', 'scheduled_class', 'date', 'marked_by',
            'total_students', 'present_count', 'absent_count',
            'late_count', 'leave_count', 'student_attendance',
            'created_at', 'updated_at'
        ]
        read_only_fields = [
            'id', 'total_students', 'present_count', 'absent_count',
            'late_count', 'leave_count', 'created_at', 'updated_at'
        ]


class AttendanceMarkingSerializer(serializers.Serializer):
    """Serializer for marking attendance"""
    scheduled_class_id = serializers.UUIDField(required=True)
    date = serializers.DateField(required=True)
    student_attendance = serializers.ListField(
        child=serializers.DictField(),
        help_text="List of student attendance records with student_id, status, and optional remarks"
    )
    
    def validate_scheduled_class_id(self, value):
        """Validate that scheduled class exists"""
        try:
            ScheduledClass.objects.get(id=value)
        except ScheduledClass.DoesNotExist:
            raise serializers.ValidationError("Scheduled class does not exist")
        return value
    
    def validate_student_attendance(self, value):
        """Validate student attendance data"""
        if not value or len(value) == 0:
            raise serializers.ValidationError("At least one student attendance record is required")
        
        required_fields = ['student_id', 'status']
        valid_statuses = ['present', 'absent', 'late', 'leave']
        
        for record in value:
            # Check required fields
            for field in required_fields:
                if field not in record:
                    raise serializers.ValidationError(f"Missing required field: {field} in student attendance record")
            
            # Validate status
            if record['status'] not in valid_statuses:
                raise serializers.ValidationError(
                    f"Invalid status '{record['status']}'. Must be one of: {', '.join(valid_statuses)}"
                )
            
            # Validate student_id is integer
            try:
                int(record['student_id'])
            except (ValueError, TypeError):
                raise serializers.ValidationError(f"student_id must be an integer, got: {record['student_id']}")
        
        return value

