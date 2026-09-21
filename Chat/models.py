from django.db import models


# ---------------------------------------------------------------------------
# مدل‌های اپ چت‌بات
# توجه: هیچ تغییری در پروژه اصلی لازم نیست؛ فقط این اپ را نصب کنید.
# ---------------------------------------------------------------------------

class BaseChatbotRequest(models.Model):
    """
    فیلدهای مشترک بین «درخواست مشاوره» و «درخواست منتور».
    (مدل انتزاعی است و جدول جداگانه‌ای در دیتابیس نمی‌سازد)
    """
    phone_number = models.CharField('شماره موبایل', max_length=11)
    interest_field = models.CharField('زمینه مورد علاقه', max_length=100)
    source_page = models.CharField(
        'صفحه‌ای که چت از آن شروع شده', max_length=200, blank=True, default='',
    )
    is_reviewed = models.BooleanField('بررسی شده توسط ادمین', default=False)
    admin_note = models.TextField('یادداشت ادمین', blank=True, default='')
    created_at = models.DateTimeField('تاریخ ثبت', auto_now_add=True)

    class Meta:
        abstract = True


class ConsultationRequest(BaseChatbotRequest):
    """درخواست مشاوره برای انتخاب دوره (کاربر هنوز دوره ندارد)"""

    age = models.PositiveIntegerField('سن')
    monthly_budget = models.CharField('هزینه ماهیانه آموزش', max_length=100)
    free_time = models.CharField('میزان زمان آزاد هفتگی', max_length=100)

    class Meta:
        verbose_name = 'درخواست مشاوره دوره'
        verbose_name_plural = 'درخواست‌های مشاوره دوره'
        ordering = ['-created_at']

    def __str__(self):
        return f'مشاوره | {self.phone_number} | {self.interest_field}'


class MentorRequest(BaseChatbotRequest):
    """درخواست منتور (کاربر دوره دارد و منتور می‌خواهد)"""

    courses = models.TextField('دوره‌هایی که کاربر دارد')

    class Meta:
        verbose_name = 'درخواست منتور'
        verbose_name_plural = 'درخواست‌های منتور'
        ordering = ['-created_at']

    def __str__(self):
        return f'منتور | {self.phone_number} | {self.interest_field}'
