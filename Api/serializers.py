from django.contrib.auth import get_user_model
from rest_framework import serializers

from Courses.models import Course, Review
from User.models import phone_validator

User = get_user_model()


class ReviewSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()
    rating = serializers.IntegerField(source='score')
    text = serializers.CharField(source='comment')

    class Meta:
        model = Review
        fields = ['name', 'rating', 'text']

    def get_name(self, obj):
        if obj.user:
            return obj.user.full_name or obj.user.email
        return 'Anonymous'


class CourseSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source='title')
    category = serializers.CharField(source='category.name')
    summary = serializers.CharField(source='description')
    instructor = serializers.CharField(source='instructor_name')
    level = serializers.CharField(source='get_level_display')
    rating = serializers.SerializerMethodField()
    rating_count = serializers.ReadOnlyField()
    modules = serializers.ReadOnlyField()
    reviews = ReviewSerializer(many=True, read_only=True)

    class Meta:
        model = Course
        fields = [
            'id', 'name', 'category', 'summary', 'instructor', 'instructor_bio',
            'level', 'price', 'original_price', 'color', 'icon', 'lessons', 'hours',
            'rating', 'rating_count', 'modules', 'reviews',
        ]

    def get_rating(self, obj):
        return round(obj.average_rating, 1)


class ProfileSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=75, required=False, allow_blank=True)
    last_name = serializers.CharField(max_length=75, required=False, allow_blank=True)
    email = serializers.EmailField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(source='phone_number', max_length=11, required=False)
    bio = serializers.CharField(required=False, allow_blank=True)
    avatar = serializers.ImageField(required=False, allow_null=True)

    def validate_phone(self, value):
        phone_validator(value)
        user = self.context['request'].user
        if User.objects.exclude(pk=user.pk).filter(phone_number=value).exists():
            raise serializers.ValidationError('این شماره موبایل قبلا استفاده شده است.')
        return value

    def to_representation(self, instance):
        profile = instance.profile
        request = self.context.get('request')
        avatar_url = None
        if profile.avatar:
            avatar_url = profile.avatar.url
            if request is not None:
                avatar_url = request.build_absolute_uri(avatar_url)
        return {
            'first_name': instance.first_name,
            'last_name': instance.last_name,
            'email': instance.email or '',
            'phone': instance.phone_number,
            'bio': profile.bio,
            'avatar': avatar_url,
        }

    def update(self, instance, validated_data):
        user_fields = ['first_name', 'last_name', 'phone_number']
        for field in user_fields:
            if field in validated_data:
                setattr(instance, field, validated_data[field])
        if 'email' in validated_data:
            instance.email = validated_data['email'] or None
        instance.save()

        profile = instance.profile
        if 'bio' in validated_data:
            profile.bio = validated_data['bio']
        if 'avatar' in validated_data:
            profile.avatar = validated_data['avatar']
        profile.save()
        return instance
