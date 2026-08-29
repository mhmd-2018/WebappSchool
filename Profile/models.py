from django.conf import settings
from django.db import models

from Courses.models import Category


class Profile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='profile', verbose_name='کاربر'
    )
    avatar = models.ImageField(upload_to='profiles/avatars/', blank=True, null=True, verbose_name='تصویر پروفایل')
    bio = models.TextField(blank=True, verbose_name='درباره من')
    interests = models.ManyToManyField(
        Category, blank=True, related_name='interested_users', verbose_name='علاقه‌مندی‌ها'
    )

    class Meta:
        verbose_name = 'پروفایل'
        verbose_name_plural = 'پروفایل‌ها'

    def __str__(self):
        return f'پروفایل {self.user}'
