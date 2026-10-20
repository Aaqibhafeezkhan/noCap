from __future__ import annotations

# Grammatical words that are almost always unstressed in speech, so their vowel
# is not a rhyme the listener hears. Pronouns (I, my, you, me) stay rhymable.
WEAK_FUNCTION_WORDS = frozenset({
    "a", "an", "the",
    "and", "or", "nor", "but", "if", "as", "than", "then", "when",
    "of", "to", "in", "on", "at", "by", "for", "from", "with", "into", "onto", "upon",
    "is", "was", "are", "were", "am", "it", "its", "it's",
    "that", "this", "these", "those", "just",
    "em", "uh", "um",
})


def is_weak_function_word(clean: str) -> bool:
    return clean.strip("'") in WEAK_FUNCTION_WORDS
