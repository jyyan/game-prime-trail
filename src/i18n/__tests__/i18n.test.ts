import { afterEach, describe, expect, it, vi } from 'vitest';
import { messages, t, useI18n, type MessageKey } from '..';
import { zhTW } from '../zh-TW';

function leaves(node: unknown, path: string[] = []): Array<[string, unknown]> {
  if (typeof node === 'object' && node !== null) {
    return Object.entries(node).flatMap(([k, v]) => leaves(v, [...path, k]));
  }
  return [[path.join('.'), node]];
}

describe('t', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('looks up a plain key', () => {
    expect(t('difficulty.easy')).toBe('簡單');
    expect(t('app.title')).toBe('Prime Trail');
  });

  it('replaces {name} placeholders', () => {
    expect(t('status.steps', { n: 57 })).toBe('步數 57');
    expect(t('picker.resumeLabel', { id: '0123', difficulty: '進階' })).toBe('#0123・進階');
    expect(t('board.cellLabel', { r: 1, c: 2, content: '7' })).toBe('第1列第2行，7');
  });

  it('leaves placeholders without a matching param untouched', () => {
    expect(t('status.steps', {})).toBe('步數 {n}');
  });

  it('returns the key itself and warns once for an unknown key', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('nope' as MessageKey)).toBe('nope');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('treats a namespace (non-leaf) key as missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(t('difficulty' as MessageKey)).toBe('difficulty');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('rejects misspelled keys at the type level', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // @ts-expect-error 'difficulty.hard' is not a MessageKey
    expect(t('difficulty.hard')).toBe('difficulty.hard');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('useI18n', () => {
  it('exposes t and the zh-TW locale', () => {
    const { t: tt, locale } = useI18n();
    expect(locale.value).toBe('zh-TW');
    expect(tt('difficulty.challenge')).toBe('挑戰');
  });

  it('registers zh-TW in messages', () => {
    expect(messages['zh-TW']).toBe(zhTW);
  });
});

describe('zh-TW messages', () => {
  const all = leaves(zhTW);

  it('has a non-empty string at every leaf', () => {
    expect(all.length).toBeGreaterThan(0);
    for (const [key, value] of all) {
      expect(typeof value, key).toBe('string');
      expect((value as string).length, key).toBeGreaterThan(0);
    }
  });

  it('never mentions Hidato or Numbrix', () => {
    for (const [key, value] of all) {
      expect(value as string, key).not.toMatch(/hidato|numbrix/i);
    }
  });

  it('uses the fixed terminology', () => {
    expect(t('board.head')).toBe('龍頭');
    expect(t('board.primeCell')).toBe('質數格');
    expect(t('input.trail')).toBe('接續模式');
    expect(t('input.direct')).toBe('指定模式');
    expect(t('solution.reference')).toBe('參考解');
  });
});
