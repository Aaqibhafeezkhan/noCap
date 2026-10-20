from __future__ import annotations

import os
import unittest
from unittest import mock

from nocap.audio import separator, transcriber, whisper_mlx, whisper_torch

RESULT = {"text": "yo", "language": "en", "segments": []}
OPTIONS = {"language": "en", "initial_prompt": None, "beam_size": 5, "temperature": 0.0}


def _run(env: str = "auto"):
    with mock.patch.dict(os.environ, {"NOCAP_WHISPER_BACKEND": env}):
        return transcriber._run_backends(None, **OPTIONS)


class WhisperBackendTest(unittest.TestCase):
    def test_mlx_is_preferred_and_gets_beam_size(self) -> None:
        with mock.patch.object(whisper_mlx, "is_available", return_value=True), \
                mock.patch.object(whisper_mlx, "run", return_value=RESULT) as mlx_run, \
                mock.patch.object(whisper_torch, "run") as torch_run:
            self.assertIs(_run(), RESULT)
        self.assertEqual(mlx_run.call_args.kwargs["beam_size"], 5)
        torch_run.assert_not_called()

    def test_mlx_failure_falls_back_to_torch(self) -> None:
        with mock.patch.object(whisper_mlx, "is_available", return_value=True), \
                mock.patch.object(whisper_mlx, "run", side_effect=RuntimeError("metal")), \
                mock.patch.object(whisper_torch, "run", return_value=RESULT) as torch_run, \
                self.assertLogs("nocap.audio.transcriber", "WARNING"):
            self.assertIs(_run(), RESULT)
        self.assertEqual(torch_run.call_args.kwargs["beam_size"], 5)

    def test_pinned_mlx_failure_raises(self) -> None:
        with mock.patch.object(whisper_mlx, "is_available", return_value=True), \
                mock.patch.object(whisper_mlx, "run", side_effect=RuntimeError("metal")), \
                self.assertRaises(RuntimeError):
            _run("mlx")

    def test_torch_backend_skips_mlx(self) -> None:
        with mock.patch.object(whisper_mlx, "is_available", return_value=True), \
                mock.patch.object(whisper_mlx, "run") as mlx_run, \
                mock.patch.object(whisper_torch, "run", return_value=RESULT):
            self.assertIs(_run("torch"), RESULT)
        mlx_run.assert_not_called()

    def test_missing_torch_whisper_falls_back_to_whisper_cpp(self) -> None:
        with mock.patch.object(whisper_mlx, "is_available", return_value=False), \
                mock.patch.object(whisper_torch, "run", side_effect=ImportError), \
                mock.patch.object(transcriber, "_run_whisper_cpp", return_value=RESULT) as cpp:
            self.assertIs(_run(), RESULT)
        cpp.assert_called_once()

    def test_mlx_unavailable_off_apple_silicon(self) -> None:
        with mock.patch.object(whisper_mlx.sys, "platform", "linux"):
            self.assertFalse(whisper_mlx.is_available())


class DemucsDeviceTest(unittest.TestCase):
    def test_env_override_wins(self) -> None:
        with mock.patch.dict(os.environ, {"NOCAP_DEMUCS_DEVICE": "cpu"}):
            self.assertEqual(separator.separation_device(), "cpu")

    def test_gpu_failure_retries_on_cpu(self) -> None:
        calls: list[str] = []

        def apply_model(model, wav, device, progress):
            calls.append(device)
            if device != "cpu":
                raise RuntimeError("MPS backend out of memory")
            return "sources"

        with mock.patch.object(separator, "separation_device", return_value="mps"), \
                self.assertLogs("nocap.audio.separator", "WARNING"):
            self.assertEqual(separator._apply_on_best_device(apply_model, None, None), "sources")
        self.assertEqual(calls, ["mps", "cpu"])


if __name__ == "__main__":
    unittest.main()
