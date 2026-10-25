// Fake API for the recording, so the real UI shows an analysis, a library track and a
// lyrics edit without waiting on Whisper. Everything is built from the demo verse.
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const TITLE = 'Late Night';
export const MISHEARD = ['grooves', 'groups']; // bar 3 as "transcribed", fixed on screen

/** The demo flow map as the "transcribed" track, the fixed track, and its library entry. */
export function demoData(here) {
  const raw = execFileSync('npx', ['tsx', path.join(here, 'dump-demo.ts')], { cwd: path.join(here, '..'), encoding: 'utf8' });
  const fixed = JSON.parse(raw);
  fixed.metadata = { ...fixed.metadata, title: TITLE, lyrics_edited: true };
  const misheard = JSON.parse(JSON.stringify(fixed).replaceAll(`"${MISHEARD[0]}`, `"${MISHEARD[1]}`));
  misheard.metadata.lyrics_edited = false;
  const track = {
    id: 'late-night', title: TITLE, created_at: new Date().toISOString(), bpm: fixed.metadata.bpm,
    duration: fixed.metadata.duration, bars: fixed.bars.length, syllables: fixed.syllables.length,
    has_audio: false, has_vocals: true, summary: fixed.summary, bar_density: fixed.bars.map((bar) => bar.density),
  };
  return { fixed, misheard, track };
}

/** Runs in the page (addInitScript): replaces fetch for the endpoints the walkthrough uses. */
export function installMocks({ fixed, misheard, track }) {
  const realFetch = window.fetch.bind(window);
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const json = (body) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  let analyzed = false;

  // Analysis: each step with its progress and findings, about seven seconds in all.
  const script = [
    [300, { type: 'started', track_id: track.id, title: track.title }],
    [200, { type: 'progress', step: 'load' }],
    [700, { type: 'progress', step: 'load', done: true, info: { duration: track.duration } }],
    [200, { type: 'progress', step: 'beat', pct: 30 }],
    [600, { type: 'progress', step: 'beat', done: true, info: { bpm: track.bpm } }],
    ...[8, 25, 44, 63, 81].map((pct) => [420, { type: 'progress', step: 'separate', pct }]),
    [400, { type: 'progress', step: 'separate', done: true }],
    ...[20, 48, 76].map((pct) => [450, { type: 'progress', step: 'transcribe', pct }]),
    [400, { type: 'progress', step: 'transcribe', done: true, info: { words: fixed.words.length } }],
    [500, { type: 'progress', step: 'align', pct: 60 }],
    [500, { type: 'progress', step: 'align', done: true, info: { bars: track.bars, rhyme_groups: fixed.rhyme_groups.length } }],
    [600, 'complete'],
  ];
  function analysisStream() {
    const encoder = new TextEncoder();
    return new ReadableStream({
      async start(controller) {
        for (const [delay, message] of script) {
          await sleep(delay);
          if (message === 'complete') analyzed = true;
          const body = message === 'complete' ? { type: 'complete', flowmap: misheard, track, has_vocals: true } : message;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(body)}\n\n`));
        }
        controller.close();
      },
    });
  }

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const method = init?.method ?? 'GET';
    if (url === '/api/analyze' && method === 'POST') return new Response(analysisStream());
    if (url === '/api/library') return json({ tracks: analyzed ? [track] : [] });
    if (url.endsWith('/open')) return json({ flowmap: misheard, track, has_audio: false, has_vocals: true });
    if (url.endsWith('/lyrics') && method === 'POST') {
      await sleep(1100);
      return json({ flowmap: fixed, track });
    }
    return realFetch(input, init);
  };
}
