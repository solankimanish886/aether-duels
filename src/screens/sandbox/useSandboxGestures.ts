import { useCallback, useEffect, useRef, useState } from 'react';
import type { Gesture } from '@/game/hand/gestures';
import { ACTION_COOLDOWN_MS, HELD_DONE_MS, HELD_FIST_MS } from '@/game/hand/constants';
import type { SandboxMode } from '@/game/sandbox/types';

export type SandboxMenuKind = 'shape' | 'color';
export interface SandboxHold {
  action: 'clear' | 'save';
  progress: number; // 0..1
}

const MENU_GRACE_MS = 500;

interface Params {
  getCursor: () => { x: number; y: number };
  getMode: () => SandboxMode;
  enabled: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToggleMode: () => void;
  onClear: () => void;
  onSave: () => void;
}

/**
 * Sandbox gesture controller (sibling of useDuelGestures). Pinch is pen/drag
 * (handled by the hand bridge). Finger-count poses open radial menus; 3 fingers
 * toggles Create↔Fill; thumb/shaka tap undo/redo; fist/open hold clear/save.
 */
export function useSandboxGestures({
  getCursor,
  getMode,
  enabled,
  onUndo,
  onRedo,
  onToggleMode,
  onClear,
  onSave,
}: Params) {
  const [menu, setMenu] = useState<SandboxMenuKind | null>(null);
  const [anchor, setAnchor] = useState({ x: 0, y: 0 });
  const [hold, setHold] = useState<SandboxHold | null>(null);

  const menuRef = useRef<SandboxMenuKind | null>(null);
  const lastPoseAt = useRef(0);
  const blockReopen = useRef(false);
  const prevTap = useRef<Gesture | null>(null);
  const lastActionAt = useRef(0);
  const holdGesture = useRef<Gesture | null>(null);
  const holdStart = useRef(0);
  const holdFired = useRef(false);

  const cbs = useRef({ getCursor, getMode, onUndo, onRedo, onToggleMode, onClear, onSave });
  cbs.current = { getCursor, getMode, onUndo, onRedo, onToggleMode, onClear, onSave };

  const closeMenu = useCallback(() => {
    menuRef.current = null;
    blockReopen.current = true;
    setMenu(null);
  }, []);

  const handleGesture = useCallback(
    (g: Gesture) => {
      if (!enabled) return;
      const now = performance.now();

      // ── menus: 2 fingers → shape (Create) / colour (Fill); 4 fingers → colour ──
      const mode = cbs.current.getMode();
      let poseKind: SandboxMenuKind | null = null;
      if (g === 'two-finger') poseKind = mode === 'fill' ? 'color' : 'shape';
      else if (g === 'palm') poseKind = 'color';

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
        blockReopen.current = false;
        if (menuRef.current && (g === 'pinch' || now - lastPoseAt.current > MENU_GRACE_MS)) {
          menuRef.current = null;
          setMenu(null);
        }
      }

      // ── edge taps: thumb=undo, shaka=redo, three-finger=toggle mode ──
      if (
        (g === 'thumb' || g === 'shaka' || g === 'three-finger') &&
        prevTap.current !== g &&
        now - lastActionAt.current > ACTION_COOLDOWN_MS
      ) {
        lastActionAt.current = now;
        if (g === 'thumb') cbs.current.onUndo();
        else if (g === 'shaka') cbs.current.onRedo();
        else cbs.current.onToggleMode();
      }
      prevTap.current = g;

      // ── holds: fist=clear, open=save ──
      if (g === 'fist' || g === 'open') {
        const dur = g === 'fist' ? HELD_FIST_MS : HELD_DONE_MS;
        if (holdGesture.current !== g) {
          holdGesture.current = g;
          holdStart.current = now;
          holdFired.current = false;
        }
        const progress = Math.min(1, (now - holdStart.current) / dur);
        setHold({ action: g === 'fist' ? 'clear' : 'save', progress });
        if (!holdFired.current && progress >= 1) {
          holdFired.current = true;
          if (g === 'fist') cbs.current.onClear();
          else cbs.current.onSave();
        }
      } else if (holdGesture.current) {
        holdGesture.current = null;
        holdFired.current = false;
        setHold(null);
      }
    },
    [enabled],
  );

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
