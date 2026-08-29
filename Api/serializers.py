from rest_framework import serializers

from Courses.models import Course, Review


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
