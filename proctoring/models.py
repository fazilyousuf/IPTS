from django.conf import settings
from django.db import models
from django.utils import timezone

class ProctorAnomaly(models.Model):
    EVENT_TYPES = [
        ("no_face", "No face"),
        ("multiple_faces", "Multiple faces"),
        ("phone_detected", "Phone detected"),
        ("looking_away", "Looking away"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="proctor_anomalies",
    )
    exam_id = models.IntegerField()
    event_type = models.CharField(max_length=64, choices=EVENT_TYPES)
    timestamp = models.DateTimeField()  # when the event occurred (from client)
    message = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user} – {self.event_type} – exam {self.exam_id}"

class ProctorAnomalyAggregate(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="proctor_anomaly_aggregates",
    )
    exam_id = models.IntegerField()
    event_type = models.CharField(max_length=64, choices=ProctorAnomaly.EVENT_TYPES)
    count = models.IntegerField(default=0)
    last_seen = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ("user", "exam_id", "event_type")
        ordering = ["-last_seen"]

    def __str__(self):
        return f"{self.user} | exam {self.exam_id} | {self.event_type} = {self.count}"
