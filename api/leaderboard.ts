import type { VercelRequest, VercelResponse } from '@vercel/node';
import { store } from './_store';

/** GET top XP scores. Backed by the in-memory placeholder store. */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const limit = Math.min(50, Number(req.query.limit ?? 20) || 20);
  return res.status(200).json({ scores: store.topScores(limit) });
}
