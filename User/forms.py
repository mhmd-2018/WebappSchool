from django import forms
from django.contrib.auth import password_validation

from .models import User


class RegisterForm(forms.ModelForm):
    password1 = forms.CharField(label='رمز عبور', widget=forms.PasswordInput)
    password2 = forms.CharField(label='تکرار رمز عبور', widget=forms.PasswordInput)

    class Meta:
        model = User
        fields = ['phone_number', 'full_name', 'email']

    def clean_password2(self):
        password1 = self.cleaned_data.get('password1')
        password2 = self.cleaned_data.get('password2')
        if password1 and password2 and password1 != password2:
            raise forms.ValidationError('رمز عبور و تکرار آن مطابقت ندارند.')
        password_validation.validate_password(password2)
        return password2

    def save(self, commit=True):
        user = super().save(commit=False)
        user.set_password(self.cleaned_data['password1'])
        if commit:
            user.save()
        return user


class LoginForm(forms.Form):
    phone_number = forms.CharField(label='شماره موبایل')
    password = forms.CharField(label='رمز عبور', widget=forms.PasswordInput)
