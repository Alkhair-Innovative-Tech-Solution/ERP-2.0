from django.apps import AppConfig


class CoursesConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'courses'

    def ready(self):
        import sys
        if '/app' not in sys.path:
            sys.path.insert(0, '/app')

        from . import signals

        if any(cmd in sys.argv for cmd in ['runserver', 'gunicorn', 'uvicorn']):
            from . import consumers
            consumers.start_rabbitmq_listeners()
