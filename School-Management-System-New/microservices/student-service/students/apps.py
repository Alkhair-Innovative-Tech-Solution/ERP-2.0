from django.apps import AppConfig


class StudentsConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'students'
    
    def ready(self):
        import students.signals
        import os
        if os.environ.get('DJANGO_SETTINGS_MODULE', '').startswith('student_service'):
            self._unregister_shared_admins()

    def _unregister_shared_admins(self):
        from django.contrib import admin
        models_to_hide = []
        try:
            from campus.models import Campus
            models_to_hide.append(Campus)
        except Exception:
            pass
        try:
            from classes.models import ClassRoom, Grade, Level
            models_to_hide += [ClassRoom, Grade, Level]
        except Exception:
            pass
        try:
            from coordinator.models import Coordinator
            models_to_hide.append(Coordinator)
        except Exception:
            pass
        try:
            from teachers.models import Teacher, TeacherSubjectAssignment
            models_to_hide += [Teacher, TeacherSubjectAssignment]
        except Exception:
            pass
        try:
            from principals.models import Principal
            models_to_hide.append(Principal)
        except Exception:
            pass
        try:
            from users.models import User
            models_to_hide.append(User)
        except Exception:
            pass
        for model in models_to_hide:
            try:
                admin.site.unregister(model)
            except Exception:
                pass
                     





















