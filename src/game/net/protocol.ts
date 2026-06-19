/** Wire protocol for 1v1 duels. Ported from the legacy MSG set. */

import type { ElementKey } from '@/game/elemental';

export interface PlayerInfo {
  name: string;
  level: number;
}

export type StrokePhase = 'start' | 'add' | 'end';

/** Discriminated union of all messages exchanged over the data channel. */
export type NetMessage =
  | { type: 'hello'; data: PlayerInfo }
  | { type: 'ready'; data: { ready: boolean } }
  | { type: 'matchStart'; data: { prompts: string[]; bestOf: number } }
  | { type: 'roundStart'; data: { index: number; prompt: string } }
  | {
      type: 'stroke';
      data: { phase: StrokePhase; x: number; y: number; color?: string; size?: number; p?: number };
    }
  | { type: 'strokeUndo'; data: Record<string, never> }
  | { type: 'strokeClear'; data: Record<string, never> }
  | { type: 'chat'; data: { text: string } }
  | { type: 'reaction'; data: { emoji: string } }
  | { type: 'revealDraw'; data: { index: number; dataUrl: string } }
  | { type: 'vote'; data: { index: number; choice: 'self' | 'opp' } }
  | { type: 'rematchReq'; data: Record<string, never> }
  | { type: 'rematchOk'; data: Record<string, never> }
  // ── Elemental Showdown (Friends Mode) ──
  | { type: 'elemMatchStart'; data: { bestOf: number; winThreshold: number } }
  | { type: 'elemRoundStart'; data: { index: number } }
  // "I locked in" — carries NO element, so a pick can't be read early off the wire.
  | { type: 'elemLock'; data: { index: number } }
  // The actual pick, sent only at reveal (both locked, or the timer expired).
  | { type: 'elemReveal'; data: { index: number; pick: ElementKey | null } }
  // "I'm ready for the next round" — both players must send before advancing.
  | { type: 'elemReady'; data: { index: number } }
  | { type: 'elemRematchReq'; data: Record<string, never> }
  | { type: 'elemRematchOk'; data: Record<string, never> }
  | { type: 'bye'; data: Record<string, never> };

export type NetType = NetMessage['type'];

/** Payload type for a given message type. */
export type PayloadOf<T extends NetType> = Extract<NetMessage, { type: T }>['data'];

export const BEST_OF = 3;
export const ROUNDS_TO_WIN = Math.ceil(BEST_OF / 2);

/** Resolve a round from both players' votes. Returns who won this round. */
export function resolveVotes(
  myChoice: 'self' | 'opp',
  oppChoice: 'self' | 'opp',
): 'me' | 'opp' | 'tie' {
  // Each player votes for the drawing they think is better.
  // "self" = a vote for that voter; translate to a vote for me/opp.
  const votesForMe = (myChoice === 'self' ? 1 : 0) + (oppChoice === 'opp' ? 1 : 0);
  const votesForOpp = (myChoice === 'opp' ? 1 : 0) + (oppChoice === 'self' ? 1 : 0);
  if (votesForMe > votesForOpp) return 'me';
  if (votesForOpp > votesForMe) return 'opp';
  return 'tie';
}
