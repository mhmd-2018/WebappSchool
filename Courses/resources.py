import logging
import re

from django.core.exceptions import ValidationError
from import_export import fields, resources
from import_export.widgets import ForeignKeyWidget

from .models import Category, Course

# Routed through the project's DatabaseLogHandler (see root/settings/base.py's
# LOGGING['loggers']['Courses']), so every import attempt's diagnostics show
# up in the admin log dashboard (log_dashboard.html) without needing a
# developer to read server output.
logger = logging.getLogger(__name__)

# Excel headers typed in a right-to-left editor often carry an invisible
# directional-mark/zero-width character (RLM, LRM, ZWNJ, ZWSP, BOM) glued to
# the visible text. That makes e.g. "title" + RLM != "title", so the column
# silently fails to bind to any resource field.
_INVISIBLE_CHARS = re.compile('[' + ''.join(chr(c) for c in (0x200B, 0x200C, 0x200D, 0x200E, 0x200F, 0xFEFF)) + ']')

REQUIRED_FIELDS = {
    'title': 'عنوان دوره',
    'category': 'دسته‌بندی',
    'instructor_name': 'مدرس',
}


class CategoryWidget(ForeignKeyWidget):
    """Matches the category cell to Category.name ignoring case/whitespace,
    and raises a plain ValueError (shown as a normal field error in the
    import preview) instead of ForeignKeyWidget's raw DoesNotExist traceback."""

    def clean(self, value, row=None, **kwargs):
        value = (value or '').strip()
        if not value:
            return None
        match = Category.objects.filter(name__iexact=value).first()
        if not match:
            existing = ', '.join(Category.objects.values_list('name', flat=True))
            logger.warning('Course import: category "%s" not found. Existing categories: %s', value, existing)
            raise ValueError(
                f'دسته‌بندی "{value}" پیدا نشد. دسته‌بندی‌های موجود: {existing}'
            )
        return match


class CourseResource(resources.ModelResource):
    category = fields.Field(column_name='category', attribute='category', widget=CategoryWidget(Category, field='name'))
    provider_name = fields.Field(column_name='provider_name', attribute='provider_name')

    class Meta:
        model = Course
        import_id_fields = []
        fields = [
            'title', 'category', 'description', 'instructor_name',
            'source_url', 'provider_name', 'is_published',
        ]
        skip_unchanged = True
        report_skipped = True

    def before_import(self, dataset, **kwargs):
        raw_headers = list(dataset.headers)
        dataset.headers = [
            _INVISIBLE_CHARS.sub('', header).strip() if header else header
            for header in dataset.headers
        ]
        logger.info('Course import: raw headers %s -> normalized %s', raw_headers, dataset.headers)

    def before_import_row(self, row, row_number=None, **kwargs):
        self._current_row_number = row_number
        # Blank/whitespace-only required fields would otherwise fail with an
        # opaque IntegrityError deep in save() — skip_row below needs the
        # stripped value, so normalize it here first.
        for key in REQUIRED_FIELDS:
            if row.get(key):
                row[key] = str(row[key]).strip()

    def skip_row(self, instance, original, row, import_validation_errors=None):
        row_number = getattr(self, '_current_row_number', '?')
        present = {key: row.get(key) for key in REQUIRED_FIELDS}
        if not any(present.values()):
            # A fully blank row (e.g. a trailing empty line in the sheet) —
            # ignore it quietly instead of flagging it as an error.
            logger.info('Course import: row %s is fully blank, skipping silently.', row_number)
            return True

        missing = [label for key, label in REQUIRED_FIELDS.items() if not present[key]]
        if missing:
            # Surface this as a real validation error in the import preview
            # instead of a silent "skipped" row with no explanation.
            logger.warning(
                'Course import: row %s missing required field(s) %s. Row data: %s',
                row_number, missing, row,
            )
            errors = dict(import_validation_errors or {})
            errors.setdefault('__all__', []).append(
                f'فیلدهای الزامی خالی است: {", ".join(missing)}'
            )
            raise ValidationError(errors)

        return super().skip_row(instance, original, row, import_validation_errors)

    def after_import(self, dataset, result, **kwargs):
        counts = {}
        for row in result.rows:
            counts[row.import_type] = counts.get(row.import_type, 0) + 1
        logger.info('Course import finished: %s rows total, breakdown: %s', len(result.rows), counts)
