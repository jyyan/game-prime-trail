import {
  effectScope,
  getCurrentScope,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
  type EffectScope,
  type Ref,
  type ShallowRef,
} from 'vue';
import { step } from '../core/geometry';
import { derivePuzzle } from '../core/level-decode';
import type { Cell, Difficulty, Direction, Level, RecordEntry } from '../core/types';
import { t } from '../i18n';
import { useConfirm } from './useConfirm';
import { useGame, type Game } from './useGame';
import { useLevelStore } from './useLevelStore';
import { usePdfExport } from './usePdfExport';
import { useProgress } from './useProgress';
import { useRecords } from './useRecords';
import { useSettings } from './useSettings';
import { useToast } from './useToast';

export const SAVE_DEBOUNCE_MS = 300;

export type SessionStatus = 'loading' | 'missing' | 'error' | 'ready';

export interface WinResult {
  entry: RecordEntry;
  isNewBest: { time: boolean; steps: boolean };
}

export interface Session {
  status: Ref<SessionStatus>;
  game: ShallowRef<Game | null>;
  level: ShallowRef<Level | null>;
  restored: Ref<boolean>;
  /** Cell the last hint points at; cleared whenever the grid changes. */
  highlight: Ref<Cell | null>;
  /** Bumped on every structurally rejected input; the view forwards it to `GameBoard.shake`. */
  shakeTarget: Ref<{ cell: Cell; seq: number } | null>;
  winResult: Ref<WinResult | null>;
  showWin: Ref<boolean>;
  showSolution: Ref<boolean>;
  showPdf: Ref<boolean>;
  pdfBusy: Ref<boolean>;
  /**
   * Cells the player filled themselves on this map (controls-help spec §4.2): trail press, drag or
   * arrow that placed, and direct-mode confirm. Hints, undo, retreats, restarts and restored saves
   * leave it alone; a new map starts it at 0.
   */
  playerFills: Ref<number>;
  onPress(cell: Cell): void;
  onDrag(cell: Cell): void;
  onKey(e: KeyboardEvent): void;
  /** NumberPad: a digit key. */
  onDigit(d: number): void;
  /** NumberPad: confirm (same as Enter in direct mode). */
  onConfirm(): void;
  /** NumberPad "clear" and the action bar's clear: same as Backspace in the current mode. */
  onClear(): void;
  undo(): void;
  hint(): void;
  requestRestart(): Promise<void>;
  requestViewSolution(): Promise<void>;
  markAssisted(): void;
  exportPdf(options: { includeSolution: boolean }): Promise<void>;
  /** WinModal "next random": the id to navigate to, or null when the same map was reset in place. */
  nextRandom(): number | null;
}

const ARROWS: Readonly<Record<string, Direction>> = {
  ArrowUp: 'U',
  ArrowDown: 'D',
  ArrowLeft: 'L',
  ArrowRight: 'R',
};

const confirmLabels = () => ({ okLabel: t('common.confirm'), cancelLabel: t('common.cancel') });

/**
 * PlayView's logic (plan D1): loads the level, restores or starts a game, autosaves
 * (debounced, spec §7.6), records the win (spec §7.4), and maps pointer and keyboard input
 * to `useGame` per mode (spec §7.3). The view only renders what this returns.
 */
