from django import forms

from .models import Profile


class ProfileForm(forms.ModelForm):
    class Meta:
        model = Profile
        fields = ['avatar', 'bio', 'interests']
        widgets = {
            'bio': forms.Textarea(attrs={'rows': 4}),
            'interests': forms.CheckboxSelectMultiple,
        }
