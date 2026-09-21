from django.urls import path

from .views import (
    ChatbotDemoView,
    ConsultationRequestCreateView,
    MentorRequestCreateView,
)

app_name = 'chatbot'

urlpatterns = [
    # صفحه دمو برای تست ویجت
    path('', ChatbotDemoView.as_view(), name='demo'),
    # API ثبت درخواست‌ها
    path('api/consultation/', ConsultationRequestCreateView.as_view(), name='api-consultation'),
    path('api/mentor/', MentorRequestCreateView.as_view(), name='api-mentor'),
]
