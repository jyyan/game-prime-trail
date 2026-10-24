import { describe, expect, it } from 'vitest';
import {
  FIXTURE_ALT_PATH,
  FIXTURE_PATH,
  FIXTURE_START,
  fixtureGrid,
  fixturePuzzle,
} from '../__fixtures__/level-fixture';
import { PRIMES, isPrime } from '../primes';
import type { Conflict, ConflictKind, Puzzle } from '../types';
import {
  cellOfNumber,
  conflictMap,
  findConflicts,
  gridEquals,
  headOf,
  isFull,
  isSolved,
} from '../validate';

const P = fixturePuzzle(PRIMES);
const G = fixtureGrid(FIXTURE_PATH);

function cellsOfKind(conflicts: Conflict[], kind: ConflictKind): number[] {
  return [...new Set(conflicts.filter((c) => c.kind === kind).map((c) => c.cell))].sort(
    (a, b) => a - b,
  );
}

function startOnly(): Uint8Array {
  const grid = new Uint8Array(100);
  grid[FIXTURE_START] = 1;
  return grid;
}

describe('reference solution', () => {
  it('is solved and conflict-free', () => {
    expect(isFull(G)).toBe(true);
    expect(isSolved(G, P)).toBe(true);
    expect(findConflicts(G, P)).toEqual([]);
  });
});

describe('isSolved counterexamples (spec 2.8)', () => {
  it('condition 1: an empty cell', () => {
    const grid = G.slice();
    grid[56] = 0;
    expect(isFull(grid)).toBe(false);
    expect(isSolved(grid, P)).toBe(false);
  });

  it('condition 1: full but not a permutation', () => {
    const grid = G.slice();
    grid[56] = 99;
    expect(isFull(grid)).toBe(true);
    expect(isSolved(grid, P)).toBe(false);
    expect(cellsOfKind(findConflicts(grid, P), 'duplicate')).toEqual([55, 56]);
  });

  it('condition 2: 1 not at start (plan case)', () => {
    const grid = G.slice();
    grid[FIXTURE_START] = 2;
    grid[9] = 1;
    expect(isSolved(grid, P)).toBe(false);
  });

  it('condition 2 in isolation: valid trail that does not begin at start', () => {
    // Reversed reference path: 1 at cell 56, 100 at cell 8; grey matches its primes, no givens.
    const grid = new Uint8Array(100);
    FIXTURE_PATH.forEach((cell, i) => (grid[cell] = 100 - i));
    const grey = new Uint8Array(100);
    for (let cell = 0; cell < 100; cell++) grey[cell] = isPrime(grid[cell]) ? 1 : 0;
    const puzzle: Puzzle = { start: FIXTURE_START, grey, givens: new Map() };
    expect(isSolved(grid, puzzle)).toBe(false);
    expect(isSolved(grid, { ...puzzle, start: 56 })).toBe(true);
  });

  it('condition 3: swapping 12 and 13 breaks adjacency', () => {
    const grid = G.slice();
    expect(grid[78]).toBe(12);
    expect(grid[77]).toBe(13);
    grid[78] = 13;
    grid[77] = 12;
    const conflicts = findConflicts(grid, P);
    expect(cellsOfKind(conflicts, 'nonAdjacent')).toEqual([77, 78, 79, 87]);
    expect(cellsOfKind(conflicts, 'primeMismatch')).toEqual([77, 78]);
    expect(isSolved(grid, P)).toBe(false);
  });

  it('condition 3 in isolation: no givens beyond start', () => {
    const grid = G.slice();
    grid[78] = 13;
    grid[77] = 12;
    const puzzle = fixturePuzzle([]);
    puzzle.grey[77] = 0;
    puzzle.grey[78] = 1;
    expect(isSolved(grid, puzzle)).toBe(false);
  });

  it('condition 4: puzzle grey has one extra cell', () => {
    const puzzle = fixturePuzzle(PRIMES);
    expect(puzzle.grey[56]).toBe(0);
    puzzle.grey[56] = 1;
    expect(isSolved(G, puzzle)).toBe(false);
    expect(findConflicts(G, puzzle)).toEqual([{ cell: 56, kind: 'primeMismatch' }]);
  });

  it('condition 5: given 17 moved', () => {
    const puzzle = fixturePuzzle([17]);
    const grid = G.slice();
    expect(grid[99]).toBe(17);
    grid[99] = grid[98];
    grid[98] = 17;
    expect(isSolved(grid, puzzle)).toBe(false);
  });

  it('condition 5 in isolation: legal alternative solution contradicts a given', () => {
    const alt = fixtureGrid(FIXTURE_ALT_PATH);
    expect(isSolved(alt, fixturePuzzle([]))).toBe(true);
    expect(isSolved(alt, fixturePuzzle([13]))).toBe(false);
  });
});

