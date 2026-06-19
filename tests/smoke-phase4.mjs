// Phase-4 hand-tracking smoke (camera-less): enable hand mode in test mode, then
// feed synthetic MediaPipe landmarks through window.__aetherHand.feed to verify
// (1) pinch draws ink, (2) the cursor + coach render, (3) open-hand dwell over a
// toolbar swatch fires a tool selection.
import { chromium } from 'playwright';

const URL = (process.env.URL || 'http://127.0.0.1:5199/') + '?handtest';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.addInitScript(() => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('aether-duels')) localStorage.removeItem(k);
  localStorage.setItem(
    'aether-duels:v3:profile',
    JSON.stringify({ name: 'Hands', xp: 0, onboarded: true }),
  );
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.menu-hero', { timeout: 8000 });
await page.locator('.menu-card', { hasText: 'Practice Round' }).click();
await page.waitForSelector('.match-hud', { timeout: 12000 });

// Enable hand mode (test mode — no camera/worker).
await page.locator('.match-hand-btn').click();
await page.waitForTimeout(150);

// Build a synthetic hand in-page. index tip at (nx,ny); pinch pulls thumb on.
await page.evaluate(() => {
  window.__hand = (nx, ny, pinch) => {
    const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
    lm[0] = { x: 0.5, y: 0.9 };
    lm[9] = { x: 0.5, y: 0.5 };
    lm[2] = { x: 0.46, y: 0.78 };
    lm[4] = { x: 0.46, y: 0.82 };
    lm[6] = { x: nx, y: ny + 0.25 };
    lm[8] = { x: nx, y: ny };
    lm[10] = { x: 0.5, y: 0.5 }; lm[12] = { x: 0.5, y: 0.62 };
    lm[14] = { x: 0.5, y: 0.5 }; lm[16] = { x: 0.5, y: 0.62 };
    lm[18] = { x: 0.5, y: 0.5 }; lm[20] = { x: 0.5, y: 0.62 };
    if (pinch) lm[4] = { x: nx, y: ny + 0.04 };
    return lm;
  };
});

const countInk = () =>
  page.evaluate(() => {
    const c = document.querySelector('.draw-main');
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 10) n++;
    return n;
  });

const before = await countInk();

// Feed ~26 pinch frames sweeping across the canvas → should draw a stroke.
let ts = 1000;
for (let i = 0; i <= 26; i++) {
  const nx = 0.4 + (i / 26) * 0.2; // 0.40 → 0.60
  const ny = 0.45 + Math.sin(i / 4) * 0.05;
  await page.evaluate(
    ([nx, ny, ts]) => window.__aetherHand.feed(window.__hand(nx, ny, true), ts),
    [nx, ny, ts],
  );
  ts += 33;
}
// Cursor/coach visible while the stroke is live on the active layer.
const cursorVisible = await page.locator('.hand-cursor').count();
const coachVisible = await page.locator('.hand-coach').count();
await page.screenshot({ path: 'verify-v2-hand.png' });

// Release pinch (no-hand frames) to end + commit the stroke to the main layer.
for (let i = 0; i < 8; i++) {
  await page.evaluate((ts) => window.__aetherHand.feed(null, ts), ts);
  ts += 40;
}
await page.waitForTimeout(120);
const afterDraw = await countInk();

// Dwell-to-click: aim the open hand at the first toolbar swatch (ink black) and
// hold ~900ms. It should fire a tool select → that swatch becomes active.
const sw = await page.locator('.tb-swatch').first().boundingBox();
const targetNx = 1 - (sw.x + sw.width / 2) / 1280; // un-mirror
const targetNy = (sw.y + sw.height / 2) / 800;
for (let i = 0; i < 26; i++) {
  await page.evaluate(
    ([nx, ny, ts]) => window.__aetherHand.feed(window.__hand(nx, ny, false), ts),
    [targetNx, targetNy, ts],
  );
  ts += 40;
}
await page.waitForTimeout(120);
const firstSwatchActive = await page.locator('.tb-swatch').first().evaluate((el) =>
  el.classList.contains('is-active'),
);

await browser.close();

console.log({ before, afterDraw, cursorVisible, coachVisible, firstSwatchActive, errors: errors.length });
const fail = [];
if (!(afterDraw > before + 200)) fail.push('pinch did not draw ink');
if (cursorVisible < 1) fail.push('hand cursor not rendered');
if (coachVisible < 1) fail.push('hand coach not rendered');
if (!firstSwatchActive) fail.push('dwell-to-click did not select the swatch');
if (errors.length) fail.push('console errors: ' + errors.join(' | '));
if (fail.length) {
  console.log('PHASE 4 SMOKE: FAIL\n - ' + fail.join('\n - '));
  process.exit(1);
}
console.log('PHASE 4 SMOKE: PASS');
