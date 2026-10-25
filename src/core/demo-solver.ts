import { findDeadEnd } from './dead-end';
import { NEIGHBORS, step } from './geometry';
import { derivePuzzle } from './level-decode';
import { isPrime } from './primes';
import { CELL_COUNT } from './types';
import type { Cell, Level, Puzzle } from './types';

// "Human-like" trial-and-error search for the home page demo (demo-playback spec §4). It is not a
// solver: it only uses rules a person can follow, so it walks into dead ends and backs out of them.

export type DemoReasonKind =
  | 'used'
  | 'otherGiven'
  | 'givenElsewhere'
  | 'needPrime'
  | 'notPrime'
  | 'far'
  | 'trap'
  | 'twoEnds'
  | 'split';

export interface DemoReason {
  cell: Cell;
  kind: DemoReasonKind;
  /** otherGiven: the given there; far: v */
  value?: number;
  /** far */
  dist?: number;
  steps?: number;
  /** trap / twoEnds / split */
  cells?: Cell[];
}

export type DemoEvent =
  | { type: 'place'; cell: Cell; n: number }
  | { type: 'unplace'; cell: Cell; n: number }
  /** n = last placed number (the search could not place n + 1) */
  | { type: 'stuck'; n: number; head: Cell; reasons: DemoReason[] };

export interface DemoTrace {
  solved: boolean;
  events: DemoEvent[];
  backtracks: number;
}

export const DEMO_PACING: {
  readonly introMs: 2500;
  readonly placeMs: 1000;
  readonly primeMs: 1800;
  readonly stuckBaseMs: 3000;
  readonly stuckPerReasonMs: 2000;
  readonly unplaceMs: 1000;
  readonly branchPauseMs: 1200;
  readonly branchMsgMs: 1800;
} = {
  introMs: 2500,
  placeMs: 1000,
  primeMs: 1800,
  stuckBaseMs: 3000,
  stuckPerReasonMs: 2000,
  unplaceMs: 1000,
  branchPauseMs: 1200,
  branchMsgMs: 1800,
};

export const DEMO_LIMITS: {
  readonly maxEvents: 4000;
  readonly minBacktracks: 2;
  readonly maxBacktracks: 4;
  readonly maxPickEvents: 260;
  readonly maxPlaybackMs: 360000;
  readonly tries: 80;
  readonly fallbackMaxBacktracks: 8;
} = {
  maxEvents: 4000,
  minBacktracks: 2,
  maxBacktracks: 4,
  maxPickEvents: 260,
  maxPlaybackMs: 360000,
  tries: 80,
  fallbackMaxBacktracks: 8,
};

/** Tie-break order for equally constrained candidates: up, right, down, left. */
const TIE_ORDER = ['U', 'R', 'D', 'L'] as const;
const ORDERED_NEIGHBORS: ReadonlyArray<readonly Cell[]> = Array.from(
  { length: CELL_COUNT },
  (_, cell) => {
    const out: Cell[] = [];
    for (const d of TIE_ORDER) {
      const nb = step(cell, d);
      if (nb !== -1) out.push(nb);
    }
    return out;
  },
);

/**
 * Every event costs at least 1000 ms of playback, so a trace longer than this can never fit in
 * `maxPlaybackMs`; `pickDemo` stops searching a map there instead of running to `maxEvents`.
 */
const PICK_EVENT_CAP = Math.floor(
  (DEMO_LIMITS.maxPlaybackMs - DEMO_PACING.introMs) / Math.min(DEMO_PACING.placeMs, DEMO_PACING.unplaceMs),
);

