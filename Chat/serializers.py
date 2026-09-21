import re

from rest_framework import serializers

from .models import ConsultationRequest, MentorRequest

# ---------------------------------------------------------------------------
# ابزارهای کمکی
# ---------------------------------------------------------------------------

# جدول تبدیل ارقام فارسی/عربی به انگلیسی
_DIGIT_MAP = str.maketrans('۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩', '01234567890123456789')


def normalize_digits(value):
    """تبدیل ارقام فارسی/عربی به انگلیسی (مثلاً ۰۹۱۲ به 0912)"""
    return str(value).translate(_DIGIT_MAP)


def normalize_phone(value):
    """
    نرمال‌سازی شماره موبایل به فرمت استاندارد 09xxxxxxxxx
    (پشتیبانی از +98 و 0098 و 98 ، حذف فاصله/خط تیره/پرانتز، تبدیل ارقام فارسی)
    """
    value = normalize_digits(value).strip()
    value = value.replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
    if value.startswith('+98'):
        value = '0' + value[3:]
    elif value.startswith('0098'):
        value = '0' + value[4:]
    elif value.startswith('98') and len(value) == 12:
        value = '0' + value[2:]
    elif len(value) == 10 and value.startswith('9'):
        value = '0' + value
    return value


# ---------------------------------------------------------------------------
# میکس‌های مشترک
# ---------------------------------------------------------------------------
class PersianErrorsMixin:
    """
    جایگزین کردن پیام‌های خطای پیش‌فرض (انگلیسی) DRF با معادل فارسی.
    پیام‌هایی که برای یک فیلد صریحاً مشخص شده باشند، اولویت دارند.
    """
    PERSIAN_ERRORS = {
        'required': 'این فیلد الزامی است.',
        'null': 'این فیلد نمی‌تواند خالی باشد.',
        'blank': 'این فیلد نمی‌تواند خالی باشد.',
        'invalid': 'مقدار واردشده معتبر نیست.',
        'max_length': 'متن واردشده بیش از حد طولانی است.',
        'min_length': 'متن واردشده بیش از حد کوتاه است.',
        'max_string_length': 'مقدار واردشده بیش از حد بزرگ است.',
    }

    def get_fields(self):
        """
        پیام‌های خطای پیش‌فرض (انگلیسی) DRF را با معادل فارسی جایگزین می‌کند.
        فقط کلیدهایی فارسی می‌شوند که پیام فعلی‌شان همان پیام پیش‌فرض کلاس است؛
        بنابراین پیام‌های سفارشی (مثل پیام‌های فیلد سن) دست‌نخورده می‌مانند.
        نکته: پراپرتی fields در DRF در هر بار access فیلدها را از نو
        می‌سازد؛ بنابراین جای درستِ پچ، همین get_fields است نه __init__.
        """
        fields = super().get_fields()
        for field in fields.values():
            # پیام‌های پیش‌فرض کلاس‌های سلسله‌مراتب فیلد را جمع کن
            class_defaults = {}
            for cls in reversed(type(field).__mro__):
                class_defaults.update(getattr(cls, 'default_error_messages', {}))
            new_messages = {}
            for key, msg in field.error_messages.items():
                if key in self.PERSIAN_ERRORS and class_defaults.get(key) == msg:
                    new_messages[key] = self.PERSIAN_ERRORS[key]  # پیش‌فرض → فارسی
                else:
                    new_messages[key] = msg  # پیام سفارشی → حفظ می‌شود
            field.error_messages = new_messages
        return fields


class PersianFriendlyIntegerField(serializers.IntegerField):
    """فیلد عددی که ارقام فارسی/عربی را هم می‌پذیرد (مثلاً «۲۲»)"""

    def to_internal_value(self, data):
        if isinstance(data, str):
            data = normalize_digits(data)
        return super().to_internal_value(data)


class CommonFieldValidationMixin:
    """اعتبارسنجی‌های مشترک بین هر دو فرم"""

    PHONE_ERROR = 'شماره موبایل معتبر نیست؛ نمونه صحیح: 09123456789'

    def validate_phone_number(self, value):
        normalized = normalize_phone(value)
        if not re.fullmatch(r'09\d{9}', normalized):
            raise serializers.ValidationError(self.PHONE_ERROR)
        return normalized

    def validate_interest_field(self, value):
        value = (value or '').strip()
        if len(value) < 2:
            raise serializers.ValidationError('زمینه مورد علاقه را انتخاب کنید.')
        return value


# ---------------------------------------------------------------------------
# سریالایزرها
# ---------------------------------------------------------------------------
class ConsultationRequestSerializer(
    PersianErrorsMixin, CommonFieldValidationMixin, serializers.ModelSerializer,
):
    """ثبت درخواست «مشاوره دوره» از سمت چت‌بات"""

    # max_length بزرگ‌تر از مدل است تا شماره‌های +98/0098 هم قبل از نرمال‌سازی رد نشوند
    phone_number = serializers.CharField(max_length=20)
    age = PersianFriendlyIntegerField(
        min_value=10,
        max_value=90,
        error_messages={
            'invalid': 'سن باید یک عدد صحیح باشد.',
            'min_value': 'سن باید حداقل ۱۰ سال باشد.',
            'max_value': 'سن باید حداکثر ۹۰ سال باشد.',
        },
    )

    class Meta:
        model = ConsultationRequest
        fields = [
            'id', 'age', 'phone_number', 'interest_field',
            'monthly_budget', 'free_time', 'source_page',
        ]
        read_only_fields = ['id']

    def validate_monthly_budget(self, value):
        value = (value or '').strip()
        if len(value) < 2:
            raise serializers.ValidationError('میزان هزینه ماهیانه را انتخاب کنید.')
        return value

    def validate_free_time(self, value):
        value = (value or '').strip()
        if len(value) < 2:
            raise serializers.ValidationError('میزان زمان آزاد را انتخاب کنید.')
        return value


class MentorRequestSerializer(
    PersianErrorsMixin, CommonFieldValidationMixin, serializers.ModelSerializer,
):
    """ثبت درخواست «منتور» از سمت چت‌بات"""

    phone_number = serializers.CharField(max_length=20)
    courses = serializers.CharField(
        min_length=3,
        error_messages={'min_length': 'لطفاً نام دوره‌ها را کامل‌تر بنویسید.'},
    )

    class Meta:
        model = MentorRequest
        fields = ['id', 'phone_number', 'interest_field', 'courses', 'source_page']
        read_only_fields = ['id']
