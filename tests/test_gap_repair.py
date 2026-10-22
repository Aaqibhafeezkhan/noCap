from __future__ import annotations

import unittest

import numpy as np

from nocap.audio import gap_repair
from nocap.audio.transcriber import TranscriptWord

SR = gap_repair.SAMPLE_RATE


def _stem(seconds: float, active: list[tuple[float, float]]) -> np.ndarray:
    """Quiet noise with loud 'vocal' bursts in the given (start, end) ranges."""
    rng = np.random.default_rng(0)
    audio = rng.normal(0, 0.001, int(seconds * SR)).astype(np.float32)
    for start, end in active:
        audio[int(start * SR): int(end * SR)] = rng.normal(0, 0.2, int((end - start) * SR))
    return audio


def _words(*spans: tuple[str, float, float]) -> list[TranscriptWord]:
    return [TranscriptWord(w, s, e) for w, s, e in spans]


def _every_half_second(start: float, end: float) -> list[TranscriptWord]:
    return [TranscriptWord("yo", t, t + 0.4) for t in np.arange(start, end, 0.5)]


class CollapseRepeatsTest(unittest.TestCase):
    def test_stacked_loop_collapses_but_spaced_repeats_stay(self) -> None:
        loop = _words(*[("you,", 207.5, 207.5)] * 50)
        lyric = _words(("you", 10.0, 10.2), ("you", 10.3, 10.5), ("you", 10.6, 10.8))
        self.assertEqual(len(gap_repair.collapse_repeats(loop)), 1)
        self.assertEqual(len(gap_repair.collapse_repeats(lyric)), 3)


class FindGapsTest(unittest.TestCase):
    def test_sung_stretch_without_words_is_a_gap(self) -> None:
        audio = _stem(20, [(2, 18)])
        words = _every_half_second(2, 8) + _every_half_second(14, 18)
        gaps = gap_repair.find_gaps(audio, words)
        self.assertEqual(len(gaps), 1)
        start, end = gaps[0]
        self.assertAlmostEqual(start, 8.0, delta=0.5)
        self.assertAlmostEqual(end, 14.0, delta=0.5)

    def test_silence_and_short_holes_are_not_gaps(self) -> None:
        audio = _stem(20, [(2, 8), (12, 18)])  # 8-12 s is silent
        words = _every_half_second(2, 5) + _every_half_second(6.5, 8) + _every_half_second(12, 18)
        self.assertEqual(gap_repair.find_gaps(audio, words), [])


class RepairTest(unittest.TestCase):
    def test_hole_is_decoded_on_its_own_and_merged(self) -> None:
        audio = _stem(20, [(2, 18)])
        words = _every_half_second(2, 8) + _every_half_second(14, 18)
        clips: list[float] = []

        def decode(clip):
            clips.append(len(clip) / SR)
            return _words(("found", 1.5, 1.9), ("it", 3.0, 3.3))  # clip-relative

        repaired = gap_repair.repair(audio, words, decode)
        self.assertEqual(len(clips), 1)
        added = [w for w in repaired if w.word in ("found", "it")]
        self.assertEqual(len(added), 2)
        self.assertTrue(all(8.0 <= w.start < 14.5 for w in added))
        self.assertEqual([w.start for w in repaired], sorted(w.start for w in repaired))

    def test_dense_hallucination_in_a_hole_is_dropped(self) -> None:
        audio = _stem(20, [(2, 18)])
        words = _every_half_second(2, 8) + _every_half_second(14, 18)

        def decode(clip):
            return [TranscriptWord(f"w{i}", 1.0 + i * 0.01, 1.0 + i * 0.01 + 0.2) for i in range(200)]

        self.assertEqual(len(gap_repair.repair(audio, words, decode)), len(words))

    def test_repair_continues_after_whisper_stops_early(self) -> None:
        # A short phrase, then Whisper ends the decode: the rest of the hole is retried.
        audio = _stem(40, [(2, 38)])
        words = _every_half_second(2, 5) + _every_half_second(35, 38)
        calls: list[int] = []

        def decode(clip):
            calls.append(len(clip))
            if len(calls) == 1:
                return _words(("intro", 0.3, 0.8))  # stops after the first phrase
            return [TranscriptWord("bar", t, t + 0.4) for t in np.arange(0.3, 8.0, 0.5)]

        repaired = gap_repair.repair(audio, words, decode)
        self.assertGreaterEqual(len(calls), 2)
        self.assertTrue(any(w.word == "intro" for w in repaired))
        self.assertGreater(sum(w.word == "bar" for w in repaired), 10)

    def test_empty_pass_is_retried_a_few_seconds_later(self) -> None:
        audio = _stem(40, [(2, 38)])
        words = _every_half_second(2, 5) + _every_half_second(35, 38)
        calls: list[int] = []

        def decode(clip):
            calls.append(len(clip))
            if len(calls) == 1:
                return []  # e.g. a producer tag at the start of the hole blocks the decode
            return [TranscriptWord("bar", t, t + 0.4) for t in np.arange(0.3, 25.0, 0.5)]

        repaired = gap_repair.repair(audio, words, decode)
        self.assertEqual(2, len(calls))
        self.assertGreater(sum(w.word == "bar" for w in repaired), 30)

    def test_retry_starts_at_the_hole_not_a_second_before(self) -> None:
        audio = _stem(20, [(2, 18)])
        words = _every_half_second(2, 8) + _every_half_second(14, 18)
        starts: list[float] = []

        def decode(clip):
            starts.append(len(clip) / SR)
            return []

        gap_repair.repair(audio, words, decode)
        hole_start, hole_end = gap_repair.find_gaps(audio, gap_repair.collapse_repeats(words))[0]
        expected = hole_end + gap_repair.CLIP_PAD - (hole_start - gap_repair.LEAD_IN)
        self.assertAlmostEqual(expected, starts[0], places=1)

    def test_no_gaps_means_no_decoding(self) -> None:
        audio = _stem(10, [(1, 9)])
        words = _every_half_second(1, 9)

        def decode(clip):
            raise AssertionError("should not decode")

        self.assertEqual(len(gap_repair.repair(audio, words, decode)), len(words))


if __name__ == "__main__":
    unittest.main()
