# summarizer/serializers.py
from rest_framework import serializers
from .models import Summarization

class SummarizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Summarization
        fields = ['id', 'email', 'input_text', 'summary_text', 'tokens_requested', 'created_at', 'client_ip']
        read_only_fields = ['id', 'summary_text', 'created_at', 'client_ip']
