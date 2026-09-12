import logging
import re

from django.core.exceptions import ValidationError
from import_export import fields, resources, widgets
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

# The sheet's real header text varies by who filled it in — English column
# names one time, Persian labels the next, and sometimes a name that's close
# but not identical to the model field (e.g. "provider_site" instead of
# "provider_name", "time_required" instead of "hours"). Map every variant
# we've actually seen in a real uploaded file to the canonical column name
# the fields below expect, so any of them just works instead of the column
# silently being dropped.
HEADER_ALIASES = {
    'title': ['title', 'نام دوره', 'عنوان', 'عنوان دوره'],
    'category': ['category', 'دسته بندی', 'دستهبندی'],
    'description': ['description', 'توضیحات', 'توضیح'],
    'instructor_name': ['instructor_name', 'استاد', 'مدرس'],
    'source_url': ['source_url', 'لینک', 'url'],
    'provider_name': ['provider_name', 'provider_site', 'provider', 'سایت', 'پلتفرم'],
    'price': ['price', 'قیمت', 'هزینه'],
    'level': ['level', 'سطح'],
    'origin': ['origin', 'origin_language', 'منشا', 'نوع تولید'],
    'hours': ['hours', 'time_required', 'ساعت', 'مدت زمان', 'مدت'],
    'curriculum': ['curriculum', 'سرفصل', 'سرفصل ها', 'سرفصل‌ها'],
    'is_published': ['is_published', 'published', 'منتشر شده'],
}
_HEADER_ALIAS_LOOKUP = {
    alias.strip().lower(): canonical
    for canonical, aliases in HEADER_ALIASES.items()
    for alias in aliases
}

# Only these actually block a row — everything else below has a safe
# fallback (a parsed number, a matched choice, or the model's own default)
# so a formatting quirk in a secondary column never throws out an otherwise
# good row.
REQUIRED_FIELDS = {
    'title': 'عنوان دوره',
    'category': 'دسته‌بندی',
    'instructor_name': 'مدرس',
}

LEVEL_SYNONYMS = {
    Course.Level.BEGINNER: ['beginner', 'مبتدی', 'پایه', 'ابتدایی'],
    Course.Level.INTERMEDIATE: ['intermediate', 'متوسط', 'میانی'],
    Course.Level.ADVANCED: ['advanced', 'پیشرفته', 'حرفه‌ای'],
}

ORIGIN_SYNONYMS = {
    Course.Origin.DOMESTIC: ['domestic', 'original', 'تولید داخل', 'اورجینال', 'اصلی', 'فارسی'],
    Course.Origin.TRANSLATED: ['translated', 'ترجمه', 'ترجمه شده', 'دوبله', 'زیرنویس شده'],
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


class LenientIntWidget(widgets.Widget):
    """Pulls a plain integer out of messy cell text (thousands separators,
    currency/unit words like "199,000 تومان" or "10 ساعت") instead of
    raising and invalidating the whole row over a formatting quirk in a
    field that isn't essential enough to reject the course over."""

    def __init__(self, label):
        self.label = label

    def clean(self, value, row=None, **kwargs):
        if value in (None, ''):
            return 0
        digits = re.sub(r'[^\d]', '', str(value))
        if not digits:
            logger.warning('Course import: could not read a number from "%s" for %s, defaulting to 0.', value, self.label)
            return 0
        return int(digits)

    def render(self, value, obj=None):
        return str(value) if value is not None else ''


class SynonymChoiceWidget(widgets.Widget):
    """Matches a cell against known synonyms (English + Persian) for a
    TextChoices field and falls back to a default instead of raising, since
    an unrecognized level/origin shouldn't throw out the whole course."""

    def __init__(self, synonyms, default, label):
        self.lookup = {syn.strip().lower(): value for value, syns in synonyms.items() for syn in syns}
        self.default = default
        self.label = label

    def clean(self, value, row=None, **kwargs):
        if not value:
            return self.default
        match = self.lookup.get(str(value).strip().lower())
        if match is None:
            logger.warning('Course import: unrecognized %s value "%s", defaulting to "%s".', self.label, value, self.default)
            return self.default
        return match

    def render(self, value, obj=None):
        return value or ''


class CourseResource(resources.ModelResource):
    category = fields.Field(column_name='category', attribute='category', widget=CategoryWidget(Category, field='name'))
    provider_name = fields.Field(column_name='provider_name', attribute='provider_name', widget=widgets.CharWidget())
    # TextField has no entry in django-import-export's widget map (only
    # CharField does), so without an explicit CharWidget a blank cell comes
    # through as Python None instead of '' and violates the DB's NOT NULL
    # constraint on save.
    description = fields.Field(column_name='description', attribute='description', widget=widgets.CharWidget())
    curriculum = fields.Field(column_name='curriculum', attribute='curriculum', widget=widgets.CharWidget())
    price = fields.Field(column_name='price', attribute='price', widget=LenientIntWidget('قیمت'))
    hours = fields.Field(column_name='hours', attribute='hours', widget=LenientIntWidget('مدت زمان'))
    level = fields.Field(
        column_name='level', attribute='level',
        widget=SynonymChoiceWidget(LEVEL_SYNONYMS, Course.Level.BEGINNER, 'سطح'),
    )
    origin = fields.Field(
        column_name='origin', attribute='origin',
        widget=SynonymChoiceWidget(ORIGIN_SYNONYMS, Course.Origin.DOMESTIC, 'منشا'),
    )

    class Meta:
        model = Course
        # Matching on title means re-uploading the same (or a more complete)
        # sheet updates the existing courses instead of creating duplicates —
        # important now that a re-import is exactly how you'd backfill fields
        # an earlier, narrower version of this resource didn't capture yet.
        import_id_fields = ['title']
        fields = [
            'title', 'category', 'description', 'instructor_name', 'source_url',
            'provider_name', 'price', 'level', 'origin', 'hours', 'curriculum',
            'is_published',
        ]
        skip_unchanged = True
        report_skipped = True

    def before_import(self, dataset, **kwargs):
        raw_headers = list(dataset.headers)

        def normalize(header):
            if not header:
                return header
            cleaned = _INVISIBLE_CHARS.sub('', header).strip()
            return _HEADER_ALIAS_LOOKUP.get(cleaned.lower(), cleaned)

        dataset.headers = [normalize(header) for header in dataset.headers]
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
