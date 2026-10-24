import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_PATH, FIXTURE_RECORD } from '../../core/__fixtures__/level-fixture';
import { decodeLevel } from '../../core/level-decode';
import { isPrime } from '../../core/primes';
import type { Difficulty } from '../../core/types';
import { useGame } from '../useGame';
import { useTimer, type Timer } from '../useTimer';

const level = decodeLevel(FIXTURE_RECORD, 1);
const cellOf = (n: number): number => FIXTURE_PATH[n - 1];

let timer: Timer;

beforeEach(() => {
  vi.useFakeTimers();
  timer = useTimer({ now: () => Date.now(), doc: null });
});

afterEach(() => {
  timer.dispose();
  vi.useRealTimers();
});

function newGame(difficulty: Difficulty) {
  return useGame(level, difficulty, null, { timer });
}

describe('useGame trail mode (challenge)', () => {
  it('starts with head 1 on the start cell and idle', () => {
    const game = newGame('challenge');
    expect(game.head.value).toBe(1);
    expect(game.headCell.value).toBe(8);
    expect(game.state.status).toBe('idle');
    expect(game.state.inputMode).toBe('trail');
    expect(timer.running.value).toBe(false);
  });

  it('extends, rejects non-adjacent, and retreats', () => {
    const game = newGame('challenge');
    expect(game.trailPress(9)).toBe('placed');
    expect(game.state.grid[9]).toBe(2);
    expect(game.state.steps).toBe(1);
    expect(game.state.status).toBe('playing');
    expect(timer.running.value).toBe(true);

    expect(game.trailPress(50)).toBe('rejected');
    expect(game.state.steps).toBe(1);

    expect(game.trailPress(9)).toBe('rejected'); // filled, and not the head-1 cell
    expect(game.trailPress(8)).toBe('retreated');
    expect(game.state.grid[9]).toBe(0);
    expect(game.state.steps).toBe(1);
    expect(game.head.value).toBe(1);
  });

  it('cannot retreat onto the given start', () => {
    const game = newGame('challenge');
    expect(game.trailPress(8)).toBe('rejected');
    expect(game.state.grid[8]).toBe(1);
  });

  it('walks the reference path to 100 and wins', () => {
    const game = newGame('challenge');
    for (let n = 2; n <= 100; n++) expect(game.trailPress(cellOf(n))).toBe('placed');
    expect(game.state.status).toBe('won');
    expect(game.isFull.value).toBe(true);
    expect(game.conflicts.value.size).toBe(0);
    expect(game.state.steps).toBe(99);
    expect(timer.running.value).toBe(false);
    const frozen = game.elapsedMs.value;
    vi.advanceTimersByTime(2000);
    expect(game.elapsedMs.value).toBe(frozen);
    expect(game.hint()).toBeNull();
  });

  it('undo restores the last cell without touching steps', () => {
    const game = newGame('challenge');
    game.trailPress(cellOf(2));
    game.trailPress(cellOf(3));
    expect(game.undo()).toBe(true);
    expect(game.state.grid[cellOf(3)]).toBe(0);
    expect(game.state.grid[cellOf(2)]).toBe(2);
    expect(game.state.steps).toBe(2);
    expect(game.head.value).toBe(2);
  });

  it('undo on an empty stack returns false', () => {
    expect(newGame('challenge').undo()).toBe(false);
  });

  it('trailStep extends from headCell and rejects out-of-bounds', () => {
    const game = newGame('challenge');
    expect(game.trailStep('U')).toBe('rejected'); // cell 8 is on the top row
    expect(game.trailStep('D')).toBe('placed');
    expect(game.state.grid[18]).toBe(2);
    expect(game.headCell.value).toBe(18);
    expect(game.trailStep('U')).toBe('rejected'); // cell 8 is filled
  });
});

describe('useGame trail mode (easy)', () => {
  it('head skips over givens (Review Focus 1)', () => {
    const game = newGame('easy');
    expect(game.head.value).toBe(3); // 1, 2, 3 are givens
    expect(game.headCell.value).toBe(cellOf(3));
    for (let n = 4; n <= 10; n++) {
      if (isPrime(n)) continue;
      expect(game.trailPress(cellOf(n))).toBe('placed');
    }
    expect(game.head.value).toBe(11);
    expect(game.headCell.value).toBe(cellOf(11));
    expect(game.trailPress(cellOf(12))).toBe('placed');
    expect(game.state.grid[cellOf(12)]).toBe(12);
  });

  it('a misplaced 10 still lets head jump to the given 11, flagged nonAdjacent', () => {
    const game = newGame('easy');
    for (const n of [4, 6, 8, 9]) expect(game.place(cellOf(n), n)).toBe(true);
    const wrong = 50; // empty, not grey, not adjacent to cellOf(11) = 79
    expect(game.place(wrong, 10)).toBe(true);
    expect(game.head.value).toBe(11);
    expect(game.headCell.value).toBe(cellOf(11));
    expect(game.conflicts.value.get(wrong)).toContain('nonAdjacent');
    expect(game.conflicts.value.get(cellOf(11))).toContain('nonAdjacent');
    // a given head cannot retreat
    expect(game.trailPress(wrong)).toBe('rejected');
    // extension continues from the 11 cell
    expect(game.trailPress(cellOf(12))).toBe('placed');
  });

  it('trailStep rejects filled and given targets', () => {
    const game = newGame('easy');
    // head 3 sits on cell 19 (right edge)
    expect(game.trailStep('R')).toBe('rejected'); // out of bounds
    expect(game.trailStep('U')).toBe('rejected'); // cell 9 holds the given 2
    expect(game.trailStep('D')).toBe('placed'); // cell 29 is the path's 4
    expect(game.state.grid[29]).toBe(4);
  });

  it('markAssisted is idempotent', () => {
    const game = newGame('easy');
    expect(game.state.assisted).toBe(false);
    game.markAssisted();
    game.markAssisted();
    expect(game.state.assisted).toBe(true);
  });

  it('hint points at the next reference cell when consistent', () => {
    const game = newGame('easy');
    game.trailPress(cellOf(4));
    const h = game.hint();
    expect(h).toEqual({ cell: level.cellOf[game.head.value], divergedAt: null });
    expect(h?.cell).toBe(cellOf(6)); // 5 is a given, so head is already 5
    expect(game.state.assisted).toBe(true);
  });

  it('hint reports the smallest diverging number', () => {
    const game = newGame('easy');
    game.place(cellOf(4), 4);
    game.place(50, 6); // 6 belongs elsewhere
    game.place(cellOf(8), 9); // 9 on the 8 cell
    expect(game.hint()).toEqual({ cell: 50, divergedAt: 6 });
    expect(game.state.assisted).toBe(true);
  });
});
