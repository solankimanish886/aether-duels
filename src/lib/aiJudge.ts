import type { JudgeRequest, JudgeVerdict } from './judgeTypes';

/** Local mock — mirrors api/judge.ts so the judge works without a backend. */
function mockVerdict(req: JudgeRequest, coveragePct?: number): JudgeVerdict {
  let h = 0;
  for (const c of req.prompt) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const base = typeof coveragePct === 'number' ? 45 + Math.round(coveragePct * 0.4) : 55 + (h % 35);
  const titles = [
    'Bold strokes!',
    'I can see it!',
    'Charmingly chaotic',
    'Gallery-worthy… almost',
    'Full of character',
  ];
  const lines = [
    `A brave take on "${req.prompt}" — the energy is undeniable, even if the anatomy filed a complaint.`,
    `I squinted, I believed, I saw "${req.prompt}". A few more seconds and it'd be in a museum.`,
    `Confident lines for "${req.prompt}"! The composition has real swagger — keep that momentum.`,
  ];
  return {
    score: Math.min(100, base),
    title: titles[h % titles.length],
    critique: lines[h % lines.length],
    winner: req.mode === 'duel' ? h % 2 : 0,
    mock: true,
  };
}

/**
 * Ask the AI judge to score a drawing. Tries the serverless function; on any
 * failure (no backend in dev, network error, non-OK) falls back to the local
 * mock so the result screen always has a verdict.
 */
export async function requestJudge(
  req: JudgeRequest,
  opts: { coveragePct?: number; signal?: AbortSignal } = {},
): Promise<JudgeVerdict> {
  try {
    const res = await fetch('/api/judge', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: opts.signal,
    });
    if (!res.ok) throw new Error(`judge ${res.status}`);
    return (await res.json()) as JudgeVerdict;
  } catch {
    return mockVerdict(req, opts.coveragePct);
  }
}
