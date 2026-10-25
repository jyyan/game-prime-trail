import { adjacent, manhattan, NEIGHBORS } from './geometry';
import { isPrime } from './primes';
import { CELL_COUNT } from './types';
import type { Cell, Puzzle } from './types';
import { headOf } from './validate';

export type DeadEndKind = 'far' | 'trap' | 'twoEnds' | 'split' | 'noMove';

export interface DeadEnd {
  kind: DeadEndKind;
  /** far: [cell of v]; trap/twoEnds: the trapped cells; split: cells the head cannot reach; noMove: [] */
  cells: Cell[];
  /** noMove: head neighbours that cannot take h+1; otherwise [] */
  rejected: Cell[];
  /** far only */
  target?: number;
  dist?: number;
  steps?: number;
}

/**
 * Cells of 1..h for the player's grid: h = largest with 1..h all filled; null if 1..h is not a
 * legal trail (duplicate number, non-adjacent step, prime/grey mismatch, given mismatch).
 */
export function trailOf(grid: Uint8Array, puzzle: Puzzle): Cell[] | null {
  const h = headOf(grid);
  if (h === 0) return null;
  const trail: Cell[] = new Array<Cell>(h).fill(-1);
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    const n = grid[cell];
    if (n < 1 || n > h) continue;
    if (trail[n - 1] !== -1) return null; // duplicate
    trail[n - 1] = cell;
  }
  for (let n = 1; n <= h; n++) {
    const cell = trail[n - 1];
    if (n > 1 && !adjacent(trail[n - 2], cell)) return null;
    if (isPrime(n) !== (puzzle.grey[cell] === 1)) return null;
    const given = puzzle.givens.get(cell);
    if (given !== undefined && given !== n) return null;
  }
  for (const [cell, n] of puzzle.givens) {
    if (n <= h && trail[n - 1] !== cell) return null;
  }
  return trail;
}

/**
 * spec 6.1; checks in order far, trap, twoEnds, split, noMove; null = not doomed or h = 100.
 * Only cells in `trail` count as visited; givens and anything else are unvisited.
 */
export function findDeadEnd(puzzle: Puzzle, trail: readonly Cell[]): DeadEnd | null {
  const h = trail.length;
  if (h === 0 || h >= CELL_COUNT) return null;
  const head = trail[h - 1];
  const visited = new Uint8Array(CELL_COUNT);
  for (const cell of trail) visited[cell] = 1;

  // far: the next given number is out of reach
  let target = 0;
  let targetCell = -1;
  for (const [cell, n] of puzzle.givens) {
    if (n > h && (target === 0 || n < target)) {
      target = n;
      targetCell = cell;
    }
  }
  if (target !== 0) {
    const steps = target - h;
    const dist = manhattan(head, targetCell);
    if (dist > steps) {
      return { kind: 'far', cells: [targetCell], rejected: [], target, dist, steps };
    }
  }

  // walkable neighbours of each unvisited cell: unvisited neighbours plus the head
  const trapped: Cell[] = [];
  const ends: Cell[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (visited[cell]) continue;
    let walkable = adjacent(cell, head) ? 1 : 0;
    for (const nb of NEIGHBORS[cell]) if (!visited[nb]) walkable++;
    if (walkable === 0) trapped.push(cell);
    else if (walkable === 1) ends.push(cell);
  }
  if (trapped.length > 0) return { kind: 'trap', cells: trapped, rejected: [] };
  if (ends.length >= 2) return { kind: 'twoEnds', cells: ends, rejected: [] };

  // split: unvisited cells the head cannot reach
  const seen = new Uint8Array(CELL_COUNT);
  const queue: Cell[] = [head];
  seen[head] = 1;
  for (let i = 0; i < queue.length; i++) {
    for (const nb of NEIGHBORS[queue[i]]) {
      if (visited[nb] || seen[nb]) continue;
      seen[nb] = 1;
      queue.push(nb);
    }
  }
  const cut: Cell[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) if (!visited[cell] && !seen[cell]) cut.push(cell);
  if (cut.length > 0) return { kind: 'split', cells: cut, rejected: [] };

  // noMove: no neighbour of the head can take h+1
  const next = h + 1;
  const nextPrime = isPrime(next);
  const rejected: Cell[] = [];
  let canMove = false;
  for (const x of NEIGHBORS[head]) {
    const given = puzzle.givens.get(x);
    const ok =
      !visited[x] &&
      (puzzle.grey[x] === 1) === nextPrime &&
      (given === undefined || given === next) &&
      (target !== next || x === targetCell);
    if (ok) canMove = true;
    else rejected.push(x);
  }
  if (!canMove) return { kind: 'noMove', cells: [], rejected };
  return null;
}
