import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref, type EffectScope } from 'vue';
import { FIXTURE_PATH, FIXTURE_RECORD, fixtureGrid } from '../../core/__fixtures__/level-fixture';
import { decodeLevel, derivePuzzle } from '../../core/level-decode';
import type { Difficulty, SavedProgress } from '../../core/types';
import { useConfirm } from '../useConfirm';
import { useLevelStore } from '../useLevelStore';
import { SAVE_DEBOUNCE_MS, usePlaySession, type Session } from '../usePlaySession';
import { useProgress } from '../useProgress';
import { useRecords } from '../useRecords';
import { __resetSettings, useSettings } from '../useSettings';
import { useToast } from '../useToast';

// The PDF pipeline (font fetch, jsPDF) has its own tests; here only the session's use of it matters.
const pdfMock = vi.hoisted(() => ({ exportPdf: vi.fn<(...args: unknown[]) => Promise<boolean>>() }));
vi.mock('../usePdfExport', async () => {
  const { ref } = await import('vue');
  return { usePdfExport: () => ({ busy: ref(false), exportPdf: pdfMock.exportPdf }) };
});

const level = decodeLevel(FIXTURE_RECORD, 1);
const easyGivens = derivePuzzle(level, 'easy').givens;

function fixtureFile() {
  return { schema: 1, libraryVersion: 1, generator: 't', masterSeed: 's', count: 1, levels: [FIXTURE_RECORD] };
}

// Fake timers also fake setImmediate, so settle microtasks (store load, pre-flush watchers) by hand.
async function settle(): Promise<void> {
  for (let i = 0; i < 20; i++) await Promise.resolve();
}

let scope: EffectScope | null = null;

async function makeSession(id = 1, d: Difficulty = 'easy'): Promise<Session> {
  scope = effectScope();
  const session = scope.run(() => usePlaySession(ref(id), ref(d)))!;
  await settle();
  return session;
}

/** R21: whatever `lastPlayed` points at must exist, or the home page offers a dead "continue". */
function expectLastPlayedExists(): void {
  const last = useProgress(1).lastPlayed();
  if (last !== null) expect(useProgress(1).has(last.levelId, last.difficulty)).toBe(true);
}

function messages(): string[] {
  return useToast().toasts.value.map((toast) => toast.message);
}

function key(k: string, init: KeyboardEventInit = {}): KeyboardEvent {
  return new KeyboardEvent('keydown', { key: k, cancelable: true, ...init });
}

async function answerConfirm(ok: boolean): Promise<void> {
  await settle();
  const pending = useConfirm().pending.value;
  expect(pending).not.toBeNull();
  pending!.settle(ok);
  await settle();
}

/** Trail-press numbers from..to of the reference path (givens are skipped, they are already on the board). */
function trailTo(s: Session, to: number, from = 2): void {
  for (let k = from; k <= to; k++) {
    const cell = FIXTURE_PATH[k - 1];
    if (!easyGivens.has(cell)) s.onPress(cell);
  }
}

function snapAt(n: number, overrides: Partial<SavedProgress> = {}): SavedProgress {
  const grid = new Uint8Array(100);
  for (const [cell, v] of easyGivens) grid[cell] = v;
  for (let k = 1; k <= n; k++) grid[FIXTURE_PATH[k - 1]] = k;
  return {
    grid: Array.from(grid),
    steps: 7,
    elapsedMs: 42_000,
    assisted: false,
    inputMode: 'trail',
    savedAt: '2026-10-24T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  __resetSettings();
  useLevelStore().__setLoader(async () => fixtureFile());
  for (const toast of [...useToast().toasts.value]) useToast().dismiss(toast.id);
  useConfirm().pending.value?.settle(false);
  pdfMock.exportPdf.mockReset();
  pdfMock.exportPdf.mockResolvedValue(true);
});

