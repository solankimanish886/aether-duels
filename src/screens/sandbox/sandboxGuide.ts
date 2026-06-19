import type { GuideItem } from '@/components/GestureGuide';

/** Sandbox gesture cheat-sheet (reliable poses; no swipes). */
export const SANDBOX_GESTURES: GuideItem[] = [
  { pose: 'pinch', emoji: '🤏', label: 'Draw / Move', how: 'Pinch to draw, place, drag & resize' },
  { pose: 'two-finger', emoji: '✌️', label: 'Shapes / Colour', how: '2 fingers → shape (or colour) wheel' },
  { pose: 'palm', emoji: '🖐️', label: 'Colour', how: '4 fingers → colour wheel' },
  { pose: 'three-finger', emoji: '🤟', label: 'Switch mode', how: '3 fingers → Create ⇄ Fill' },
  { pose: 'thumb', emoji: '👍', label: 'Undo', how: 'Thumb out' },
  { pose: 'shaka', emoji: '🤙', label: 'Redo', how: 'Thumb + pinky out' },
  { pose: 'fist', emoji: '✊', label: 'Clear', how: 'Hold a fist to wipe the canvas' },
  { pose: 'open', emoji: '🙌', label: 'Save', how: 'Hold open hand to export a PNG' },
];

export const SANDBOX_GUIDE_NOTE = 'Pinch to draw & shape · open a wheel with 2 / 4 fingers, then hover + hold to pick.';
