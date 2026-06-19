/**
 * Shared round timing used by the Forge a Duel countdown/timer.
 * (The old solo Practice Round store lived here too; it was removed with that mode.)
 */
export type CountdownValue = 3 | 2 | 1 | 'GO';

export const ROUND_SECONDS = 60;
export const COUNTDOWN_STEP_MS = 850;
