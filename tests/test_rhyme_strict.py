from __future__ import annotations

import unittest

from nocap.text.rhyme import classify_group, classify_pair, detect, profile_for_word
from nocap.text.syllables import analyze_line


def _wa(word: str):
    return analyze_line(word)[0]


class StrictRhymeMatchTest(unittest.TestCase):
    def test_same_stressed_vowel_words_rhyme(self) -> None:
        pairs = [("i", "my"), ("high", "like"), ("time", "rhyme"), ("light", "bite"), ("mind", "line"), ("me", "see"), ("you", "through")]
        for left, right in pairs:
            with self.subTest(pair=(left, right)):
                self.assertIsNotNone(classify_pair(_wa(left), _wa(right)))

    def test_different_stressed_vowel_never_rhymes(self) -> None:
        for other in ["on", "get", "but", "game", "call", "able", "okie", "cat", "bit"]:
            with self.subTest(word=other):
                self.assertIsNone(classify_pair(_wa("line"), _wa(other)))
        self.assertIsNone(classify_pair(_wa("cat"), _wa("bit")))
        self.assertIsNone(classify_pair(_wa("time"), _wa("game")))

    def test_function_words_have_no_rhyme_profile(self) -> None:
        for word in ["the", "a", "and", "on", "when", "at", "but", "from", "just", "to", "of", "with"]:
            with self.subTest(word=word):
                self.assertEqual("", profile_for_word(_wa(word)).key)

    def test_unstressed_only_words_do_not_rhyme(self) -> None:
        self.assertIsNone(classify_pair(_wa("the"), _wa("the")))

    def test_multi_syllable_rhymes_still_group(self) -> None:
        self.assertEqual("multi_syllable", classify_group([_wa("nation"), _wa("patience")]).kind)
        self.assertEqual("multi_syllable", classify_group([_wa("never"), _wa("ever")]).kind)
        self.assertEqual("perfect", classify_group([_wa("time"), _wa("rhyme")]).kind)

    def test_single_vowel_rhyme_is_not_multi_syllable(self) -> None:
        self.assertNotEqual("multi_syllable", classify_group([_wa("survive"), _wa("high")]).kind)


class StrictRhymeDetectTest(unittest.TestCase):
    def test_ay_group_rejects_function_and_other_vowel_words(self) -> None:
        text = "I get my high on when the time is right but from just at like fly"
        words = analyze_line(text)
        labels = detect(words)
        ay_words = {"i", "my", "high", "time", "right", "like", "fly"}
        intruders = {"get", "on", "when", "the", "is", "but", "from", "just", "at"}
        ay_labels = {labels[i] for i, w in enumerate(words) if w.clean in ay_words}
        self.assertEqual(1, len(ay_labels))
        self.assertNotEqual({""}, ay_labels)
        for idx, word in enumerate(words):
            if word.clean in intruders:
                self.assertNotIn(labels[idx], ay_labels, word.clean)

    def test_articles_and_conjunctions_form_no_group(self) -> None:
        words = analyze_line("the cat and the hat a dog and a log")
        labels = detect(words)
        for idx, word in enumerate(words):
            if word.clean in {"the", "a", "and"}:
                self.assertEqual("", labels[idx], word.clean)
        self.assertEqual(labels[1], labels[4])
        self.assertEqual(labels[6], labels[9])


if __name__ == "__main__":
    unittest.main()
