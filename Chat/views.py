from django.conf import settings
from django.core.mail import send_mail
from django.views.generic import TemplateView
from rest_framework import generics
from rest_framework.throttling import AnonRateThrottle

from .models import ConsultationRequest, MentorRequest
from .serializers import ConsultationRequestSerializer, MentorRequestSerializer


class ChatbotThrottle(AnonRateThrottle):
    """
    محدودیت تعداد درخواست برای جلوگیری از اسپم:
    هر IP حداکثر ۶۰ ثبت در ساعت.
    (برای تغییر، فقط مقدار rate را عوض کنید؛ نیازی به تنظیمات settings ندارد)
    """
    rate = '60/hour'


def notify_admins(subject, message):
    """
    اطلاع‌رسانی ادمین‌ها با ایمیل (کاملاً اختیاری و پیش‌فرض خاموش).
    برای فعال‌سازی در settings.py پروژه:
        CHATBOT_EMAIL_NOTIFY = True
        ADMINS = [('نام ادمین', 'admin@example.com')]
        + تنظیم EMAIL_BACKEND مناسب
    """
    if not getattr(settings, 'CHATBOT_EMAIL_NOTIFY', False):
        return
    admin_emails = [email for _name, email in getattr(settings, 'ADMINS', [])]
    if not admin_emails:
        return
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@chatbot.local'),
            recipient_list=admin_emails,
            fail_silently=True,
        )
    except Exception:
        # خطای ایمیل هرگز نباید ثبت درخواست کاربر را مختل کند
        pass


class ConsultationRequestCreateView(generics.CreateAPIView):
    """
    POST /chatbot/api/consultation/
    ثبت درخواست «مشاوره دوره»
    """
    queryset = ConsultationRequest.objects.all()
    serializer_class = ConsultationRequestSerializer
    authentication_classes = []   # عمومی؛ بدون نیاز به لاگین و بدون دردسر CSRF
    permission_classes = []
    throttle_classes = [ChatbotThrottle]

    def perform_create(self, serializer):
        instance = serializer.save()
        notify_admins(
            subject='درخواست مشاوره جدید از چت‌بات',
            message=(
                'یک درخواست مشاوره جدید ثبت شد:\n'
                '--------------------------------\n'
                f'سن: {instance.age}\n'
                f'شماره موبایل: {instance.phone_number}\n'
                f'زمینه مورد علاقه: {instance.interest_field}\n'
                f'هزینه ماهیانه: {instance.monthly_budget}\n'
                f'زمان آزاد هفتگی: {instance.free_time}\n'
                f'صفحه مبدا: {instance.source_page or "-"}\n'
                '--------------------------------\n'
                'بررسی در پنل ادمین: /admin/chatbot/consultationrequest/'
            ),
        )


class MentorRequestCreateView(generics.CreateAPIView):
    """
    POST /chatbot/api/mentor/
    ثبت درخواست «منتور»
    """
    queryset = MentorRequest.objects.all()
    serializer_class = MentorRequestSerializer
    authentication_classes = []
    permission_classes = []
    throttle_classes = [ChatbotThrottle]

    def perform_create(self, serializer):
        instance = serializer.save()
        notify_admins(
            subject='درخواست منتور جدید از چت‌بات',
            message=(
                'یک درخواست منتور جدید ثبت شد:\n'
                '--------------------------------\n'
                f'شماره موبایل: {instance.phone_number}\n'
                f'زمینه مورد علاقه: {instance.interest_field}\n'
                f'دوره‌های کاربر: {instance.courses}\n'
                f'صفحه مبدا: {instance.source_page or "-"}\n'
                '--------------------------------\n'
                'بررسی در پنل ادمین: /admin/chatbot/mentorrequest/'
            ),
        )


class ChatbotDemoView(TemplateView):
    """صفحه دمو برای تست ویجت:  GET /chatbot/"""
    template_name = 'chatbot/demo.html'