export function usePlaySession(
  levelId: Readonly<Ref<number>>,
  difficulty: Readonly<Ref<Difficulty>>,
): Session {
  const store = useLevelStore();
  const settings = useSettings();
  const toast = useToast();
  const { confirm } = useConfirm();
  const pdf = usePdfExport();

  const status = ref<SessionStatus>('loading');
  const game = shallowRef<Game | null>(null);
  const level = shallowRef<Level | null>(null);
  const restored = ref(false);
  const highlight = ref<Cell | null>(null);
  const shakeTarget = ref<{ cell: Cell; seq: number } | null>(null);
  const winResult = ref<WinResult | null>(null);
  const showWin = ref(false);
  const showSolution = ref(false);
  const showPdf = ref(false);
  const playerFills = ref(0);

  let gameScope: EffectScope | null = null;
  let progress: ReturnType<typeof useProgress> | null = null;
  let records: ReturnType<typeof useRecords> | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let loadToken = 0;
  let shakeSeq = 0;

  function shake(cell: Cell | null): void {
    if (cell === null || cell < 0) return;
    shakeTarget.value = { cell, seq: ++shakeSeq };
  }

  function cancelSave(): void {
    if (saveTimer !== null) clearTimeout(saveTimer);
    saveTimer = null;
  }

  // True after a reset (restart, or "next random" on a one-map library) of a game that was
  // already assisted. `reset()` keeps `assisted` (spec §7.3), so without this the idle board
  // would look worth saving and re-create the entry the reset just removed (R21).
  let resetWhileAssisted = false;

  // Only a game in play, or an idle board that just became assisted (solution viewed, hint,
  // PDF with solution before the first move), is worth a save. A fresh or reset board is
  // not: saving it would point `lastPlayed` at an empty game. `assisted` only ever turns on,
  // so an idle board reset while assisted stays unsaved until the next move.
  function shouldSave(g: Game): boolean {
    if (g.state.status === 'playing') return true;
    return g.state.status === 'idle' && g.state.assisted && !resetWhileAssisted;
  }

  function saveNow(): void {
    cancelSave();
    const g = game.value;
    if (!g || !progress || !shouldSave(g)) return;
    progress.save(g.state.levelId, g.state.difficulty, g.snapshot());
  }

  function scheduleSave(): void {
    cancelSave();
    const g = game.value;
    if (!g || !shouldSave(g)) return;
    saveTimer = setTimeout(saveNow, SAVE_DEBOUNCE_MS);
  }

  function flushSave(): void {
    if (saveTimer !== null) saveNow();
  }

  function teardownGame(): void {
    flushSave();
    cancelSave();
    gameScope?.stop();
    gameScope = null;
    game.value = null;
    level.value = null;
    progress = null;
    records = null;
    restored.value = false;
    resetWhileAssisted = false;
    highlight.value = null;
    shakeTarget.value = null;
    winResult.value = null;
    showWin.value = false;
    showSolution.value = false;
    showPdf.value = false;
    playerFills.value = 0;
  }

  function onWin(g: Game): void {
    cancelSave();
    const { levelId: id, difficulty: d } = g.state;
    progress?.remove(id, d);
    if (records) {
      winResult.value = records.recordClear(id, d, {
        elapsedMs: g.elapsedMs.value,
        steps: g.state.steps,
        assisted: g.state.assisted,
      });
    }
    highlight.value = null;
    showSolution.value = false;
    showPdf.value = false;
    showWin.value = true;
  }

  function wireGame(g: Game): void {
    // Snapshot-relevant state; elapsedMs alone is not watched (it changes every tick).
    watch(
      () => [g.state.grid, g.state.steps, g.state.assisted, g.state.inputMode],
      () => scheduleSave(),
    );
    watch(
      () => g.state.grid,
      () => {
        highlight.value = null;
      },
    );
    watch(
      () => g.state.inputMode,
      (mode) => {
        settings.inputMode.value = mode;
      },
    );
    watch(
      () => g.state.status,
      (s) => {
        if (s === 'won') onWin(g);
      },
    );
    // Spec §8: a full grid with conflicts says so once per fill.
    watch(
      () => g.isFull.value && g.state.status !== 'won',
      (fullWithErrors) => {
        if (fullWithErrors && g.conflicts.value.size > 0) {
          toast.show(t('play.remainingErrors', { n: g.conflicts.value.size }), { variant: 'danger' });
        }
      },
    );
  }

  async function start(id: number, d: Difficulty): Promise<void> {
    const token = ++loadToken;
    teardownGame();
    status.value = 'loading';
    await store.load();
    if (token !== loadToken) return;
    if (store.status.value === 'missing') {
      status.value = 'missing';
      return;
    }
    if (store.status.value !== 'ready' || store.libraryVersion.value === null) {
      status.value = 'error';
      return;
    }
    let lv: Level;
    try {
      lv = store.getLevel(id);
    } catch {
      status.value = 'missing';
      return;
    }
    const version = store.libraryVersion.value;
    progress = useProgress(version);
    records = useRecords(version);

    // Incompatible saves are dropped by useProgress (spec §7.6).
    const saved = progress.load(id, d, derivePuzzle(lv, d));
    // A detached scope owns the game's timer and watchers, so switching maps disposes them.
    const scope = effectScope(true);
    const g = scope.run(() => useGame(lv, d, saved));
    if (!g) return;
    gameScope = scope;
    level.value = lv;
    if (!saved) g.setInputMode(settings.inputMode.value);
    game.value = g;
    scope.run(() => wireGame(g));
    restored.value = saved !== null;
    if (saved) toast.show(t('play.restored'), { variant: 'success' });
    status.value = 'ready';
  }

  watch(
    () => [levelId.value, difficulty.value] as const,
    ([id, d]) => void start(id, d),
    { immediate: true },
  );

  const onPageHide = (): void => flushSave();
  if (typeof window !== 'undefined') window.addEventListener('pagehide', onPageHide);

  if (getCurrentScope()) {
    onScopeDispose(() => {
      loadToken++;
      if (typeof window !== 'undefined') window.removeEventListener('pagehide', onPageHide);
      teardownGame();
    });
  }

  function isWon(g: Game): boolean {
    return g.state.status === 'won';
  }

  function onPress(cell: Cell): void {
    const g = game.value;
    if (!g || isWon(g)) return;
    if (g.state.inputMode === 'trail') {
      const result = g.trailPress(cell);
      if (result === 'rejected') shake(cell);
      else if (result === 'placed') playerFills.value++;
    } else {
      g.select(cell);
    }
  }

  function onDrag(cell: Cell): void {
    const g = game.value;
    if (!g || isWon(g) || g.state.inputMode !== 'trail') return;
    if (g.trailPress(cell) === 'placed') playerFills.value++;
  }

  function undo(): void {
    const g = game.value;
    if (!g || isWon(g)) return;
    g.undo();
  }

  function onDigit(d: number): void {
    const g = game.value;
    if (!g || isWon(g)) return;
    // Spec §8: a digit that would leave 1–100 is a structural rejection.
    if (!g.digit(d)) shake(g.state.selected);
  }

  function onConfirm(): void {
    const g = game.value;
    if (!g || isWon(g)) return;
    if (g.state.pending === '' || g.state.selected === null) return;
    // Only a given cell (or a value out of range) refuses a confirm.
    if (g.confirmPending()) playerFills.value++;
    else shake(g.state.selected);
  }

  function onClear(): void {
    const g = game.value;
    if (!g || isWon(g)) return;
    if (g.state.inputMode === 'trail') g.undo();
    else g.backspace();
  }

  function moveSelection(g: Game, dir: Direction): void {
    const from = g.state.selected ?? g.headCell.value ?? g.puzzle.start;
    if (g.state.selected === null) {
      g.select(from);
      return;
    }
    const to = step(from, dir);
    if (to !== -1) g.select(to);
  }

  function onKey(e: KeyboardEvent): void {
    const g = game.value;
    if (!g) return;
    const key = e.key;
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (key === 'z' || key === 'Z') && !e.shiftKey) {
      e.preventDefault();
      undo();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // Shift+Tab is left alone so keyboard users can still move focus off the board.
    if (key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      g.toggleInputMode();
      return;
    }
    if (isWon(g)) return;
    const dir = ARROWS[key];
    if (g.state.inputMode === 'trail') {
      if (dir) {
        e.preventDefault();
        if (g.trailStep(dir) === 'placed') {
          playerFills.value++;
        } else {
          const hc = g.headCell.value;
          const target = hc === null ? -1 : step(hc, dir);
          shake(target === -1 ? hc : target);
        }
      } else if (key === 'Backspace' || key === 'Delete') {
        e.preventDefault();
        g.undo();
      }
      return;
    }
    if (dir) {
      e.preventDefault();
      moveSelection(g, dir);
    } else if (/^[0-9]$/.test(key)) {
      e.preventDefault();
      onDigit(Number(key));
    } else if (key === 'Enter') {
      e.preventDefault();
      onConfirm();
    } else if (key === 'Backspace' || key === 'Delete') {
      e.preventDefault();
      g.backspace();
    }
  }

  function hint(): void {
    const g = game.value;
    if (!g || isWon(g)) return;
    const result = g.hint();
    if (!result) return;
    highlight.value = result.cell;
    if (result.divergedAt !== null) toast.show(t('play.hintDiverged', { n: result.divergedAt }));
  }

  function markAssisted(): void {
    game.value?.markAssisted();
  }

  async function requestRestart(): Promise<void> {
    const g = game.value;
    if (!g) return;
    const ok = await confirm(t('play.restartConfirm'), confirmLabels());
    if (!ok || game.value !== g) return;
    resetInPlace(g);
  }

  function resetInPlace(g: Game): void {
    cancelSave();
    resetWhileAssisted = g.state.assisted;
    g.reset();
    progress?.remove(g.state.levelId, g.state.difficulty);
    highlight.value = null;
    winResult.value = null;
    showWin.value = false;
    showSolution.value = false;
  }

  async function requestViewSolution(): Promise<void> {
    const g = game.value;
    if (!g) return;
    // After the win the records are written; looking at the solution changes nothing.
    if (g.state.assisted || isWon(g)) {
      showWin.value = false;
      showSolution.value = true;
      return;
    }
    const ok = await confirm(t('solution.confirm'), confirmLabels());
    if (!ok || game.value !== g) return;
    g.markAssisted();
    showSolution.value = true;
  }

  async function exportPdf(options: { includeSolution: boolean }): Promise<void> {
    const lv = level.value;
    const g = game.value;
    if (!lv || !g) return;
    const ok = await pdf.exportPdf(lv, g.state.difficulty, options.includeSolution);
    if (ok) showPdf.value = false;
  }

  function nextRandom(): number | null {
    const g = game.value;
    if (store.status.value !== 'ready') return null;
    const current = g?.state.levelId ?? levelId.value;
    let id = store.randomId();
    // A different map whenever there is one; a one-map library just restarts.
    for (let i = 0; i < 8 && id === current && store.count.value > 1; i++) id = store.randomId();
    if (id === current) {
      if (g) resetInPlace(g);
      return null;
    }
    return id;
  }

  return {
    status,
    game,
    level,
    restored,
    highlight,
    shakeTarget,
    winResult,
    showWin,
    showSolution,
    showPdf,
    pdfBusy: pdf.busy,
    playerFills,
    onPress,
    onDrag,
    onKey,
    onDigit,
    onConfirm,
    onClear,
    undo,
    hint,
    requestRestart,
    requestViewSolution,
    markAssisted,
    exportPdf,
    nextRandom,
  };
}
