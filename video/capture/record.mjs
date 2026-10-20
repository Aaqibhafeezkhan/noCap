// Records the footage for the promo: one continuous walkthrough of the demo track at 2x,
// captured as timestamped JPEG frames through the Chrome DevTools screencast.
// Scene starts and clicks are written to marks.json so the edit and the sound effects
// can line up with what happens on screen.
//
// usage: node capture/record.mjs [url]   (default http://localhost:5758/, a `nocap serve` backend)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { CURSOR } from './cursor.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRAMES = path.join(HERE, 'frames');
const URL = process.argv[2] ?? 'http://localhost:5758/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ['--window-size=1440,900'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });
await page.addInitScript(CURSOR);
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
// First-run state: an empty library, so the walkthrough starts from onboarding.
await page.route('**/api/library', (route) => route.fulfill({ json: { tracks: [] } }));
await page.goto(URL);
await page.waitForTimeout(1500);

const cdp = await page.context().newCDPSession(page);
const frames = [];
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  const file = `${String(frames.length).padStart(5, '0')}.jpg`;
  fs.writeFileSync(path.join(FRAMES, file), Buffer.from(data, 'base64'));
  frames.push({ file, t: metadata.timestamp });
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});

const mouse = page.mouse;
const wait = (ms) => page.waitForTimeout(ms);
const marks = { scenes: {}, clicks: [] };
const now = () => Date.now() / 1000;
const mark = (name) => { marks.scenes[name] = now(); };
const move = (x, y, ms = 700) => mouse.move(x, y, { steps: Math.max(8, Math.round(ms / 16)) });
const click = async () => { marks.clicks.push(now()); await mouse.down(); await wait(90); await mouse.up(); };
const clickOn = async (locator, ms = 700) => {
  const box = await locator.boundingBox();
  await move(box.x + box.width / 2, box.y + box.height / 2, ms);
  await wait(150);
  await click();
};

await mouse.move(560, 620);
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 2880, maxHeight: 1800 });
await wait(400);

// Scene "flow": onboarding → Try the demo → the flow map.
mark('flow');
await wait(500);
await clickOn(page.getByRole('button', { name: /Try the demo/ }), 800);
await page.locator('.flow-scroll').waitFor();
await wait(4200);

// Scene "rhymes": hover through rhyme group A; the tooltip follows.
const fb = await page.locator('.flow-scroll').boundingBox();
const rowY = (row) => fb.y + 28 + 56 * row + 29;
const beatX = (beat) => fb.x + 64 + ((fb.width - 112) / 4) * beat;
mark('rhymes');
await move(beatX(0.5), rowY(0), 600); await wait(1000);
await move(beatX(1.75), rowY(0), 600); await wait(900);
await move(beatX(2.5), rowY(1), 600); await wait(900);
await move(beatX(3.25), rowY(1), 600); await wait(1000);

// Scene "inspect": select bar 5 → inspector shows its metrics and lyrics.
mark('inspect');
await move(fb.x + 40, rowY(4), 700); await wait(200);
await click();
await wait(1400);
await move(1270, 420, 1000); await wait(2600);

// Scene "pocket": hover syllables whose pocket notch sits ahead / behind the grid.
mark('pocket');
await move(beatX(1.05), rowY(4), 700); await wait(1500);
await move(beatX(2.8), rowY(4), 700); await wait(1500);
await move(beatX(0.95), rowY(5), 700); await wait(1400);

// Scene "zoom": zoom out to the whole verse, then back in to every syllable.
mark('zoom');
await move(fb.x + fb.width / 2, fb.y + fb.height - 60, 400);
const slider = page.locator('.zoom-control input[type=range]');
const sb = await slider.boundingBox();
const knobY = sb.y + sb.height / 2;
await move(sb.x + sb.width * 0.5, knobY, 700);
await mouse.down();
await move(sb.x + 4, knobY, 700);
await mouse.up(); await wait(1500);
await mouse.down();
await move(sb.x + sb.width * 0.5, knobY, 700);
await mouse.up(); await wait(1400);

// Scene "report": the whole flow on one chart.
mark('report');
await clickOn(page.locator('nav.segmented button', { hasText: 'Report' }), 800);
await page.locator('.report-chart svg').waitFor();
await wait(1200);
const cb = await page.locator('.report-chart svg').boundingBox();
await move(cb.x + cb.width * 0.2, cb.y + cb.height * 0.35, 700);
await move(cb.x + cb.width * 0.7, cb.y + cb.height * 0.35, 2200);
await wait(1500);
mark('end');

await cdp.send('Page.stopScreencast');
await wait(300);
await browser.close();

const start = frames[0].t;
const rel = (t) => Math.round((t - start) * 1000) / 1000;
marks.scenes = Object.fromEntries(Object.entries(marks.scenes).map(([k, t]) => [k, rel(t)]));
marks.clicks = marks.clicks.map(rel);
marks.duration = rel(frames.at(-1).t) + 0.5; // the encoder holds the last frame for 0.5 s
fs.writeFileSync(path.join(HERE, 'frames.json'), JSON.stringify(frames));
fs.writeFileSync(path.join(HERE, '..', 'src', 'marks.json'), JSON.stringify(marks, null, 2) + '\n');
console.log(`frames: ${frames.length}, duration: ${rel(frames.at(-1).t)}s`, marks);
