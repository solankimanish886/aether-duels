/**
 * Room/join codes are a fixed 6-digit number (000000–999999) shown to players.
 * The actual PeerJS peer id is namespaced with an app prefix so two players'
 * short numeric codes can't collide with unrelated peers on the public broker.
 */
const PEER_PREFIX = 'aether-duels-';

/** A fresh 6-digit numeric code, zero-padded (e.g. "048213"). */
export function generateRoomCode(): string {
  return Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');
}

/** True only for an exactly-6-digit numeric code. */
export function isValidRoomCode(code: string): boolean {
  return /^\d{6}$/.test(code);
}

/** Map a 6-digit code to the namespaced PeerJS peer id used for connecting. */
export function peerIdForCode(code: string): string {
  return PEER_PREFIX + code;
}
