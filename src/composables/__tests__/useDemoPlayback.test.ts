import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_RECORD } from '../../core/__fixtures__/level-fixture';
import { DEMO_PACING as P, playbackMs, traceDemo, type DemoEvent, type DemoTrace } from '../../core/demo-solver';
import { decodeLevel, derivePuzzle } from '../../core/level-decode';
import { CELL_COUNT, type Cell, type Puzzle } from '../../core/types';
import { buildDemoFrames, framesMs, PROGRESS_EVERY, useDemoPlayback } from '../useDemoPlayback';

// Snake path 0,1,…,9,19,18,…,10,20,…: cell of number k is SNAKE[k-1].
const SNAKE: Cell[] = [];
for (let r = 0; r < 10; r++) for (let c = 0; c < 10; c++) SNAKE.push(r * 10 + (r % 2 === 0 ? c : 9 - c));

const PUZZLE: Puzzle = { start: 0, grey: new Uint8Array(CELL_COUNT), givens: new Map() };

/** 2, 3, 4 along the snake, stuck after 4, back two cells to the branch point 2, then the full snake. */
function handTrace(): DemoTrace {
  const events: DemoEvent[] = [
    { type: 'place', cell: 1, n: 2 },
    { type: 'place', cell: 2, n: 3 },
    { type: 'place', cell: 3, n: 4 },
    {
      type: 'stuck',
      n: 4,
      head: 3,
      reasons: [
        { cell: 2, kind: 'used' },
        { cell: 4, kind: 'trap', cells: [5, 15] },
        { cell: 13, kind: 'notPrime' },
      ],
    },
    { type: 'unplace', cell: 3, n: 4 },
    { type: 'unplace', cell: 2, n: 3 },
  ];
  for (let n = 3; n <= 100; n++) events.push({ type: 'place', cell: SNAKE[n - 1], n });
  return { solved: true, events, backtracks: 1 };
}

const PICK = { levelId: 7, trace: handTrace() };
const isPrimeN = (n: number): boolean => [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97].includes(n);

describe('buildDemoFrames', () => {
  it('lasts exactly playbackMs for the hand trace and a real trace', () => {
    expect(framesMs(buildDemoFrames(PICK.trace, PUZZLE))).toBe(playbackMs(PICK.trace));
    const level = decodeLevel(FIXTURE_RECORD, 1);
    const trace = traceDemo(level);
    expect(framesMs(buildDemoFrames(trace, derivePuzzle(level, 'easy')))).toBe(playbackMs(trace));
  });
});

