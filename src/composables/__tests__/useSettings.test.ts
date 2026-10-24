import { beforeEach, describe, expect, it } from 'vitest';
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

  it('persists changes and a fresh instance reads them back', () => {
    useSettings().inputMode.value = 'direct';
    expect(JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null')).toEqual({
      inputMode: 'direct',
      locale: 'zh-TW',
    });
    __resetSettings();
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
