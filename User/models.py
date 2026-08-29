from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.validators import RegexValidator
from django.db import models

phone_validator = RegexValidator(
    regex=r'^09\d{9}$',
    message='شماره موبایل باید به شکل 09xxxxxxxxx باشد.',
)


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, phone_number, password, **extra_fields):
        if not phone_number:
            raise ValueError('شماره موبایل الزامی است.')
        user = self.model(phone_number=phone_number, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', False)
        extra_fields.setdefault('is_superuser', False)
        return self._create_user(phone_number, password, **extra_fields)

    def create_superuser(self, phone_number, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_active', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')
        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self._create_user(phone_number, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    phone_number = models.CharField(
        max_length=11, unique=True, validators=[phone_validator], verbose_name='شماره موبایل'
    )
    full_name = models.CharField(max_length=150, blank=True, verbose_name='نام و نام خانوادگی')
    first_name = models.CharField(max_length=75, blank=True, verbose_name='نام')
    last_name = models.CharField(max_length=75, blank=True, verbose_name='نام خانوادگی')
    email = models.EmailField(blank=True, null=True, verbose_name='ایمیل')

    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'phone_number'
    REQUIRED_FIELDS = []

    class Meta:
        verbose_name = 'کاربر'
        verbose_name_plural = 'کاربران'

    def save(self, *args, **kwargs):
        if self.first_name or self.last_name:
            self.full_name = f'{self.last_name} {self.first_name}'.strip()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.full_name or self.phone_number

    def get_full_name(self):
        return self.full_name or self.phone_number

    def get_short_name(self):
        return self.full_name or self.phone_number
