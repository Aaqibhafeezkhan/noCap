"""Parse whisper.cpp's JSON output into the segment/word dict the other backends return."""
from __future__ import annotations

import re


def normalize_whisper_cpp_json(data: dict) -> dict:
    transcription = data.get("transcription", [])
    segments = []
    for item in transcription:
        text = item.get("text", "").strip()
        if _is_special_token_text(text):
            text = ""
        start = _seconds_from_whisper_cpp_item(item, "from")
        end = _seconds_from_whisper_cpp_item(item, "to")
        segment = {"text": text, "start": start, "end": end}
        if _is_word_text(text):
            word = _item_word(item, text, start, end)
            segment["words"] = [word]
        segments.append(segment)

    return {
        "text": " ".join(seg["text"] for seg in segments if seg.get("text")).strip(),
        "language": data.get("result", {}).get("language", "en"),
        "segments": segments,
    }


def _item_word(item: dict, text: str, start: float, end: float) -> dict:
    token = _first_word_token(item)
    probability = float(token.get("p", 1.0)) if token else 1.0

    # Prefer DTW-aligned start when available — it is derived from cross-attention
    # alignment and gives ≈10 ms accuracy vs 20 ms-quantized segment boundaries.
    dtw_start = _token_dtw_start(token) if token else None
    if dtw_start is not None and 0.0 <= dtw_start <= end + 1.0:
        start = dtw_start

    token_end = _token_end(token) if token else None
    if token_end is not None and token_end > start + 0.02:
        end = min(end, token_end)
    return {"word": text, "start": start, "end": end, "probability": probability}


def _first_word_token(item: dict) -> dict | None:
    for token in item.get("tokens", []):
        text = token.get("text", "").strip()
        if _is_word_text(text):
            return token
    return None


def _token_end(token: dict | None) -> float | None:
    if not token:
        return None
    timestamps = token.get("timestamps")
    if not timestamps:
        return None
    return _seconds_from_timestamp(timestamps.get("to", "0"))


def _token_dtw_start(token: dict | None) -> float | None:
    """Return DTW-aligned token start in seconds, or None if unavailable.

    whisper.cpp stores ``t_dtw`` as a raw centisecond integer (10 ms/unit),
    the same internal unit as ``t0`` / ``t1`` before they are scaled to ms in
    the ``offsets`` field.  A negative value (-1) means DTW was not computed.
    """
    if not token:
        return None
    t_dtw = token.get("t_dtw")
    if t_dtw is None:
        return None
    val = int(t_dtw)
    if val < 0:
        return None
    return val / 100.0  # centiseconds → seconds


def _seconds_from_whisper_cpp_item(item: dict, key: str) -> float:
    offsets = item.get("offsets", {})
    if key in offsets:
        return float(offsets[key]) / 1000.0
    timestamps = item.get("timestamps", {})
    return _seconds_from_timestamp(timestamps.get(key, "0"))


def _is_special_token_text(text: str) -> bool:
    return bool(re.fullmatch(r"\[[A-Z0-9_ -]+\]", text))


def _is_word_text(text: str) -> bool:
    return bool(text and not _is_special_token_text(text) and re.search(r"[A-Za-z0-9']", text))


def _seconds_from_timestamp(value: str) -> float:
    value = value.replace(",", ".")
    parts = value.split(":")
    if len(parts) == 3:
        hours, minutes, seconds = parts
        return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    if len(parts) == 2:
        minutes, seconds = parts
        return int(minutes) * 60 + float(seconds)
    return float(value or 0)
