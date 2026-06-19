import { describe, it, expect } from 'vitest';
import { generateRoomCode, isValidRoomCode, peerIdForCode } from '@/game/net/roomCode';

describe('roomCode', () => {
  it('generates a 6-digit numeric code', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateRoomCode();
      expect(code).toMatch(/^\d{6}$/);
      expect(isValidRoomCode(code)).toBe(true);
    }
  });

  it('accepts exactly 6 digits (incl. leading zeros)', () => {
    expect(isValidRoomCode('000000')).toBe(true);
    expect(isValidRoomCode('123456')).toBe(true);
  });

  it('rejects anything that is not exactly 6 digits', () => {
    expect(isValidRoomCode('12345')).toBe(false);
    expect(isValidRoomCode('1234567')).toBe(false);
    expect(isValidRoomCode('abcdef')).toBe(false);
    expect(isValidRoomCode('12 345')).toBe(false);
    expect(isValidRoomCode('')).toBe(false);
  });

  it('namespaces the peer id with the app prefix', () => {
    expect(peerIdForCode('048213')).toBe('aether-duels-048213');
  });
});
