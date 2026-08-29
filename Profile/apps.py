from django.apps import AppConfig


class ProfileConfig(AppConfig):
    name = 'Profile'
    verbose_name = 'پروفایل کاربران'

    def ready(self):
        from . import signals  # noqa: F401
