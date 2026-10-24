import { describe, expect, it } from 'vitest';
import { createRng, hash32, levelSeed } from '../rng';

describe('rng', () => {
  it('hash32 is FNV-1a 32-bit', () => {
    expect(hash32('')).toBe(2166136261);
    expect(hash32('a')).toBe(0xe40c292c);
  });

  it('levelSeed', () => {
    expect(levelSeed('prime-trail-v1', 1, 0)).toBe(hash32('prime-trail-v1:1:0'));
  });

  it('same seed gives same sequence', () => {
    const a = createRng(123);
    const b = createRng(123);
    for (let i = 0; i < 1000; i++) expect(a.next()).toBe(b.next());
  });

  it('different seeds differ', () => {
    const a = createRng(1);
    const b = createRng(2);
    const xs = Array.from({ length: 10 }, () => a.next());
    const ys = Array.from({ length: 10 }, () => b.next());
    expect(xs).not.toEqual(ys);
  });

  it('next is in [0,1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(10) is in [0,9]', () => {
    const r = createRng(9);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(10);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(9);
    }
  });

  it('shuffle is in place and a permutation', () => {
    const arr = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const out = createRng(5).shuffle(arr);
    expect(out).toBe(arr);
    expect([...out].sort((x, y) => x - y)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('pick returns an element', () => {
    const arr = ['a', 'b', 'c'];
    expect(arr).toContain(createRng(3).pick(arr));
  });
});
