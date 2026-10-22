from __future__ import annotations

import os
import unittest
from unittest import mock

import numpy as np

from nocap.audio import hallucination, vocal_segments
from nocap.audio.transcriber import TranscriptWord

SR = 16000


def stem(*spans: tuple[float, float], length: float = 20.0) -> np.ndarray:
    """A vocal stem that is silent except for a 220 Hz tone in each (start, end) span."""
    audio = np.zeros(int(length * SR), dtype=np.float32)
    for start, end in spans:
        t = np.arange(int(start * SR), int(end * SR))
        audio[t] = 0.3 * np.sin(2 * np.pi * 220 * t / SR)
    return audio


class HallucinationFilterTest(unittest.TestCase):
    def test_runaway_tokens(self) -> None:
        self.assertTrue(hallucination.is_runaway("a" * 40))
        self.assertTrue(hallucination.is_runaway("Ohhhhhhh"))
        self.assertFalse(hallucination.is_runaway("Hallelujah"))
        self.assertFalse(hallucination.is_runaway("committed"))
        self.assertTrue(hallucination.is_runaway("\U0001F3B5"))
        self.assertFalse(hallucination.is_runaway("24/7"))

    @mock.patch.dict(os.environ, {}, clear=False)
    def test_drops_words_over_silence_and_runaways(self) -> None:
        os.environ.pop("NOCAP_HALLUCINATION_FILTER", None)  # the default is on
        audio = stem((5.0, 10.0))
        words = [TranscriptWord("intro", 1.0, 1.4), TranscriptWord("real", 6.0, 6.4),
                 TranscriptWord("a" * 30, 7.0, 9.0), TranscriptWord("edge", 10.05, 10.4)]
        kept = [w.word for w in hallucination.clean(audio, words, vocal_stem=True)]
        self.assertEqual(["real", "edge"], kept)

    @mock.patch.dict(os.environ, {"NOCAP_HALLUCINATION_FILTER": "0"})
    def test_can_be_switched_off(self) -> None:
        words = [TranscriptWord("a" * 30, 0.0, 1.0)]
        self.assertEqual(words, hallucination.clean(stem(), words, vocal_stem=True))


class VocalSegmentsTest(unittest.TestCase):
    def test_splits_at_pauses_and_pads(self) -> None:
        spans = vocal_segments.segments(stem((1.0, 4.0), (6.0, 9.0)))
        self.assertEqual(2, len(spans))
        self.assertAlmostEqual(0.8, spans[0][0], places=1)
        self.assertAlmostEqual(9.2, spans[1][1], places=1)

    def test_short_last_phrase_joins_the_previous_one(self) -> None:
        spans = vocal_segments.segments(stem((1.0, 6.0), (7.0, 7.8)))
        self.assertEqual(1, len(spans))
        self.assertAlmostEqual(8.0, spans[0][1], places=1)

    def test_long_phrase_is_cut_under_whisper_window(self) -> None:
        spans = vocal_segments.segments(stem((0.0, 70.0), length=70.0))
        self.assertGreaterEqual(len(spans), 3)
        self.assertTrue(all(end - start <= vocal_segments.MAX_SEGMENT + 2 * vocal_segments.PAD + 1e-6 for start, end in spans))

    def test_transcribe_shifts_times_to_song_time(self) -> None:
        def decode(clip: np.ndarray) -> dict:
            return {"text": "yo", "language": "en",
                    "segments": [{"start": 0.5, "end": 1.0, "words": [{"word": "yo", "start": 0.5, "end": 0.8}]}]}

        result = vocal_segments.transcribe(stem((6.0, 9.0)), decode)
        word = result["segments"][0]["words"][0]
        self.assertAlmostEqual(5.8 + 0.5, word["start"], places=1)
        self.assertEqual("yo", result["text"])


class LoopGuardTest(unittest.TestCase):
    def test_detects_repetition_and_impossible_word_rate(self) -> None:
        loop = {"text": "I wanted it all, " * 40, "segments": [{"words": [{}] * 160}]}
        normal = {"text": "we nearly carried it to the end and every whisper", "segments": [{"words": [{}] * 10}]}
        self.assertTrue(vocal_segments.is_loop(loop, 28.0))
        self.assertFalse(vocal_segments.is_loop(normal, 5.0))

    def test_looping_segment_is_split_then_dropped(self) -> None:
        calls = []

        def decode(clip: np.ndarray) -> dict:
            calls.append(len(clip) / SR)
            return {"text": "la " * 200, "language": "en", "segments": [{"start": 0, "end": 1, "words": []}]}

        result = vocal_segments.transcribe(stem((1.0, 11.0), length=12.0), decode)
        self.assertEqual(3, len(calls))  # the whole segment, then its two halves
        self.assertEqual([], result["segments"])


class StemDecodingTest(unittest.TestCase):
    def test_stem_options_allow_fallback_without_silence_override(self) -> None:
        from nocap.audio import stem_decoding
        base = {"temperature": 0.0, "beam_size": 5}
        self.assertEqual(base, stem_decoding.options(base, vocal_stem=False))
        stem_opts = stem_decoding.options(base, vocal_stem=True)
        self.assertIsNone(stem_opts["no_speech_threshold"])
        self.assertEqual(0.0, stem_opts["temperature"][0])
        self.assertEqual(0.0, stem_decoding.first_temperature(stem_opts["temperature"]))

    def test_segments_decoded_only_at_the_last_temperature_are_dropped(self) -> None:
        from nocap.audio.whisper_torch import normalize_result
        raw = {"text": "", "segments": [
            {"text": "real", "start": 0, "end": 1, "temperature": 0.2, "words": [{"word": "real", "start": 0, "end": 1}]},
            {"text": "noise", "start": 1, "end": 2, "temperature": 1.0, "words": [{"word": "noise", "start": 1, "end": 2}]},
        ]}
        self.assertEqual(["real"], [seg["text"] for seg in normalize_result(raw)["segments"]])


if __name__ == "__main__":
    unittest.main()
