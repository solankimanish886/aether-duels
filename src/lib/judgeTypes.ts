/** Shared types for the AI judge (used by both the client and the serverless fn). */

export interface JudgeImage {
  /** Display label, e.g. a player name. */
  label: string;
  /** A data URL: "data:image/png;base64,...." */
  dataUrl: string;
}

export interface JudgeRequest {
  mode: 'solo' | 'duel';
  prompt: string;
  images: JudgeImage[];
}

export interface JudgeVerdict {
  /** 0–100 quality score (for solo); for duel it's the winner's score. */
  score: number;
  /** Short punchy headline, e.g. "Surprisingly recognizable!" */
  title: string;
  /** A specific, funny, encouraging critique (1–3 sentences). */
  critique: string;
  /** For duel mode: index of the winning image, or -1 for a tie. */
  winner: number;
  /** True when produced by the local mock (no API key / offline). */
  mock?: boolean;
}

/** JSON schema the model is constrained to (structured outputs). */
export const JUDGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    score: { type: 'integer' },
    title: { type: 'string' },
    critique: { type: 'string' },
    winner: { type: 'integer' },
  },
  required: ['score', 'title', 'critique', 'winner'],
} as const;
