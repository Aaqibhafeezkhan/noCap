from __future__ import annotations

import importlib.util
import math
import unittest
from types import SimpleNamespace

HAS_MLX = importlib.util.find_spec("mlx_whisper") is not None
EOT = 3
SOT = 9


def _logits(rows):
    import mlx.core as mx

    return mx.array([[math.log(p) for p in row] for row in rows], dtype=mx.float32)


class _Inference:
    def __init__(self) -> None:
        self.calls: list[list[int]] = []

    def rearrange_kv_cache(self, source_indices) -> None:
        self.calls.append(list(source_indices))


@unittest.skipUnless(HAS_MLX, "mlx-whisper not installed")
class BeamSearchDecoderTest(unittest.TestCase):
    def _decode(self):
        import mlx.core as mx
        from nocap.audio.mlx_beam import BeamSearchDecoder

        inference = _Inference()
        decoder = BeamSearchDecoder(2, EOT, inference)
        tokens = mx.array([[SOT], [SOT]])
        sums = mx.zeros(2)
        # Greedy takes token 0 (0.6) but then only reaches EOT with 0.25;
        # token 1 (0.35) ends with 0.9, so the best sequence is SOT 1 EOT.
        tokens, done, sums = decoder.update(tokens, _logits([[0.6, 0.35, 0.04, 0.01]] * 2), sums)
        self.assertFalse(done)
        step2 = [[0.25, 0.25, 0.25, 0.25] if row[-1] == 0 else [0.05, 0.03, 0.02, 0.9]
                 for row in tokens.tolist()]
        tokens, done, sums = decoder.update(tokens, _logits(step2), sums)
        self.assertFalse(done)  # only SOT 1 EOT has finished so far
        tokens, done, sums = decoder.update(tokens, _logits([[0.2, 0.2, 0.1, 0.5]] * 2), sums)
        return decoder, inference, tokens, done, sums

    def test_beam_beats_greedy_and_finishes_on_eot(self) -> None:
        decoder, _, tokens, done, sums = self._decode()
        self.assertTrue(done)
        final, scores = decoder.finalize(tokens.reshape(1, 2, -1), sums.reshape(1, 2))
        self.assertEqual(final.tolist()[0][0], [SOT, 1, EOT, EOT])  # EOT-padded
        self.assertAlmostEqual(math.exp(scores.tolist()[0][0]), 0.35 * 0.9, places=4)

    def test_kv_cache_follows_the_kept_beams(self) -> None:
        _, inference, _, _, _ = self._decode()
        self.assertEqual(inference.calls[:2], [[1, 1], [0, 0]])

    def test_extra_update_after_completion_is_a_no_op(self) -> None:
        decoder, _, tokens, _, sums = self._decode()
        before = [dict(s) for s in decoder.finished_sequences]
        flat = _logits([[0.25, 0.25, 0.25, 0.25]] * 2)
        _, done, _ = decoder.update(tokens, flat, sums)
        self.assertTrue(done)
        self.assertEqual(decoder.finished_sequences, before)


@unittest.skipUnless(HAS_MLX, "mlx-whisper not installed")
class TimestampRulesTest(unittest.TestCase):
    def test_no_all_masked_rows_when_timestamps_are_exhausted(self) -> None:
        import mlx.core as mx
        from nocap.audio.mlx_timestamp_rules import TimestampRules

        # vocab: 0..3 text, 4 = eot, 5 = no_timestamps, 6..9 timestamps
        tokenizer = SimpleNamespace(timestamp_begin=6, eot=4, no_timestamps=5)
        rules = TimestampRules(tokenizer, sample_begin=1, max_initial_timestamp_index=None)
        # last timestamp is the final one (9): every timestamp is now forbidden,
        # yet the raw logits favour timestamps; text and EOT must stay possible.
        tokens = mx.array([[SOT, 6, 1, 9, 2]])
        logits = mx.array([[0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 5.0, 5.0, 5.0, 5.0]])
        out = rules.apply(logits, tokens).tolist()[0]
        self.assertTrue(any(v > float("-inf") for v in out[:6]))
        self.assertTrue(all(v == float("-inf") for v in out[6:]))


if __name__ == "__main__":
    unittest.main()
