import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  FIXTURE_ALT_DIRS,
  FIXTURE_ALT_PATH,
  FIXTURE_DIRS,
  FIXTURE_PATH,
} from '../__fixtures__/level-fixture';
import { PathCodecError, decodePath, encodePath, isHamiltonianPath } from '../path-codec';

function codecError(fn: () => unknown): PathCodecError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(PathCodecError);
    return e as PathCodecError;
  }
  throw new Error('expected PathCodecError');
}

describe('decodePath / encodePath', () => {
  it('decodes the fixture', () => {
    const path = decodePath(8, FIXTURE_DIRS);
    expect(path).toBeInstanceOf(Uint8Array);
    expect([...path]).toEqual([...FIXTURE_PATH]);
    expect([...decodePath(8, FIXTURE_ALT_DIRS)]).toEqual([...FIXTURE_ALT_PATH]);
  });

  it('encodes the fixture', () => {
    expect(encodePath(FIXTURE_PATH)).toBe(FIXTURE_DIRS);
    expect(encodePath(Uint8Array.from(FIXTURE_ALT_PATH))).toBe(FIXTURE_ALT_DIRS);
  });

  it('round-trips fixture paths and their reversals', () => {
    fc.assert(
      fc.property(fc.constantFrom(FIXTURE_PATH, FIXTURE_ALT_PATH), fc.boolean(), (base, rev) => {
        const p = rev ? [...base].reverse() : [...base];
        expect([...decodePath(p[0], encodePath(p))]).toEqual(p);
      }),
    );
  });

  it('rejects wrong dirs length', () => {
    codecError(() => decodePath(8, FIXTURE_DIRS.slice(0, 98)));
    codecError(() => decodePath(8, FIXTURE_DIRS + 'R'));
  });

  it('rejects a non-UDLR letter at its index', () => {
    const dirs = FIXTURE_DIRS.slice(0, 50) + 'X' + FIXTURE_DIRS.slice(51);
    expect(codecError(() => decodePath(8, dirs)).index).toBe(50);
  });

  it('rejects stepping off the board', () => {
    expect(codecError(() => decodePath(0, 'U' + 'R'.repeat(98))).index).toBe(0);
  });

  it('rejects revisiting a cell', () => {
    expect(codecError(() => decodePath(8, 'RL' + 'D'.repeat(97))).index).toBe(1);
  });

  it('rejects an out-of-range start', () => {
    codecError(() => decodePath(100, FIXTURE_DIRS));
    codecError(() => decodePath(-1, FIXTURE_DIRS));
    codecError(() => decodePath(1.5, FIXTURE_DIRS));
  });

  it('encodePath rejects wrong length and non-adjacent steps', () => {
    codecError(() => encodePath(FIXTURE_PATH.slice(0, 99)));
    const swapped = [...FIXTURE_PATH];
    [swapped[10], swapped[40]] = [swapped[40], swapped[10]];
    expect(codecError(() => encodePath(swapped)).index).toBe(9);
  });
});

describe('isHamiltonianPath', () => {
  it('accepts the fixture paths', () => {
    expect(isHamiltonianPath(FIXTURE_PATH)).toBe(true);
    expect(isHamiltonianPath(Uint8Array.from(FIXTURE_ALT_PATH))).toBe(true);
  });

  it('rejects swapped elements', () => {
    const swapped = [...FIXTURE_PATH];
    [swapped[10], swapped[40]] = [swapped[40], swapped[10]];
    expect(isHamiltonianPath(swapped)).toBe(false);
  });

  it('rejects duplicates and wrong length', () => {
    const dup = [...FIXTURE_PATH];
    dup[99] = dup[97];
    expect(isHamiltonianPath(dup)).toBe(false);
    expect(isHamiltonianPath(FIXTURE_PATH.slice(0, 99))).toBe(false);
  });
});
