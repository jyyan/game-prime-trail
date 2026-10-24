import { adjacent, color } from './geometry';
import { isPrime } from './primes';
import { CELL_COUNT } from './types';
import type { Cell, Conflict, ConflictKind, Puzzle } from './types';

const MAX_NUMBER = CELL_COUNT;

const KIND_BITS: ReadonlyArray<readonly [ConflictKind, number]> = [
  ['duplicate', 1],
  ['nonAdjacent', 2],
  ['primeMismatch', 4],
  ['parity', 8],
];

/** cellsByNumber[n] = cells holding n, in ascending cell order. */
function cellsByNumber(grid: Uint8Array): Cell[][] {
  const out: Cell[][] = Array.from({ length: MAX_NUMBER + 2 }, () => []);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const n = grid[cell];
    if (n >= 1 && n <= MAX_NUMBER) out[n].push(cell);
  }
  return out;
}

/** One entry per (cell, kind); order is not guaranteed (spec 2.7). */
export function findConflicts(grid: Uint8Array, puzzle: Puzzle): Conflict[] {
  const flags = new Uint8Array(CELL_COUNT);
  const byNumber = cellsByNumber(grid);
  const startColor = color(puzzle.start);

  for (let n = 1; n <= MAX_NUMBER; n++) {
    const cells = byNumber[n];
    if (cells.length > 1) for (const cell of cells) flags[cell] |= 1;
    for (const a of cells) {
      for (const b of byNumber[n + 1]) {
        if (!adjacent(a, b)) {
          flags[a] |= 2;
          flags[b] |= 2;
        }
      }
    }
  }

  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const n = grid[cell];
    if (n === 0) continue;
    if (isPrime(n) !== (puzzle.grey[cell] === 1)) flags[cell] |= 4;
    if (color(cell) !== (startColor + n - 1) % 2) flags[cell] |= 8;
  }

  const conflicts: Conflict[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (flags[cell] === 0) continue;
    for (const [kind, bit] of KIND_BITS) {
      if (flags[cell] & bit) conflicts.push({ cell, kind });
    }
  }
  return conflicts;
}

export function conflictMap(conflicts: Conflict[]): Map<Cell, ConflictKind[]> {
  const map = new Map<Cell, ConflictKind[]>();
  for (const { cell, kind } of conflicts) {
    const kinds = map.get(cell);
    if (kinds) kinds.push(kind);
    else map.set(cell, [kind]);
  }
  return map;
}

export function isFull(grid: Uint8Array): boolean {
  return grid.every((n) => n !== 0);
}

/** The five conditions of spec 2.8, checked directly rather than via findConflicts. */
export function isSolved(grid: Uint8Array, puzzle: Puzzle): boolean {
  if (grid.length !== CELL_COUNT) return false;
  // 1. a permutation of 1..100
  const cellOf = new Int16Array(MAX_NUMBER + 1).fill(-1);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const n = grid[cell];
    if (n < 1 || n > MAX_NUMBER || cellOf[n] !== -1) return false;
    cellOf[n] = cell;
  }
  // 2. 1 sits on the start
  if (grid[puzzle.start] !== 1) return false;
  // 3. consecutive numbers are adjacent
  for (let k = 1; k < MAX_NUMBER; k++) {
    if (!adjacent(cellOf[k], cellOf[k + 1])) return false;
  }
  // 4. grey cells are exactly the prime positions
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (isPrime(grid[cell]) !== (puzzle.grey[cell] === 1)) return false;
  }
  // 5. every given is respected
  for (const [cell, n] of puzzle.givens) {
    if (grid[cell] !== n) return false;
  }
  return true;
}

/** Largest h such that 1..h all appear on the grid; 0 when 1 is absent. */
export function headOf(grid: Uint8Array): number {
  const present = new Uint8Array(MAX_NUMBER + 2);
  for (const n of grid) if (n <= MAX_NUMBER) present[n] = 1;
  let h = 0;
  while (present[h + 1]) h++;
  return h;
}

/** Cell holding n (smallest index on duplicates), or -1. */
export function cellOfNumber(grid: Uint8Array, n: number): Cell | -1 {
  return grid.indexOf(n);
}

export function gridEquals(a: Uint8Array, b: ArrayLike<number>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
