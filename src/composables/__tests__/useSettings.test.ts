import { beforeEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { SETTINGS_KEY } from '../storage';
import { __resetSettings, useSettings } from '../useSettings';

describe('useSettings', () => {
  beforeEach(() => {
    localStorage.clear();
    __resetSettings();
  });

  it('defaults to trail / zh-TW', () => {
    const s = useSettings();
    expect(s.inputMode.value).toBe('trail');
    expect(s.locale.value).toBe('zh-TW');
  });

  it('is a module-level singleton', () => {
    expect(useSettings()).toBe(useSettings());
  });

  function stored(): unknown {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
  }

  it('persists changes and a fresh instance reads them back', async () => {
    useSettings().inputMode.value = 'direct';
    await nextTick();
    expect(stored()).toEqual({ inputMode: 'direct', locale: 'zh-TW' });
    __resetSettings();
    expect(useSettings().inputMode.value).toBe('direct');
  });

  it('a locale change triggers a write and is normalized to a supported locale', async () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ inputMode: 'direct', locale: 'zh-TW' }));
    const s = useSettings();
    localStorage.removeItem(SETTINGS_KEY);
    // Only 'zh-TW' is supported today; force a change to prove the locale watcher writes.
    s.locale.value = 'en' as 'zh-TW';
    await nextTick();
    expect(stored()).toEqual({ inputMode: 'direct', locale: 'zh-TW' });
    s.locale.value = 'zh-TW';
    await nextTick();
    expect(stored()).toEqual({ inputMode: 'direct', locale: 'zh-TW' });
    __resetSettings();
    expect(useSettings().locale.value).toBe('zh-TW');
    expect(useSettings().inputMode.value).toBe('direct');
  });

  it('broken JSON falls back to defaults', () => {
    localStorage.setItem(SETTINGS_KEY, '{bad');
    expect(useSettings().inputMode.value).toBe('trail');
  });

  it('invalid values fall back to defaults', () => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ inputMode: 'swipe', locale: 'fr' }));
    const s = useSettings();
    expect(s.inputMode.value).toBe('trail');
    expect(s.locale.value).toBe('zh-TW');
  });

  it('does not use the library version prefix', () => {
    useSettings().inputMode.value = 'direct';
    expect(Object.keys(localStorage)).toEqual(['prime-trail:v1:settings']);
  });
});
