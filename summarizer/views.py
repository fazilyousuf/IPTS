# summarizer/views.py
import os
import time
import logging
import math
from collections import Counter, defaultdict
from django.core.cache import cache
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework import status

from .models import Summarization
import requests

logger = logging.getLogger(__name__)

# Config
API_KEY = getattr(settings, "GOOGLE_GENERATIVE_API_KEY", None)
SAVE_TO_DB = getattr(settings, "SUMMARIZER_SAVE_TO_DB", True)
RATE_LIMIT_PER_HOUR = getattr(settings, "RATE_LIMIT_PER_HOUR", 5)

# Models to try (adjust to your account)
MODEL_GEMINI = "gemini-2.5-flash"      # change to available model
MODEL_BIS = "text-bison-001"    # fallback


def get_client_ip(request):
    xff = request.META.get("HTTP_X_FORWARDED_FOR")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def check_rate_limit(ip: str):
    if not ip:
        return True, RATE_LIMIT_PER_HOUR, 0
    key = f"summarizer:rate:{ip}"
    entry = cache.get(key)
    now = int(time.time())
    window = 3600
    if not entry:
        cache.set(key, (1, now), timeout=window)
        return True, RATE_LIMIT_PER_HOUR - 1, window
    count, start = entry
    elapsed = now - start
    if elapsed >= window:
        cache.set(key, (1, now), timeout=window)
        return True, RATE_LIMIT_PER_HOUR - 1, window
    if count >= RATE_LIMIT_PER_HOUR:
        return False, 0, window - elapsed
    cache.set(key, (count + 1, start), timeout=window - elapsed)
    return True, RATE_LIMIT_PER_HOUR - (count + 1), window - elapsed


def _extract_text_from_gemini_response(resp_json):
    # Try common shapes; return first found string or "".
    if not resp_json:
        return ""
    try:
        if isinstance(resp_json, dict):
            # candidate patterns
            if "candidates" in resp_json and isinstance(resp_json["candidates"], list):
                first = resp_json["candidates"][0]
                for k in ("output", "content", "text"):
                    if k in first:
                        v = first[k]
                        if isinstance(v, str):
                            return v
                        if isinstance(v, dict) and "text" in v:
                            return v["text"]
                        if isinstance(v, list) and len(v) and isinstance(v[0], dict):
                            for p in v:
                                if "text" in p:
                                    return p["text"]
            if "outputs" in resp_json and isinstance(resp_json["outputs"], list):
                out0 = resp_json["outputs"][0]
                if isinstance(out0, dict):
                    if "output" in out0 and isinstance(out0["output"], str):
                        return out0["output"]
                    content = out0.get("content")
                    if isinstance(content, list):
                        for c in content:
                            if isinstance(c, dict) and "text" in c:
                                return c["text"]
            for key in ("summary", "result"):
                if key in resp_json and isinstance(resp_json[key], str):
                    return resp_json[key]
        return ""
    except Exception:
        logger.exception("extract failed")
        return ""


def call_gemini_summarize(text: str, tokens: int):
    """
    Try Gemini generateContent, then text-bison generateText.
    Raise exceptions with useful messages on failure.
    """
    if not API_KEY:
        raise RuntimeError("GOOGLE_GENERATIVE_API_KEY not set")

    prompt = f"Summarize the following text concisely in about {tokens} tokens:\n\n{text}"

    # 1) Gemini-style (v1beta) generateContent
    try:
        gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL_GEMINI}:generateContent?key={API_KEY}"
        body = {
            "contents": [
                {"role": "user", "parts": [{"text": prompt}]}
            ],
            "maxOutputTokens": tokens
        }
        resp = requests.post(gemini_url, json=body, timeout=60)
        if resp.status_code == 200:
            data = resp.json()
            s = _extract_text_from_gemini_response(data)
            if s:
                return s.strip()
        # capture response for debug
        logger.warning("Gemini call status=%s body=%s", resp.status_code, resp.text)
    except Exception as e:
        logger.exception("Gemini request failed: %s", e)

    # 2) text-bison fallback (v1beta2)
    try:
        bis_url = f"https://generativelanguage.googleapis.com/v1beta2/models/{MODEL_BIS}:generateText?key={API_KEY}"
        body = {"prompt": {"text": prompt}, "maxOutputTokens": tokens}
        resp = requests.post(bis_url, json=body, timeout=60)
        if resp.status_code == 200:
            data = resp.json()
            s = _extract_text_from_gemini_response(data)
            if s:
                return s.strip()
        logger.warning("text-bison call status=%s body=%s", resp.status_code, resp.text)
    except Exception as e:
        logger.exception("text-bison request failed: %s", e)

    raise RuntimeError("LLM calls failed or returned empty. Check API key, model names and logs.")


