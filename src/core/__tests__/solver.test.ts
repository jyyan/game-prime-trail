import { describe, expect, it } from 'vitest';
import {
  FIXTURE_ALT_PATH,
  FIXTURE_AMBIGUOUS_HINT_MASK,
  FIXTURE_PATH,
  fixtureGrid,
  fixturePuzzle,
} from '../__fixtures__/level-fixture';
import { adjacent } from '../geometry';
import { PRIMES, isPrime } from '../primes';
import { solve } from '../solver';
import type { Puzzle } from '../types';

// B1 (hintMaskToPrimes) and B2 (validate) are in the same layer, so decode the mask and
// check solutions locally instead of importing them.
const AMBIGUOUS_PRIMES = PRIMES.filter((_, i) => (FIXTURE_AMBIGUOUS_HINT_MASK >> i) & 1);

function sameGrid(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

function expectValidSolution(grid: Uint8Array, puzzle: Puzzle): void {
  const cellOf = new Array<number>(101).fill(-1);
  for (let cell = 0; cell < 100; cell++) cellOf[grid[cell]] = cell;
  expect([...grid].sort((a, b) => a - b)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
  for (let n = 1; n < 100; n++) expect(adjacent(cellOf[n], cellOf[n + 1])).toBe(true);
  for (let cell = 0; cell < 100; cell++) expect(isPrime(grid[cell])).toBe(puzzle.grey[cell] === 1);
  for (const [cell, value] of puzzle.givens) expect(grid[cell]).toBe(value);
}

function withGivens(puzzle: Puzzle, extra: Array<[number, number]>): Puzzle {
  return { ...puzzle, givens: new Map([...puzzle.givens, ...extra]) };
}

describe('solve', () => {
  it('finds the unique solution of the easy puzzle within budget', () => {
    const r = solve(fixturePuzzle(PRIMES), { maxSolutions: 2, maxNodes: 200_000, collect: true });
    expect(r.count).toBe(1);
    expect(r.exhausted).toBe(true);
    expect(r.nodes).toBeLessThan(200_000);
    expect(sameGrid(r.solutions![0], fixtureGrid(FIXTURE_PATH))).toBe(true);
  });

  it('proves {1, 17} unique', () => {
    const r = solve(fixturePuzzle([17]), { maxSolutions: 2, maxNodes: 2_000_000 });
    expect(r.count).toBe(1);
    expect(r.exhausted).toBe(true);
    expect(r.solutions).toBeUndefined();
  });

  it('counts exactly the two solutions of the ambiguous puzzle', () => {
    expect(AMBIGUOUS_PRIMES).toEqual(PRIMES.filter((p) => p >= 19));
    const r = solve(fixturePuzzle(AMBIGUOUS_PRIMES), {
      maxSolutions: 1000,
      maxNodes: 2_000_000,
      collect: true,
    });
    expect(r.count).toBe(2);
    expect(r.exhausted).toBe(true);
    expect(r.solutions).toHaveLength(2);
    const ref = fixtureGrid(FIXTURE_PATH);
    const alt = fixtureGrid(FIXTURE_ALT_PATH);
    expect(r.solutions!.some((g) => sameGrid(g, ref))).toBe(true);
    expect(r.solutions!.some((g) => sameGrid(g, alt))).toBe(true);
  });

  it('stops early at maxSolutions', () => {
    const r = solve(fixturePuzzle(AMBIGUOUS_PRIMES), { maxSolutions: 1, maxNodes: 2_000_000 });
    expect(r.count).toBe(1);
    expect(r.exhausted).toBe(false);
  });

  it('stops when the node budget runs out', () => {
    const r = solve(fixturePuzzle([]), { maxSolutions: 2, maxNodes: 1000 });
    expect(r.exhausted).toBe(false);
    expect(r.nodes).toBeLessThanOrEqual(1000 + 4);
  });

  it('finds two valid solutions of the challenge puzzle', () => {
    const puzzle = fixturePuzzle([]);
    const r = solve(puzzle, { maxSolutions: 2, maxNodes: 5_000_000, collect: true });
    expect(r.count).toBe(2);
    expect(r.exhausted).toBe(false);
    expect(r.solutions).toHaveLength(2);
    for (const g of r.solutions!) expectValidSolution(g, puzzle);
    expect(sameGrid(r.solutions![0], r.solutions![1])).toBe(false);
  });

  it('rejects a given too far from the previous one without searching', () => {
    const r = solve(withGivens(fixturePuzzle([]), [[55, 3]]), { maxSolutions: 2, maxNodes: 1000 });
    expect(r).toEqual({ count: 0, exhausted: true, nodes: 0 });
    // a grey cell, so only the distance check can reject it
    const far = solve(withGivens(fixturePuzzle([]), [[99, 3]]), { maxSolutions: 2, maxNodes: 1000 });
    expect(far).toEqual({ count: 0, exhausted: true, nodes: 0 });
  });

  it('rejects contradictory givens without searching', () => {
    const opts = { maxSolutions: 2, maxNodes: 1000 };
    // composite number on a grey cell
    expect(solve(withGivens(fixturePuzzle([]), [[9, 4]]), opts).nodes).toBe(0);
    // the same number on two grey cells
    const dup = solve(withGivens(fixturePuzzle([]), [[9, 2], [19, 2]]), opts);
    expect(dup).toEqual({ count: 0, exhausted: true, nodes: 0 });
  });

  it('accepts a fully given board', () => {
    const givens = new Map<number, number>();
    FIXTURE_PATH.forEach((cell, i) => givens.set(cell, i + 1));
    const puzzle = { ...fixturePuzzle([]), givens };
    const r = solve(puzzle, { maxSolutions: 2, maxNodes: 1000, collect: true });
    expect(r.count).toBe(1);
    expect(r.exhausted).toBe(true);
    expect(r.nodes).toBe(99);
    expect(sameGrid(r.solutions![0], fixtureGrid(FIXTURE_PATH))).toBe(true);
  });
});