function runTrace(puzzle: Puzzle, maxEvents: number): DemoTrace {
  const cellOfGiven = new Map<number, Cell>();
  for (const [cell, n] of puzzle.givens) cellOfGiven.set(n, cell);

  const grid = new Uint8Array(CELL_COUNT);
  const trail: Cell[] = [puzzle.start];
  grid[puzzle.start] = 1;
  const events: DemoEvent[] = [];
  let backtracks = 0;
  let aborted = false;

  /** First failing check of spec §4.2 for putting n on x, or null when x is a candidate. */
  function reasonFor(x: Cell, n: number): DemoReason | null {
    if (grid[x]) return { cell: x, kind: 'used' };
    const given = puzzle.givens.get(x);
    if (given !== undefined && given !== n) return { cell: x, kind: 'otherGiven', value: given };
    const home = cellOfGiven.get(n);
    if (home !== undefined && home !== x) return { cell: x, kind: 'givenElsewhere' };
    const prime = isPrime(n);
    if ((puzzle.grey[x] === 1) !== prime) return { cell: x, kind: prime ? 'needPrime' : 'notPrime' };
    trail.push(x);
    const dead = findDeadEnd(puzzle, trail);
    trail.pop();
    if (dead === null || dead.kind === 'noMove') return null;
    if (dead.kind === 'far') {
      return { cell: x, kind: 'far', value: dead.target, dist: dead.dist, steps: dead.steps };
    }
    return { cell: x, kind: dead.kind, cells: dead.cells };
  }

  function freeDegree(x: Cell): number {
    let d = 0;
    for (const nb of NEIGHBORS[x]) if (!grid[nb]) d++;
    return d;
  }

  function push(event: DemoEvent): boolean {
    if (events.length >= maxEvents) {
      aborted = true;
      return false;
    }
    events.push(event);
    return true;
  }

  /** Places n next to head; true once 100 is placed. */
  function dfs(head: Cell, n: number): boolean {
    if (n > CELL_COUNT) return true;
    const candidates = ORDERED_NEIGHBORS[head].filter((x) => reasonFor(x, n) === null);
    if (candidates.length === 0) {
      const reasons = ORDERED_NEIGHBORS[head].map((x) => reasonFor(x, n) as DemoReason);
      if (!push({ type: 'stuck', n: n - 1, head, reasons })) return false;
      backtracks++;
      return false;
    }
    // Warnsdorff: fewest free neighbours first; the sort is stable, so ties keep U, R, D, L
    const degree = new Map(candidates.map((x) => [x, freeDegree(x)]));
    candidates.sort((a, b) => degree.get(a)! - degree.get(b)!);
    for (const x of candidates) {
      if (!push({ type: 'place', cell: x, n })) return false;
      grid[x] = n;
      trail.push(x);
      if (dfs(x, n + 1)) return true;
      if (aborted) return false;
      trail.pop();
      grid[x] = 0;
      if (!push({ type: 'unplace', cell: x, n })) return false;
    }
    return false;
  }

  const solved = dfs(puzzle.start, 2) && !aborted;
  return { solved, events, backtracks };
}

/** Demo search on the easy puzzle of `level` (spec §4.1–4.2); gives up after `maxEvents`. */
export function traceDemo(level: Level): DemoTrace {
  return runTrace(derivePuzzle(level, 'easy'), DEMO_LIMITS.maxEvents);
}

/**
 * spec §5.3 timings: intro + place(prime? primeMs : placeMs) + stuck(base + perReason × non-`used`
 * reasons) + unplace × unplaceMs + per backtrack (branchPauseMs + branchMsgMs). Excludes the final hold.
 */
export function playbackMs(trace: DemoTrace): number {
  const p = DEMO_PACING;
  let ms = p.introMs;
  for (const e of trace.events) {
    if (e.type === 'place') ms += isPrime(e.n) ? p.primeMs : p.placeMs;
    else if (e.type === 'unplace') ms += p.unplaceMs;
    else {
      const shown = e.reasons.filter((r) => r.kind !== 'used').length;
      ms += p.stuckBaseMs + p.stuckPerReasonMs * shown;
    }
  }
  return ms + trace.backtracks * (p.branchPauseMs + p.branchMsgMs);
}

export interface DemoPick {
  levelId: number;
  trace: DemoTrace;
}

/** Up to `n` distinct ids from 1..count, in random order (partial Fisher–Yates). */
function drawIds(count: number, n: number, random: () => number): number[] {
  const ids = Array.from({ length: count }, (_, i) => i + 1);
  const take = Math.min(n, count);
  for (let i = 0; i < take; i++) {
    const j = i + Math.min(Math.floor(random() * (count - i)), count - i - 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, take);
}

/**
 * spec §4.3; ids are 1..count as in useLevelStore.getLevel. Each round draws up to `tries` maps
 * and returns the first that is solved with 2–4 backtracks, ≤ 260 events and ≤ 360 s; failing
 * that, the solved map with 1–8 backtracks and ≤ 360 s whose backtracks are closest to 2. After
 * two empty rounds it throws.
 */
export function pickDemo(
  count: number,
  getLevel: (id: number) => Level,
  random: () => number = Math.random,
): DemoPick {
  const L = DEMO_LIMITS;
  for (let round = 0; round < 2; round++) {
    let fallback: (DemoPick & { gap: number }) | null = null;
    for (const levelId of drawIds(count, L.tries, random)) {
      const trace = runTrace(derivePuzzle(getLevel(levelId), 'easy'), PICK_EVENT_CAP);
      if (!trace.solved) continue;
      const ms = playbackMs(trace);
      if (ms > L.maxPlaybackMs) continue;
      const bt = trace.backtracks;
      if (bt >= L.minBacktracks && bt <= L.maxBacktracks && trace.events.length <= L.maxPickEvents) {
        return { levelId, trace };
      }
      if (bt >= 1 && bt <= L.fallbackMaxBacktracks) {
        const gap = Math.abs(bt - L.minBacktracks);
        if (fallback === null || gap < fallback.gap) fallback = { levelId, trace, gap };
      }
    }
    if (fallback !== null) return { levelId: fallback.levelId, trace: fallback.trace };
  }
  throw new Error('pickDemo: no map fits the demo limits');
}
