"""
URL configuration for root project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.generic import TemplateView

FRONTEND_PAGES = [
    'base.html',
    'contact_us.html',
    'course.html',
    'course_list.html',
    'User_dashboard.html',
    'feedback.html',
    'signup.html',
    'profile_alter.html',
    'admin_dashboard.html',
    'log_dashboard.html',
]

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('Api.urls')),
    path('', include('log_viewer.urls')),
    path('', TemplateView.as_view(template_name='base.html'), name='home'),
]
urlpatterns += [
    path(page, TemplateView.as_view(template_name=page)) for page in FRONTEND_PAGES
]

handler404 = 'django.views.defaults.page_not_found'
handler500 = 'django.views.defaults.server_error'

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
