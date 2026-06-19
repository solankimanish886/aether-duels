// Quick Phase-0 smoke check: app boots, splash auto-advances to a screen,
// menu mode cards render, and there are no console errors.
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://localhost:5173/';
const errors = [];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(URL, { waitUntil: 'networkidle' });

// Splash logo present
await page.waitForSelector('.splash-logo', { timeout: 5000 });
await page.screenshot({ path: 'verify-v2-splash.png' });

// Auto-advances to menu (no profile -> onboarding placeholder, then we force menu)
await page.waitForTimeout(2600);
// If we landed on onboarding placeholder, click Back to Menu
const onboarding = await page.locator('text=Onboarding').count();
if (onboarding) await page.getByRole('button', { name: /Back to Menu/i }).click();

await page.waitForSelector('.menu-hero', { timeout: 5000 });
const cards = await page.locator('.menu-card').count();
await page.screenshot({ path: 'verify-v2-menu.png' });

// Navigate into sandbox placeholder and back
await page.locator('.menu-card', { hasText: 'Drawing Sandbox' }).click();
await page.waitForSelector('text=Sandbox', { timeout: 5000 });
await page.getByRole('button', { name: /Back to Menu/i }).click();
await page.waitForSelector('.menu-hero', { timeout: 5000 });

await browser.close();

console.log(`menu cards: ${cards}`);
console.log(`console errors: ${errors.length}`);
if (errors.length) {
  console.log(errors.join('\n'));
  process.exit(1);
}
if (cards < 4) {
  console.log('Expected >=4 mode cards');
  process.exit(1);
}
console.log('PHASE 0 SMOKE: PASS');
