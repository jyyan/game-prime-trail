// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { FIXTURE_RECORD } from '../../src/core/__fixtures__/level-fixture';
import { isEdge } from '../../src/core/geometry';
import { decodeLevel, derivePuzzle, hintMaskToPrimes } from '../../src/core/level-decode';
import { createRng, levelSeed } from '../../src/core/rng';
import { solve } from '../../src/core/solver';
import { GEN_CONFIG, type GenConfig } from '../gen-config';
import {
  generateLevel,
  greedyHintMask,
  isRowCurrent,
  popcount,
  recomputeRow,
  rowConfigOf,
  type MetaRow,
} from '../lib/gen-level';

const SMALL: GenConfig = {
  ...GEN_CONFIG,
  backbiteSteps: 2000,
  candidates: 1,
  challengeBudget: 50_000,
  advBudget: 200_000,
  advRestarts: 1,
};

const withoutMs = (row: MetaRow): MetaRow => ({ ...row, ms: 0 });

function isUnique(row: Pick<MetaRow, 's' | 'p' | 'h'>, difficulty: 'easy' | 'advanced'): boolean {
  const level = decodeLevel({ ...row, c: null, seed: 0 }, 1);
  const r = solve(derivePuzzle(level, difficulty), { maxSolutions: 2, maxNodes: 2_000_000 });
  return r.count === 1 && r.exhausted;
}

describe('generateLevel', () => {
  const row = generateLevel(1, SMALL);

  it('produces a valid, uniquely solvable level record', () => {
    expect(row.id).toBe(1);
    expect(row.p).toMatch(/^[UDLR]{99}$/);
    expect(isEdge(row.s)).toBe(true);
    expect(isUnique(row, 'easy')).toBe(true);
    expect(isUnique(row, 'advanced')).toBe(true);
    expect(row.hintCount).toBe(popcount(row.h));
    expect(row.hintCount).toBeGreaterThanOrEqual(6);
    expect(row.seed).toBe(levelSeed('prime-trail-v1', 1, row.attempt));
    expect(row.c === null || (row.c >= 1 && row.c <= SMALL.challengeCap)).toBe(true);
    expect(row.candidates).toEqual([
      { attempt: row.attempt, seed: row.seed, c: row.c, nodes: row.nodes.chal },
    ]);
    expect(row.generator).toBe(GEN_CONFIG.generator);
  });

  it('is reproducible', () => {
    expect(withoutMs(generateLevel(1, SMALL))).toEqual(withoutMs(row));
  });

  it('picks the candidate with the fewest challenge solutions, earliest on ties', () => {
    const multi = generateLevel(2, { ...SMALL, candidates: 3 });
    expect(multi.candidates).toHaveLength(3);
    const attempts = multi.candidates.map((cand) => cand.attempt);
    expect(attempts).toEqual([...attempts].sort((a, b) => a - b));
    const rank = (c: number | null): number => c ?? Number.POSITIVE_INFINITY;
    const best = Math.min(...multi.candidates.map((cand) => rank(cand.c)));
    const first = multi.candidates.find((cand) => rank(cand.c) === best);
    expect(multi.attempt).toBe(first?.attempt);
    expect(multi.c).toBe(first?.c);
  });

  it('gives up after maxAttemptsPerLevel', () => {
    expect(() => generateLevel(1, { ...SMALL, maxAttemptsPerLevel: 0 })).toThrow(/after 0 attempts/);
  });

  it('records the parameters it ran with', () => {
    expect(row.config).toEqual(rowConfigOf(SMALL));
    expect(isRowCurrent(row, SMALL)).toBe(true);
    expect(isRowCurrent(row, { ...SMALL, generator: 'other' })).toBe(false);
    expect(isRowCurrent(row, { ...SMALL, advFloor: 5 })).toBe(false);
  });
});

// Each case regenerates id 5 (about 1–2 s alone, several times that under parallel test files).
describe('recomputeRow matches a fresh run with the new parameters', { timeout: 60_000 }, () => {
  // With these settings id 5 picks attempt 3 under the tiny budget (every c is null) and attempt 7
  // under the larger one (its c reaches the cap of 2), so the recompute must move the pick.
  const OLD: GenConfig = { ...SMALL, candidates: 3, challengeCap: 2, challengeBudget: 1_000 };
  const NEW_C: GenConfig = { ...OLD, challengeBudget: 200_000, generator: 'test/c' };
  const old = generateLevel(5, OLD);

  it('re-picks the candidate when c changes', () => {
    const fresh = generateLevel(5, NEW_C);
    expect(fresh.attempt).not.toBe(old.attempt);
    expect(withoutMs(recomputeRow(old, ['c'], NEW_C))).toEqual(withoutMs(fresh));
  });

  it('reruns the greedy search for h', () => {
    const newH: GenConfig = { ...OLD, advFloor: 4, generator: 'test/h' };
    expect(withoutMs(recomputeRow(old, ['h'], newH))).toEqual(withoutMs(generateLevel(5, newH)));
  });

  it('does both at once', () => {
    const newHC: GenConfig = { ...NEW_C, advFloor: 4, generator: 'test/hc' };
    expect(withoutMs(recomputeRow(old, ['h', 'c'], newHC))).toEqual(withoutMs(generateLevel(5, newHC)));
  });

  it('is a no-op with unchanged parameters', () => {
    expect(withoutMs(recomputeRow(old, ['h', 'c'], OLD))).toEqual(withoutMs(old));
  });

  it('refuses parameters outside the recomputed stages', () => {
    expect(() => recomputeRow(old, ['h'], NEW_C)).toThrow(/challengeBudget/);
    expect(() => recomputeRow(old, ['c'], { ...NEW_C, advFloor: 4 })).toThrow(/advFloor/);
    expect(() => recomputeRow(old, ['h', 'c'], { ...OLD, easyBudget: 1 })).toThrow(/easyBudget/);
    expect(() => recomputeRow(old, ['h', 'c'], { ...OLD, backbiteSteps: 10 })).toThrow(/backbiteSteps/);
    expect(() => recomputeRow({ ...old, config: undefined as never }, ['h', 'c'], OLD)).toThrow(/regenerate/);
  });
});

describe('greedyHintMask', () => {
  it('stops at the floor and stays unique', () => {
    const level = decodeLevel(FIXTURE_RECORD, 1);
    const mask = greedyHintMask(level, createRng(1), { advFloor: 6, advBudget: 2_000_000 });
    expect(popcount(mask)).toBe(6);
    const hinted = { ...level, advancedHints: hintMaskToPrimes(mask) };
    const r = solve(derivePuzzle(hinted, 'advanced'), { maxSolutions: 2, maxNodes: 2_000_000 });
    expect(r).toMatchObject({ count: 1, exhausted: true });
  });

  it('keeps the smallest subset over restarts', () => {
    const level = decodeLevel(FIXTURE_RECORD, 1);
    // A small budget keeps this fast: puzzles not settled within it count as not unique.
    const cfg = { advFloor: 1, advBudget: 20_000 };
    // The first of three restarts sees the same rng state as a single-restart run.
    const once = greedyHintMask(level, createRng(7), { ...cfg, advRestarts: 1 });
    const mask = greedyHintMask(level, createRng(7), { ...cfg, advRestarts: 3 });
    expect(popcount(mask)).toBeLessThanOrEqual(popcount(once));
    const hinted = { ...level, advancedHints: hintMaskToPrimes(mask) };
    const r = solve(derivePuzzle(hinted, 'advanced'), { maxSolutions: 2, maxNodes: 2_000_000 });
    expect(r).toMatchObject({ count: 1, exhausted: true });
  });
});
