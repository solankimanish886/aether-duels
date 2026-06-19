import { describe, it, expect } from 'vitest';
import {
  ELEMENT_LIST,
  ELEMENTS,
  elementBeats,
  gestureToElement,
  resolveRound,
  roundReason,
  type ElementKey,
} from '@/game/elemental';

const KEYS = ELEMENT_LIST.map((e) => e.key);

describe('elemental ruleset', () => {
  it('is a balanced pentagon: each element beats exactly 2 and loses to exactly 2', () => {
    for (const a of KEYS) {
      const beats = KEYS.filter((b) => a !== b && elementBeats(a, b));
      const losesTo = KEYS.filter((b) => a !== b && elementBeats(b, a));
      expect(beats).toHaveLength(2);
      expect(losesTo).toHaveLength(2);
    }
  });

  it('never beats itself; same element ties', () => {
    for (const a of KEYS) {
      expect(elementBeats(a, a)).toBe(false);
      expect(resolveRound(a, a)).toBe('tie');
    }
  });

  it('resolveRound is consistent with the beats table', () => {
    expect(resolveRound('fire', 'wind')).toBe('win');
    expect(resolveRound('wind', 'fire')).toBe('lose');
    expect(resolveRound('water', 'fire')).toBe('win');
    expect(resolveRound('lightning', 'water')).toBe('win');
  });

  it('maps each gesture to its element and back', () => {
    for (const def of ELEMENT_LIST) {
      expect(gestureToElement(def.gesture)).toBe(def.key);
    }
    expect(gestureToElement('none')).toBeNull();
    expect(gestureToElement('unknown')).toBeNull();
  });

  it('every element defines a distinct gesture', () => {
    const gestures = new Set(ELEMENT_LIST.map((e) => e.gesture));
    expect(gestures.size).toBe(ELEMENT_LIST.length);
    expect(Object.keys(ELEMENTS).length).toBe(5);
  });
});

describe('roundReason', () => {
  it('explains a win via the beats verb', () => {
    expect(roundReason('win', 'fire', 'earth')).toBe('Fire scorches Earth');
  });

  it('explains a loss via the opponent beats verb', () => {
    expect(roundReason('lose', 'fire', 'water')).toBe('Water douses Fire');
  });

  it('explains a tie naming the shared element', () => {
    expect(roundReason('tie', 'wind', 'wind')).toBe('Both summoned Wind — a perfect clash.');
  });

  it('handles a win where the rival never summoned', () => {
    expect(roundReason('win', 'fire', null)).toBe('Your rival never summoned — the round is yours.');
  });

  it('handles a loss where you never summoned', () => {
    expect(roundReason('lose', null, 'fire')).toBe("You didn't summon in time.");
  });
});

// Type guard: KEYS really are ElementKey[]
const _check: ElementKey[] = KEYS;
void _check;
