
## Findings (first run, 20 Jam-ALT songs, 2026-10-22)

- **Timing is strong.** For words that are recognised, the median start-time error is 96 ms over all songs and 47 ms on the two hip-hop songs; 81 % of words land within 300 ms (97 % on hip-hop). The flow map places syllables where they are sung.
- **Transcription is the weak point.** Pooled WER is 33.5 % (22 % on hip-hop). Most errors are deletions: Whisper skips whole passages, mostly sung choruses over dense mixes (e.g. 164 of 426 words missing on one pop song). Rap verses are transcribed better than sung pop.
- **Whisper hallucinations show up in 5 songs:**
  - a held vowel written as one 889-character "aaaa…" word (2 songs);
  - words invented over the intro before anyone sings (3 songs).

  Both are easy to filter: drop tokens that are a single repeated letter, and drop words that fall before the first vocal activity in the separated vocal stem.
- **Syllable count** is off by 14 % on average, almost entirely because of the skipped passages above (3 % on hip-hop).
- **BPM** is not scored yet: Jam-ALT has no tempo annotations. Add BPMs for your own tracks in `benchmark/data/own/manifest.csv`.
- **Line onset** is less precise than word onset (384 ms) because Jam-ALT line boundaries are drawn loosely around breaths; use the word onset column for timing.

## How to read this

- **WER / CER**: word / character error rate of the transcription against the reference lyrics, after lower-casing and removing punctuation. WER is pooled over all words of a set (total errors ÷ total reference words); CER is the median per song (a single runaway token can push one song past 100 %). Lower is better.
- **Word onset**: for words that were recognised correctly, the gap between our start time and the annotated start time. Only the Jam-ALT songs have word-level annotations (from JamendoLyrics).
- **Line onset**: the same for the first word of each lyric line, against the line start time (Jam-ALT annotations, or LRCLIB's synced lyrics for your own tracks — LRCLIB timings are community-made and less precise).
- **Syllable count error**: |our syllables − reference syllables| ÷ reference syllables, per song. The reference count uses the same CMU dictionary as noCap, so this shows how transcription errors change the number of blocks on the flow map, not the dictionary's own accuracy.
- **BPM Acc1 · Acc2**: songs whose detected tempo is within 4 % of the reference (Acc1), or within 4 % after allowing half / double / triple tempo (Acc2). Only songs with a known BPM count.

Settings: the same as the desktop app — vocal separation on, language detected automatically. Audio and lyrics stay local (`benchmark/data/`, git-ignored). Reproduce with `python -m benchmark.fetch_jamendo`, `python -m benchmark.fetch_lyrics`, `python -m benchmark.run`, `python -m benchmark.score`, `python -m benchmark.report`.
