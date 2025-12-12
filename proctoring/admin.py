from django.contrib import admin
from .models import ProctorAnomaly, ProctorAnomalyAggregate

@admin.register(ProctorAnomaly)
class ProctorAnomalyAdmin(admin.ModelAdmin):
    list_display = ("user", "exam_id", "event_type", "timestamp", "created_at")
    list_filter = ("event_type", "exam_id")
    search_fields = ("user__username", "message")

@admin.register(ProctorAnomalyAggregate)
class ProctorAnomalyAggregateAdmin(admin.ModelAdmin):
    list_display = ("user", "exam_id", "event_type", "count", "last_seen")
    search_fields = ("user__username",)