afterEach(() => {
  scope?.stop();
  scope = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('usePlaySession: loading and restore', () => {
  it('starts a new game when there is no save', async () => {
    const s = await makeSession();
    expect(s.status.value).toBe('ready');
    expect(s.restored.value).toBe(false);
    expect(s.game.value!.state.status).toBe('idle');
    expect(s.level.value!.id).toBe(1);
    expect(messages()).not.toContain('已恢復進度');
  });

  it('restores a compatible save and says so', async () => {
    useProgress(1).save(1, 'easy', snapAt(6));
    const s = await makeSession();
    expect(s.restored.value).toBe(true);
    expect(messages()).toContain('已恢復進度');
    expect(s.game.value!.state.steps).toBe(7);
    expect(Array.from(s.game.value!.state.grid)).toEqual(snapAt(6).grid);
  });

  it('ignores (and drops) a save whose givens do not fit the puzzle', async () => {
    const bad = snapAt(6);
    bad.grid[FIXTURE_PATH[1]] = 0; // the given 2 is missing
    useProgress(1).save(1, 'easy', bad);
    const s = await makeSession();
    expect(s.restored.value).toBe(false);
    expect(s.game.value!.state.steps).toBe(0);
    expect(useProgress(1).has(1, 'easy')).toBe(false);
    expect(useProgress(1).lastPlayed()).toBeNull();
    // The fresh board is not saved either.
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 2);
    expect(useProgress(1).has(1, 'easy')).toBe(false);
    expectLastPlayedExists();
  });

  it('new games take the input mode from settings', async () => {
    useSettings().inputMode.value = 'direct';
    const s = await makeSession();
    expect(s.game.value!.state.inputMode).toBe('direct');
  });

  it('missing library → missing', async () => {
    useLevelStore().__setLoader(null);
    const s = await makeSession();
    expect(s.status.value).toBe('missing');
    expect(s.game.value).toBeNull();
  });

  it('id outside the library → missing', async () => {
    const s = await makeSession(2);
    expect(s.status.value).toBe('missing');
  });

  it('a broken library → error', async () => {
    useLevelStore().__setLoader(async () => ({ schema: 99 }));
    const s = await makeSession();
    expect(s.status.value).toBe('error');
  });
});

describe('usePlaySession: trail input and autosave', () => {
  it('pressing an adjacent empty cell extends, and autosaves after 300 ms', async () => {
    const s = await makeSession();
    // Easy shows every prime: 1, 2, 3 are given, so the head is 3 at cell 19 and 4 goes to 29.
    const cell = FIXTURE_PATH[3];
    s.onPress(cell);
    expect(s.game.value!.state.grid[cell]).toBe(4);
    await settle();
    expect(useProgress(1).has(1, 'easy')).toBe(false);
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(useProgress(1).has(1, 'easy')).toBe(true);
    expect(useProgress(1).lastPlayed()).toMatchObject({ levelId: 1, difficulty: 'easy' });
    expectLastPlayedExists();
  });

  it('pressing a non-adjacent cell shakes it and changes nothing', async () => {
    const s = await makeSession();
    s.onPress(55);
    expect(s.shakeTarget.value).toEqual({ cell: 55, seq: expect.any(Number) });
    const first = s.shakeTarget.value!.seq;
    s.onPress(55);
    expect(s.shakeTarget.value!.seq).toBeGreaterThan(first);
    expect(s.game.value!.state.steps).toBe(0);
  });

  it('drag extends but never shakes', async () => {
    const s = await makeSession();
    s.onDrag(55);
    expect(s.shakeTarget.value).toBeNull();
    s.onDrag(FIXTURE_PATH[3]);
    expect(s.game.value!.head.value).toBe(5); // 4 placed; 5 is a given
  });

  it('ArrowDown extends the head; an illegal arrow shakes the target', async () => {
    const s = await makeSession();
    // Head is 3 at cell 19; cell 29 (number 4) is straight down.
    const down = key('ArrowDown');
    s.onKey(down);
    expect(down.defaultPrevented).toBe(true);
    expect(s.game.value!.state.grid[29]).toBe(4);
    // The head jumped to the given 5 at cell 39; up is 29, which is filled.
    s.onKey(key('ArrowUp'));
    expect(s.shakeTarget.value?.cell).toBe(29);
    expect(s.game.value!.state.steps).toBe(1);
  });

  it('Backspace undoes the last cell in trail mode', async () => {
    const s = await makeSession();
    s.onKey(key('ArrowDown'));
    s.onKey(key('Backspace'));
    expect(s.game.value!.state.grid[29]).toBe(0);
  });

  it('Tab toggles the input mode and prevents default; Shift+Tab is left alone', async () => {
    const s = await makeSession();
    const tab = key('Tab');
    s.onKey(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(s.game.value!.state.inputMode).toBe('direct');
    await settle();
    expect(useSettings().inputMode.value).toBe('direct');
    const back = key('Tab', { shiftKey: true });
    s.onKey(back);
    expect(back.defaultPrevented).toBe(false);
    expect(s.game.value!.state.inputMode).toBe('direct');
  });

  it('Ctrl+Z and Cmd+Z undo in both modes', async () => {
    const s = await makeSession();
    s.onKey(key('ArrowDown'));
    s.onKey(key('z', { ctrlKey: true }));
    expect(s.game.value!.state.grid[29]).toBe(0);
    s.onKey(key('ArrowDown'));
    s.onKey(key('Tab'));
    s.onKey(key('z', { metaKey: true }));
    expect(s.game.value!.state.grid[29]).toBe(0);
  });
});

describe('usePlaySession: direct input', () => {
  it('digits and Enter fill the selected cell', async () => {
    const s = await makeSession();
    s.onKey(key('Tab'));
    s.onPress(29);
    s.onKey(key('1'));
    s.onKey(key('Enter'));
    expect(s.game.value!.state.grid[29]).toBe(1);
    s.onKey(key('Backspace')); // pending empty → clears the cell
    expect(s.game.value!.state.grid[29]).toBe(0);
    s.onDigit(1);
    s.onDigit(0);
    s.onDigit(0);
    s.onConfirm();
    expect(s.game.value!.state.grid[29]).toBe(100);
  });

  it('arrows move the selection; a refused confirm on a given shakes it', async () => {
    const s = await makeSession();
    s.onKey(key('Tab'));
    s.onPress(29);
    s.onKey(key('ArrowUp'));
    expect(s.game.value!.state.selected).toBe(19);
    s.onKey(key('5'));
    s.onKey(key('Enter'));
    expect(s.game.value!.state.grid[19]).toBe(3);
    expect(s.shakeTarget.value?.cell).toBe(19);
  });
});

describe('usePlaySession: win, records and errors', () => {
  it('filling the reference path wins, records the clear and drops the save', async () => {
    const s = await makeSession();
    trailTo(s, 50);
    await settle();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(useProgress(1).has(1, 'easy')).toBe(true);
    trailTo(s, 100, 51);
    await settle();
    expect(s.game.value!.state.status).toBe('won');
    expect(s.winResult.value).not.toBeNull();
    expect(s.showWin.value).toBe(true);
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 2);
    expect(useRecords(1).get(1, 'easy')?.clears).toBe(1);
    expect(useProgress(1).has(1, 'easy')).toBe(false);
    expect(useProgress(1).lastPlayed()).toBeNull();
    // The board is locked: presses and keys do nothing.
    const steps = s.game.value!.state.steps;
    s.onKey(key('Backspace'));
    s.onPress(FIXTURE_PATH[99]);
    expect(s.game.value!.state.steps).toBe(steps);
    expect(s.game.value!.state.grid[FIXTURE_PATH[99]]).toBe(100);
  });

  it('viewing the solution first makes the clear assisted', async () => {
    const s = await makeSession();
    const pending = s.requestViewSolution();
    await answerConfirm(true);
    await pending;
    expect(s.game.value!.state.assisted).toBe(true);
    expect(s.showSolution.value).toBe(true);
    // Already assisted: no second confirm.
    s.showSolution.value = false;
    await s.requestViewSolution();
    expect(useConfirm().pending.value).toBeNull();
    expect(s.showSolution.value).toBe(true);
    trailTo(s, 100);
    await settle();
    const entry = useRecords(1).get(1, 'easy');
    expect(entry?.assistedClears).toBe(1);
    expect(entry?.clears).toBe(0);
    expect(entry?.bestMs).toBeNull();
  });

  it('declining the solution confirm changes nothing', async () => {
    const s = await makeSession();
    const pending = s.requestViewSolution();
    await answerConfirm(false);
    await pending;
    expect(s.game.value!.state.assisted).toBe(false);
    expect(s.showSolution.value).toBe(false);
  });

  it('the confirms use the localized button labels', async () => {
    const s = await makeSession();
    void s.requestRestart();
    await settle();
    expect(useConfirm().pending.value).toMatchObject({
      message: '清除目前盤面並重新計時？',
      okLabel: '確認',
      cancelLabel: '取消',
    });
  });

  it('restart after confirm clears the board and the save', async () => {
    const s = await makeSession();
    trailTo(s, 10);
    await settle();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(useProgress(1).has(1, 'easy')).toBe(true);
    const pending = s.requestRestart();
    await answerConfirm(true);
    await pending;
    expect(s.game.value!.state.steps).toBe(0);
    expect(s.game.value!.state.status).toBe('idle');
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 2);
    expect(useProgress(1).has(1, 'easy')).toBe(false);
    expect(useProgress(1).lastPlayed()).toBeNull();
  });

  it('restarting an assisted game does not write the idle board back (R21)', async () => {
    const s = await makeSession();
    trailTo(s, 10);
    s.hint();
    expect(s.game.value!.state.assisted).toBe(true);
    await settle();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(useProgress(1).has(1, 'easy')).toBe(true);
    const pending = s.requestRestart();
    await answerConfirm(true);
    await pending;
    await settle();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 2);
    expect(s.game.value!.state.status).toBe('idle');
    // reset() keeps assisted (spec §7.3), but the reset board is not saved.
    expect(s.game.value!.state.assisted).toBe(true);
    expect(useProgress(1).has(1, 'easy')).toBe(false);
    expect(useProgress(1).lastPlayed()).toBeNull();
    // Hints on the reset board change nothing worth saving either.
    s.hint();
    await settle();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 2);
    expect(useProgress(1).has(1, 'easy')).toBe(false);
    // The next move is a game in play again, and is saved with the assisted flag.
    s.onPress(FIXTURE_PATH[3]);
    await settle();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(useProgress(1).has(1, 'easy')).toBe(true);
    expect(useProgress(1).load(1, 'easy', s.game.value!.puzzle)?.assisted).toBe(true);
    expectLastPlayedExists();
  });

  it('becoming assisted on an idle board is saved, so a reload keeps the flag', async () => {
    const s = await makeSession();
    // A restart of an unassisted game first: the reset alone must not block later saves.
    trailTo(s, 6);
    const pending = s.requestRestart();
    await answerConfirm(true);
    await pending;
    await settle();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 2);
    expect(useProgress(1).has(1, 'easy')).toBe(false);
    const view = s.requestViewSolution();
    await answerConfirm(true);
    await view;
    await settle();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(s.game.value!.state.status).toBe('idle');
    expect(useProgress(1).load(1, 'easy', s.game.value!.puzzle)?.assisted).toBe(true);
    expectLastPlayedExists();
    scope!.stop();
    const again = await makeSession();
    expect(again.restored.value).toBe(true);
    expect(again.game.value!.state.assisted).toBe(true);
  });

  it('a full grid with errors says how many, once, and does not win', async () => {
    const s = await makeSession();
    trailTo(s, 98);
    s.onKey(key('Tab'));
    s.onPress(FIXTURE_PATH[98]);
    for (const d of '100') s.onKey(key(d));
    s.onKey(key('Enter'));
    s.onPress(FIXTURE_PATH[99]);
    for (const d of '99') s.onKey(key(d));
    s.onKey(key('Enter'));
    await settle();
    const g = s.game.value!;
    expect(g.isFull.value).toBe(true);
    expect(g.state.status).not.toBe('won');
    const errors = messages().filter((m) => m.startsWith('還有'));
    expect(errors).toEqual([`還有 ${g.conflicts.value.size} 格有錯`]);
    // n is the number of red cells (spec §8 "紅格已標"). Swapping 99 and 100 marks three:
    // 98 → 99 is no longer adjacent, and 99/100 sit on the wrong colour. The plan's "2" counts
    // only the swapped cells; see docs/backlog/drafts/GAME-16.md for the plan fix requested.
    expect([...g.conflicts.value.keys()].sort((a, b) => a - b)).toEqual(
      [FIXTURE_PATH[97], FIXTURE_PATH[98], FIXTURE_PATH[99]].sort((a, b) => a - b),
    );
    expect(errors[0]).toBe('還有 3 格有錯');
    // Overwriting the same cell keeps the grid full: no second toast.
    s.onPress(FIXTURE_PATH[99]);
    for (const d of '98') s.onKey(key(d));
    s.onKey(key('Enter'));
    await settle();
    expect(messages().filter((m) => m.startsWith('還有'))).toHaveLength(1);
  });
});

