# noCap accuracy benchmark

| Set | Songs | WER | CER (median) | Word onset (median) | Words within 300 ms | Line onset (median) | Syllable count error | BPM Acc1 · Acc2 |
|---|---|---|---|---|---|---|---|---|
| Jam-ALT (CC songs, mixed genres) | 20 | 33.5% | 21.5% | 96 ms | 81.1% | 384 ms | 14.4% | – |
| All hip-hop | 2 | 22.0% | 12.7% | 47 ms | 96.8% | 162 ms | 3.0% | – |

## Per song (worst WER first)

| Song | Set | Genre | WER | Sub / Del / Ins | Word onset median | Runaway tokens | Words before vocals |
|---|---|---|---|---|---|---|---|
| LUNABLIND_-_Vision__Radio_Edit_ | jamendo | Pop | 73.8% | 167 / 22 / 28 | 144 ms | 0 | 0 |
| Avercage_-_Embers | jamendo | Rock | 69.2% | 54 / 81 / 0 | 142 ms | 0 | 0 |
| Moon_I_Mean_-_Wrong_Concept | jamendo | Reggae | 64.3% | 107 / 24 / 44 | 102 ms | 0 | 0 |
| Explosive_Ear_Candy_-_Like_The_Sun | jamendo | Pop | 64.1% | 108 / 164 / 1 | 355 ms | 0 | 0 |
| Pure_Mids_-_The_Leader | jamendo | Indie | 55.0% | 22 / 58 / 2 | 75 ms | 3 | 0 |
| The_Rinn_-_Voices__2017_Version_ | jamendo | Metal | 37.1% | 37 / 31 / 7 | 91 ms | 1 | 4 |
| Tom_Orlando_-_The_One__feat._Tina_G_ | jamendo | RNB | 33.7% | 84 / 118 / 9 | 56 ms | 0 | 0 |
| Wordsmith_-_The_Statement | jamendo | Hip-Hop | 31.7% | 133 / 29 / 24 | 41 ms | 0 | 0 |
| HILA_-_Give_Me_the_Same | jamendo | Pop | 31.7% | 44 / 52 / 5 | 97 ms | 0 | 1 |
| Kinematic_-_Peyote | jamendo | Rock | 28.3% | 12 / 23 / 10 | 68 ms | 0 | 0 |
| Rxbyn_-_Bad_Side | jamendo | RNB | 28.2% | 26 / 96 / 7 | 54 ms | 0 | 0 |
| Color_Out_-_Falling_Star | jamendo | Rock | 25.3% | 21 / 47 / 1 | 104 ms | 0 | 0 |
| Quentin_Hannappe_-_Keep_On | jamendo | Pop | 24.7% | 25 / 20 / 2 | 56 ms | 0 | 0 |
| The.madpix.project_-_One_Way_Street | jamendo | Electronic | 24.5% | 10 / 42 / 0 | 55 ms | 0 | 0 |
| Slingshot_Miracle_-_Whistler | jamendo | Blues | 23.9% | 22 / 14 / 3 | 105 ms | 0 | 0 |
| Songwriterz_-_Back_In_Time | jamendo | Pop | 23.3% | 26 / 43 / 1 | 99 ms | 0 | 0 |
| Ridgway_-_Fire_Inside | jamendo | Reggae | 20.1% | 24 / 17 / 20 | 71 ms | 0 | 2 |
| Lower_Loveday_-_Is_It_Right_ | jamendo | Indie | 14.8% | 11 / 19 / 2 | 79 ms | 0 | 0 |
| JASON_MILLER_-_CROWD_PLEASER | jamendo | Hip-Hop | 11.4% | 22 / 35 / 4 | 53 ms | 0 | 0 |
| Cortez_-_Feel__Stripped_ | jamendo | Pop | 8.7% | 16 / 15 / 0 | 76 ms | 0 | 0 |

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
