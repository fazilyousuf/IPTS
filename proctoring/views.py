from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from django.utils.dateparse import parse_datetime
from .serializers import ProctorAnomalySerializer, ProctorAnomalyAggregateSerializer
from .models import ProctorAnomaly, ProctorAnomalyAggregate

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def log_anomaly(request):
    serializer = ProctorAnomalySerializer(data=request.data, context={"request": request})
    if serializer.is_valid():
        anomaly = serializer.save()
        return Response(ProctorAnomalySerializer(anomaly).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def log_anomaly_batch(request):
    """
    Expected payload:
    {
      "exam_id": 123,
      "user_id": 42,           # optional (we will use request.user)
      "events": [
         { "event_type": "no_face", "count": 3, "first_ts": "...", "last_ts": "..." },
         ...
      ]
    }
    Response returns updated aggregates list.
    """
    user = request.user
    data = request.data
    exam_id = data.get("exam_id")
    events = data.get("events", [])

    if not exam_id or not isinstance(events, list):
        return Response({"detail": "exam_id and events required"}, status=status.HTTP_400_BAD_REQUEST)

    updated_aggregates = []

    for ev in events:
        event_type = ev.get("event_type")
        count = int(ev.get("count", 0))
        first_ts = ev.get("first_ts")
        last_ts = ev.get("last_ts")

        # update/create aggregate
        agg, created = ProctorAnomalyAggregate.objects.get_or_create(
            user=user, exam_id=exam_id, event_type=event_type,
            defaults={"count": 0, "last_seen": parse_datetime(last_ts) if last_ts else None}
        )

        # increment count and update last_seen
        agg.count = (agg.count or 0) + count
        if last_ts:
            parsed = parse_datetime(last_ts)
            if parsed:
                agg.last_seen = parsed
        agg.save()

        # Create a single ProctorAnomaly log entry for this aggregated event
        try:
            ts_parsed = parse_datetime(last_ts) if last_ts else None
            ProctorAnomaly.objects.create(
                user=user,
                exam_id=exam_id,
                event_type=event_type,
                timestamp=ts_parsed or None,
                message=f"Batch reported: count={count}, window_first={first_ts}, window_last={last_ts}"
            )
        except Exception:
            # don't fail the whole batch for logging error
            pass

        updated_aggregates.append({
            "event_type": agg.event_type,
            "count": agg.count,
            "last_seen": agg.last_seen.isoformat() if agg.last_seen else None,
        })

    return Response({"aggregates": updated_aggregates}, status=status.HTTP_200_OK)
