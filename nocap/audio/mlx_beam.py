"""Beam search for mlx-whisper, which only ships a greedy decoder.

Greedy decoding drops whole 30 s windows on dense or repetitive rap vocals
(e.g. 422 vs 553 words on one track), so the MLX backend decodes with the same
beam search as openai-whisper. ``BeamSearchDecoder`` is a port of
``whisper.decoding.BeamSearchDecoder``; ``patched_decoding()`` swaps it (plus
fixed timestamp rules) into ``mlx_whisper.decoding`` for one transcription.
"""
from __future__ import annotations

import contextlib
import dataclasses

import mlx.core as mx
import numpy as np
from mlx_whisper import decoding

from nocap.audio.mlx_timestamp_rules import fix_timestamp_rules


class BeamSearchDecoder(decoding.TokenDecoder):
    def __init__(self, beam_size: int, eot: int, inference, patience: float | None = None):
        self.beam_size = beam_size
        self.eot = eot
        self.inference = inference
        self.max_candidates = round(beam_size * (patience or 1.0))
        if self.max_candidates <= 0:
            raise ValueError(f"Invalid beam size ({beam_size}) or patience ({patience})")
        self.finished_sequences: list[dict[tuple, float]] | None = None

    def reset(self) -> None:
        self.finished_sequences = None

    def update(self, tokens: mx.array, logits: mx.array, sum_logprobs: mx.array):
        if tokens.shape[0] % self.beam_size != 0:
            raise ValueError(f"{tokens.shape}[0] % {self.beam_size} != 0")
        n_audio = tokens.shape[0] // self.beam_size
        if self.finished_sequences is None:
            self.finished_sequences = [{} for _ in range(n_audio)]

        logprobs = logits - mx.logsumexp(logits, axis=-1, keepdims=True)
        top = mx.argpartition(-logprobs, self.beam_size, axis=-1)[:, : self.beam_size + 1]
        top_logprobs = mx.take_along_axis(logprobs, top, axis=-1)
        prefixes, top, top_logprobs, sums = (
            tokens.tolist(), top.tolist(), top_logprobs.tolist(), sum_logprobs.tolist()
        )

        next_tokens, source_indices, next_sums, newly_finished = [], [], [], []
        for i in range(n_audio):
            scores: dict[tuple, float] = {}
            sources: dict[tuple, int] = {}
            for j in range(self.beam_size):
                idx = i * self.beam_size + j
                for token, logprob in zip(top[idx], top_logprobs[idx]):
                    sequence = tuple(prefixes[idx] + [token])
                    scores[sequence] = sums[idx] + logprob
                    sources[sequence] = idx

            finished: dict[tuple, float] = {}
            saved = 0
            for sequence in sorted(scores, key=scores.get, reverse=True):
                if sequence[-1] == self.eot:
                    finished[sequence] = scores[sequence]
                    continue
                next_tokens.append(sequence)
                next_sums.append(scores[sequence])
                source_indices.append(sources[sequence])
                saved += 1
                if saved == self.beam_size:
                    break
            newly_finished.append(finished)

        self.inference.rearrange_kv_cache(source_indices)
        for previous, new in zip(self.finished_sequences, newly_finished):
            for sequence in sorted(new, key=new.get, reverse=True):
                if len(previous) >= self.max_candidates:
                    break  # the candidate list is full
                previous[sequence] = new[sequence]

        completed = all(len(seqs) >= self.max_candidates for seqs in self.finished_sequences)
        return mx.array(next_tokens), completed, mx.array(next_sums, dtype=mx.float32)

    def finalize(self, preceding_tokens: mx.array, sum_logprobs: mx.array):
        """Return rectangular (n_audio, beam_size, L) tokens padded with EOT, as mlx expects."""
        preceding, sums = preceding_tokens.tolist(), sum_logprobs.tolist()
        candidates = []
        for i, sequences in enumerate(self.finished_sequences):
            if len(sequences) < self.beam_size:  # not enough finished: add the live beams
                for j in np.argsort(sums[i])[::-1]:
                    sequences[tuple(preceding[i][j] + [self.eot])] = sums[i][j]
                    if len(sequences) >= self.beam_size:
                        break
            best = sorted(sequences.items(), key=lambda kv: kv[1], reverse=True)
            candidates.append(best[: self.beam_size])

        length = max(len(seq) for group in candidates for seq, _ in group)
        tokens = [[list(seq) + [self.eot] * (length - len(seq)) for seq, _ in group] for group in candidates]
        scores = [[score for _, score in group] for group in candidates]
        return mx.array(tokens), mx.array(scores, dtype=mx.float32)


class BeamDecodingTask(decoding.DecodingTask):
    def __init__(self, model, options: decoding.DecodingOptions):
        beam_size = options.beam_size
        # Let the base class build the tokenizer and logit filters on its greedy path.
        super().__init__(model, dataclasses.replace(options, beam_size=None, patience=None))
        self.logit_filters = fix_timestamp_rules(self.logit_filters)
        if beam_size and beam_size > 1:
            self.options = options
            self.n_group = beam_size
            self.decoder = BeamSearchDecoder(beam_size, self.tokenizer.eot, self.inference, options.patience)

    def _main_loop(self, audio_features: mx.array, tokens: mx.array):
        if self.n_group > 1:
            # One audio per call (transcribe decodes a window at a time); every
            # beam needs its own copy so the cross-attention cache can be reordered.
            if audio_features.shape[0] != 1:
                raise ValueError("beam search decodes one audio window at a time")
            audio_features = mx.repeat(audio_features, self.n_group, axis=0)
        return super()._main_loop(audio_features, tokens)


@contextlib.contextmanager
def patched_decoding():
    """Make ``mlx_whisper`` honour ``beam_size`` (and decode timestamps like openai)."""
    original = decoding.DecodingTask
    decoding.DecodingTask = BeamDecodingTask
    try:
        yield
    finally:
        decoding.DecodingTask = original
