import type { VercelRequest, VercelResponse } from '@vercel/node';
import Anthropic from '@anthropic-ai/sdk';
import type { JudgeRequest, JudgeVerdict } from '../src/lib/judgeTypes';

/**
 * AI art judge. With ANTHROPIC_API_KEY set, asks Claude (vision) to score the
 * drawing(s) against the prompt and return a witty, specific critique. Without
 * a key — or on any failure — it falls back to a deterministic local mock so the
 * game keeps working in local dev and on misconfigured deploys.
 *
 * The Anthropic key is read from the server environment and never shipped to the
 * client.
 */

const MODEL = 'claude-opus-4-8';

const SYSTEM = `You are the AI Judge for "Aether Duels", a fast 60-second drawing game.
You are shown a prompt word and one or more rough drawings of it (made in seconds, often by non-artists).
Judge with warmth and wit, never cruelty. Be SPECIFIC about what you actually see in the drawing.
- score: 0-100, how recognizable/charming the drawing is for the prompt (most casual drawings land 45-85).
- title: a short punchy headline (max 6 words).
- critique: 1-3 sentences, specific and funny, always ending on an encouraging note.
- winner: for a single drawing always 0; for two drawings, the index (0 or 1) of the better one, or -1 for a tie.

Respond with ONLY a JSON object (no prose, no code fences) of exactly this shape:
{"score": <int 0-100>, "title": "<string>", "critique": "<string>", "winner": <int>}`;

function parseVerdict(text: string): JudgeVerdict | null {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  try {
    const o = JSON.parse(cleaned);
    if (typeof o.score === 'number' && typeof o.title === 'string' && typeof o.critique === 'string') {
      return { score: o.score, title: o.title, critique: o.critique, winner: o.winner ?? 0 };
    }
  } catch {
    /* fall through */
  }
  return null;
}

function dataUrlToSource(dataUrl: string) {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.*)$/.exec(dataUrl);
  if (!m) throw new Error('bad data url');
  return { type: 'base64' as const, media_type: m[1] as any, data: m[2] };
}

function mockVerdict(body: JudgeRequest): JudgeVerdict {
  // Deterministic-ish variety seeded by the prompt text.
  let h = 0;
  for (const c of body.prompt) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const score = 55 + (h % 35);
  const titles = ['Bold strokes!', 'I can see it!', 'Charmingly chaotic', 'Gallery-worthy… almost', 'Full of character'];
  const lines = [
    `That's a brave attempt at "${body.prompt}" — the energy is undeniable, even if the anatomy filed a complaint.`,
    `I squinted, I believed, I saw "${body.prompt}". A few more seconds and it'd be in a museum.`,
    `Confident lines for "${body.prompt}"! The composition has real swagger. Keep that momentum.`,
  ];
  return {
    score,
    title: titles[h % titles.length],
    critique: lines[h % lines.length],
    winner: body.mode === 'duel' ? h % 2 : 0,
    mock: true,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const body: JudgeRequest =
    typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;

  if (!body?.prompt || !Array.isArray(body.images) || body.images.length === 0) {
    res.status(400).json({ error: 'prompt and images are required' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(200).json(mockVerdict(body));
    return;
  }

  try {
    const client = new Anthropic({ apiKey });
    const content: Anthropic.ContentBlockParam[] = [];
    body.images.forEach((img, i) => {
      content.push({ type: 'text', text: `Drawing ${i} (${img.label}):` });
      content.push({ type: 'image', source: dataUrlToSource(img.dataUrl) });
    });
    content.push({
      type: 'text',
      text: `The prompt was "${body.prompt}". Judge ${body.mode === 'duel' ? 'both drawings and pick a winner' : 'this drawing'}.`,
    });

    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: 'user', content }],
    });

    if (message.stop_reason === 'refusal') {
      res.status(200).json(mockVerdict(body));
      return;
    }

    const textBlock = message.content.find((b) => b.type === 'text');
    const parsed = textBlock ? parseVerdict((textBlock as any).text) : null;
    res.status(200).json(parsed ? { ...parsed, mock: false } : mockVerdict(body));
  } catch {
    // Never break the game on an API hiccup — degrade to the local mock.
    res.status(200).json(mockVerdict(body));
  }
}