describe('usePlaySession: next random', () => {
  it('a one-map library resets the won, assisted game in place and saves nothing', async () => {
    const s = await makeSession();
    s.hint();
    trailTo(s, 100);
    await settle();
    expect(s.game.value!.state.status).toBe('won');
    expect(s.showWin.value).toBe(true);
    expect(s.nextRandom()).toBeNull();
    await settle();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS * 2);
    expect(s.game.value!.state.status).toBe('idle');
    expect(s.game.value!.state.steps).toBe(0);
    expect(s.showWin.value).toBe(false);
    expect(s.winResult.value).toBeNull();
    expect(useProgress(1).has(1, 'easy')).toBe(false);
    expect(useProgress(1).lastPlayed()).toBeNull();
    expect(useRecords(1).get(1, 'easy')?.assistedClears).toBe(1);
  });

  it('with more maps, draws again until the id differs', async () => {
    useLevelStore().__setLoader(async () => ({ ...fixtureFile(), count: 2, levels: [FIXTURE_RECORD, FIXTURE_RECORD] }));
    const s = await makeSession();
    const rand = vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(0.9);
    expect(s.nextRandom()).toBe(2);
    expect(rand).toHaveBeenCalledTimes(3);
    // The current game is left alone; the route change starts the next one.
    expect(s.game.value!.state.levelId).toBe(1);
  });
});

