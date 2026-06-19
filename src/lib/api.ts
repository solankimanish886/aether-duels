import { storageKey } from './storage';

export interface ScoreEntry {
  name: string;
  xp: number;
  level: number;
  updatedAt?: number;
}

/** Stable anonymous device id (created once, persisted). */
export function deviceId(): string {
  const key = storageKey('device');
  let id = localStorage.getItem(key);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(key, id);
  }
  return id;
}

/** Best-effort profile sync — never throws; silently no-ops without a backend. */
export async function syncProfile(p: { name: string; xp: number; level: number }): Promise<void> {
  try {
    await fetch('/api/profile', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ deviceId: deviceId(), ...p }),
    });
  } catch {
    /* offline / no backend — fine */
  }
}

const MOCK_NAMES = ['Aria', 'Kenji', 'Mira', 'Dax', 'Luna', 'Rook', 'Vee', 'Otto'];

/** Top scores; falls back to a mock board (including the player) without a backend. */
export async function getLeaderboard(
  me: { name: string; xp: number; level: number },
): Promise<ScoreEntry[]> {
  try {
    const res = await fetch('/api/leaderboard?limit=20');
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { scores: ScoreEntry[] };
    if (Array.isArray(data.scores) && data.scores.length) return data.scores;
    throw new Error('empty');
  } catch {
    const mock: ScoreEntry[] = MOCK_NAMES.map((name, i) => ({
      name,
      xp: 900 - i * 110 + ((name.charCodeAt(0) * 7) % 60),
      level: 8 - i,
    }));
    mock.push({ name: me.name || 'You', xp: me.xp, level: me.level });
    return mock.sort((a, b) => b.xp - a.xp).slice(0, 20);
  }
}
