"""
Celery configuration for File Service.
"""
import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')

app = Celery('file_service')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()


