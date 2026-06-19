import type { Gesture } from '@/game/hand/gestures';

/** A world-shaping tool. `none` means no brush is held. */
export type BrushKind = 'raise' | 'dig' | 'forest' | 'volcano' | 'rain' | 'storm' | 'none';

/** Map a committed hand pose to the brush it drives. Unlisted poses = no brush. */
export const GESTURE_TO_BRUSH: Partial<Record<Gesture, BrushKind>> = {
  palm: 'raise',
  open: 'raise', // full open hand (thumb splayed) also raises land
  fist: 'dig',
  draw: 'forest',
  thumb: 'volcano',
  'two-finger': 'rain',
};

export interface BrushSpec {
  /** Disk radius in GRID cells. */
  radius: number;
  /** Per-tick deposition strength at the brush centre. */
  strength: number;
  /** Minimum ms between dramatic re-triggers (volcano/storm). 0 = continuous. */
  cooldownMs: number;
  emoji: string;
  label: string;
}

export const BRUSHES: Record<Exclude<BrushKind, 'none'>, BrushSpec> = {
  raise: { radius: 9, strength: 0.05, cooldownMs: 0, emoji: '🖐', label: 'Raise land' },
  dig: { radius: 9, strength: 0.05, cooldownMs: 0, emoji: '✊', label: 'Dig water' },
  forest: { radius: 6, strength: 0.6, cooldownMs: 0, emoji: '☝', label: 'Plant forest' },
  volcano: { radius: 4, strength: 0.12, cooldownMs: 90, emoji: '👍', label: 'Erupt volcano' },
  rain: { radius: 12, strength: 1, cooldownMs: 220, emoji: '✌', label: 'Rain cloud' },
  storm: { radius: 20, strength: 1, cooldownMs: 700, emoji: '🙌', label: 'Storm' },
};

/** Brushes selectable from the on-screen HUD (mouse/touch fallback). */
export const HUD_BRUSHES: Exclude<BrushKind, 'none' | 'storm'>[] = [
  'raise',
  'dig',
  'forest',
  'volcano',
  'rain',
];

/** Tint (hex) used for the cursor ring per brush. */
export const BRUSH_TINT: Record<Exclude<BrushKind, 'none'>, number> = {
  raise: 0x7ed957,
  dig: 0x4aa3ff,
  forest: 0x2ecc71,
  volcano: 0xff6a2b,
  rain: 0x9ad0ff,
  storm: 0xb98cff,
};
