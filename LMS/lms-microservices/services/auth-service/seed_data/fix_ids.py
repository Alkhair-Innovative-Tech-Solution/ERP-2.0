#!/usr/bin/env python
"""
Script to generate IDs for existing StudentProfile and TeacherProfile records
"""
import os
import sys
import django

# Set Django settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'auth_service.settings')
django.setup()

from django.db import models
from profiles.models import StudentProfile, TeacherProfile

# Fix Student IDs
students = StudentProfile.objects.filter(
    models.Q(student_id__isnull=True) | models.Q(student_id='')
)
for student in students:
    if not student.student_id:
        # Get the highest existing student_id
        last_student = StudentProfile.objects.filter(
            student_id__isnull=False
        ).exclude(
            student_id=''
        ).order_by('-student_id').first()
        
        if last_student and last_student.student_id:
            try:
                last_number = int(last_student.student_id)
                next_number = last_number + 1
            except (ValueError, TypeError):
                next_number = 1
        else:
            next_number = 1
        
        student.student_id = f"{next_number:04d}"
        student.save(update_fields=['student_id'])
        print(f"Generated student_id: {student.student_id} for user {student.user.username}")

print(f"Updated {students.count()} student profiles")

# Fix Teacher IDs
teachers = TeacherProfile.objects.filter(
    models.Q(teacher_id__isnull=True) | models.Q(teacher_id='')
)
for teacher in teachers:
    if not teacher.teacher_id:
        # Get the highest existing teacher_id
        last_teacher = TeacherProfile.objects.filter(
            teacher_id__isnull=False
        ).exclude(
            teacher_id=''
        ).order_by('-teacher_id').first()
        
        if last_teacher and last_teacher.teacher_id:
            try:
                last_number = int(last_teacher.teacher_id)
                next_number = last_number + 1
            except (ValueError, TypeError):
                next_number = 1
        else:
            next_number = 1
        
        teacher.teacher_id = f"{next_number:04d}"
        teacher.save(update_fields=['teacher_id'])
        print(f"Generated teacher_id: {teacher.teacher_id} for user {teacher.user.username}")

print(f"Updated {teachers.count()} teacher profiles")

