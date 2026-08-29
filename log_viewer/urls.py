from django.urls import path
from .views import log_dashboard

urlpatterns = [
    path('logs/', log_dashboard, name='log_dashboard'),
]