import { CELL_COUNT } from './types';
import type { Cell, Puzzle, SolveOptions, SolveResult } from './types';
import { NEIGHBORS, manhattan } from './geometry';
import { PRIMES, isPrime } from './primes';

const LAST = CELL_COUNT; // the largest number on the board
const MAX_DIST = 18; // largest manhattan distance on a 10x10 board

/**
 * Counts solutions of a puzzle by DFS that extends the head with 1, 2, ..., 100 (spec §5).
 * Stops at `maxSolutions` solutions or after `maxNodes` placements; `exhausted` is true
 * only when the whole search space was walked.
 */
export function solve(puzzle: Puzzle, options: SolveOptions): SolveResult {
  const { maxSolutions, maxNodes, collect = false } = options;
  const solutions: Uint8Array[] = [];
  const result = (count: number, exhausted: boolean, nodes: number): SolveResult =>
    collect ? { count, exhausted, nodes, solutions } : { count, exhausted, nodes };

  const { start, grey } = puzzle;
  if (!isCell(start)) return result(0, true, 0);

  // Givens, including the start as the cell of 1. Contradictory givens mean no solution.
  const givenCellOf = new Int16Array(LAST + 1).fill(-1);
  const givenAt = new Uint8Array(CELL_COUNT);
  const entries: Array<[Cell, number]> = [[start, 1], ...puzzle.givens];
  for (const [cell, value] of entries) {
    if (!isCell(cell) || !Number.isInteger(value) || value < 1 || value > LAST) {
      return result(0, true, 0);
    }
    if (givenAt[cell] !== 0 && givenAt[cell] !== value) return result(0, true, 0);
    if (givenCellOf[value] !== -1 && givenCellOf[value] !== cell) return result(0, true, 0);
    if ((grey[cell] === 1) !== isPrime(value)) return result(0, true, 0);
    givenAt[cell] = value;
    givenCellOf[value] = cell;
  }

  const greyCells: Cell[] = [];
  for (let cell = 0; cell < CELL_COUNT; cell++) if (grey[cell] === 1) greyCells.push(cell);
  if (greyCells.length !== PRIMES.length) return result(0, true, 0);

  // Static check between consecutive givens: distance must fit the number gap (and its parity).
  // With this in place, the search only needs to check reachability of the next given.
  const nextGiven = new Int16Array(LAST + 1);
  let prevValue = 1;
  for (let value = 2; value <= LAST; value++) {
    if (givenCellOf[value] === -1) continue;
    const d = manhattan(givenCellOf[prevValue], givenCellOf[value]);
    const gap = value - prevValue;
    if (d > gap || (gap - d) % 2 !== 0) return result(0, true, 0);
    for (let n = prevValue; n < value; n++) nextGiven[n] = value;
    prevValue = value;
  }

  const primeFlag = new Uint8Array(LAST + 1);
  for (const p of PRIMES) primeFlag[p] = 1;
  // firstPrimeAfter[n] = index into PRIMES of the smallest prime > n (PRIMES.length if none)
  const firstPrimeAfter = new Uint8Array(LAST + 1);
  for (let n = 0, i = 0; n <= LAST; n++) {
    while (i < PRIMES.length && PRIMES[i] <= n) i++;
    firstPrimeAfter[n] = i;
  }

  const grid = new Uint8Array(CELL_COUNT);
  const visited = new Uint8Array(CELL_COUNT);
  const deg = new Int8Array(CELL_COUNT); // unvisited neighbours of each cell
  for (let cell = 0; cell < CELL_COUNT; cell++) deg[cell] = NEIGHBORS[cell].length;
  const nearHead = new Uint32Array(CELL_COUNT);
  let stamp = 0;
  const queue = new Uint8Array(CELL_COUNT);
  const seen = new Uint32Array(CELL_COUNT);
  const distCount = new Int32Array(MAX_DIST + 1);
  const candidates = new Int16Array((LAST + 1) * 4);
  const endCell = givenCellOf[LAST];

  const visit = (x: Cell): void => {
    visited[x] = 1;
    for (const y of NEIGHBORS[x]) deg[y]--;
  };
  const unvisit = (x: Cell): void => {
    visited[x] = 0;
    for (const y of NEIGHBORS[x]) deg[y]++;
  };

  /** Pruning rules of §5.4 after placing n at head x; false = backtrack. */
  const feasible = (x: Cell, n: number): boolean => {
    // 1. the next given is still reachable in time
    const ng = nextGiven[n];
    if (ng !== 0 && manhattan(x, givenCellOf[ng]) > ng - n) return false;

    // 2. unvisited grey cells can still be matched to the unused primes in time: the i-th
    //    nearest grey cell must be within reach of the i-th next prime (implies both §5.4.2 rules)
    const pi = firstPrimeAfter[n];
    if (pi < PRIMES.length) {
      distCount.fill(0);
      for (const y of greyCells) if (visited[y] === 0) distCount[manhattan(x, y)]++;
      for (let d = 1; d <= MAX_DIST; d++) distCount[d] += distCount[d - 1];
      for (let i = pi; i < PRIMES.length; i++) {
        const reach = Math.min(PRIMES[i] - n, MAX_DIST);
        if (distCount[reach] < i - pi + 1) return false;
      }
    }

    // 3. degree rule: no dead cell, at most one cell that can only be the path's end
    stamp++;
    for (const y of NEIGHBORS[x]) nearHead[y] = stamp;
    let ones = 0;
    for (let y = 0; y < CELL_COUNT; y++) {
      if (visited[y] === 1) continue;
      const avail = deg[y] + (nearHead[y] === stamp ? 1 : 0);
      if (avail === 0) return false;
      if (avail === 1) {
        if (++ones >= 2) return false;
        if (endCell !== -1 && y !== endCell) return false;
      }
    }

    // 4. unvisited cells plus the head form one connected region
    let head = 0;
    let tail = 0;
    let reached = 0;
    queue[tail++] = x;
    seen[x] = stamp;
    while (head < tail) {
      const c = queue[head++];
      for (const y of NEIGHBORS[c]) {
        if (visited[y] === 1 || seen[y] === stamp) continue;
        seen[y] = stamp;
        queue[tail++] = y;
        reached++;
      }
    }
    return reached === LAST - n;
  };

  let count = 0;
  let nodes = 0;
  let stopped = false; // reached maxSolutions
  let aborted = false; // ran out of nodes

  const dfs = (headCell: Cell, n: number): void => {
    if (n === LAST) {
      count++;
      if (collect) solutions.push(grid.slice());
      if (count >= maxSolutions) stopped = true;
      return;
    }
    const m = n + 1;
    const base = m * 4;
    let size = 0;
    const forced = givenCellOf[m];
    for (const y of NEIGHBORS[headCell]) {
      if (visited[y] === 1) continue;
      if (forced !== -1 ? y !== forced : givenAt[y] !== 0 || grey[y] !== primeFlag[m]) continue;
      // Warnsdorff: fewer unvisited neighbours first (insertion sort, at most 4 items)
      let i = size++;
      while (i > 0 && deg[candidates[base + i - 1]] > deg[y]) {
        candidates[base + i] = candidates[base + i - 1];
        i--;
      }
      candidates[base + i] = y;
    }
    for (let i = 0; i < size; i++) {
      if (nodes >= maxNodes) {
        aborted = true;
        return;
      }
      nodes++;
      const x = candidates[base + i];
      grid[x] = m;
      visit(x);
      if (m === LAST || feasible(x, m)) dfs(x, m);
      unvisit(x);
      grid[x] = 0;
      if (stopped || aborted) return;
    }
  };

  if (maxSolutions <= 0) return result(0, false, 0);
  grid[start] = 1;
  visit(start);
  if (feasible(start, 1)) dfs(start, 1);
  return result(count, !stopped && !aborted, nodes);
}

function isCell(cell: number): boolean {
  return Number.isInteger(cell) && cell >= 0 && cell < CELL_COUNT;
}