describe('usePlaySession: PDF export and markAssisted', () => {
  it('a successful export closes the dialog and passes the options through', async () => {
    const s = await makeSession();
    s.showPdf.value = true;
    await s.exportPdf({ includeSolution: true });
    expect(pdfMock.exportPdf).toHaveBeenCalledTimes(1);
    expect(pdfMock.exportPdf).toHaveBeenCalledWith(s.level.value, 'easy', true);
    expect(s.showPdf.value).toBe(false);
  });

  it('a failed export keeps the dialog open', async () => {
    pdfMock.exportPdf.mockResolvedValue(false);
    const s = await makeSession();
    s.showPdf.value = true;
    await s.exportPdf({ includeSolution: false });
    expect(pdfMock.exportPdf).toHaveBeenCalledWith(s.level.value, 'easy', false);
    expect(s.showPdf.value).toBe(true);
  });

  it('markAssisted (PDF with the solution mid-game) flags the game and the save', async () => {
    const s = await makeSession();
    trailTo(s, 6);
    await settle();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(useProgress(1).load(1, 'easy', s.game.value!.puzzle)?.assisted).toBe(false);
    s.markAssisted();
    expect(s.game.value!.state.assisted).toBe(true);
    await settle();
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS);
    expect(useProgress(1).load(1, 'easy', s.game.value!.puzzle)?.assisted).toBe(true);
    trailTo(s, 100, 7);
    await settle();
    const entry = useRecords(1).get(1, 'easy');
    expect(entry?.assistedClears).toBe(1);
    expect(entry?.bestMs).toBeNull();
  });
});

