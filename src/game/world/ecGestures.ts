import type { GuideItem } from '@/components/GestureGuide';

/**
 * Element Creator gesture cheat-sheet. The single-hand poses map 1:1 to brushes;
 * Storm is a two-hand pose (its `pose` is set to `shaka` purely as a highlight
 * sentinel — no world brush uses shaka, so it never false-lights).
 */
export const EC_GESTURES: GuideItem[] = [
  { pose: 'palm', emoji: '🖐', label: 'Raise land', how: 'Open hand to the camera' },
  { pose: 'fist', emoji: '✊', label: 'Dig water', how: 'Make a fist' },
  { pose: 'draw', emoji: '☝', label: 'Plant forest', how: 'Point one finger' },
  { pose: 'thumb', emoji: '👍', label: 'Erupt volcano', how: 'Thumbs up' },
  { pose: 'two-finger', emoji: '✌', label: 'Rain cloud', how: 'Two fingers up' },
  { pose: 'shaka', emoji: '🙌', label: 'Storm', how: 'Both hands open, held wide apart' },
];

export const EC_GUIDE_NOTE = 'Hold a pose over the world to shape it · two open hands wide apart summon a storm.';
