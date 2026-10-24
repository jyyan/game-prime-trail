// Thin, never-throwing localStorage helpers (spec §7.5): any missing value, broken JSON,
// failed guard or inaccessible storage reads as "no data".

export type StorageName = 'records' | 'progress' | 'lastPlayed';

/** Settings are not scoped by library version: a new level library must not reset preferences. */
export const SETTINGS_KEY = 'prime-trail:v1:settings';

export function storageKey(name: StorageName, libraryVersion: number): string {
  return `prime-trail:v1:L${libraryVersion}:${name}`;
}

function defaultStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Accessing localStorage can throw (blocked site data, sandboxed iframes).
    return null;
  }
}

export function readJson<T>(
  key: string,
  guard: (v: unknown) => v is T,
  storage: Storage | null = defaultStorage(),
): T | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    return guard(value) ? value : null;
  } catch {
    return null;
  }
}

/** Returns false when the value could not be stored (no storage, quota exceeded). */
export function writeJson(
  key: string,
  value: unknown,
  storage: Storage | null = defaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string, storage: Storage | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    // ignore
  }
}

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
