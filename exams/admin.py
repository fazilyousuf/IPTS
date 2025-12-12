from django.contrib import admin
from .models import Question, ExamSession, Answer

admin.site.register(Question)
admin.site.register(ExamSession)
admin.site.register(Answer)
