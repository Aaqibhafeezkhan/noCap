"""Locate Demucs weights: bundled inside the packaged app, or torch.hub's cache in dev."""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

BUNDLE_DIRNAME = "demucs_models"


def bundled_demucs_dir() -> Path | None:
    """Return the torch.hub dir shipped inside the app bundle, or None in dev mode.

    The folder mirrors torch.hub's layout (`checkpoints/<sig>-<hash>.th`), so demucs'
    usual remote loader finds the weights there and never downloads.
    """
    resources = os.environ.get("NOCAP_RESOURCES")
    if resources:
        d = Path(resources) / BUNDLE_DIRNAME
        if any((d / "checkpoints").glob("*.th")):
            return d
    return None


def load_model(model_name: str = "htdemucs"):
    """Load a Demucs model, reading bundled weights when the app ships them."""
    import torch
    from demucs.pretrained import get_model

    bundled = bundled_demucs_dir()
    if bundled is None:
        return get_model(model_name)
    previous = torch.hub.get_dir()
    torch.hub.set_dir(str(bundled))
    try:
        return get_model(model_name)
    finally:
        torch.hub.set_dir(previous)


def export_bundle(out_dir: Path, model_name: str = "htdemucs") -> list[Path]:
    """Copy `model_name`'s checkpoints into `out_dir/checkpoints` (build-time helper).

    Checkpoints come from torch.hub's cache; missing ones are downloaded first.
    """
    import torch
    import yaml
    from demucs.pretrained import REMOTE_ROOT, _parse_remote_files, get_model

    signatures = yaml.safe_load((REMOTE_ROOT / f"{model_name}.yaml").read_text())["models"]
    urls = _parse_remote_files(REMOTE_ROOT / "files.txt")
    hub_dir = Path(torch.hub.get_dir()) / "checkpoints"
    checkpoints = [hub_dir / urls[sig].rsplit("/", 1)[1] for sig in signatures]
    if not all(p.is_file() for p in checkpoints):
        get_model(model_name)  # populates the torch.hub cache

    dest = out_dir / "checkpoints"
    dest.mkdir(parents=True, exist_ok=True)
    return [Path(shutil.copy2(src, dest / src.name)) for src in checkpoints]


if __name__ == "__main__":
    for path in export_bundle(Path(sys.argv[1]), *sys.argv[2:3]):
        print(f"  {path}")
