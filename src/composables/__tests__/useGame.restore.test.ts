import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_PATH, FIXTURE_RECORD, fixtureGrid } from '../../core/__fixtures__/level-fixture';
import { decodeLevel } from '../../core/level-decode';
import type { SavedProgress } from '../../core/types';
import { useGame } from '../useGame';
import { useTimer, type Timer } from '../useTimer';

const level = decodeLevel(FIXTURE_RECORD, 1);

let timer: Timer;

beforeEach(() => {
  vi.useFakeTimers();
  timer = useTimer({ now: () => Date.now(), doc: null });
});

afterEach(() => {
  timer.dispose();
  vi.useRealTimers();
});

function savedAt30(): SavedProgress {
  return {
    grid: Array.from(fixtureGrid(FIXTURE_PATH.slice(0, 30))),
    steps: 29,
    elapsedMs: 61_000,
    assisted: true,
    inputMode: 'direct',
    savedAt: '2026-10-24T00:00:00.000Z',
  };
}

describe('useGame restore', () => {
  it('restores grid, steps, elapsed, assisted and input mode with the timer paused', () => {
    const game = useGame(level, 'challenge', savedAt30(), { timer });
    expect(game.state.steps).toBe(29);
    expect(game.elapsedMs.value).toBe(61_000);
    expect(game.state.elapsedMs).toBe(61_000);
    expect(timer.running.value).toBe(false);
    expect(game.state.assisted).toBe(true);
    expect(game.state.inputMode).toBe('direct');
    expect(game.state.status).toBe('playing');
    expect(game.head.value).toBe(30);
    vi.advanceTimersByTime(5000);
    expect(game.elapsedMs.value).toBe(61_000);
  });

  it('the next place starts the timer from the saved value (Review Focus 6)', () => {
    const game = useGame(level, 'challenge', savedAt30(), { timer });
    expect(game.place(FIXTURE_PATH[30], 31)).toBe(true);
    expect(timer.running.value).toBe(true);
    expect(game.state.steps).toBe(30);
    vi.advanceTimersByTime(1000);
    timer.pause();
    expect(game.elapsedMs.value).toBe(62_000);
  });

  it('a save holding only givens restores as idle', () => {
    const onlyStart = { ...savedAt30(), grid: Array.from(fixtureGrid(FIXTURE_PATH.slice(0, 1))), steps: 0 };
    const game = useGame(level, 'challenge', onlyStart, { timer });
    expect(game.state.status).toBe('idle');
  });

  it('a save that already holds the full solution restores as playing with the timer paused', () => {
    // Plan C3 defines only 'playing' / 'idle' on restore; won games delete their save (spec 7.6).
    const solved = { ...savedAt30(), grid: Array.from(fixtureGrid(FIXTURE_PATH)), steps: 99 };
    const game = useGame(level, 'challenge', solved, { timer });
    expect(game.isFull.value).toBe(true);
    expect(game.state.status).toBe('playing');
    expect(timer.running.value).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(game.elapsedMs.value).toBe(61_000);
  });

  it('snapshot returns every field', () => {
    const game = useGame(level, 'challenge', savedAt30(), { timer });
    const snap = game.snapshot();
    expect(snap.grid).toHaveLength(100);
    expect(snap.grid).toEqual(savedAt30().grid);
    expect(snap.steps).toBe(29);
    expect(snap.elapsedMs).toBe(61_000);
    expect(snap.assisted).toBe(true);
    expect(snap.inputMode).toBe('direct');
    expect(Number.isNaN(Date.parse(snap.savedAt))).toBe(false);
  });

  it('reset keeps assisted and givens, clears the rest', () => {
    const game = useGame(level, 'easy', savedAt30(), { timer });
    game.place(FIXTURE_PATH[30], 31);
    game.reset();
    expect(game.state.steps).toBe(0);
    expect(game.elapsedMs.value).toBe(0);
    expect(timer.running.value).toBe(false);
    expect(game.state.status).toBe('idle');
    expect(game.state.assisted).toBe(true);
    expect(game.state.undo).toHaveLength(0);
    expect(game.state.grid[8]).toBe(1);
    expect(game.state.grid[9]).toBe(2); // given prime
    expect(game.state.grid[FIXTURE_PATH[3]]).toBe(0); // 4 is not a given
    expect(game.puzzle.givens.size).toBe(26);
  });

  it('a snapshot restores into an equivalent new game', () => {
    const first = useGame(level, 'challenge', savedAt30(), { timer });
    first.place(FIXTURE_PATH[30], 31);
    const snap = first.snapshot();
    const other = useTimer({ now: () => Date.now(), doc: null });
    const second = useGame(level, 'challenge', snap, { timer: other });
    expect(Array.from(second.state.grid)).toEqual(snap.grid);
    expect(second.state.steps).toBe(30);
    other.dispose();
  });
});
