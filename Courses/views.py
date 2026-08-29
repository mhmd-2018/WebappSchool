from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.core.paginator import Paginator
from django.db.models import Avg, Count, Q
from django.shortcuts import get_object_or_404, redirect, render

from .forms import ReviewForm
from .models import Category, Course


def course_list(request):
    courses = Course.objects.filter(is_published=True).select_related('category').annotate(
        avg_rating=Avg('reviews__score'), num_reviews=Count('reviews')
    )

    query = request.GET.get('q', '').strip()
    category_slug = request.GET.get('category', '')
    level = request.GET.get('level', '')
    price = request.GET.get('price', '')
    min_rating = request.GET.get('min_rating', '')
    sort = request.GET.get('sort', 'newest')

    if query:
        courses = courses.filter(
            Q(title__icontains=query)
            | Q(description__icontains=query)
            | Q(instructor_name__icontains=query)
            | Q(category__name__icontains=query)
        )
    if category_slug:
        courses = courses.filter(category__slug=category_slug)
    if level:
        courses = courses.filter(level=level)
    if price == 'free':
        courses = courses.filter(is_free=True)
    elif price == 'paid':
        courses = courses.filter(is_free=False)
    if min_rating:
        try:
            courses = courses.filter(avg_rating__gte=float(min_rating))
        except ValueError:
            pass

    sort_map = {
        'newest': '-created_at',
        'rating': '-avg_rating',
        'price_asc': 'price',
        'price_desc': '-price',
    }
    courses = courses.order_by(sort_map.get(sort, '-created_at'))

    paginator = Paginator(courses, 12)
    page_obj = paginator.get_page(request.GET.get('page'))

    context = {
        'page_obj': page_obj,
        'categories': Category.objects.all(),
        'query': query,
        'selected_category': category_slug,
        'selected_level': level,
        'selected_price': price,
        'selected_min_rating': min_rating,
        'selected_sort': sort,
        'levels': Course.Level.choices,
    }
    return render(request, 'courses/course_list.html', context)


def course_detail(request, slug):
    course = get_object_or_404(
        Course.objects.select_related('category'), slug=slug, is_published=True
    )
    reviews = course.reviews.select_related('user').all()
    user_review = None
    form = None

    if request.user.is_authenticated:
        user_review = reviews.filter(user=request.user).first()
        if request.method == 'POST':
            if user_review:
                messages.info(request, 'شما قبلا برای این دوره نظر ثبت کرده‌اید.')
                return redirect('courses:course_detail', slug=slug)
            form = ReviewForm(request.POST)
            if form.is_valid():
                review = form.save(commit=False)
                review.course = course
                review.user = request.user
                review.save()
                messages.success(request, 'نظر شما با موفقیت ثبت شد.')
                return redirect('courses:course_detail', slug=slug)
        else:
            form = ReviewForm()

    related_courses = Course.objects.filter(
        category=course.category, is_published=True
    ).exclude(pk=course.pk).select_related('category')[:4]

    context = {
        'course': course,
        'reviews': reviews,
        'user_review': user_review,
        'form': form,
        'related_courses': related_courses,
    }
    return render(request, 'courses/course_detail.html', context)