describe('useDemoPlayback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const STUCK_AT = P.introMs + P.primeMs + P.primeMs + P.placeMs;

  it('opens with the intro on the start cell', () => {
    const { frame, start } = useDemoPlayback();
    start(PICK, PUZZLE);
    expect(frame.value?.message).toEqual({ kind: 'intro' });
    expect(frame.value?.grid[0]).toBe(1);
    expect(frame.value?.head).toBe(0);
    expect(frame.value?.trail).toBeNull();
    expect(frame.value?.done).toBe(false);
  });

  it('a place updates grid and head', () => {
    const { frame, start } = useDemoPlayback();
    start(PICK, PUZZLE);
    vi.advanceTimersByTime(P.introMs);
    expect(frame.value?.grid[1]).toBe(2);
    expect(frame.value?.head).toBe(1);
    expect(frame.value?.message).toEqual({ kind: 'prime', n: 2 });
    vi.advanceTimersByTime(P.primeMs + P.primeMs);
    expect(frame.value?.grid[3]).toBe(4);
    expect(frame.value?.head).toBe(3);
    expect(frame.value?.message).toEqual({ kind: 'progress', n: 4 });
  });

  it('stuck marks the rejected neighbours and their trapped cells, without the used one', () => {
    const { frame, start } = useDemoPlayback();
    start(PICK, PUZZLE);
    vi.advanceTimersByTime(STUCK_AT);
    const f = frame.value!;
    expect(f.message.kind).toBe('stuck');
    expect([...f.marks].sort((a, b) => a[0] - b[0])).toEqual([
      [4, 'reject'],
      [5, 'trap'],
      [13, 'reject'],
      [15, 'trap'],
    ]);
    if (f.message.kind !== 'stuck') throw new Error('unreachable');
    expect(f.message.n).toBe(4);
    expect(f.message.lines.map((l) => [l.dir, l.reason.kind])).toEqual([
      ['right', 'trap'],
      ['down', 'notPrime'],
    ]);
    // 3 s + 2 s for each of the two shown reasons
    vi.advanceTimersByTime(P.stuckBaseMs + 2 * P.stuckPerReasonMs - 1);
    expect(frame.value).toBe(f);
  });

  it('a retreat marks the taken-back cell and the branch point, then reroutes', () => {
    const { frame, start } = useDemoPlayback();
    start(PICK, PUZZLE);
    vi.advanceTimersByTime(STUCK_AT + P.stuckBaseMs + 2 * P.stuckPerReasonMs);
    expect(frame.value?.grid[3]).toBe(0);
    expect(frame.value?.head).toBe(2);
    expect(frame.value?.message).toEqual({ kind: 'back', m: 2 });
    expect([...frame.value!.marks]).toEqual([
      [3, 'reject'],
      [1, 'branch'],
    ]);
    vi.advanceTimersByTime(P.unplaceMs);
    expect(frame.value?.grid[2]).toBe(0);
    expect(frame.value?.head).toBe(1);
    expect(frame.value?.marks.get(2)).toBe('reject');
    expect(frame.value?.marks.get(1)).toBe('branch');
    vi.advanceTimersByTime(P.unplaceMs);
    expect(frame.value?.message).toEqual({ kind: 'back', m: 2 });
    expect([...frame.value!.marks]).toEqual([[1, 'branch']]);
    vi.advanceTimersByTime(P.branchPauseMs);
    expect(frame.value?.message).toEqual({ kind: 'branch', m: 2 });
    expect([...frame.value!.marks]).toEqual([[1, 'branch']]);
    vi.advanceTimersByTime(P.branchMsgMs);
    expect(frame.value?.grid[2]).toBe(3);
    expect(frame.value?.marks.size).toBe(0);
  });

  it('refreshes "filling" only every few numbers', () => {
    const frames = buildDemoFrames(PICK.trace, PUZZLE);
    // Message shown on the frame where the last cell placed holds n (the final pass of the snake).
    const at = new Map<number, string>();
    for (const { frame } of frames) {
      const n = frame.head === null ? 0 : frame.grid[frame.head];
      if (frame.message.kind === 'progress') at.set(n, `progress ${frame.message.n}`);
      else if (frame.message.kind === 'prime') at.set(n, `prime ${frame.message.n}`);
    }
    // 89 is prime; 90 refreshes "filling", which then stays on 90 through 96; 97 is prime again.
    expect(at.get(89)).toBe('prime 89');
    for (let n = 90; n <= 96; n++) expect(at.get(n)).toBe('progress 90');
    expect(at.get(97)).toBe('prime 97');
    // Every distinct refresh either follows another message kind or comes PROGRESS_EVERY later.
    let prev: { kind: string; n?: number } | null = null;
    for (const { frame } of frames) {
      const m = frame.message;
      if (m.kind === 'progress' && prev?.kind === 'progress' && prev.n !== m.n) {
        expect(m.n - prev.n!).toBeGreaterThanOrEqual(PROGRESS_EVERY);
      }
      prev = m.kind === 'progress' ? { kind: m.kind, n: m.n } : { kind: m.kind };
    }
    const plain = PICK.trace.events.filter((e) => e.type === 'place' && !isPrimeN(e.n)).length;
    const refreshes = new Set(frames.map((f) => f.frame.message).filter((m) => m.kind === 'progress'));
    expect(refreshes.size).toBeLessThan(plain);
  });

  it('is done with the trail exactly at playbackMs', () => {
    const { frame, start } = useDemoPlayback();
    start(PICK, PUZZLE);
    const total = playbackMs(PICK.trace);
    vi.advanceTimersByTime(total - 1);
    expect(frame.value?.done).toBe(false);
    vi.advanceTimersByTime(1);
    expect(frame.value?.done).toBe(true);
    expect(frame.value?.trail).toEqual(SNAKE);
    expect(frame.value?.message).toEqual({ kind: 'done', backtracks: 1 });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stop() freezes the frame and clears every timer', () => {
    const { frame, start, stop } = useDemoPlayback();
    start(PICK, PUZZLE);
    vi.advanceTimersByTime(P.introMs);
    const before = frame.value;
    stop();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(frame.value).toBe(before);
  });

  it('start() twice keeps a single timer and restarts from the intro', () => {
    const { frame, start } = useDemoPlayback();
    start(PICK, PUZZLE);
    vi.advanceTimersByTime(P.introMs);
    start(PICK, PUZZLE);
    expect(vi.getTimerCount()).toBe(1);
    expect(frame.value?.message).toEqual({ kind: 'intro' });
    vi.advanceTimersByTime(P.introMs);
    expect(frame.value?.grid[1]).toBe(2);
    expect(frame.value?.grid[2]).toBe(0);
  });
});
