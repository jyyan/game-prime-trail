import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeUiPrefs, readUiPrefs, UI_KEY } from '../useUiPrefs';

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe('useUiPrefs', () => {
  it('reads {} when nothing is stored', () => {
    expect(readUiPrefs()).toEqual({});
  });

  it('merge keeps the fields it does not touch', () => {
    localStorage.setItem(UI_KEY, JSON.stringify({ rulesCollapsed: true }));
    mergeUiPrefs({ controlsHintSeen: true });
    expect(JSON.parse(localStorage.getItem(UI_KEY)!)).toEqual({ rulesCollapsed: true, controlsHintSeen: true });
    mergeUiPrefs({ rulesCollapsed: false });
    expect(readUiPrefs()).toEqual({ rulesCollapsed: false, controlsHintSeen: true });
  });

  it.each(['[1]', '"x"', 'x', 'null', '42'])('reads {} for a non-object value %s, and merge replaces it', (raw) => {
    localStorage.setItem(UI_KEY, raw);
    expect(readUiPrefs()).toEqual({});
    mergeUiPrefs({ controlsHintSeen: true });
    expect(readUiPrefs()).toEqual({ controlsHintSeen: true });
  });

  it('merge swallows a failing setItem (private mode, quota)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    expect(() => mergeUiPrefs({ controlsHintSeen: true })).not.toThrow();
  });

  it('read swallows a failing getItem', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(readUiPrefs()).toEqual({});
  });
});
