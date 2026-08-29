from django.urls import path

from . import views

app_name = 'profile'

urlpatterns = [
    path('', views.profile_view, name='profile_detail'),
    path('edit/', views.profile_edit, name='profile_edit'),
]
