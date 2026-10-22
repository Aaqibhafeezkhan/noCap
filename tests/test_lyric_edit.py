from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from nocap.audio.beat_tracker import build_from_bpm
from nocap.audio.transcriber import TranscriptWord
from nocap.library import LibraryStore
from nocap.pipeline import lyric_edit, relyrics
from nocap.web.app import create_app
from nocap.web.state import SessionState

# 120 BPM: every bar is 2 s long.
LINES = [
    ["late", "night", "city", "lights"],
    ["I", "count", "the", "syllables"],
    ["pen", "moves", "to", "the", "beat"],
]


def _track() -> dict:
    grid = build_from_bpm(120, 8.0)
    beats = [{"time": b.time, "beat_no": b.beat_no, "bar_no": b.bar_no} for b in grid.beats]
    words = [
        TranscriptWord(text, bar * 2.0 + 0.1 + i * 0.4, bar * 2.0 + 0.4 + i * 0.4)
        for bar, line in enumerate(LINES) for i, text in enumerate(line)
    ]
    shell = {"metadata": {"title": "test", "bpm": 120.0, "duration": 8.0, "time_signature": 4}, "beats": beats}
    return relyrics.rebuild(shell, words, None)


def _bar_text(flowmap: dict, bar: int) -> list[str]:
    return [w["word"] for w in lyric_edit.words_by_bar(flowmap).get(bar, [])]


class RetimeTest(unittest.TestCase):
    def test_corrected_word_keeps_its_time_and_added_words_fill_the_gap(self) -> None:
        old = [{"word": "late", "start": 0.1, "end": 0.4}, {"word": "nite", "start": 0.5, "end": 0.8}]
        new = lyric_edit.retime(old, ["late", "night", "city", "lights"], (0.0, 2.0))
        self.assertEqual(["late", "night", "city", "lights"], [w.word for w in new])
        self.assertEqual((0.5, 0.8), (new[1].start, new[1].end))  # "nite" corrected to "night"
        self.assertTrue(0.8 <= new[2].start < new[3].start < 2.0)  # added after it, inside the bar
        self.assertEqual(sorted(w.start for w in new), [w.start for w in new])

    def test_word_added_after_a_held_word_stays_in_the_bar(self) -> None:
        old = [{"word": "someday", "start": 0.2, "end": 4.7}]  # held far past the bar line at 2.8
        new = lyric_edit.retime(old, ["someday", "again"], (0.1, 2.8))
        self.assertLess(new[1].start, 2.8)
        self.assertLessEqual(new[0].end, new[1].start)
        self.assertEqual(0.2, new[0].start)

    def test_words_added_to_an_empty_bar_span_the_bar(self) -> None:
        new = lyric_edit.retime([], ["one", "two"], (4.0, 6.0))
        self.assertAlmostEqual(4.0, new[0].start)
        self.assertAlmostEqual(6.0, new[-1].end)


class ApplyEditsTest(unittest.TestCase):
    def setUp(self) -> None:
        self.flowmap = _track()

    def test_only_the_edited_bar_changes(self) -> None:
        words = lyric_edit.apply_edits(self.flowmap, {2: "I count every syllable"})
        texts = [w.word for w in words]
        self.assertEqual(LINES[0] + ["I", "count", "every", "syllable"] + LINES[2], texts)

    def test_unknown_bar_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            lyric_edit.apply_edits(self.flowmap, {99: "nope"})


class RelyricsTest(unittest.TestCase):
    def test_edit_rebuilds_the_analysis_and_restore_brings_back_the_transcription(self) -> None:
        flowmap = _track()
        edited = relyrics.edit_lyrics(flowmap, {1: "late night city lights shine", 4: "brand new line here"}, None)
        self.assertEqual(LINES[0] + ["shine"], _bar_text(edited, 1))
        self.assertEqual(["brand", "new", "line", "here"], _bar_text(edited, 4))
        self.assertTrue(edited["metadata"]["lyrics_edited"])
        self.assertEqual(len(flowmap["words"]), len(edited["original_words"]))
        self.assertGreater(len(edited["syllables"]), len(flowmap["syllables"]))
        again = relyrics.edit_lyrics(edited, {1: "late night"}, None)  # the very first transcription is kept
        self.assertEqual(len(flowmap["words"]), len(again["original_words"]))
        restored = relyrics.restore_transcription(again, None)
        self.assertEqual([w["word"] for w in flowmap["words"]], [w["word"] for w in restored["words"]])
        self.assertNotIn("original_words", restored)


class ReplaceAnalysisTest(unittest.TestCase):
    def test_new_analysis_replaces_the_old_one_and_keeps_the_track(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            store = LibraryStore(Path(tmp))
            flowmap = _track()
            store.add_track("t1", "test", flowmap, None, None, "2026-10-22T00:00:00+00:00")
            edited = relyrics.edit_lyrics(flowmap, {2: "I count every syllable twice"}, None)
            meta = store.replace_analysis("t1", edited)
            loaded, *_ = store.load_track("t1")
            self.assertEqual("2026-10-22T00:00:00+00:00", meta["created_at"])
            self.assertEqual(len(edited["words"]), len(loaded["words"]))
            self.assertEqual(1, len(store.list_tracks()))
            with self.assertRaises(FileNotFoundError):
                store.replace_analysis("missing", edited)


class LyricsRoutesTest(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.store = LibraryStore(Path(self.tmp.name))
        self.store.add_track("t1", "test", _track(), None, None, "2026-10-22T00:00:00+00:00")
        self.client = create_app(Path(self.tmp.name), self.store, SessionState()).test_client()

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def test_save_and_restore(self) -> None:
        saved = self.client.post("/api/library/t1/lyrics", json={"bars": {"2": "I count every syllable"}})
        self.assertEqual(200, saved.status_code)
        self.assertEqual(["I", "count", "every", "syllable"], _bar_text(saved.get_json()["flowmap"], 2))
        reopened, *_ = self.store.load_track("t1")
        self.assertTrue(reopened["metadata"]["lyrics_edited"])
        restored = self.client.post("/api/library/t1/lyrics/restore")
        self.assertEqual(LINES[1], _bar_text(restored.get_json()["flowmap"], 2))

    def test_bad_requests(self) -> None:
        self.assertEqual(400, self.client.post("/api/library/t1/lyrics", json={}).status_code)
        self.assertEqual(400, self.client.post("/api/library/t1/lyrics", json={"bars": {"x": "a"}}).status_code)
        self.assertEqual(400, self.client.post("/api/library/t1/lyrics", json={"bars": {"99": "a"}}).status_code)
        self.assertEqual(404, self.client.post("/api/library/nope/lyrics", json={"bars": {"1": "a"}}).status_code)


if __name__ == "__main__":
    unittest.main()
