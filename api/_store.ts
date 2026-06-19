/**
 * In-memory store placeholder. NOT durable across serverless cold starts.
 * Swap for Vercel KV / Postgres (or Supabase) before production — the function
 * handlers only depend on this module's tiny interface.
 */
export interface ScoreEntry {
  name: string;
  xp: number;
  level: number;
  updatedAt: number;
}

const profiles = new Map<string, ScoreEntry>();

export const store = {
  upsertProfile(deviceId: string, entry: ScoreEntry) {
    profiles.set(deviceId, entry);
  },
  getProfile(deviceId: string): ScoreEntry | null {
    return profiles.get(deviceId) ?? null;
  },
  topScores(limit = 20): ScoreEntry[] {
    return [...profiles.values()].sort((a, b) => b.xp - a.xp).slice(0, limit);
  },
};
