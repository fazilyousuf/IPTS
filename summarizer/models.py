# summarizer/models.py
from django.db import models
from django.conf import settings

class Summarization(models.Model):
    # optional: you can later link to a user (ForeignKey) instead of email
    email = models.EmailField(blank=True, null=True)
    input_text = models.TextField()
    summary_text = models.TextField()
    tokens_requested = models.IntegerField(default=100)
    created_at = models.DateTimeField(auto_now_add=True)
    client_ip = models.GenericIPAddressField(null=True, blank=True)

    def __str__(self):
        return f"{self.email or 'anon'} - {self.created_at.isoformat()[:19]}"
