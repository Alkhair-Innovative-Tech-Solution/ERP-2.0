from django.contrib import admin
from .models import Organization, Campus, Level, Grade, Classroom

admin.site.register(Organization)
admin.site.register(Campus)
admin.site.register(Level)
admin.site.register(Grade)
admin.site.register(Classroom)