describe('alternative legal solution', () => {
  it('is accepted on challenge, rejected on easy, and differs from the reference', () => {
    const alt = fixtureGrid(FIXTURE_ALT_PATH);
    expect(isSolved(alt, fixturePuzzle([]))).toBe(true);
    expect(isSolved(alt, P)).toBe(false);
    expect(gridEquals(alt, fixtureGrid(FIXTURE_PATH))).toBe(false);
  });
});

describe('findConflicts kinds', () => {
  it('duplicate marks every cell holding the number', () => {
    const grid = new Uint8Array(100);
    grid[9] = 2;
    grid[18] = 2;
    expect(cellsOfKind(findConflicts(grid, P), 'duplicate')).toEqual([9, 18]);
  });

  it('nonAdjacent marks both cells of a broken link', () => {
    const grid = startOnly();
    grid[10] = 2;
    const conflicts = findConflicts(grid, P);
    expect(cellsOfKind(conflicts, 'nonAdjacent')).toEqual([8, 10]);
  });

  it('nonAdjacent checks every pair when numbers are duplicated', () => {
    const grid = startOnly();
    grid[9] = 2;
    grid[0] = 2;
    expect(cellsOfKind(findConflicts(grid, P), 'nonAdjacent')).toEqual([0, 8]);
  });

  it('parity flags a number on the wrong colour', () => {
    const grid = startOnly();
    grid[18] = 3;
    const conflicts = findConflicts(grid, P);
    expect(conflicts).toContainEqual({ cell: 18, kind: 'parity' });
  });

  it('parity is clear for a number on the right colour, prime mismatch still reported', () => {
    const grid = startOnly();
    grid[18] = 2;
    const conflicts = findConflicts(grid, P);
    expect(cellsOfKind(conflicts, 'parity')).toEqual([]);
    expect(conflicts).toContainEqual({ cell: 18, kind: 'primeMismatch' });
  });

  it('primeMismatch flags a composite on a grey cell', () => {
    const grid = startOnly();
    grid[9] = 4;
    expect(findConflicts(grid, P)).toContainEqual({ cell: 9, kind: 'primeMismatch' });
  });

  it('returns one entry per (cell, kind)', () => {
    const grid = G.slice();
    grid[78] = 13;
    grid[77] = 12;
    const conflicts = findConflicts(grid, P);
    const keys = conflicts.map((c) => `${c.cell}:${c.kind}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('reports nothing for an empty grid', () => {
    expect(findConflicts(new Uint8Array(100), P)).toEqual([]);
  });
});

describe('conflictMap', () => {
  it('groups kinds by cell', () => {
    const map = conflictMap([
      { cell: 77, kind: 'nonAdjacent' },
      { cell: 78, kind: 'primeMismatch' },
      { cell: 77, kind: 'parity' },
    ]);
    expect(map.size).toBe(2);
    expect(map.get(77)).toEqual(['nonAdjacent', 'parity']);
    expect(map.get(78)).toEqual(['primeMismatch']);
    expect(map.get(0)).toBeUndefined();
  });
});

describe('headOf', () => {
  it('is the largest h with 1..h all present', () => {
    expect(headOf(new Uint8Array(100))).toBe(0);
    const grid = startOnly();
    expect(headOf(grid)).toBe(1);
    grid[9] = 2;
    grid[19] = 3;
    grid[58] = 7;
    expect(headOf(grid)).toBe(3);
    grid[29] = 4;
    grid[39] = 5;
    grid[49] = 6;
    expect(headOf(grid)).toBe(7);
    expect(headOf(G)).toBe(100);
  });

  it('is 0 when 1 is missing', () => {
    const grid = new Uint8Array(100);
    grid[9] = 2;
    expect(headOf(grid)).toBe(0);
  });
});

describe('cellOfNumber', () => {
  it('finds the cell or -1', () => {
    expect(cellOfNumber(G, 100)).toBe(56);
    expect(cellOfNumber(G, 1)).toBe(FIXTURE_START);
    expect(cellOfNumber(G, 101)).toBe(-1);
  });

  it('returns the smallest index on duplicates', () => {
    const grid = new Uint8Array(100);
    grid[42] = 5;
    grid[17] = 5;
    expect(cellOfNumber(grid, 5)).toBe(17);
  });
});

describe('gridEquals', () => {
  it('compares element-wise against any array-like', () => {
    expect(gridEquals(G, [...G])).toBe(true);
    expect(gridEquals(G, G.slice(0, 99))).toBe(false);
    const other = G.slice();
    other[0] = 0;
    expect(gridEquals(G, other)).toBe(false);
  });
});
