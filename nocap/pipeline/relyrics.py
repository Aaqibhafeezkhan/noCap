"""Re-analyses a track after its lyrics were edited, without transcribing again.

The beat grid comes from the saved flow map and the audio from the library, so
only the word-driven parts are recomputed: syllables, rhymes, bar metrics, the
summary and sections. The first edit keeps the original transcription in the
flow map ("original_words") so it can be restored.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from nocap.audio.beat_grid import Beat, BeatGrid
from nocap.audio.transcriber import TranscriptWord, words_to_timed_lines
from nocap.pipeline.lyric_edit import apply_edits


def edit_lyrics(flowmap: dict[str, Any], edits: dict[int, str], audio_path: Path | None) -> dict[str, Any]:
    original = flowmap.get("original_words") or flowmap.get("words", [])
    rebuilt = rebuild(flowmap, apply_edits(flowmap, edits), audio_path)
    rebuilt["original_words"] = original
    rebuilt["metadata"]["lyrics_edited"] = True
    return rebuilt


def restore_transcription(flowmap: dict[str, Any], audio_path: Path | None) -> dict[str, Any]:
    """Back to the words Whisper found, before any edit."""
    original = flowmap.get("original_words")
    if not original:
        return flowmap
    words = [TranscriptWord(w["word"], float(w["start"]), float(w["end"]), float(w.get("probability", 1.0))) for w in original]
    return rebuild(flowmap, words, audio_path)


def rebuild(flowmap: dict[str, Any], words: list[TranscriptWord], audio_path: Path | None) -> dict[str, Any]:
    from nocap.audio.loader import load
    from nocap.pipeline.service import _finish

    meta = flowmap.get("metadata", {})
    audio = load(audio_path) if audio_path and Path(audio_path).is_file() else None
    return _finish(
        title=meta.get("title", ""),
        grid=grid_from(flowmap),
        lines=words_to_timed_lines(words),
        audio_path=str(audio_path or meta.get("audio_path", "")),
        duration=float(meta.get("duration") or 0.0),
        transcript_words=words,
        audio_data=audio,
        reporter=None,
    )


def grid_from(flowmap: dict[str, Any]) -> BeatGrid:
    meta = flowmap.get("metadata", {})
    beats = [
        Beat(
            time=float(b["time"]),
            beat_no=int(b["beat_no"]),
            bar_no=int(b["bar_no"]),
            confidence=float(b.get("confidence", 1.0)),
            downbeat_confidence=float(b.get("downbeat_confidence", 0.0)),
            source=str(b.get("source", "detected")),
        )
        for b in flowmap.get("beats", [])
    ]
    return BeatGrid(bpm=float(meta.get("bpm") or 0.0), beats=beats, time_signature=int(meta.get("time_signature") or 4))
