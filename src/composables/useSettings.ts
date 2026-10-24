import { ref, watch, type Ref } from 'vue';
import type { InputMode, Settings } from '../core/types';
import { isPlainObject, readJson, SETTINGS_KEY, writeJson } from './storage';

export const DEFAULT_SETTINGS: Readonly<Settings> = Object.freeze({
  inputMode: 'trail',
  locale: 'zh-TW',
});

export interface SettingsState {
  inputMode: Ref<InputMode>;
  locale: Ref<'zh-TW'>;
}

// Module-level singleton (spec §7); the first caller's storage wins until `__resetSettings()`.
let state: SettingsState | null = null;
let stopWatch: (() => void) | null = null;

function readSettings(storage: Storage | undefined): Settings {
  const raw = readJson(SETTINGS_KEY, isPlainObject, storage);
  return {
    inputMode:
      raw?.inputMode === 'trail' || raw?.inputMode === 'direct'
        ? raw.inputMode
        : DEFAULT_SETTINGS.inputMode,
    locale: raw?.locale === 'zh-TW' ? raw.locale : DEFAULT_SETTINGS.locale,
  };
}

export function useSettings(storage?: Storage): SettingsState {
  if (state) return state;
  const initial = readSettings(storage);
  const inputMode = ref<InputMode>(initial.inputMode);
  const locale = ref<'zh-TW'>(initial.locale);
  stopWatch = watch(
    [inputMode, locale],
    ([mode, loc]) => {
      const settings: Settings = {
        inputMode: mode === 'direct' ? 'direct' : 'trail',
        locale: loc === 'zh-TW' ? loc : DEFAULT_SETTINGS.locale,
      };
      writeJson(SETTINGS_KEY, settings, storage);
    },
    { flush: 'sync' },
  );
  state = { inputMode, locale };
  return state;
}

/** Test hook: drop the singleton so the next `useSettings()` re-reads storage. */
export function __resetSettings(): void {
  stopWatch?.();
  stopWatch = null;
  state = null;
}
