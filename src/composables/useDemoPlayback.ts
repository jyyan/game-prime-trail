import { onScopeDispose, getCurrentScope, shallowRef, type Ref } from 'vue';
import type { CellMark } from '../components/board/marks';
import { DEMO_PACING, type DemoPick, type DemoReason, type DemoTrace } from '../core/demo-solver';
import { isPrime } from '../core/primes';
import { CELL_COUNT, type Cell, type Puzzle } from '../core/types';

// Home page demo playback (demo-playback spec §5.2–§5.4). The whole run is laid out up front as a
// list of frames with their hold times, then walked with one setTimeout at a time, so stop() only
// has a single timer to clear and the total always equals playbackMs(trace).

export type DemoDir = 'up' | 'down' | 'left' | 'right';

export type DemoMessage =
  | { kind: 'intro' }
  | { kind: 'progress'; n: number }
  | { kind: 'prime'; n: number }
  | { kind: 'stuck'; n: number; lines: { dir: DemoDir; reason: DemoReason }[] }
  | { kind: 'back'; m: number }
  | { kind: 'branch'; m: number }
  | { kind: 'done'; backtracks: number };

export interface DemoFrame {
  grid: Uint8Array;
  head: Cell | null;
  marks: ReadonlyMap<Cell, CellMark>;
  trail: readonly Cell[] | null;
  message: DemoMessage;
  done: boolean;
}

export interface TimedFrame {
  frame: DemoFrame;
  /** How long the frame stays before the next one; 0 for the final (done) frame. */
  ms: number;
}

/** spec §5.3: the "filling n" line (demo.filling) is refreshed only every few steps, not on every placement. */
export const PROGRESS_EVERY = 12;

const NO_MARKS: ReadonlyMap<Cell, CellMark> = new Map();

function dirOf(head: Cell, cell: Cell): DemoDir {
  if (cell === head - 10) return 'up';
  if (cell === head + 10) return 'down';
  return cell === head - 1 ? 'left' : 'right';
}

/** Lays out the playback of `trace` on `puzzle`; durations follow DEMO_PACING exactly like playbackMs. */
export function buildDemoFrames(trace: DemoTrace, puzzle: Puzzle): TimedFrame[] {
  const p = DEMO_PACING;
  const grid = new Uint8Array(CELL_COUNT);
  grid[puzzle.start] = 1;
  const path: Cell[] = [puzzle.start];
  const out: TimedFrame[] = [];
  let lastProgress = -Infinity;
  let message: DemoMessage = { kind: 'intro' };

  function push(ms: number, marks: ReadonlyMap<Cell, CellMark> = NO_MARKS): void {
    out.push({
      frame: { grid: grid.slice(), head: path[path.length - 1] ?? null, marks, trail: null, message, done: false },
      ms,
    });
  }

  push(p.introMs);
  const events = trace.events;
  let segments = 0;
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'place') {
      grid[e.cell] = e.n;
      path.push(e.cell);
      if (isPrime(e.n)) {
        message = { kind: 'prime', n: e.n };
      } else if (message.kind !== 'progress' || e.n - lastProgress >= PROGRESS_EVERY) {
        message = { kind: 'progress', n: e.n };
        lastProgress = e.n;
      }
      push(isPrime(e.n) ? p.primeMs : p.placeMs);
    } else if (e.type === 'stuck') {
      const shown = e.reasons.filter((r) => r.kind !== 'used');
      const marks = new Map<Cell, CellMark>();
      for (const r of shown) for (const c of r.cells ?? []) marks.set(c, 'trap');
      // The rejected neighbour itself keeps its ✕ even if another reason also frames it.
      for (const r of shown) marks.set(r.cell, 'reject');
      message = { kind: 'stuck', n: e.n, lines: shown.map((reason) => ({ dir: dirOf(e.head, reason.cell), reason })) };
      push(p.stuckBaseMs + p.stuckPerReasonMs * shown.length, marks);
    } else {
      // The segment of consecutive unplace events ends at the branch point m.
      let j = i;
      while (j + 1 < events.length && events[j + 1].type === 'unplace') j++;
      const m = events[j].n - 1;
      const branchCell = path[m - 1];
      grid[e.cell] = 0;
      path.pop();
      message = { kind: 'back', m };
      push(p.unplaceMs, new Map<Cell, CellMark>([[e.cell, 'reject'], [branchCell, 'branch']]));
      if (i === j) {
        segments++;
        const branchOnly = new Map<Cell, CellMark>([[branchCell, 'branch']]);
        push(p.branchPauseMs, branchOnly);
        message = { kind: 'branch', m };
        push(p.branchMsgMs, branchOnly);
      }
    }
  }
  // A stuck event without a following retreat (only in a trace that gave up) still counts in
  // playbackMs; hold the last frame for it so the totals agree.
  const missing = trace.backtracks - segments;
  if (missing > 0) out[out.length - 1].ms += missing * (p.branchPauseMs + p.branchMsgMs);

  const solved = trace.solved && path.length === CELL_COUNT;
  out.push({
    frame: {
      grid: grid.slice(),
      head: path[path.length - 1] ?? null,
      marks: NO_MARKS,
      trail: solved ? path.slice() : null,
      message: { kind: 'done', backtracks: trace.backtracks },
      done: true,
    },
    ms: 0,
  });
  return out;
}

/** Sum of the hold times; equals playbackMs(trace) by construction (checked in tests). */
export function framesMs(frames: readonly TimedFrame[]): number {
  return frames.reduce((sum, f) => sum + f.ms, 0);
}

export function useDemoPlayback(): {
  frame: Readonly<Ref<DemoFrame | null>>;
  start(pick: DemoPick, puzzle: Puzzle): void;
  stop(): void;
} {
  const frame = shallowRef<DemoFrame | null>(null);
  let timer: ReturnType<typeof setTimeout> | null = null;

  function stop(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  function start(pick: DemoPick, puzzle: Puzzle): void {
    stop();
    const frames = buildDemoFrames(pick.trace, puzzle);
    let index = 0;
    const show = (): void => {
      timer = null;
      const current = frames[index];
      frame.value = current.frame;
      if (index === frames.length - 1) return;
      index++;
      timer = setTimeout(show, current.ms);
    };
    show();
  }

  if (getCurrentScope()) onScopeDispose(stop);

  return { frame, start, stop };
}