describe('usePlaySession: hint', () => {
  it('on a consistent board highlights the next cell without a toast', async () => {
    const s = await makeSession();
    s.hint();
    expect(s.highlight.value).toBe(FIXTURE_PATH[3]);
    expect(s.game.value!.state.assisted).toBe(true);
    expect(messages().some((m) => m.startsWith('從'))).toBe(false);
    s.onPress(FIXTURE_PATH[3]);
    await settle();
    expect(s.highlight.value).toBeNull();
  });

  it('after diverging points at the first wrong number and says so', async () => {
    const s = await makeSession();
    s.onPress(18); // 4 off the path (the reference has 4 at 29)
    expect(s.game.value!.state.grid[18]).toBe(4);
    s.hint();
    expect(s.highlight.value).toBe(18);
    expect(messages().some((m) => m.startsWith('從 4'))).toBe(true);
  });
});

describe('usePlaySession: lifecycle', () => {
  it('stopping the owning scope flushes a pending save', async () => {
    const s = await makeSession();
    s.onPress(FIXTURE_PATH[3]);
    await settle();
    expect(useProgress(1).has(1, 'easy')).toBe(false);
    scope!.stop();
    scope = null;
    expect(useProgress(1).has(1, 'easy')).toBe(true);
  });

  it('pagehide writes a pending save at once', async () => {
    const s = await makeSession();
    s.onPress(FIXTURE_PATH[3]);
    await settle();
    expect(useProgress(1).has(1, 'easy')).toBe(false);
    window.dispatchEvent(new Event('pagehide'));
    expect(useProgress(1).has(1, 'easy')).toBe(true);
    expectLastPlayedExists();
  });

  it('the pagehide listener is removed with the session', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    await makeSession();
    const added = add.mock.calls.find(([type]) => type === 'pagehide');
    expect(added).toBeDefined();
    scope!.stop();
    scope = null;
    expect(remove).toHaveBeenCalledWith('pagehide', added![1]);
  });

  it('switching difficulty loads that game instead', async () => {
    useProgress(1).save(1, 'challenge', {
      ...snapAt(0),
      grid: Array.from(fixtureGrid(FIXTURE_PATH.slice(0, 5))),
      steps: 4,
    });
    scope = effectScope();
    const d = ref<Difficulty>('easy');
    const s = scope.run(() => usePlaySession(ref(1), d))!;
    await settle();
    expect(s.restored.value).toBe(false);
    d.value = 'challenge';
    await settle();
    expect(s.game.value!.state.difficulty).toBe('challenge');
    expect(s.restored.value).toBe(true);
    expect(s.game.value!.state.steps).toBe(4);
  });
});
