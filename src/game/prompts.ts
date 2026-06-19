/** Drawing prompt pool, ported from the legacy game. */
export const PROMPTS = {
  animals: [
    'octopus', 'dragon', 'sloth', 'narwhal', 'crab', 'elephant', 'flamingo',
    'axolotl', 'hedgehog', 'butterfly', 'penguin', 'tiger', 'jellyfish', 'snail', 'owl',
  ],
  objects: [
    'rocket ship', 'teapot', 'lighthouse', 'old radio', 'treasure chest', 'suitcase',
    'umbrella', 'typewriter', 'vinyl record', 'grand piano', 'wizard hat',
    'ice cream cone', 'camera', 'clock tower', 'bicycle',
  ],
  fantasy: [
    'haunted castle', 'unicorn drinking coffee', 'wizard casting spell', 'alien spaceship',
    'genie in a lamp', 'dragon riding a bicycle', 'ghost holding flowers', 'mermaid',
    'phoenix', 'floating island',
  ],
  funny: [
    'cat using a laptop', 'dancing banana', 'penguin in a tuxedo', 'duck wearing sunglasses',
    'frog with a crown', 'robot doing yoga', 'dinosaur on a skateboard',
  ],
} as const;

export const ALL_PROMPTS: string[] = Object.values(PROMPTS).flat();

export function randomPrompt(exclude?: string): string {
  let p = ALL_PROMPTS[Math.floor(Math.random() * ALL_PROMPTS.length)];
  if (exclude && ALL_PROMPTS.length > 1) {
    while (p === exclude) p = ALL_PROMPTS[Math.floor(Math.random() * ALL_PROMPTS.length)];
  }
  return p;
}

/** Generate N distinct prompts (for a best-of-N match). */
export function pickPrompts(n: number): string[] {
  const pool = [...ALL_PROMPTS];
  const out: string[] = [];
  for (let i = 0; i < n && pool.length; i++) {
    out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  }
  return out;
}
