from django.contrib import admin
from import_export.admin import ImportExportModelAdmin

from .models import Category, Contact, Course, CourseEnrollment, Enrollment, Package, Review, Transaction
from .resources import CourseResource


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'slug']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(Course)
class CourseAdmin(ImportExportModelAdmin):
    resource_classes = [CourseResource]
    list_display = ['title', 'category', 'is_published', 'average_rating']
    list_filter = ['category',  'origin', 'is_free', 'is_published']
    search_fields = ['title', 'instructor_name', 'provider_name']
    prepopulated_fields = {'slug': ('title',)}


@admin.register(Review)
class ReviewAdmin(admin.ModelAdmin):
    list_display = ['course', 'user', 'score', 'recommend', 'created_at']
    list_filter = ['score', 'recommend']


@admin.register(CourseEnrollment)
class CourseEnrollmentAdmin(admin.ModelAdmin):
    list_display = ['user', 'course', 'progress', 'enrolled_at']
    list_filter = ['progress']


@admin.register(Contact)
class ContactAdmin(admin.ModelAdmin):
    list_display = ['name', 'email', 'subject', 'is_read', 'created_at']
    list_filter = ['subject', 'is_read']


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ['label', 'type', 'amount', 'created_at']
    list_filter = ['type']


@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ['name', 'course_count', 'price', 'is_active']


@admin.register(Enrollment)
class EnrollmentAdmin(admin.ModelAdmin):
    list_display = ['user', 'package', 'purchased_at']
    filter_horizontal = ['courses']
