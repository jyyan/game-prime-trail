import { describe, expect, it } from 'vitest';
import {
  FIXTURE_AMBIGUOUS_HINT_MASK,
  FIXTURE_GREY_CELLS,
  FIXTURE_PATH,
  FIXTURE_RECORD,
} from '../__fixtures__/level-fixture';
import {
  decodeLevel,
  derivePuzzle,
  hintMaskToPrimes,
  parseLevelFile,
  primesToHintMask,
} from '../level-decode';
import { PRIMES } from '../primes';

const ADV_PRIMES = new Set([17, 19, 23, 29, 31, 37]);

function file(overrides: Record<string, unknown> = {}, record: Record<string, unknown> = {}) {
  return {
    schema: 1,
    libraryVersion: 1,
    generator: 'x',
    masterSeed: 's',
    count: 1,
    levels: [{ ...FIXTURE_RECORD, ...record }],
    ...overrides,
  };
}

describe('hint mask', () => {
  it('converts between mask and primes', () => {
    expect(hintMaskToPrimes(4032)).toEqual(ADV_PRIMES);
    expect(primesToHintMask([17, 19, 23, 29, 31, 37])).toBe(4032);
    const amb = hintMaskToPrimes(FIXTURE_AMBIGUOUS_HINT_MASK);
    expect(amb.size).toBe(18);
    expect(amb.has(17)).toBe(false);
    expect(primesToHintMask(PRIMES)).toBe(2 ** 25 - 1);
    expect(hintMaskToPrimes(0).size).toBe(0);
  });

  it('rejects non-primes', () => {
    expect(() => primesToHintMask([4])).toThrow();
  });
});

describe('decodeLevel', () => {
  it('decodes the fixture record', () => {
    const level = decodeLevel(FIXTURE_RECORD, 7);
    expect(level.id).toBe(7);
    expect(level.start).toBe(8);
    expect([...level.path]).toEqual([...FIXTURE_PATH]);
    expect(level.cellOf).toBe(level.path);
    expect(level.numberAt[8]).toBe(1);
    expect(level.numberAt[56]).toBe(100);
    const greyCells = [...level.grey].flatMap((v, i) => (v === 1 ? [i] : []));
    expect(greyCells).toEqual([...FIXTURE_GREY_CELLS]);
    expect(level.advancedHints).toEqual(ADV_PRIMES);
  });
});

describe('derivePuzzle', () => {
  const level = decodeLevel(FIXTURE_RECORD, 1);

  it('easy shows 1 and all primes', () => {
    const pz = derivePuzzle(level, 'easy');
    expect(pz.start).toBe(8);
    expect(pz.givens.size).toBe(26);
    expect(pz.givens.get(8)).toBe(1);
    expect(pz.givens.get(77)).toBe(13);
    expect([...pz.grey]).toEqual([...level.grey]);
  });

  it('advanced shows 1 and the hint subset', () => {
    const pz = derivePuzzle(level, 'advanced');
    expect(pz.givens.size).toBe(7);
    expect(new Set([...pz.givens.values()].filter((n) => n !== 1))).toEqual(ADV_PRIMES);
    expect([...pz.grey]).toEqual([...level.grey]);
  });

  it('challenge shows only 1 but keeps all grey cells', () => {
    const pz = derivePuzzle(level, 'challenge');
    expect([...pz.givens]).toEqual([[8, 1]]);
    expect(pz.grey.reduce((a, b) => a + b, 0)).toBe(25);
  });
});

describe('parseLevelFile', () => {
  it('accepts a valid file', () => {
    const parsed = parseLevelFile(file());
    expect(parsed.count).toBe(1);
    expect(parsed.levels[0]).toEqual(FIXTURE_RECORD);
  });

  it('rejects wrong schema', () => {
    expect(() => parseLevelFile(file({ schema: 2 }))).toThrow();
  });

  it('rejects bad libraryVersion', () => {
    expect(() => parseLevelFile(file({ libraryVersion: 0 }))).toThrow();
    expect(() => parseLevelFile(file({ libraryVersion: 1.5 }))).toThrow();
  });

  it('rejects count mismatch', () => {
    expect(() => parseLevelFile(file({ count: 2 }))).toThrow();
  });

  it('rejects non-objects', () => {
    expect(() => parseLevelFile(null)).toThrow();
    expect(() => parseLevelFile(file({ levels: 'x' }))).toThrow();
  });

  it('rejects malformed records with the record index in the message', () => {
    expect(() => parseLevelFile(file({}, { p: FIXTURE_RECORD.p.slice(0, 98) }))).toThrow(
      'levels[0]',
    );
    expect(() => parseLevelFile(file({}, { s: 55 }))).toThrow('levels[0]');
    expect(() => parseLevelFile(file({}, { h: 2 ** 25 }))).toThrow('levels[0]');
    expect(() => parseLevelFile(file({}, { c: 0 }))).toThrow('levels[0]');
    expect(() => parseLevelFile(file({}, { c: 1001 }))).toThrow('levels[0]');
    expect(() => parseLevelFile(file({}, { seed: -1 }))).toThrow('levels[0]');
  });

  it('accepts c in [1, 1000]', () => {
    expect(() => parseLevelFile(file({}, { c: 1 }))).not.toThrow();
    expect(() => parseLevelFile(file({}, { c: 1000 }))).not.toThrow();
  });

  it('reports the failing record index', () => {
    const f = file({ count: 2 });
    f.levels.push({ ...FIXTURE_RECORD, p: 'U' });
    expect(() => parseLevelFile(f)).toThrow('levels[1]');
  });
});
