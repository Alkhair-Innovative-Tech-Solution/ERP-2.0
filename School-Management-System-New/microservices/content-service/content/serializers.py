from rest_framework import serializers
from .models import Module, Lesson, ContentItem, StudentContentProgress


class ContentItemSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ContentItem
        fields = [
            'id', 'lesson', 'title', 'content_type',
            'file', 'file_url', 'url', 'is_preview', 'order', 'created_at',
        ]
        read_only_fields = ['id', 'created_at', 'file_url']

    def get_file_url(self, obj):
        if obj.file:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.file.url)
            return obj.file.url
        return None


class ContentItemCreateSerializer(serializers.ModelSerializer):
    # Per-content-type upload size caps (bytes). Videos get the most headroom;
    # documents/images stay modest. nginx caps the whole request at 200 MB, and
    # settings.FILE_UPLOAD_MAX_MEMORY_SIZE keeps large files off the heap.
    MB = 1024 * 1024
    MAX_UPLOAD_SIZES = {
        'VIDEO': 200 * MB,
        'PRESENTATION': 50 * MB,
        'DOCUMENT': 30 * MB,
        'IMAGE': 5 * MB,
    }
    DEFAULT_MAX_UPLOAD = 30 * MB

    class Meta:
        model = ContentItem
        fields = ['lesson', 'title', 'content_type', 'file', 'url', 'is_preview', 'order']

    def validate(self, attrs):
        f = attrs.get('file')
        if f is not None:
            content_type = attrs.get('content_type') or getattr(self.instance, 'content_type', 'DOCUMENT')
            limit = self.MAX_UPLOAD_SIZES.get(content_type, self.DEFAULT_MAX_UPLOAD)
            if f.size > limit:
                raise serializers.ValidationError({
                    'file': f"File too large ({f.size // self.MB} MB). "
                            f"Max {limit // self.MB} MB for {content_type.title()} uploads."
                })
        return attrs


class LessonSerializer(serializers.ModelSerializer):
    contents = ContentItemSerializer(many=True, read_only=True)
    is_completed = serializers.SerializerMethodField()

    class Meta:
        model = Lesson
        fields = [
            'id', 'module', 'title', 'description', 'order',
            'is_published', 'duration_minutes', 'created_at',
            'contents', 'is_completed',
        ]
        read_only_fields = ['id', 'created_at', 'is_completed']

    def get_is_completed(self, obj):
        request = self.context.get('request')
        if request and request.user and request.user.role == 'student':
            return StudentContentProgress.all_objects.filter(
                student_id=request.user.id, lesson=obj, is_completed=True
            ).exists()
        return False


class LessonCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lesson
        fields = ['module', 'title', 'description', 'order', 'is_published', 'duration_minutes']


class ModuleSerializer(serializers.ModelSerializer):
    lessons = LessonSerializer(many=True, read_only=True)
    lesson_count = serializers.SerializerMethodField()

    class Meta:
        model = Module
        fields = [
            'id', 'subject_id', 'subject_name', 'title', 'description',
            'order', 'is_published', 'created_at', 'lessons', 'lesson_count',
        ]
        read_only_fields = ['id', 'created_at', 'lesson_count']

    def get_lesson_count(self, obj):
        return obj.lessons.count()


class ModuleCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Module
        fields = ['subject_id', 'subject_name', 'title', 'description', 'order', 'is_published']


class StudentContentProgressSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentContentProgress
        fields = ['id', 'student_id', 'lesson', 'is_completed', 'last_accessed', 'completion_date']
        read_only_fields = ['id', 'last_accessed', 'student_id']
