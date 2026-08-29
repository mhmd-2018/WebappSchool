from django.shortcuts import render
from django.core.paginator import Paginator
from django.contrib.auth.decorators import user_passes_test
from .models import LogEntry

# Only superusers can access this view
@user_passes_test(lambda u: u.is_superuser, login_url='/admin/login/')
def log_dashboard(request):
    logs = LogEntry.objects.all()

    # Optional filters
    level = request.GET.get('level')
    if level:
        logs = logs.filter(level=level)

    search = request.GET.get('q')
    if search:
        logs = logs.filter(message__icontains=search)

    paginator = Paginator(logs, 50)  # 50 logs per page
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    return render(request, 'log_viewer/dashboard.html', {
        'page_obj': page_obj,
        'level': level,
        'search': search,
        'level_choices': [choice[0] for choice in LogEntry.LEVEL_CHOICES],
    })