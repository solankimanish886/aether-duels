import { describe, it, expect } from 'vitest';
import { resolveVotes } from '@/game/net/protocol';
import { DuelNet } from '@/game/net/DuelNet';

describe('resolveVotes', () => {
  it('mutual self-votes tie', () => {
    expect(resolveVotes('self', 'self')).toBe('tie');
  });
  it('opponent conceding to me makes me win', () => {
    expect(resolveVotes('self', 'opp')).toBe('me');
  });
  it('me conceding makes opponent win', () => {
    expect(resolveVotes('opp', 'self')).toBe('opp');
  });
  it('mutual deference ties', () => {
    expect(resolveVotes('opp', 'opp')).toBe('tie');
  });
});

describe('DuelNet loopback', () => {
  it('delivers typed messages between two paired instances', () => {
    const a = new DuelNet();
    const b = new DuelNet();
    a.attachChannel('host', 'room', (m) => b.deliver(m));
    b.attachChannel('guest', 'room', (m) => a.deliver(m));

    const received: string[] = [];
    b.on('hello', (info) => received.push(info.name));
    a.on('chat', (d) => received.push(d.text));

    a.send('hello', { name: 'Host', level: 3 });
    b.send('chat', { text: 'hi' });

    expect(received).toEqual(['Host', 'hi']);
    expect(a.role).toBe('host');
    expect(b.role).toBe('guest');
  });
});
