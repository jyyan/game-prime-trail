import { beforeEach, describe, expect, it } from 'vitest';
import { isPlainObject, readJson, removeKey, SETTINGS_KEY, storageKey, writeJson } from '../storage';

const isNumberArray = (v: unknown): v is number[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'number');

describe('storage', () => {
  beforeEach(() => localStorage.clear());

  it('builds versioned keys', () => {
    expect(storageKey('records', 1)).toBe('prime-trail:v1:L1:records');
    expect(storageKey('progress', 2)).toBe('prime-trail:v1:L2:progress');
    expect(storageKey('lastPlayed', 1)).toBe('prime-trail:v1:L1:lastPlayed');
    expect(SETTINGS_KEY).toBe('prime-trail:v1:settings');
  });

  it('returns null for a missing key', () => {
    expect(readJson('nope', isPlainObject)).toBeNull();
  });

  it('returns null for broken JSON without throwing', () => {
    localStorage.setItem('k', '{bad');
    expect(() => readJson('k', isPlainObject)).not.toThrow();
    expect(readJson('k', isPlainObject)).toBeNull();
  });

  it('returns null when the guard fails', () => {
    localStorage.setItem('k', JSON.stringify({ a: 1 }));
    expect(readJson('k', isNumberArray)).toBeNull();
  });

  it('round-trips writeJson and readJson, and removeKey deletes', () => {
    expect(writeJson('k', [1, 2, 3])).toBe(true);
    expect(readJson('k', isNumberArray)).toEqual([1, 2, 3]);
    removeKey('k');
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('swallows storage exceptions', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    } as unknown as Storage;
    expect(readJson('k', isPlainObject, broken)).toBeNull();
    expect(writeJson('k', 1, broken)).toBe(false);
    expect(() => removeKey('k', broken)).not.toThrow();
  });
});
