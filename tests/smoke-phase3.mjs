// Phase-3 juice smoke: brush sparkles spawn while drawing, a practice round that
// crosses a level boundary fires the level-up burst, and nothing throws.
// (Audio is silent in headless, but the synth calls must not error.)
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://127.0.0.1:5199/';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

// Seed an onboarded profile with XP just below level 2 (=60 XP) so a round levels up.
await page.addInitScript(() => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('aether-duels')) localStorage.removeItem(k);
  localStorage.setItem(
    'aether-duels:v3:profile',
    JSON.stringify({
      name: 'Juicy',
      xp: 55,
      onboarded: true,
      prefs: { audio: true, handTracking: false, reducedMotion: false },
    }),
  );
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.menu-hero', { timeout: 8000 });

await page.locator('.menu-card', { hasText: 'Practice Round' }).click();
await page.waitForSelector('.match-hud', { timeout: 12000 });

// Draw vigorously, sampling for sparkle elements mid-stroke.
const box = await page.locator('.draw-active').boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
let maxSparks = 0;
for (let s = 0; s < 4; s++) {
  await page.mouse.move(cx - 200 + s * 90, cy - 120);
  await page.mouse.down();
  for (let i = 0; i <= 24; i++) {
    await page.mouse.move(cx - 200 + s * 90 + i * 6, cy - 120 + Math.sin(i / 2) * 90);
    if (i % 6 === 0) {
      const n = await page.locator('.brush-spark').count();
      if (n > maxSparks) maxSparks = n;
    }
  }
  await page.mouse.up();
}

await page.getByRole('button', { name: 'Done' }).click();

// Level-up burst should appear (xp 55 + >=10 ≥ 60).
let burstSeen = false;
try {
  await page.waitForSelector('.levelup', { timeout: 4000 });
  burstSeen = true;
  await page.screenshot({ path: 'verify-v2-levelup.png' });
} catch {}

await page.waitForSelector('.presult', { timeout: 6000 });
await page.waitForTimeout(400);
await page.screenshot({ path: 'verify-v2-juice-result.png' });
const leveledChip = await page.locator('.presult-chip--level').count();

await browser.close();

console.log({ maxSparks, burstSeen, leveledChip, errors: errors.length });
const fail = [];
if (maxSparks < 1) fail.push('no brush sparkles spawned while drawing');
if (!burstSeen) fail.push('level-up burst did not appear');
if (leveledChip < 1) fail.push('level-up chip missing on result');
if (errors.length) fail.push('console errors: ' + errors.join(' | '));
if (fail.length) {
  console.log('PHASE 3 SMOKE: FAIL\n - ' + fail.join('\n - '));
  process.exit(1);
}
console.log('PHASE 3 SMOKE: PASS');
