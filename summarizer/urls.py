from django.urls import path
from .views import summarize_view

urlpatterns = [
    path('summarize/', summarize_view),
]
