/**
 * Versioned localStorage wrapper. Bump STORAGE_VERSION when the persisted
 * profile schema changes incompatibly (legacy used 'aether-duels:v2').
 */
export const STORAGE_VERSION = 3;
const PREFIX = 'aether-duels';

export function storageKey(name: string): string {
  return `${PREFIX}:v${STORAGE_VERSION}:${name}`;
}

export function loadJSON<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(storageKey(name));
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as object) } as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(name: string, value: unknown): void {
  try {
    localStorage.setItem(storageKey(name), JSON.stringify(value));
  } catch {
    /* storage full or unavailable — fail silently */
  }
}
