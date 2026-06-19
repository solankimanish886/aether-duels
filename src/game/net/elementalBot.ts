import { DuelNet } from './DuelNet';
import { ELEMENT_BEATS, randomElement, type ElementKey } from '@/game/elemental';
import type { NetMessage } from './protocol';

const BOT_NAMES = ['Aether Bot', 'Pyro', 'Tempest', 'Gaia'];

/** An element that beats `target` (random among the options). */
function counterElement(target: ElementKey): ElementKey {
  const keys = Object.keys(ELEMENT_BEATS) as ElementKey[];
  const options = keys.filter((k) => ELEMENT_BEATS[k].includes(target));
  return options.length ? options[Math.floor(Math.random() * options.length)] : randomElement();
}

/**
 * A scripted Elemental Showdown opponent for "Quick vs CPU" play and broker-free
 * testing. Plays as the GUEST against a human HOST: the host is authoritative for
 * round sequencing, so the bot only reacts to elemRoundStart, locks after a short
 * delay, and reveals once both sides have locked (mirroring the human client's
 * lock/reveal handshake). Returns the human's DuelNet, wired via an in-memory
 * channel.
 */
export function createElementalBotNet(botLevel = 4): DuelNet {
  const net = new DuelNet();
  const info = { name: BOT_NAMES[botLevel % BOT_NAMES.length], level: botLevel };

  // Per-round handshake state.
  let index = -1;
  let botPick = randomElement();
  let botLocked = false;
  let botRevealed = false;
  let oppLockedOrRevealed = false;
  // Difficulty: higher levels increasingly counter the human's last pick.
  let lastHumanPick: ElementKey | null = null;
  const counterChance = Math.max(0, Math.min(0.75, botLevel / 8));

  const tryReveal = () => {
    if (botLocked && oppLockedOrRevealed && !botRevealed) {
      botRevealed = true;
      net.deliver({ type: 'elemReveal', data: { index, pick: botPick } });
    }
  };

  const beginRound = (i: number) => {
    index = i;
    // Read the human's habits: at higher levels, often pick a counter to their
    // most recent element; otherwise play randomly.
    botPick =
      lastHumanPick && Math.random() < counterChance ? counterElement(lastHumanPick) : randomElement();
    botLocked = false;
    botRevealed = false;
    oppLockedOrRevealed = false;
    // Lock in after a human-like beat (well within the summon window).
    setTimeout(() => {
      botLocked = true;
      net.deliver({ type: 'elemLock', data: { index } });
      tryReveal();
    }, 700 + Math.floor((botLevel * 137) % 900));
  };

  const botReceive = (msg: NetMessage) => {
    switch (msg.type) {
      case 'hello':
        net.deliver({ type: 'hello', data: info });
        break;
      case 'ready':
        setTimeout(() => net.deliver({ type: 'ready', data: { ready: true } }), 250);
        break;
      case 'elemRoundStart':
        beginRound(msg.data.index);
        break;
      case 'elemLock':
        oppLockedOrRevealed = true;
        tryReveal();
        break;
      case 'elemReveal':
        // Human's timer expired before locking — reveal in kind. Remember their
        // pick so the next round can counter it (difficulty).
        if (msg.data.pick) lastHumanPick = msg.data.pick;
        oppLockedOrRevealed = true;
        tryReveal();
        break;
      case 'elemRematchReq':
        net.deliver({ type: 'elemRematchOk', data: {} });
        break;
      default:
        break;
    }
  };

  net.attachChannel('host', 'CPU-ELEM', botReceive);
  setTimeout(() => net.deliver({ type: 'hello', data: info }), 50);
  return net;
}
