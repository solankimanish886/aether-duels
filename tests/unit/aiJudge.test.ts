import { describe, it, expect, vi } from 'vitest';
import { requestJudge } from '@/lib/aiJudge';

describe('requestJudge', () => {
  it('falls back to a local mock verdict when the backend is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no backend')));
    const v = await requestJudge({
      mode: 'solo',
      prompt: 'octopus',
      images: [{ label: 'You', dataUrl: 'data:image/png;base64,AAAA' }],
    });
    expect(v.mock).toBe(true);
    expect(typeof v.title).toBe('string');
    expect(v.critique).toContain('octopus');
    expect(v.score).toBeGreaterThanOrEqual(0);
    expect(v.score).toBeLessThanOrEqual(100);
    vi.unstubAllGlobals();
  });

  it('uses the server verdict when the endpoint responds OK', async () => {
    const server = { score: 88, title: 'Magnificent', critique: 'Wow.', winner: 0, mock: false };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => server }),
    );
    const v = await requestJudge({
      mode: 'solo',
      prompt: 'dragon',
      images: [{ label: 'You', dataUrl: 'data:image/png;base64,AAAA' }],
    });
    expect(v.score).toBe(88);
    expect(v.mock).toBe(false);
    vi.unstubAllGlobals();
  });

  it('derives mock score from coverage when provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const low = await requestJudge(
      { mode: 'solo', prompt: 'snail', images: [{ label: 'a', dataUrl: 'x' }] },
      { coveragePct: 0 },
    );
    const high = await requestJudge(
      { mode: 'solo', prompt: 'snail', images: [{ label: 'a', dataUrl: 'x' }] },
      { coveragePct: 100 },
    );
    expect(high.score).toBeGreaterThan(low.score);
    vi.unstubAllGlobals();
  });
});
