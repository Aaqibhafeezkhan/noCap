# noCap promo video

A 45-second promo (1920×1080, 30 fps), edited in code with [Remotion](https://www.remotion.dev).
The footage is a scripted walkthrough of the demo track. The soundtrack is a 92 BPM
boom-bap beat with UI sound effects, all synthesized by the scripts here, so it is
royalty-free.

## Rebuild

From the repository root:

```bash
cd frontend && npx vite build && cd ..                        # the UI the recording uses
PYTHONPATH=. .venv/bin/python -m nocap.cli serve --port 5758  # leave running
```

In a second terminal:

```bash
cd video && npm install
node capture/record.mjs                                       # frames + src/marks.json
swift capture/encode.swift capture/frames capture/frames.json public/clips/walkthrough.mp4
../.venv/bin/python audio/make_beat.py && ../.venv/bin/python audio/make_sfx.py
npm run render                                                # out/nocap-promo.mp4
```

`npm run studio` opens the timeline for previewing.

## Layout

- `src/timeline.ts`: tempo, scene list, captions and footage timing. Scenes start on bar lines.
- `src/camera.ts`: camera keyframes (in bars) over the app window.
- `src/Soundtrack.tsx`: the beat, plus each sound effect at its frame. Clicks follow `marks.json`.
- `audio/`: beat and sound-effect synthesis (numpy/scipy).
- `capture/`: recording at 2x through the Chrome DevTools screencast, and the H.264 encoder.

The generated footage, audio and renders (`public/clips`, `public/audio`, `out`) are not committed.
