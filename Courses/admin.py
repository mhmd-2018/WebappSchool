from django.contrib import admin

from .models import Category, Course, Enrollment, Package, Review


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['title', 'category', 'level', 'origin', 'price', 'is_free', 'is_published', 'average_rating']
    list_filter = ['category', 'level', 'origin', 'is_free', 'is_published']
    search_fields = ['title', 'instructor_name', 'provider_name']
    prepopulated_fields = {'slug': ('title',)}


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ['course', 'user', 'score', 'created_at']
    list_filter = ['score']


@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ['name', 'course_count', 'price', 'is_active']


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ['user', 'package', 'purchased_at']
    filter_horizontal = ['courses']
