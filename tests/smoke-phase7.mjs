// Phase-7 multiplayer smoke (broker-free): play a full best-of-3 duel against the
// CPU bot via the in-memory loopback transport, exercising the entire match flow —
// lobby → ready → synced rounds (countdown → draw → reveal → vote) → result.
// Real 2-browser P2P uses the public PeerJS broker and needs network; the bot path
// verifies the same state machine deterministically.
import { chromium } from 'playwright';

const URL = process.env.URL || 'http://127.0.0.1:5199/';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const isExpected = (t) => /Failed to load resource/.test(t) && /404/.test(t); // /api in dev
page.on('console', (m) => m.type() === 'error' && !isExpected(m.text()) && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.addInitScript(() => {
  for (const k of Object.keys(localStorage)) if (k.startsWith('aether-duels')) localStorage.removeItem(k);
  localStorage.setItem('aether-duels:v3:profile', JSON.stringify({ name: 'Dueler', xp: 200, onboarded: true }));
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForSelector('.menu-hero', { timeout: 8000 });

await page.locator('.menu-card', { hasText: 'Forge a Duel' }).click();
await page.waitForSelector('.lobby-choose', { timeout: 6000 });
await page.locator('button', { hasText: 'Quick Duel' }).click();

// Lobby with the bot present.
await page.waitForSelector('.lobby-vs', { timeout: 6000 });
await page.screenshot({ path: 'verify-v2-lobby.png' });
await page.getByRole('button', { name: "I'm Ready" }).click();

// Play rounds until the match result appears (best of 3).
let rounds = 0;
const box = () => page.locator('.draw-active').boundingBox();
for (let r = 0; r < 4; r++) {
  if (await page.locator('.duel-result').count()) break;
  await page.waitForSelector('.match-hud', { timeout: 15000 });
  rounds++;
  const b = await box();
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  await page.mouse.move(cx - 80, cy - 30);
  await page.mouse.down();
  await page.mouse.move(cx + 80, cy + 30);
  await page.mouse.move(cx, cy + 60);
  await page.mouse.up();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.waitForSelector('.duel-reveal', { timeout: 15000 });
  if (r === 0) await page.screenshot({ path: 'verify-v2-duel-vote.png' });
  // Cast a vote (for our own drawing) if voting is still open.
  const voteCard = page.locator('.duel-vote-card:not([disabled])').first();
  if (await voteCard.count()) await voteCard.click();
  // Wait for the round to resolve and advance (or the match to end).
  await Promise.race([
    page.waitForSelector('.duel-result', { timeout: 8000 }).catch(() => {}),
    page.waitForTimeout(3200),
  ]);
}

await page.waitForSelector('.duel-result-title', { timeout: 10000 });
const title = await page.locator('.duel-result-title').innerText();
await page.screenshot({ path: 'verify-v2-duel-result.png' });

await browser.close();

console.log({ rounds, title, errors: errors.length });
const fail = [];
if (rounds < 2) fail.push(`expected at least 2 rounds, got ${rounds}`);
if (!/Victory|Defeated/.test(title)) fail.push('no match result title');
if (errors.length) fail.push('console errors: ' + errors.join(' | '));
if (fail.length) {
  console.log('PHASE 7 SMOKE: FAIL\n - ' + fail.join('\n - '));
  process.exit(1);
}
console.log('PHASE 7 SMOKE: PASS');
