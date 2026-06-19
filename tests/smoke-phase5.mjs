// Phase-5 Elemental Showdown smoke: play a full best-of-5 by tapping element
// chips each round (camera-free), then assert the match resolves to a result
// with an XP reward. CPU is random, so we only assert the flow completes.
import { chromium } from 'playwright';

const URL = (process.env.URL || 'http://127.0.0.1:5199/') + '?handtest';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.addInitScript(() => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('aether-duels')) localStorage.removeItem(k);
  localStorage.setItem('aether-duels:v3:profile', JSON.stringify({ name: 'Mage', xp: 0, onboarded: true }));
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.menu-hero', { timeout: 8000 });
await page.locator('.menu-card', { hasText: 'Elemental Showdown' }).click();
await page.waitForSelector('.elem-arena', { timeout: 8000 });

// Play up to 5 rounds: each round, tap an enabled chip, wait for the next
// charging phase (or the result).
let lockedRounds = 0;
for (let r = 0; r < 6; r++) {
  if (await page.locator('.elem-result').count()) break;
  // Wait until a chip is tappable (charging phase, nothing picked yet).
  try {
    await page.waitForSelector('.elem-chip:not([disabled])', { timeout: 4000 });
  } catch {
    break;
  }
  await page.locator('.elem-chip:not([disabled])').first().click();
  lockedRounds++;
  // Wait for this round to resolve and either re-arm chips or end the match.
  await page.waitForTimeout(2600);
}

await page.waitForSelector('.elem-result', { timeout: 8000 });
await page.waitForTimeout(300);
await page.screenshot({ path: 'verify-v2-elemental.png' });

const xpText = await page.locator('.elem-result-xp').innerText();
const titleText = await page.locator('.elem-result-title').innerText();

await browser.close();

console.log({ lockedRounds, xpText, titleText, errors: errors.length });
const fail = [];
if (lockedRounds < 3) fail.push(`too few rounds played (${lockedRounds})`);
if (!/XP/.test(xpText)) fail.push('no XP reward shown');
if (!titleText) fail.push('no result title');
if (errors.length) fail.push('console errors: ' + errors.join(' | '));
if (fail.length) {
  console.log('PHASE 5 SMOKE: FAIL\n - ' + fail.join('\n - '));
  process.exit(1);
}
console.log('PHASE 5 SMOKE: PASS');
