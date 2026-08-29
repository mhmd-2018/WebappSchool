from django.db import migrations
from django.utils.text import slugify

CATEGORIES = [
    'Technology',
    'Design',
    'Business',
    'Marketing',
    'Data Science',
    'Personal Development',
]


def seed_categories(apps, schema_editor):
    Category = apps.get_model('Courses', 'Category')
    for name in CATEGORIES:
        Category.objects.get_or_create(name=name, defaults={'slug': slugify(name)})


def unseed_categories(apps, schema_editor):
    Category = apps.get_model('Courses', 'Category')
    Category.objects.filter(name__in=CATEGORIES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('Courses', '0002_initial'),
    ]

    operations = [
        migrations.RunPython(seed_categories, unseed_categories),
    ]
