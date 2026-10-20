"""openai-whisper's timestamp rules for mlx-whisper.

mlx-whisper's ``ApplyTimestampRules`` decides "force a timestamp" from the
unmasked logits. When every allowed timestamp is already masked, that leaves a
row of only -inf: log-probs turn into NaN, decoding emits token 0 ("!") and the
whole 30 s window is lost. This port follows openai-whisper and decides on the
masked logits.
"""
from __future__ import annotations

import mlx.core as mx
import numpy as np
from mlx_whisper import decoding


class TimestampRules(decoding.ApplyTimestampRules):
    def apply(self, logits: mx.array, tokens: mx.array) -> mx.array:
        tokenizer = self.tokenizer
        begin = tokenizer.timestamp_begin
        masked = np.array(logits, dtype=np.float32)
        if tokenizer.no_timestamps is not None:
            masked[:, tokenizer.no_timestamps] = -np.inf

        rows = tokens.tolist()
        for k, row in enumerate(rows):
            seq = row[self.sample_begin :]
            last_was_timestamp = len(seq) >= 1 and seq[-1] >= begin
            penultimate_was_timestamp = len(seq) < 2 or seq[-2] >= begin
            if last_was_timestamp:
                if penultimate_was_timestamp:  # has to be non-timestamp
                    masked[k, begin:] = -np.inf
                else:  # cannot be normal text tokens
                    masked[k, : tokenizer.eot] = -np.inf

            timestamps = [t for t in seq if t >= begin]
            if timestamps:
                # timestamps shouldn't decrease, and segments need a nonzero length
                last = timestamps[-1]
                if not (last_was_timestamp and not penultimate_was_timestamp):
                    last += 1
                masked[k, begin:last] = -np.inf

        if len(rows[0]) == self.sample_begin:
            masked[:, :begin] = -np.inf  # start with a timestamp
            if self.max_initial_timestamp_index is not None:
                masked[:, begin + self.max_initial_timestamp_index + 1 :] = -np.inf

        # if the timestamps together outweigh every text token, sample a timestamp
        with np.errstate(invalid="ignore", divide="ignore"):
            peak = masked.max(axis=-1, keepdims=True)
            logprobs = masked - (peak + np.log(np.exp(masked - peak).sum(axis=-1, keepdims=True)))
            ts_peak = logprobs[:, begin:].max(axis=-1)
            timestamp_logprob = ts_peak + np.log(np.exp(logprobs[:, begin:] - ts_peak[:, None]).sum(axis=-1))
        force = timestamp_logprob > logprobs[:, :begin].max(axis=-1)
        masked[force, :begin] = -np.inf
        return mx.array(masked)


def fix_timestamp_rules(filters: list) -> list:
    """Replace mlx-whisper's ApplyTimestampRules in a task's logit filters."""
    fixed = []
    for f in filters:
        if type(f) is decoding.ApplyTimestampRules:
            f = TimestampRules(f.tokenizer, f.sample_begin, f.max_initial_timestamp_index)
        fixed.append(f)
    return fixed
