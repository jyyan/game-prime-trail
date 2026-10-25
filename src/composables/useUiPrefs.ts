import { isPlainObject, readJson, writeJson } from './storage';

/**
 * UI preferences (UI refresh spec §5.2, controls-help spec §4.1): one object shared by the home
 * page (rules card) and the play page (first-time controls hint); not scoped by library version.
 */
export const UI_KEY = 'prime-trail:v1:ui';

export interface UiPrefs {
  rulesCollapsed?: boolean;
  controlsHintSeen?: boolean;
}

/** The stored object, or {} when it is missing, broken, not an object or unreadable. */
export function readUiPrefs(): UiPrefs {
  return (readJson(UI_KEY, isPlainObject) ?? {}) as UiPrefs;
}

/** Read, merge `patch`, write back, so fields written by the other page survive. A failed write is ignored. */
export function mergeUiPrefs(patch: UiPrefs): void {
  writeJson(UI_KEY, { ...readUiPrefs(), ...patch });
}
