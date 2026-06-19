// Phase-1 drawing engine smoke: open the Sandbox, draw real strokes via pointer
// events, and assert the main canvas actually changed; then verify undo & clear.
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://127.0.0.1:5199/';
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

// Seed an onboarded profile so we land on the menu directly.
await page.addInitScript(() => {
  localStorage.setItem(
    'aether-duels:v3:profile',
    JSON.stringify({ name: 'Tester', xp: 0, onboarded: true }),
  );
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.menu-hero', { timeout: 8000 });

// Enter the sandbox.
await page.locator('.menu-card', { hasText: 'Drawing Sandbox' }).click();
await page.waitForSelector('.draw-surface', { timeout: 8000 });
await page.waitForTimeout(400); // let perfect-freehand + engine settle

// Count non-transparent pixels on the main canvas.
const countInk = () =>
  page.evaluate(() => {
    const c = document.querySelector('.draw-main');
    const ctx = c.getContext('2d');
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 10) n++;
    return n;
  });

const before = await countInk();

// Draw an S-curve in the middle of the surface.
const box = await page.locator('.draw-active').boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
await page.mouse.move(cx - 160, cy - 80);
await page.mouse.down();
for (let i = 0; i <= 20; i++) {
  const t = i / 20;
  await page.mouse.move(cx - 160 + t * 320, cy - 80 + Math.sin(t * Math.PI * 2) * 70);
}
await page.mouse.up();
await page.waitForTimeout(150);

const afterDraw = await countInk();
await page.screenshot({ path: 'verify-v2-sandbox.png' });

// Undo should remove the stroke.
await page.locator('.tb-tool[aria-label="Undo"]').click();
await page.waitForTimeout(150);
const afterUndo = await countInk();

// Draw again, then Clear.
await page.mouse.move(cx - 100, cy);
await page.mouse.down();
await page.mouse.move(cx + 100, cy);
await page.mouse.up();
await page.waitForTimeout(120);
await page.locator('.tb-tool[aria-label="Clear"]').click();
await page.waitForTimeout(150);
const afterClear = await countInk();

await browser.close();

console.log({ before, afterDraw, afterUndo, afterClear, errors: errors.length });
const fail = [];
if (!(afterDraw > before + 200)) fail.push('draw did not add ink');
if (!(afterUndo < afterDraw)) fail.push('undo did not reduce ink');
if (afterClear !== 0) fail.push('clear did not empty canvas');
if (errors.length) fail.push('console errors: ' + errors.join(' | '));

if (fail.length) {
  console.log('PHASE 1 SMOKE: FAIL\n - ' + fail.join('\n - '));
  process.exit(1);
}
console.log('PHASE 1 SMOKE: PASS');
