import type { VercelRequest, VercelResponse } from '@vercel/node';
import { store, type ScoreEntry } from './_store';

/**
 * Persistent profile sync. GET ?deviceId=… returns the stored profile;
 * POST { deviceId, name, xp, level } upserts it. Backed by the in-memory
 * placeholder store (see api/_store.ts) — swap for a real DB for production.
 */
export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    const deviceId = String(req.query.deviceId ?? '');
    if (!deviceId) return res.status(400).json({ error: 'deviceId required' });
    return res.status(200).json(store.getProfile(deviceId));
  }
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
    const { deviceId, name, xp, level } = body ?? {};
    if (!deviceId || typeof xp !== 'number') {
      return res.status(400).json({ error: 'deviceId and xp required' });
    }
    const entry: ScoreEntry = { name: String(name ?? 'Anonymous'), xp, level: level ?? 1, updatedAt: Date.now() };
    store.upsertProfile(deviceId, entry);
    return res.status(200).json(entry);
  }
  return res.status(405).json({ error: 'method not allowed' });
}
