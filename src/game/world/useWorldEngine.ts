import { useRef } from 'react';
import { WorldEngine } from './WorldEngine';
import { DEFAULT_QUALITY, type Quality } from './constants';

/**
 * Create the WorldEngine once for the screen's lifetime. The engine is a pure
 * sim object (no GPU/DOM), so there's nothing to dispose — React GCs it when the
 * screen unmounts.
 */
export function useWorldEngine(quality: Quality = DEFAULT_QUALITY): WorldEngine {
  const ref = useRef<WorldEngine | null>(null);
  if (!ref.current) ref.current = new WorldEngine(quality);
  return ref.current;
}
