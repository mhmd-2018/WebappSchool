import django.core.validators
from django.db import migrations, models


def backfill_phone_numbers(apps, schema_editor):
    User = apps.get_model('User', 'User')
    for user in User.objects.filter(phone_number__isnull=True):
        user.phone_number = '09' + str(900000000 + user.id).zfill(9)
        user.save(update_fields=['phone_number'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('User', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='email',
            field=models.EmailField(blank=True, max_length=254, null=True, verbose_name='ایمیل'),
        ),
        migrations.AlterField(
            model_name='user',
            name='phone_number',
            field=models.CharField(
                max_length=11, null=True, blank=True,
                validators=[django.core.validators.RegexValidator(
                    message='شماره موبایل باید به شکل 09xxxxxxxxx باشد.', regex='^09\\d{9}$'
                )],
                verbose_name='شماره موبایل',
            ),
        ),
        migrations.RunPython(backfill_phone_numbers, noop_reverse),
        migrations.AlterField(
            model_name='user',
            name='phone_number',
            field=models.CharField(
                max_length=11, unique=True,
                validators=[django.core.validators.RegexValidator(
                    message='شماره موبایل باید به شکل 09xxxxxxxxx باشد.', regex='^09\\d{9}$'
                )],
                verbose_name='شماره موبایل',
            ),
        ),
    ]
