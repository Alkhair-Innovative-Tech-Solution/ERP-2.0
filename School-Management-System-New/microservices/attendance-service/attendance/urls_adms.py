from django.urls import path
from . import views

urlpatterns = [
    path('', views.adms_push, name='adms_push_root'),
]
