from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Question, ExamSession, Answer
from .serializers import QuestionSerializer, AnswerSerializer, ExamSessionSerializer


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def questions_list(request):
    qs = Question.objects.all()
    serializer = QuestionSerializer(qs, many=True)
    return Response(serializer.data)


@csrf_exempt
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_exam(request):
    session = ExamSession.objects.create(user=request.user)
    return Response(ExamSessionSerializer(session).data)


@csrf_exempt
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def submit_answers(request, session_id):
    """
    Expect:
    {
      "answers": [
        {"question": 1, "selected_option": "B"},
        ...
      ]
    }
    """
    try:
        session = ExamSession.objects.get(id=session_id, user=request.user)
    except ExamSession.DoesNotExist:
        return Response({'detail': 'Session not found'}, status=404)

    answers_data = request.data.get('answers', [])
    for ans in answers_data:
        serializer = AnswerSerializer(data=ans)
        serializer.is_valid(raise_exception=True)
        Answer.objects.create(
            session=session,
            question=serializer.validated_data['question'],
            selected_option=serializer.validated_data['selected_option'],
        )

    session.ended_at = timezone.now()
    session.save()

    correct_count = session.answers.filter(is_correct=True).count()
    total = session.answers.count()
    return Response({'correct': correct_count, 'total': total})
