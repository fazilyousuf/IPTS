from django.urls import path
from .views import questions_list, start_exam, submit_answers

urlpatterns = [
    path('questions/', questions_list),
    path('start/', start_exam),
    path('<int:session_id>/submit/', submit_answers),
]
