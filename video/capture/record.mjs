// Records the footage for the promo: one continuous walkthrough at 2x, captured as
// timestamped JPEG frames through the Chrome DevTools screencast. The API is faked
// (`mocks.mjs`): a track is picked, analyzed, opened, explored, its lyrics fixed and exported.
// Scene starts and clicks are written to marks.json so the edit and the sound effects
// can line up with what happens on screen.
//
// usage: node capture/record.mjs [url]   (default http://localhost:5758/, a `nocap serve` backend)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { CURSOR } from './cursor.mjs';
import { MISHEARD, demoData, installMocks } from './mocks.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FRAMES = path.join(HERE, 'frames');
const URL = process.argv[2] ?? 'http://localhost:5758/';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

fs.rmSync(FRAMES, { recursive: true, force: true });
fs.mkdirSync(FRAMES, { recursive: true });

const browser = await chromium.launch({ executablePath: CHROME, args: ['--window-size=1440,900'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, colorScheme: 'dark' });
await page.addInitScript(CURSOR);
await page.addInitScript(() => {
  try { localStorage.clear(); localStorage.setItem('nocap.onboarding.seen', 'true'); } catch {}
});
await page.addInitScript(installMocks, demoData(HERE));
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
const tab = (name) => page.locator('nav.segmented button', { hasText: name });

await mouse.move(980, 700);
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 2880, maxHeight: 1800 });
await wait(400);

// Scene "drop": pick a track from the empty library; the analysis card runs through its steps.
mark('drop');
const chooser = page.waitForEvent('filechooser');
await clickOn(page.locator('.dropzone'), 900);
await (await chooser).setFiles({ name: 'late-night.wav', mimeType: 'audio/wav', buffer: Buffer.alloc(4096) });
await page.locator('.toast .btn-primary').waitFor({ timeout: 20000 });
await wait(700);

// Scene "flow": open it from the toast → the flow map.
mark('open');
await clickOn(page.locator('.toast .btn-primary'), 800);
await page.locator('.flow-scroll').waitFor();
mark('flow');
await wait(3600);

// Scene "rhymes": hover through rhyme group A; the tooltip follows.
const fb = await page.locator('.flow-scroll').boundingBox();
const rowY = (row) => fb.y + 28 + 56 * row + 29;
const beatX = (beat) => fb.x + 64 + ((fb.width - 112) / 4) * beat;
mark('rhymes');
await move(beatX(0.5), rowY(0), 600); await wait(900);
await move(beatX(1.75), rowY(0), 600); await wait(800);
await move(beatX(2.5), rowY(1), 600); await wait(800);
await move(beatX(3.25), rowY(1), 600); await wait(900);

// Scene "pocket": hover syllables whose pocket notch sits ahead / behind the grid.
mark('pocket');
await move(beatX(1.05), rowY(4), 700); await wait(1300);
await move(beatX(2.8), rowY(4), 700); await wait(1300);

// Scene "inspect": select bar 5 → inspector shows its metrics and lyrics.
mark('inspect');
await move(fb.x + 40, rowY(4), 600); await wait(200);
await click();
await wait(1200);
await move(1270, 420, 900); await wait(2200);

// Scene "zoom": zoom out to the whole verse, then back in to every syllable.
mark('zoom');
await move(fb.x + fb.width / 2, fb.y + fb.height - 60, 400);
const slider = page.locator('.zoom-control input[type=range]');
const sb = await slider.boundingBox();
const knobY = sb.y + sb.height / 2;
await move(sb.x + sb.width * 0.5, knobY, 600);
await mouse.down();
await move(sb.x + 4, knobY, 700);
await mouse.up(); await wait(1300);
await mouse.down();
await move(sb.x + sb.width * 0.5, knobY, 700);
await mouse.up(); await wait(1100);

// Scene "lyrics": the lyric sheet; fix the misheard word in bar 3, save, open the Export menu.
mark('lyrics');
await clickOn(tab('Lyrics'), 800);
await page.locator('.lyrics-screen').waitFor();
await wait(1600);
mark('edit');
await clickOn(page.getByRole('button', { name: 'Edit' }), 700);
const input = page.locator('#lyric-3');
await input.waitFor();
const ib = await input.boundingBox();
const value = await input.inputValue();
const at = value.indexOf(MISHEARD[1]);
// Double-click the misheard word (its position measured with the input's font) and type the fix.
const charW = await input.evaluate((el, { text, at }) => {
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.font = getComputedStyle(el).font;
  return { before: ctx.measureText(text.slice(0, at)).width, word: ctx.measureText(text.slice(at, at + 6)).width,
    pad: parseFloat(getComputedStyle(el).paddingLeft) };
}, { text: value, at });
await move(ib.x + charW.pad + charW.before + charW.word / 2, ib.y + ib.height / 2, 800);
await wait(200);
marks.clicks.push(now());
await mouse.dblclick(ib.x + charW.pad + charW.before + charW.word / 2, ib.y + ib.height / 2);
await wait(400);
await page.keyboard.type(MISHEARD[0], { delay: 85 });
await wait(600);
mark('save');
await clickOn(page.locator('.lyrics-editor button[type=submit]'), 700);
await page.locator('.lyrics-editor').waitFor({ state: 'detached' });
await wait(1300);
mark('export');
await clickOn(page.locator('.lyrics-actions .menu > button'), 700);
await wait(500);
const items = page.locator('.menu-popover .menu-item');
for (let i = 0; i < 3; i++) {
  const box = await items.nth(i).boundingBox();
  await move(box.x + box.width * 0.4, box.y + box.height / 2, 380); await wait(350);
}
await wait(500);
await page.keyboard.press('Escape');
await wait(300);

// Scene "report": the whole flow on one chart.
mark('report');
await clickOn(tab('Report'), 800);
await page.locator('.report-chart svg').waitFor();
await wait(1100);
const cb = await page.locator('.report-chart svg').boundingBox();
await move(cb.x + cb.width * 0.2, cb.y + cb.height * 0.35, 700);
await move(cb.x + cb.width * 0.7, cb.y + cb.height * 0.35, 2000);
await wait(1300);
mark('end');

await cdp.send('Page.stopScreencast');
await wait(300);

const start = frames[0].t;
const rel = (t) => Math.round((t - start) * 1000) / 1000;
marks.scenes = Object.fromEntries(Object.entries(marks.scenes).map(([k, t]) => [k, rel(t)]));
marks.clicks = marks.clicks.map(rel);
marks.duration = rel(frames.at(-1).t) + 0.5; // the encoder holds the last frame for 0.5 s
fs.writeFileSync(path.join(HERE, 'frames.json'), JSON.stringify(frames));
fs.writeFileSync(path.join(HERE, '..', 'src', 'marks.json'), JSON.stringify(marks, null, 2) + '\n');
console.log(`frames: ${frames.length}, duration: ${rel(frames.at(-1).t)}s`, marks);
// Closing can hang on the faked analysis stream; the frames are written by now.
await Promise.race([browser.close(), new Promise((resolve) => setTimeout(resolve, 3000))]);
process.exit(0);
