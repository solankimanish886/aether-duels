import { useCallback, useEffect, useRef, useState } from 'react';
import type { Gesture } from '@/game/hand/gestures';
import { ACTION_COOLDOWN_MS, HELD_DONE_MS, HELD_FIST_MS } from '@/game/hand/constants';

export type MenuKind = 'color' | 'size' | 'tool';
export interface HoldState {
  action: 'clear' | 'done';
  progress: number; // 0..1
}

/** Finger-count poses that open a radial menu. */
const MENU_POSE: Partial<Record<Gesture, MenuKind>> = {
  'two-finger': 'color',
  'three-finger': 'size',
  palm: 'tool',
};
/** Keep a menu open this long after its pose drops, so brief flicker doesn't close it. */
const MENU_GRACE_MS = 500;

interface Params {
  /** Latest index-finger cursor position (viewport px) — used to anchor a menu. */
  getCursor: () => { x: number; y: number };
  enabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onDone: () => void;
}

/**
 * Maps committed hand gestures to drawing-control intents for Forge a Duel:
 * finger-count poses open radial menus (selection happens via the tracker's
 * dwell-to-click), thumb/shaka are edge-triggered undo/redo taps, and fist/open
 * are hold-to-confirm clear/done. `handleGesture` is meant to be wired to the
 * HandTracker's per-frame `onGesture` event.
 */
export function useDuelGestures({ getCursor, enabled, onUndo, onRedo, onClear, onDone }: Params) {
  const [menu, setMenu] = useState<MenuKind | null>(null);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const [hold, setHold] = useState<HoldState | null>(null);

  const menuRef = useRef<MenuKind | null>(null);
  const lastPoseAt = useRef(0);
  const blockReopen = useRef(false); // suppress reopening the same menu until the pose is released
  const prevTap = useRef<Gesture | null>(null);
  const lastActionAt = useRef(0);
  const holdGesture = useRef<Gesture | null>(null);
  const holdStart = useRef(0);
  const holdFired = useRef(false);

  // Keep the latest callbacks in refs so `handleGesture` can stay stable.
  const cbs = useRef({ onUndo, onRedo, onClear, onDone, getCursor });
  cbs.current = { onUndo, onRedo, onClear, onDone, getCursor };

  const closeMenu = useCallback(() => {
    menuRef.current = null;
    blockReopen.current = true;
    setMenu(null);
  }, []);

  const handleGesture = useCallback((g: Gesture) => {
    if (!enabled) return;
    const now = performance.now();

    // ── radial menus (2 / 3 / 4 fingers) ──
    const poseKind = MENU_POSE[g];
    if (poseKind) {
      if (!blockReopen.current) {
        if (menuRef.current !== poseKind) {
          menuRef.current = poseKind;
          const c = cbs.current.getCursor();
          setAnchor({ x: c.x, y: c.y });
          setMenu(poseKind);
        }
        lastPoseAt.current = now;
      }
    } else {
      blockReopen.current = false; // pose released → reopening allowed again
      if (menuRef.current && (g === 'pinch' || now - lastPoseAt.current > MENU_GRACE_MS)) {
        menuRef.current = null;
        setMenu(null);
      }
    }

    // ── edge-triggered taps: thumb = undo, shaka = redo ──
    if ((g === 'thumb' || g === 'shaka') && prevTap.current !== g && now - lastActionAt.current > ACTION_COOLDOWN_MS) {
      lastActionAt.current = now;
      if (g === 'thumb') cbs.current.onUndo();
      else cbs.current.onRedo();
    }
    prevTap.current = g;

    // ── hold-to-confirm: fist = clear, open hand = done ──
    if (g === 'fist' || g === 'open') {
      const dur = g === 'fist' ? HELD_FIST_MS : HELD_DONE_MS;
      if (holdGesture.current !== g) {
        holdGesture.current = g;
        holdStart.current = now;
        holdFired.current = false;
      }
      const progress = Math.min(1, (now - holdStart.current) / dur);
      setHold({ action: g === 'fist' ? 'clear' : 'done', progress });
      if (!holdFired.current && progress >= 1) {
        holdFired.current = true;
        if (g === 'fist') cbs.current.onClear();
        else cbs.current.onDone();
      }
    } else if (holdGesture.current) {
      holdGesture.current = null;
      holdFired.current = false;
      setHold(null);
    }
  }, [enabled]);

  // Reset all transient state whenever gesture control switches off.
  useEffect(() => {
    if (enabled) return;
    menuRef.current = null;
    holdGesture.current = null;
    holdFired.current = false;
    blockReopen.current = false;
    prevTap.current = null;
    setMenu(null);
    setHold(null);
  }, [enabled]);

  return { menu, anchor, hold, handleGesture, closeMenu };
}
