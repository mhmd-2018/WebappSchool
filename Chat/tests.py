from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from .models import ConsultationRequest, MentorRequest

CONSULTATION_URL = reverse('chatbot:api-consultation')
MENTOR_URL = reverse('chatbot:api-mentor')

VALID_CONSULTATION = {
    'age': 22,
    'phone_number': '09123456789',
    'interest_field': 'برنامه‌نویسی و آی‌تی',
    'monthly_budget': '۱ تا ۲ میلیون تومان',
    'free_time': '۵ تا ۱۰ ساعت در هفته',
}

VALID_MENTOR = {
    'phone_number': '09121112233',
    'interest_field': 'دیجیتال مارکتینگ',
    'courses': 'پایتون مقدماتی، سئو',
}


class ConsultationApiTests(APITestCase):
    """تست‌های API درخواست مشاوره"""

    def test_create_consultation_successfully(self):
        response = self.client.post(CONSULTATION_URL, VALID_CONSULTATION, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ConsultationRequest.objects.count(), 1)
        obj = ConsultationRequest.objects.first()
        self.assertEqual(obj.age, 22)
        self.assertEqual(obj.phone_number, '09123456789')

    def test_persian_digits_are_normalized(self):
        payload = {**VALID_CONSULTATION, 'phone_number': '۰۹۱۲۳۴۵۶۷۸۹', 'age': '۲۲'}
        response = self.client.post(CONSULTATION_URL, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ConsultationRequest.objects.first().phone_number, '09123456789')

    def test_plus98_phone_is_normalized(self):
        payload = {**VALID_CONSULTATION, 'phone_number': '+98 912 345 6789'}
        response = self.client.post(CONSULTATION_URL, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ConsultationRequest.objects.first().phone_number, '09123456789')

    def test_invalid_phone_number_is_rejected(self):
        payload = {**VALID_CONSULTATION, 'phone_number': '12345'}
        response = self.client.post(CONSULTATION_URL, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('phone_number', response.data)
        self.assertEqual(ConsultationRequest.objects.count(), 0)

    def test_age_out_of_range_is_rejected(self):
        payload = {**VALID_CONSULTATION, 'age': 120}
        response = self.client.post(CONSULTATION_URL, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_missing_field_is_rejected(self):
        payload = {k: v for k, v in VALID_CONSULTATION.items() if k != 'monthly_budget'}
        response = self.client.post(CONSULTATION_URL, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class MentorApiTests(APITestCase):
    """تست‌های API درخواست منتور"""

    def test_create_mentor_successfully(self):
        response = self.client.post(MENTOR_URL, VALID_MENTOR, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(MentorRequest.objects.count(), 1)

    def test_missing_courses_is_rejected(self):
        payload = {k: v for k, v in VALID_MENTOR.items() if k != 'courses'}
        response = self.client.post(MENTOR_URL, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_short_courses_text_is_rejected(self):
        payload = {**VALID_MENTOR, 'courses': 'a'}
        response = self.client.post(MENTOR_URL, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
