import uuid
from django.db import models


class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    subdomain = models.CharField(max_length=100, unique=True, null=True, blank=True)
    max_users = models.IntegerField(default=100)
    max_students = models.IntegerField(default=500)
    max_campuses = models.IntegerField(default=5)
    enabled_features = models.JSONField(default=dict, blank=True)
    is_active = models.BooleanField(default=True)
    created_by_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = "Organizations"
        ordering = ["name"]


class Campus(models.Model):
    CAMPUS_TYPE_CHOICES = [('main', 'Main'), ('branch', 'Branch')]
    SHIFT_CHOICES = [('morning', 'Morning'), ('afternoon', 'Afternoon'), ('both', 'Both')]
    STATUS_CHOICES = [('active', 'Active'), ('inactive', 'Inactive')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='campuses')
    campus_id = models.CharField(max_length=50, unique=True)
    campus_code = models.CharField(max_length=20)
    campus_name = models.CharField(max_length=255)
    campus_type = models.CharField(max_length=10, choices=CAMPUS_TYPE_CHOICES, default='branch')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    shift_available = models.CharField(max_length=20, choices=SHIFT_CHOICES, default='morning')
    city = models.CharField(max_length=100, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    contact_phone = models.CharField(max_length=20, blank=True, null=True)
    official_email = models.EmailField(blank=True, null=True)
    campus_head_name = models.CharField(max_length=255, blank=True, null=True)
    campus_head_email = models.EmailField(blank=True, null=True)
    student_capacity = models.IntegerField(default=200)
    total_classrooms = models.IntegerField(default=0)
    total_staff_rooms = models.IntegerField(default=0)
    # Facilities
    labs = models.BooleanField(default=False)
    library = models.BooleanField(default=False)
    transport = models.BooleanField(default=False)
    internet_available = models.BooleanField(default=False)
    power_backup = models.BooleanField(default=False)
    canteen_facility = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.campus_id:
            import datetime
            year = datetime.datetime.now().year % 100
            city_code = (self.city or 'GEN')[:3].upper()
            last = Campus.objects.filter(campus_id__startswith=f"{city_code}-{year:02d}").order_by('-campus_id').first()
            if last:
                try:
                    last_num = int(last.campus_id.split('-')[-1])
                    new_num = last_num + 1
                except (ValueError, IndexError):
                    new_num = 1
            else:
                new_num = 1
            postal = '0000'
            self.campus_id = f"{city_code}-{year:02d}-{postal}-{new_num:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.campus_name} ({self.campus_code})"

    class Meta:
        verbose_name_plural = "Campuses"
        unique_together = ['organization', 'campus_code']
        ordering = ["campus_name"]


class Level(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='levels')
    campus = models.ForeignKey(Campus, on_delete=models.CASCADE, related_name='levels')
    name = models.CharField(max_length=100)
    shift = models.CharField(max_length=20, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.campus.campus_name})"

    class Meta:
        verbose_name_plural = "Levels"
        ordering = ["name"]


class Grade(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='grades')
    campus = models.ForeignKey(Campus, on_delete=models.CASCADE, related_name='grades')
    level = models.ForeignKey(Level, on_delete=models.CASCADE, related_name='grades')
    name = models.CharField(max_length=100)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.name} ({self.level.name})"

    class Meta:
        verbose_name_plural = "Grades"
        ordering = ["name"]


class Classroom(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.CASCADE, related_name='classrooms')
    campus = models.ForeignKey(Campus, on_delete=models.CASCADE, related_name='classrooms')
    grade = models.ForeignKey(Grade, on_delete=models.CASCADE, related_name='classrooms')
    section = models.CharField(max_length=10)
    shift = models.CharField(max_length=20, blank=True, null=True)
    capacity = models.IntegerField(default=40)
    class_teacher_id = models.UUIDField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.grade.name} - Section {self.section}"

    class Meta:
        verbose_name_plural = "Classrooms"
        unique_together = ['grade', 'section']
        ordering = ["grade__name", "section"]
