from django.contrib import admin

from .models import ConsultationRequest, MentorRequest


class BaseRequestAdmin(admin.ModelAdmin):
    """تنظیمات مشترک پنل ادمین برای هر دو نوع درخواست"""

    readonly_fields = ('created_at',)
    list_filter = ('is_reviewed', 'interest_field')
    search_fields = ('phone_number', 'interest_field')
    date_hierarchy = 'created_at'
    ordering = ('-created_at',)
    actions = ('mark_as_reviewed',)

    @admin.action(description='علامت‌گذاری به‌عنوان بررسی‌شده')
    def mark_as_reviewed(self, request, queryset):
        queryset.update(is_reviewed=True)


@admin.register(ConsultationRequest)
class ConsultationRequestAdmin(BaseRequestAdmin):
    list_display = (
        'phone_number', 'age', 'interest_field',
        'monthly_budget', 'free_time', 'created_at', 'is_reviewed',
    )
    list_editable = ('is_reviewed',)
    fieldsets = (
        ('اطلاعات کاربر', {
            'fields': ('phone_number', 'age', 'interest_field', 'monthly_budget', 'free_time'),
        }),
        ('پیگیری ادمین', {
            'fields': ('is_reviewed', 'admin_note'),
        }),
        ('متادیتا', {
            'fields': ('source_page', 'created_at'),
        }),
    )


@admin.register(MentorRequest)
class MentorRequestAdmin(BaseRequestAdmin):
    list_display = (
        'phone_number', 'interest_field', 'short_courses',
        'created_at', 'is_reviewed',
    )
    list_editable = ('is_reviewed',)

    @admin.display(description='دوره‌های کاربر')
    def short_courses(self, obj):
        text = obj.courses.replace('\n', ' / ')
        return (text[:60] + '…') if len(text) > 60 else text

    fieldsets = (
        ('اطلاعات کاربر', {
            'fields': ('phone_number', 'interest_field', 'courses'),
        }),
        ('پیگیری ادمین', {
            'fields': ('is_reviewed', 'admin_note'),
        }),
        ('متادیتا', {
            'fields': ('source_page', 'created_at'),
        }),
    )
