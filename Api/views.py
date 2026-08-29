from django.contrib.auth import authenticate, get_user_model
from django.core.exceptions import ValidationError
from rest_framework.authtoken.models import Token
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from Courses.models import Contact, Course, CourseEnrollment, Review
from User.models import phone_validator

from .serializers import CourseSerializer, ProfileSerializer

User = get_user_model()


def _user_payload(user):
    return {'id': user.id, 'name': user.full_name or user.phone_number, 'phone': user.phone_number}


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
