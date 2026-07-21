from django import forms
from django.contrib.auth.forms import AuthenticationForm, UserCreationForm
from .models import User

class CustomLoginForm(AuthenticationForm):
    username = forms.EmailField(label="Email", widget=forms.EmailInput(attrs={'autofocus': True}))

class CustomUserCreationForm(UserCreationForm):
    class Meta:
        model = User
        fields = ('full_name', 'email', 'phone', 'role')