# Simple extractive fallback summarizer (keeps API independent behavior).
# Not as good as LLM but ensures endpoint works when API fails.
def fallback_extractive_summary(text: str, max_sentences: int = 3):
    # Split into sentences naively (periods). For better results use nltk/punkt.
    sentences = [s.strip() for s in text.replace("\n", " ").split(".") if s.strip()]
    if not sentences:
        return ""
    # Build word frequencies (simple)
    words = []
    for s in sentences:
        for w in s.lower().split():
            w = "".join(ch for ch in w if ch.isalnum())
            if w:
                words.append(w)
    freqs = Counter(words)
    # Score sentences by sum of word frequencies (TF approximation)
    sent_scores = []
    for i, s in enumerate(sentences):
        score = 0
        for w in s.lower().split():
            w = "".join(ch for ch in w if ch.isalnum())
            if w:
                score += freqs.get(w, 0)
        # normalize by length
        if len(s.split()) > 0:
            score = score / math.log(len(s.split()) + 1)
        sent_scores.append((score, i, s))
    # pick top N sentences
    sent_scores.sort(reverse=True)
    top = sorted(sent_scores[:max_sentences], key=lambda x: x[1])  # keep original order
    summary = ". ".join([s for (_, _, s) in top])
    if summary and not summary.endswith("."):
        summary = summary + "."
    return summary


@csrf_exempt
@api_view(["POST"])
@permission_classes([AllowAny])
def summarize_view(request):
    email = request.data.get("email")
    text = request.data.get("text")
    try:
        tokens = int(request.data.get("tokens", 100))
    except Exception:
        tokens = 100

    if not text or not text.strip():
        return Response({"detail": "Text is required"}, status=status.HTTP_400_BAD_REQUEST)

    ip = get_client_ip(request)
    allowed, remaining, reset = check_rate_limit(ip)
    if not allowed:
        return Response({"detail": "Rate limit exceeded", "remaining": remaining, "reset_seconds": reset},
                        status=status.HTTP_429_TOO_MANY_REQUESTS)

    prepped_text = " ".join(text.split())
    summary_text = None
    used_gemini = False
    error_details = None

    # Try external LLM first; if it fails, use fallback
    try:
        summary_text = call_gemini_summarize(prepped_text, tokens)
        used_gemini = True
    except Exception as e:
        logger.exception("LLM summarization failed, falling back: %s", e)
        error_details = str(e)
        # Use extractive fallback
        summary_text = fallback_extractive_summary(prepped_text, max_sentences= max(1, min(5, tokens // 50)))

    saved = False
    if SAVE_TO_DB:
        try:
            Summarization.objects.create(email=email, input_text=prepped_text,
                                         summary_text=summary_text, tokens_requested=tokens, client_ip=ip)
            saved = True
        except Exception:
            logger.exception("Failed to save summarization to DB")

    response_payload = {
        "summary": summary_text,
        "saved": saved,
        "remaining": remaining,
        "used_gemini": used_gemini,
    }
    if error_details and not used_gemini:
        response_payload["error"] = error_details

    return Response(response_payload, status=200)
