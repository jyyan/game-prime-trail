import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_RECORD } from '../../core/__fixtures__/level-fixture';
import { decodeLevel } from '../../core/level-decode';
import { useGame, type Game } from '../useGame';
import { useTimer, type Timer } from '../useTimer';

const level = decodeLevel(FIXTURE_RECORD, 1);

let timer: Timer;
let game: Game;

beforeEach(() => {
  vi.useFakeTimers();
  timer = useTimer({ now: () => Date.now(), doc: null });
  game = useGame(level, 'easy', null, { timer });
  game.setInputMode('direct');
});

afterEach(() => {
  timer.dispose();
  vi.useRealTimers();
});

describe('useGame direct mode (easy)', () => {
  it('rejects a leading zero', () => {
    game.select(18);
    expect(game.digit(0)).toBe(false);
    expect(game.state.pending).toBe('');
  });

  it('accepts 100 as three digits and confirms it (Review Focus 2)', () => {
    game.select(18);
    expect(game.digit(1)).toBe(true);
    expect(game.digit(0)).toBe(true);
    expect(game.digit(0)).toBe(true);
    expect(game.state.pending).toBe('100');
    expect(game.digit(5)).toBe(false);
    expect(game.confirmPending()).toBe(true);
    expect(game.state.grid[18]).toBe(100);
    expect(game.state.steps).toBe(1);
    expect(game.state.pending).toBe('');
    expect(game.state.selected).toBe(18);
    expect(timer.running.value).toBe(true);
  });

  it('ignores a third digit that would exceed 100', () => {
    game.select(18);
    game.digit(1);
    game.digit(0);
    expect(game.digit(1)).toBe(false);
    expect(game.state.pending).toBe('10');
  });

  it('confirms a single digit without waiting', () => {
    game.select(18);
    game.digit(1);
    expect(game.confirmPending()).toBe(true);
    expect(game.state.grid[18]).toBe(1);
  });

  it('confirm needs a selection, pending digits and a non-given cell', () => {
    game.digit(4);
    expect(game.confirmPending()).toBe(false); // nothing selected
    game.select(9); // given 2
    game.digit(4);
    expect(game.confirmPending()).toBe(false);
    expect(game.state.grid[9]).toBe(2);
    expect(game.state.steps).toBe(0);
    expect(game.state.pending).toBe('44'); // a rejected confirm keeps pending
    game.reset();
    game.select(18);
    expect(game.confirmPending()).toBe(false); // pending empty
  });

  it('backspace deletes a pending digit, then clears the selected cell', () => {
    game.select(18);
    game.digit(4);
    game.digit(2);
    game.backspace();
    expect(game.state.pending).toBe('4');
    game.confirmPending();
    expect(game.state.grid[18]).toBe(4);
    game.backspace();
    expect(game.state.grid[18]).toBe(0);
    expect(game.state.steps).toBe(1);
  });

  it('backspace on a given does nothing', () => {
    game.select(9);
    game.backspace();
    expect(game.state.grid[9]).toBe(2);
  });

  it('overwriting counts as a step', () => {
    expect(game.place(18, 4)).toBe(true);
    expect(game.place(18, 6)).toBe(true);
    expect(game.state.steps).toBe(2);
    expect(game.state.grid[18]).toBe(6);
  });

  it('place rejects givens and out-of-range numbers', () => {
    expect(game.place(9, 4)).toBe(false);
    expect(game.place(18, 0)).toBe(false);
    expect(game.place(18, 101)).toBe(false);
    expect(game.place(18, 2.5)).toBe(false);
    expect(game.state.steps).toBe(0);
    expect(game.state.status).toBe('idle');
  });

  it('clear rejects givens and does not count a step', () => {
    game.place(18, 4);
    expect(game.clear(9)).toBe(false);
    expect(game.clear(18)).toBe(true);
    expect(game.state.grid[18]).toBe(0);
    expect(game.state.steps).toBe(1);
  });

  it('flags duplicates on both cells', () => {
    game.place(18, 4);
    game.place(38, 4);
    expect(game.conflicts.value.get(18)).toContain('duplicate');
    expect(game.conflicts.value.get(38)).toContain('duplicate');
  });

  it('flags parity', () => {
    game.place(18, 3);
    expect(game.conflicts.value.get(18)).toContain('parity');
  });

  it('toggleInputMode switches modes', () => {
    expect(game.state.inputMode).toBe('direct');
    game.toggleInputMode();
    expect(game.state.inputMode).toBe('trail');
    game.toggleInputMode();
    expect(game.state.inputMode).toBe('direct');
  });

  it('pending survives select() and input mode switches, then fills the new selection', () => {
    game.select(18);
    game.digit(4);
    game.select(38);
    expect(game.state.pending).toBe('4');
    game.setInputMode('trail');
    expect(game.state.pending).toBe('4');
    game.toggleInputMode();
    expect(game.state.inputMode).toBe('direct');
    expect(game.state.pending).toBe('4');
    game.digit(2);
    expect(game.confirmPending()).toBe(true);
    expect(game.state.grid[38]).toBe(42);
    expect(game.state.grid[18]).toBe(0);
    expect(game.state.pending).toBe('');
  });

  it('fills the whole board through select, digit and confirm, and wins', () => {
    for (let cell = 0; cell < 100; cell++) {
      if (game.puzzle.givens.has(cell)) continue;
      game.select(cell);
      for (const ch of String(level.numberAt[cell])) expect(game.digit(Number(ch))).toBe(true);
      expect(game.confirmPending()).toBe(true);
    }
    expect(game.state.status).toBe('won');
    expect(timer.running.value).toBe(false);
    const frozen = game.elapsedMs.value;
    vi.advanceTimersByTime(2000);
    expect(game.elapsedMs.value).toBe(frozen);
  });

  it('a won board rejects confirm and backspace until reset', () => {
    let last = -1;
    for (let cell = 0; cell < 100; cell++) {
      if (game.puzzle.givens.has(cell)) continue;
      game.place(cell, level.numberAt[cell]);
      last = cell;
    }
    expect(game.state.status).toBe('won');
    const won = Array.from(game.state.grid);
    const steps = game.state.steps;
    const frozen = game.elapsedMs.value;

    game.select(last);
    game.digit(7);
    expect(game.confirmPending()).toBe(false);
    game.backspace(); // removes the pending 7
    game.backspace(); // pending empty: would clear the selected cell
    expect(Array.from(game.state.grid)).toEqual(won);
    expect(game.state.steps).toBe(steps);
    expect(game.state.status).toBe('won');
    expect(timer.running.value).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(game.elapsedMs.value).toBe(frozen);

    game.reset();
    game.select(18);
    game.digit(4);
    expect(game.confirmPending()).toBe(true);
    expect(game.state.status).toBe('playing');
  });

  it('select sets selected and null clears it', () => {
    game.select(38);
    expect(game.state.selected).toBe(38);
    game.select(null);
    expect(game.state.selected).toBeNull();
  });
});
