from django.urls import path

from . import views

urlpatterns = [
    path('auth/register/', views.register),
    path('auth/login/', views.login_view),
    path('auth/logout/', views.logout_view),
    path('profile/', views.profile_view),
    path('courses/', views.course_list),
    path('courses/<int:pk>/', views.course_detail),
    path('enrollments/', views.enrollments),
    path('contacts/', views.contact_create),
    path('feedbacks/', views.feedback_create),
    path('admin/overview/', views.admin_overview),
    path('admin/messages/<int:pk>/read/', views.admin_mark_message_read),
    path('admin/logs/', views.admin_logs),
]
