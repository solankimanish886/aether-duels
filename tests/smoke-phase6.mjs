// Phase-6 smoke: a practice round shows an AI Judge critique (mock path in dev,
// real Claude when ANTHROPIC_API_KEY is set on a deploy), and the Leaderboard
// modal renders ranked rows including the player.
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://127.0.0.1:5199/';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
// In `vite dev` there is no /api backend, so /api/* 404s are expected and handled
// by the mock fallback — ignore them; flag any other console/page error.
const isExpected = (t) => /Failed to load resource/.test(t) && /404/.test(t);
page.on('console', (m) => m.type() === 'error' && !isExpected(m.text()) && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.addInitScript(() => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('aether-duels')) localStorage.removeItem(k);
  localStorage.setItem('aether-duels:v3:profile', JSON.stringify({ name: 'Judgey', xp: 120, onboarded: true }));
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.menu-hero', { timeout: 8000 });

// Leaderboard modal renders with rows including the player.
await page.locator('.menu-foot-link', { hasText: 'Leaderboard' }).click();
await page.waitForSelector('.lb-row', { timeout: 6000 });
const rows = await page.locator('.lb-row').count();
const hasMe = await page.locator('.lb-row.is-me').count();
await page.screenshot({ path: 'verify-v2-leaderboard.png' });
await page.locator('.ad-modal-close').click();

// Practice round → AI Judge critique.
await page.locator('.menu-card', { hasText: 'Practice Round' }).click();
await page.waitForSelector('.match-hud', { timeout: 12000 });
const box = await page.locator('.draw-active').boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;
await page.mouse.move(cx - 80, cy);
await page.mouse.down();
await page.mouse.move(cx + 80, cy);
await page.mouse.up();
await page.getByRole('button', { name: 'Done' }).click();

await page.waitForSelector('.presult-judge', { timeout: 8000 });
// Wait for the verdict to replace the "analysing…" state.
await page.waitForSelector('.presult-judge-critique', { timeout: 8000 });
const critique = await page.locator('.presult-judge-critique').innerText();
await page.waitForTimeout(300);
await page.screenshot({ path: 'verify-v2-judge.png' });

await browser.close();

console.log({ rows, hasMe, critiqueLen: critique.length, errors: errors.length });
const fail = [];
if (rows < 3) fail.push('leaderboard rows missing');
if (hasMe < 1) fail.push('player not highlighted on leaderboard');
if (critique.length < 10) fail.push('AI judge critique not shown');
if (errors.length) fail.push('console errors: ' + errors.join(' | '));
if (fail.length) {
  console.log('PHASE 6 SMOKE: FAIL\n - ' + fail.join('\n - '));
  process.exit(1);
}
console.log('PHASE 6 SMOKE: PASS');
