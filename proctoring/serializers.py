from rest_framework import serializers
from .models import ProctorAnomaly, ProctorAnomalyAggregate

class ProctorAnomalySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProctorAnomaly
        fields = ["id", "exam_id", "event_type", "timestamp", "message", "created_at"]
        read_only_fields = ["id", "created_at"]

    def create(self, validated_data):
        user = self.context["request"].user
        return ProctorAnomaly.objects.create(user=user, **validated_data)

class ProctorAnomalyAggregateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProctorAnomalyAggregate
        fields = ["id", "user", "exam_id", "event_type", "count", "last_seen", "created_at"]
        read_only_fields = ["id", "created_at"]
