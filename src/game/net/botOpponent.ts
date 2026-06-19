import { DuelNet } from './DuelNet';
import type { NetMessage } from './protocol';

const BOT_NAMES = ['Aether Bot', 'Specter', 'Inkling', 'Doodlebot'];

/** Generate a quick scribble as the bot's "drawing". */
function botDrawing(prompt: string): string {
  const c = document.createElement('canvas');
  c.width = 480;
  c.height = 300;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#f7f4ed';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = '#7cb9ff';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  let h = 0;
  for (const ch of prompt) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  ctx.beginPath();
  for (let i = 0; i < 40; i++) {
    const x = 60 + ((h * (i + 3)) % 360);
    const y = 60 + ((h * (i + 7)) % 180);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  return c.toDataURL('image/png');
}

/**
 * A scripted bot opponent for solo "Quick Duel" play and broker-free testing.
 * It plays as the GUEST against a human HOST. Returns the human's DuelNet,
 * already wired to the bot via an in-memory channel.
 */
export function createBotNet(botLevel = 4): DuelNet {
  const net = new DuelNet();
  const info = { name: BOT_NAMES[botLevel % BOT_NAMES.length], level: botLevel };
  let currentPrompt = '';

  // Bot receives the human's outbound messages here.
  const botReceive = (msg: NetMessage) => {
    switch (msg.type) {
      case 'hello':
        net.deliver({ type: 'hello', data: info });
        break;
      case 'ready':
        // Bot readies up shortly after the human does.
        setTimeout(() => net.deliver({ type: 'ready', data: { ready: true } }), 250);
        break;
      case 'roundStart':
        currentPrompt = msg.data.prompt;
        // Reveal a drawing a couple seconds in (the human ends via timer/Done).
        setTimeout(() => {
          net.deliver({
            type: 'revealDraw',
            data: { index: msg.data.index, dataUrl: botDrawing(currentPrompt) },
          });
        }, 1800);
        break;
      case 'revealDraw':
        // Once it sees the human's drawing, cast a vote (slightly biased to self).
        setTimeout(() => {
          const choice = Math.random() < 0.55 ? 'self' : 'opp';
          net.deliver({ type: 'vote', data: { index: msg.data.index, choice } });
        }, 600);
        break;
      case 'rematchReq':
        net.deliver({ type: 'rematchOk', data: {} });
        break;
      default:
        break;
    }
  };

  net.attachChannel('host', 'CPU-DUEL', botReceive);
  // Greet immediately so the lobby shows the opponent.
  setTimeout(() => net.deliver({ type: 'hello', data: info }), 50);
  return net;
}
