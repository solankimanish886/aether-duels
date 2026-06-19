// Phase-2 solo flow smoke: fresh user → onboarding → name gate → menu →
// practice round (countdown → draw → Done → result with XP + first achievement).
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://127.0.0.1:5199/';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

// Fresh: clear any stored profile so onboarding shows.
await page.addInitScript(() => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('aether-duels')) localStorage.removeItem(k);
});

await page.goto(URL, { waitUntil: 'networkidle' });

// Splash → onboarding.
await page.waitForSelector('.onboard', { timeout: 8000 });

// Advance through slides until the name gate input appears.
for (let i = 0; i < 5; i++) {
  if (await page.locator('.onboard-input').count()) break;
  await page.locator('.onboard .ad-btn--primary').click();
  await page.waitForTimeout(450);
}
await page.locator('.onboard-input').fill('Pixel');
await page.getByRole('button', { name: 'Enter the Arena' }).click();

// Menu with our name + level chip.
await page.waitForSelector('.menu-hero', { timeout: 8000 });
const nameText = await page.locator('.menu-profile-name').innerText();
await page.screenshot({ path: 'verify-v2-menu2.png' });

// Start practice.
await page.locator('.menu-card', { hasText: 'Practice Round' }).click();
await page.waitForSelector('.countdown-overlay', { timeout: 8000 });

// Wait for drawing phase.
await page.waitForSelector('.match-hud', { timeout: 10000 });
await page.screenshot({ path: 'verify-v2-match.png' });

// Draw a few strokes.
const box = await page.locator('.draw-active').boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
for (let s = 0; s < 3; s++) {
  await page.mouse.move(cx - 120 + s * 60, cy - 60);
  await page.mouse.down();
  for (let i = 0; i <= 12; i++) {
    await page.mouse.move(cx - 120 + s * 60 + Math.sin(i) * 30, cy - 60 + i * 8);
  }
  await page.mouse.up();
}
await page.waitForTimeout(200);

// Finish early via Done.
await page.getByRole('button', { name: 'Done' }).click();
await page.waitForSelector('.presult', { timeout: 8000 });
await page.waitForTimeout(800);
await page.screenshot({ path: 'verify-v2-result.png' });

const xpChip = await page.locator('.presult-chip--xp').innerText();
const hasAch = await page.locator('.presult-ach').count();

await browser.close();

console.log({ nameText, xpChip, achievements: hasAch, errors: errors.length });
const fail = [];
if (!/Pixel/.test(nameText)) fail.push('name not shown on menu');
if (!/XP/.test(xpChip)) fail.push('no XP chip on result');
if (hasAch < 1) fail.push('first-strokes achievement not unlocked');
if (errors.length) fail.push('console errors: ' + errors.join(' | '));
if (fail.length) {
  console.log('PHASE 2 SMOKE: FAIL\n - ' + fail.join('\n - '));
  process.exit(1);
}
console.log('PHASE 2 SMOKE: PASS');
