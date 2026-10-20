"""mlx-whisper backend: openai-whisper on the Apple Silicon GPU.

The model is built straight from the openai-whisper ``.pt`` checkpoint that the
PyTorch backend already uses, so no extra download is needed, and it gets the
same tuned cross-attention alignment heads, so DTW word timestamps match the
PyTorch backend. mlx-whisper itself only decodes greedily; beam search comes
and openai's timestamp rules come from ``nocap.audio.mlx_beam``.
"""
from __future__ import annotations

import importlib.util
import platform
import sys

from nocap.audio import whisper_torch


def is_available() -> bool:
    if sys.platform != "darwin" or platform.machine() != "arm64":
        return False
    return importlib.util.find_spec("mlx_whisper") is not None


def run(
    audio_arr,
    *,
    language: str | None,
    initial_prompt: str | None,
    beam_size: int,
    temperature: float,
    condition_on_previous_text: bool = True,
) -> dict:
    import mlx.core as mx
    import mlx_whisper
    from mlx_whisper.transcribe import ModelHolder

    from nocap.audio.mlx_beam import patched_decoding

    name = whisper_torch.model_name()
    model = load_model(name)
    # mlx_whisper.transcribe() takes a model path and loads through ModelHolder;
    # hand it our converted model instead and release it afterwards.
    ModelHolder.model, ModelHolder.model_path = model, name
    use_beam = beam_size > 1
    try:
        with patched_decoding():
            raw = mlx_whisper.transcribe(
                audio_arr,
                path_or_hf_repo=name,
                language=language,
                word_timestamps=True,
                initial_prompt=initial_prompt,
                beam_size=beam_size if use_beam else None,
                temperature=temperature,
                condition_on_previous_text=condition_on_previous_text,
                fp16=True,
                verbose=None,
            )
    finally:
        ModelHolder.model = ModelHolder.model_path = None
        del model
        mx.clear_cache()
    return whisper_torch.normalize_result(raw)


def load_model(name: str):
    """Convert the openai-whisper checkpoint ``name`` into an fp16 MLX model."""
    import mlx.core as mx
    import torch
    from mlx.utils import tree_unflatten
    from mlx_whisper import whisper as mlx_model
    from whisper import _ALIGNMENT_HEADS

    path = whisper_torch.checkpoint_dir() / f"{name}.pt"
    if not path.exists():
        raise FileNotFoundError(path)
    checkpoint = torch.load(path, map_location="cpu", weights_only=True)
    model = mlx_model.Whisper(mlx_model.ModelDimensions(**checkpoint["dims"]), mx.float16)
    weights = [
        _convert_weight(key, tensor)
        for key, tensor in checkpoint["model_state_dict"].items()
        # MLX computes the encoder's sinusoidal embedding itself.
        if key != "encoder.positional_embedding"
    ]
    del checkpoint
    model.update(tree_unflatten(weights))
    if name in _ALIGNMENT_HEADS:
        model.set_alignment_heads(_ALIGNMENT_HEADS[name])
    mx.eval(model.parameters())
    return model


def _convert_weight(key: str, tensor):
    import mlx.core as mx

    key = key.replace(".mlp.0", ".mlp1").replace(".mlp.2", ".mlp2")
    array = tensor.half().numpy()
    if key.endswith(".weight") and ".conv" in key and array.ndim == 3:
        array = array.swapaxes(1, 2)  # torch Conv1d (out, in, k) → MLX (out, k, in)
    return key, mx.array(array)
