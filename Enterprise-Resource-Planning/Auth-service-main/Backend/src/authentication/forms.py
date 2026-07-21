"""
Custom forms for Authentication admin.
"""
from django import forms
from django.contrib.auth.hashers import make_password
from .models import UserCredentials

class UserCredentialsForm(forms.ModelForm):
    """
    Form for UserCredentials admin to allow setting password.
    """
    password = forms.CharField(
        widget=forms.PasswordInput,
        required=False,
        help_text="Enter a new password to change it. Leave blank to keep existing password."
    )
    
    class Meta:
        model = UserCredentials
        fields = '__all__'
    
    def save(self, commit=True):
        user_creds = super().save(commit=False)
        
        # If password is provided, hash it and save
        password = self.cleaned_data.get('password')
        if password:
            user_creds.password_hash = make_password(password)
            
        if commit:
            user_creds.save()
        return user_creds
