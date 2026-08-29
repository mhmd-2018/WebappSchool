from django.contrib import admin
from .models import LogEntry

@admin.register(LogEntry)
class LogEntryAdmin(admin.ModelAdmin):
    list_display = ('level', 'logger_name', 'message', 'created_at')
    list_filter = ('level', 'created_at')
    search_fields = ('message', 'logger_name')
    readonly_fields = ('level', 'logger_name', 'message', 'created_at')