from django.contrib.auth import authenticate, get_user_model
from django.core.exceptions import ValidationError
from django.core.paginator import Paginator
from django.db.models import Count, Q, Sum
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, BasePermission, IsAdminUser, IsAuthenticated
from rest_framework.response import Response

from Courses.models import Contact, Course, CourseEnrollment, Review, Transaction
from log_viewer.models import LogEntry
from User.models import phone_validator

from .serializers import CourseSerializer, ProfileSerializer

User = get_user_model()

LOG_LEVELS = ['DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL']


class IsSuperUser(BasePermission):
    """Matches log_viewer's own superuser-only gate on the legacy /logs/ view —
    system log messages can contain stack traces/internals, so this stays a
    stricter bar than the general is_staff admin panel."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_superuser)


def _user_payload(user):
    return {
        'id': user.id,
        'name': user.full_name or user.phone_number,
        'phone': user.phone_number,
        'is_staff': user.is_staff,
        'is_superuser': user.is_superuser,
    }


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    name = (request.data.get('name') or '').strip()
    phone = (request.data.get('phone') or '').strip()
    password = request.data.get('password') or ''

    if not name or not phone or len(password) < 6:
        return Response({'error': 'Please fill all fields. Password must be at least 6 characters.'}, status=400)
    try:
        phone_validator(phone)
    except ValidationError:
        return Response({'error': 'Please enter a valid phone number (e.g. 09123456789).'}, status=400)
    if User.objects.filter(phone_number=phone).exists():
        return Response({'error': 'An account with this phone number already exists.'}, status=400)

    user = User.objects.create_user(phone_number=phone, password=password, full_name=name)
    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'user': _user_payload(user)})


@api_view(['POST'])
@permission_classes([AllowAny])
def login_view(request):
    phone = (request.data.get('phone') or '').strip()
    password = request.data.get('password') or ''

    user = authenticate(request, username=phone, password=password)
    if user is None:
        return Response({'error': 'Invalid phone number or password.'}, status=400)

    token, _ = Token.objects.get_or_create(user=user)
    return Response({'token': token.key, 'user': _user_payload(user)})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    request.user.auth_token.delete()
    return Response(status=204)


@api_view(['GET', 'PUT', 'PATCH'])
@permission_classes([IsAuthenticated])
def profile_view(request):
    if request.method == 'GET':
        return Response(ProfileSerializer(request.user, context={'request': request}).data)

    serializer = ProfileSerializer(
        request.user, data=request.data, partial=True, context={'request': request}
    )
    if not serializer.is_valid():
        first_error = next(iter(serializer.errors.values()))[0]
        return Response({'error': str(first_error)}, status=400)
    serializer.save()
    return Response(ProfileSerializer(request.user, context={'request': request}).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def course_list(request):
    courses = Course.objects.filter(is_published=True).select_related('category').prefetch_related('reviews__user')
    return Response(CourseSerializer(courses, many=True).data)


@api_view(['GET'])
@permission_classes([AllowAny])
def course_detail(request, pk):
    course = Course.objects.select_related('category').prefetch_related('reviews__user').filter(
        pk=pk, is_published=True
    ).first()
    if not course:
        return Response({'error': 'Course not found.'}, status=404)
    return Response(CourseSerializer(course).data)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def enrollments(request):
    if request.method == 'GET':
        qs = CourseEnrollment.objects.filter(user=request.user)
        return Response([{'course': e.course_id, 'progress': e.progress} for e in qs])

    course = Course.objects.filter(pk=request.data.get('course'), is_published=True).first()
    if not course:
        return Response({'error': 'Course not found.'}, status=404)
    enrollment, _ = CourseEnrollment.objects.get_or_create(user=request.user, course=course)
    return Response({'course': enrollment.course_id, 'progress': enrollment.progress}, status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def contact_create(request):
    name = (request.data.get('name') or '').strip()
    email = (request.data.get('email') or '').strip()
    subject = (request.data.get('subject') or '').strip()
    message = (request.data.get('message') or '').strip()

    if not all([name, email, subject, message]):
        return Response({'error': 'Please fill all required fields.'}, status=400)

    Contact.objects.create(name=name, email=email, subject=subject, message=message)
    return Response(status=201)


@api_view(['POST'])
@permission_classes([AllowAny])
def feedback_create(request):
    course = Course.objects.filter(pk=request.data.get('course')).first()
    rating = request.data.get('rating')
    message = (request.data.get('message') or '').strip()
    recommend = request.data.get('recommend') or 'yes'

    if not course or not rating or not message:
        return Response({'error': 'Please fill all required fields.'}, status=400)

    user = request.user if request.user.is_authenticated else None
    if user:
        Review.objects.update_or_create(
            course=course, user=user,
            defaults={'score': rating, 'comment': message, 'recommend': recommend},
        )
    else:
        Review.objects.create(course=course, user=None, score=rating, comment=message, recommend=recommend)
    return Response(status=201)


@api_view(['GET'])
@permission_classes([IsAdminUser])
def admin_overview(request):
    user_counts = User.objects.aggregate(total=Count('id'), active=Count('id', filter=Q(is_active=True)))
    total_users = user_counts['total']
    active_users = user_counts['active']

    total_income = Transaction.objects.filter(type=Transaction.Type.INCOME).aggregate(total=Sum('amount'))['total'] or 0
    total_expenses = Transaction.objects.filter(type=Transaction.Type.EXPENSE).aggregate(total=Sum('amount'))['total'] or 0
    new_messages = Contact.objects.filter(is_read=False).count()
    feedback_count = Review.objects.count()

    level_counts = dict(LogEntry.objects.values_list('level').annotate(count=Count('id')))
    log_summary = {level: level_counts.get(level, 0) for level in LOG_LEVELS}

    transactions = [
        {'type': tx.type, 'label': tx.label, 'amount': tx.amount, 'time': tx.created_at.strftime('%H:%M')}
        for tx in Transaction.objects.all()[:20]
    ]

    def pct(count):
        return round((count / total_users) * 100) if total_users else 0

    engagement = User.objects.aggregate(
        with_profile=Count('id', filter=Q(profile__bio__gt='') | Q(profile__avatar__gt=''), distinct=True),
        with_enrollment=Count('id', filter=Q(course_enrollments__isnull=False), distinct=True),
        with_feedback=Count('id', filter=Q(reviews__isnull=False), distinct=True),
    )

    messages = [
        {
            'id': c.id,
            'name': c.name,
            'email': c.email,
            'preview': c.message[:120],
            'time': c.created_at.strftime('%Y-%m-%d %H:%M'),
            'is_read': c.is_read,
        }
        for c in Contact.objects.all()[:20]
    ]

    feedback = [
        {
            # Matches ReviewSerializer.get_name's fallback so the same review
            # shows the same display name here and on the public course page.
            'name': (r.user.full_name or r.user.email) if r.user else 'Anonymous',
            'text': r.comment,
            'rating': r.score,
            'time': r.created_at.strftime('%Y-%m-%d %H:%M'),
        }
        for r in Review.objects.select_related('user').all()[:20]
    ]

    score_counts = dict(Review.objects.values_list('score').annotate(count=Count('id')))
    rating_distribution = {str(score): score_counts.get(score, 0) for score in range(1, 6)}

    return Response({
        'stats': {
            'active_users': active_users,
            'total_revenue': total_income,
            'new_messages': new_messages,
            'feedback_count': feedback_count,
        },
        'log_summary': log_summary,
        'finance': {
            'total_income': total_income,
            'total_expenses': total_expenses,
            'net': total_income - total_expenses,
            'transactions': transactions,
        },
        'users_report': {
            'active_percent': pct(active_users),
            'profile_completion_percent': pct(engagement['with_profile']),
            'enrollment_percent': pct(engagement['with_enrollment']),
            'feedback_percent': pct(engagement['with_feedback']),
        },
        'messages': messages,
        'feedback': feedback,
        'rating_distribution': rating_distribution,
    })


@api_view(['PATCH'])
@permission_classes([IsAdminUser])
def admin_mark_message_read(request, pk):
    contact = Contact.objects.filter(pk=pk).first()
    if not contact:
        return Response({'error': 'Message not found.'}, status=404)
    contact.is_read = True
    contact.save(update_fields=['is_read'])
    return Response({'id': contact.id, 'is_read': True})


@api_view(['GET'])
@permission_classes([IsSuperUser])
def admin_logs(request):
    qs = LogEntry.objects.all()

    level = request.GET.get('level')
    if level:
        qs = qs.filter(level=level)

    search = request.GET.get('q')
    if search:
        qs = qs.filter(Q(message__icontains=search) | Q(logger_name__icontains=search))

    paginator = Paginator(qs, 50)
    page = paginator.get_page(request.GET.get('page'))

    return Response({
        'results': [
            {
                'time': entry.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                'level': entry.level,
                'logger_name': entry.logger_name,
                'message': entry.message,
            }
            for entry in page
        ],
        'count': paginator.count,
        'page': page.number,
        'num_pages': paginator.num_pages,
        'has_previous': page.has_previous(),
        'has_next': page.has_next(),
        'start_index': page.start_index() if paginator.count else 0,
        'end_index': page.end_index(),
    })
