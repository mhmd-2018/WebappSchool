from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils.text import slugify


class Category(models.Model):
    name = models.CharField(max_length=100, unique=True, verbose_name='نام دسته')
    slug = models.SlugField(max_length=120, unique=True, blank=True, allow_unicode=True)

    class Meta:
        verbose_name = 'دسته‌بندی'
        verbose_name_plural = 'دسته‌بندی‌ها'
        ordering = ['name']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name, allow_unicode=True)
        super().save(*args, **kwargs)


class Course(models.Model):
    class Level(models.TextChoices):
        BEGINNER = 'beginner', 'Beginner'
        INTERMEDIATE = 'intermediate', 'Intermediate'
        ADVANCED = 'advanced', 'Advanced'

    class Origin(models.TextChoices):
        DOMESTIC = 'domestic', 'Original Production'
        TRANSLATED = 'translated', 'Translated/Subtitled'

    title = models.CharField(max_length=200, verbose_name='عنوان دوره')
    slug = models.SlugField(max_length=220, unique=True, blank=True, allow_unicode=True)
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name='courses', verbose_name='دسته‌بندی'
    )
    description = models.TextField(verbose_name='توضیحات کامل')
    instructor_name = models.CharField(max_length=150, verbose_name='مدرس')
    instructor_bio = models.TextField(blank=True, verbose_name='درباره مدرس')
    provider_name = models.CharField(
        max_length=150, blank=True, verbose_name='پلتفرم/سایت منبع', help_text='مثلا فرادرس، مکتب‌خونه، یوتیوب'
    )
    source_url = models.URLField(blank=True, verbose_name='لینک اصلی دوره')
    level = models.CharField(max_length=20, choices=Level.choices, default=Level.BEGINNER, verbose_name='سطح')
    origin = models.CharField(max_length=20, choices=Origin.choices, default=Origin.DOMESTIC, verbose_name='منشا')
    price = models.PositiveIntegerField(default=0, verbose_name='قیمت')
    original_price = models.PositiveIntegerField(null=True, blank=True, verbose_name='قیمت قبل از تخفیف')
    is_free = models.BooleanField(default=False, verbose_name='رایگان')
    thumbnail = models.ImageField(upload_to='courses/thumbnails/', blank=True, null=True, verbose_name='تصویر')
    color = models.CharField(max_length=20, blank=True, help_text='e.g. #4361ee', verbose_name='رنگ آیکون')
    icon = models.CharField(max_length=4, blank=True, help_text='حرف/کاراکتر کوتاه', verbose_name='آیکون')
    lessons = models.PositiveIntegerField(default=0, verbose_name='تعداد جلسات')
    hours = models.PositiveIntegerField(default=0, verbose_name='ساعت محتوا')
    curriculum = models.TextField(blank=True, help_text='هر خط یک سرفصل', verbose_name='سرفصل‌ها')
    is_published = models.BooleanField(default=True, verbose_name='منتشر شده')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'دوره'
        verbose_name_plural = 'دوره‌ها'
        ordering = ['-created_at']

    def __str__(self):
        return self.title

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.title, allow_unicode=True)
        super().save(*args, **kwargs)

    @property
    def average_rating(self):
        return self.reviews.aggregate(avg=models.Avg('score'))['avg'] or 0

    @property
    def rating_count(self):
        return self.reviews.count()

    @property
    def modules(self):
        return [line.strip() for line in self.curriculum.splitlines() if line.strip()]


class Review(models.Model):
    RECOMMEND_CHOICES = [
        ('yes', 'Yes'),
        ('maybe', 'Maybe'),
        ('no', 'No'),
    ]

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name='reviews', verbose_name='دوره')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews',
        null=True, blank=True, verbose_name='کاربر',
    )
    score = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)], verbose_name='امتیاز'
    )
    comment = models.TextField(blank=True, verbose_name='نظر')
    recommend = models.CharField(max_length=10, choices=RECOMMEND_CHOICES, default='yes', verbose_name='پیشنهاد می‌کنید؟')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'نظر'
        verbose_name_plural = 'نظرات'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(fields=['course', 'user'], name='unique_review_per_user_course')
        ]

    def __str__(self):
        return f'{self.user or "Anonymous"} -> {self.course} ({self.score})'


