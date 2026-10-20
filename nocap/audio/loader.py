from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np

from nocap.i18n import msg


@dataclass
class AudioData:
    y: np.ndarray       # mono waveform samples
    sr: int             # sample rate
    duration: float     # seconds
    path: Path


def load(path: str | Path, target_sr: int = 22050) -> AudioData:
    """Load an audio file, resample to target_sr, convert to mono."""
    try:
        import librosa
    except ImportError as e:
        raise ImportError(msg("audio.needLibrosa")) from e

    path = Path(path)
    if not path.exists():
        raise FileNotFoundError(msg("audio.notFound", path=path))

    y, sr = librosa.load(str(path), sr=target_sr, mono=True)
    duration = librosa.get_duration(y=y, sr=sr)
    return AudioData(y=y, sr=sr, duration=float(duration), path=path)


def resample_to_16k(audio: AudioData) -> np.ndarray:
    """Return a float32 array at 16 kHz (Whisper's required rate)."""
    if audio.sr == 16000:
        return audio.y.astype(np.float32)
    import librosa
    return librosa.resample(audio.y, orig_sr=audio.sr, target_sr=16000).astype(np.float32)
