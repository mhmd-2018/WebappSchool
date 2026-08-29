from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.shortcuts import redirect, render

from .forms import LoginForm, RegisterForm


def register_view(request):
    if request.user.is_authenticated:
        return redirect('courses:course_list')

    if request.method == 'POST':
        form = RegisterForm(request.POST)
        if form.is_valid():
            user = form.save()
            login(request, user)
            messages.success(request, 'ثبت‌نام شما با موفقیت انجام شد.')
            return redirect('courses:course_list')
    else:
        form = RegisterForm()
    return render(request, 'user/register.html', {'form': form})


def login_view(request):
    if request.user.is_authenticated:
        return redirect('courses:course_list')

    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            user = authenticate(
                request,
                phone_number=form.cleaned_data['phone_number'],
                password=form.cleaned_data['password'],
            )
            if user is not None:
                login(request, user)
                return redirect(request.GET.get('next') or 'courses:course_list')
            form.add_error(None, 'شماره موبایل یا رمز عبور اشتباه است.')
    else:
        form = LoginForm()
    return render(request, 'user/login.html', {'form': form})


@login_required
def logout_view(request):
    logout(request)
    return redirect('courses:course_list')