class CourseEnrollment(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='course_enrollments', verbose_name='کاربر'
    )
    course = models.ForeignKey(
        Course, on_delete=models.CASCADE, related_name='course_enrollments', verbose_name='دوره'
    )
    progress = models.PositiveSmallIntegerField(default=0, validators=[MaxValueValidator(100)], verbose_name='پیشرفت')
    enrolled_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'ثبت‌نام در دوره'
        verbose_name_plural = 'ثبت‌نام‌ها در دوره‌ها'
        ordering = ['-enrolled_at']
        constraints = [
            models.UniqueConstraint(fields=['user', 'course'], name='unique_course_enrollment')
        ]

    def __str__(self):
        return f'{self.user} -> {self.course} ({self.progress}%)'


class Contact(models.Model):
    SUBJECT_CHOICES = [
        ('general', 'General Inquiry'),
        ('support', 'Technical Support'),
        ('billing', 'Billing Question'),
        ('suggestion', 'Course Suggestion'),
        ('partnership', 'Partnership'),
        ('other', 'Other'),
    ]

    name = models.CharField(max_length=150, verbose_name='نام')
    email = models.EmailField(verbose_name='ایمیل')
    subject = models.CharField(max_length=20, choices=SUBJECT_CHOICES, verbose_name='موضوع')
    message = models.TextField(verbose_name='پیام')
    is_read = models.BooleanField(default=False, verbose_name='خوانده شده')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'پیام تماس'
        verbose_name_plural = 'پیام‌های تماس'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.name} <{self.email}> - {self.get_subject_display()}'


class Transaction(models.Model):
    class Type(models.TextChoices):
        INCOME = 'income', 'درآمد'
        EXPENSE = 'expense', 'هزینه'

    type = models.CharField(max_length=10, choices=Type.choices, verbose_name='نوع')
    label = models.CharField(max_length=200, verbose_name='شرح')
    amount = models.PositiveIntegerField(verbose_name='مبلغ (دلار)')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'تراکنش مالی'
        verbose_name_plural = 'تراکنش‌های مالی'
        ordering = ['-created_at']

    def __str__(self):
        sign = '+' if self.type == self.Type.INCOME else '-'
        return f'{self.label} ({sign}{self.amount}$)'


class Package(models.Model):
    name = models.CharField(max_length=100, verbose_name='نام بسته')
    course_count = models.PositiveIntegerField(verbose_name='تعداد دوره قابل انتخاب')
    price = models.PositiveIntegerField(verbose_name='قیمت')
    description = models.CharField(max_length=255, blank=True, verbose_name='توضیح کوتاه')
    is_active = models.BooleanField(default=True, verbose_name='فعال')

    class Meta:
        verbose_name = 'بسته اشتراک'
        verbose_name_plural = 'بسته‌های اشتراک'
        ordering = ['price']

    def __str__(self):
        return f'{self.name} ({self.course_count} دوره)'


class Enrollment(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='enrollments', verbose_name='کاربر'
    )
    package = models.ForeignKey(
        Package, on_delete=models.PROTECT, related_name='enrollments', verbose_name='بسته'
    )
    courses = models.ManyToManyField(Course, related_name='enrollments', blank=True, verbose_name='دوره‌های انتخابی')
    purchased_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'خرید اشتراک'
        verbose_name_plural = 'خریدهای اشتراک'
        ordering = ['-purchased_at']

    def __str__(self):
        return f'{self.user} - {self.package}'

    @property
    def remaining_slots(self):
        return max(self.package.course_count - self.courses.count(), 0)
