from __future__ import annotations

import unittest

from benchmark.metrics import align, cer, normalize, onset_stats, tempo_accuracy, wer


class NormalizeTest(unittest.TestCase):
    def test_drops_tags_and_punctuation_keeps_backing_vocals(self) -> None:
        self.assertEqual(["i'm", "on", "the", "beat", "give", "me", "the", "same"],
                         normalize("[Chorus]\nI’m on the beat!\n(Give me the same)"))

    def test_splits_hyphens_and_strips_quotes(self) -> None:
        self.assertEqual(["double", "time", "rock"], normalize("Double-time 'rock'"))


class AlignmentTest(unittest.TestCase):
    def test_counts_each_error_kind(self) -> None:
        result = wer(["a", "b", "c", "d"], ["a", "x", "c", "d", "e"])
        self.assertEqual((3, 1, 0, 1), (result["ok"], result["sub"], result["del"], result["ins"]))
        self.assertAlmostEqual(0.5, result["rate"])

    def test_deletion_keeps_order(self) -> None:
        ops = align(["a", "b", "c"], ["a", "c"])
        self.assertEqual(["ok", "del", "ok"], [op.kind for op in ops])
        self.assertEqual((2, 1), (ops[2].ref, ops[2].hyp))

    def test_perfect_match_and_empty_hypothesis(self) -> None:
        self.assertEqual(0.0, wer(["a", "b"], ["a", "b"])["rate"])
        self.assertEqual(1.0, wer(["a", "b"], [])["rate"])

    def test_cer_counts_characters(self) -> None:
        self.assertAlmostEqual(1 / 3, cer(["cat"], ["car"]))


class OnsetAndTempoTest(unittest.TestCase):
    def test_onset_stats_in_milliseconds(self) -> None:
        stats = onset_stats([0.05, -0.2, 0.4])
        self.assertEqual(3, stats["n"])
        self.assertAlmostEqual(200.0, stats["median_ms"])
        self.assertAlmostEqual(1 / 3, stats["within_100ms"])
        self.assertAlmostEqual(2 / 3, stats["within_300ms"])

    def test_tempo_octave_errors_count_only_for_acc2(self) -> None:
        self.assertEqual((True, True), tempo_accuracy(91.0, 92.0))
        self.assertEqual((False, True), tempo_accuracy(184.0, 92.0))
        self.assertEqual((False, False), tempo_accuracy(120.0, 92.0))


if __name__ == "__main__":
    unittest.main()
