from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.shortcuts import redirect, render

from .forms import ProfileForm


@login_required
def profile_view(request):
    profile = request.user.profile
    enrollments = request.user.enrollments.select_related('package').prefetch_related('courses')
    reviews = request.user.reviews.select_related('course')
    return render(request, 'profile/profile_detail.html', {
        'profile': profile,
        'enrollments': enrollments,
        'reviews': reviews,
    })


@login_required
def profile_edit(request):
    profile = request.user.profile
    if request.method == 'POST':
        form = ProfileForm(request.POST, request.FILES, instance=profile)
        if form.is_valid():
            form.save()
            messages.success(request, 'پروفایل شما به‌روزرسانی شد.')
            return redirect('profile:profile_detail')
    else:
        form = ProfileForm(instance=profile)
    return render(request, 'profile/profile_edit.html', {'form': form})
