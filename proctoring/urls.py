# proctoring/urls.py
from django.urls import path
from .views import log_anomaly, log_anomaly_batch

urlpatterns = [
    path("anomaly/", log_anomaly),
    path("anomaly/batch/", log_anomaly_batch),
]
