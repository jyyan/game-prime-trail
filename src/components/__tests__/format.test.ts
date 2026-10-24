import { describe, expect, it } from 'vitest';
import { formatMs, padId } from '../format';

describe('formatMs', () => {
  it('formats minutes and seconds as mm:ss', () => {
    expect(formatMs(754_000)).toBe('12:34');
    expect(formatMs(0)).toBe('00:00');
    expect(formatMs(3_600_000)).toBe('60:00');
  });

  it('truncates partial seconds and clamps negatives', () => {
    expect(formatMs(59_999)).toBe('00:59');
    expect(formatMs(-5)).toBe('00:00');
  });
});

describe('padId', () => {
  it('pads to four digits', () => {
    expect(padId(7)).toBe('0007');
    expect(padId(123)).toBe('0123');
    expect(padId(1000)).toBe('1000');
  });
});
