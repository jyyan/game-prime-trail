import { computed, getCurrentScope, onScopeDispose, reactive, readonly, type ComputedRef, type Ref } from 'vue';
import { adjacent, step } from '../core/geometry';
import { derivePuzzle } from '../core/level-decode';
import { CELL_COUNT } from '../core/types';
import type {
  Cell,
  ConflictKind,
  Difficulty,
  Direction,
  GameStatus,
  InputMode,
  Level,
  Move,
  Puzzle,
  SavedProgress,
} from '../core/types';
import { cellOfNumber, conflictMap, findConflicts, headOf, isFull, isSolved } from '../core/validate';
import { useTimer, type Timer } from './useTimer';

/** Spec 7.2. `grid` is replaced (never mutated in place) so computeds re-run. */
export interface GameState {
  levelId: number;
  difficulty: Difficulty;
  grid: Uint8Array;
  steps: number;
  elapsedMs: number;
  assisted: boolean;
  status: GameStatus;
  undo: Move[];
  selected: Cell | null;
  pending: string;
  inputMode: InputMode;
}

export type TrailResult = 'placed' | 'retreated' | 'rejected';

export interface Game {
  state: Readonly<GameState>;
  puzzle: Puzzle;
  head: ComputedRef<number>;
  headCell: ComputedRef<Cell | null>;
  conflicts: ComputedRef<Map<Cell, ConflictKind[]>>;
  isFull: ComputedRef<boolean>;
  elapsedMs: Ref<number>;
  place(cell: Cell, n: number): boolean;
  clear(cell: Cell): boolean;
  undo(): boolean;
  reset(): void;
  markAssisted(): void;
  trailPress(cell: Cell): TrailResult;
  trailStep(dir: Direction): 'placed' | 'rejected';
  select(cell: Cell | null): void;
  digit(d: number): boolean;
  backspace(): void;
  confirmPending(): boolean;
  setInputMode(m: InputMode): void;
  toggleInputMode(): void;
  hint(): { cell: Cell; divergedAt: number | null } | null;
  snapshot(): SavedProgress;
}

const MAX_PENDING = 3;

function isCell(cell: unknown): cell is Cell {
  return Number.isInteger(cell) && (cell as number) >= 0 && (cell as number) < CELL_COUNT;
}

function givensGrid(puzzle: Puzzle): Uint8Array {
  const grid = new Uint8Array(CELL_COUNT);
  for (const [cell, n] of puzzle.givens) grid[cell] = n;
  return grid;
}

export function useGame(
  level: Level,
  difficulty: Difficulty,
  saved?: SavedProgress | null,
  deps: { timer?: Timer } = {},
): Game {
  const puzzle = derivePuzzle(level, difficulty);
  const ownsTimer = deps.timer === undefined;
  const timer = deps.timer ?? useTimer();
  if (ownsTimer && getCurrentScope()) onScopeDispose(() => timer.dispose());

  const initialGrid = givensGrid(puzzle);
  let initialStatus: GameStatus = 'idle';
  if (saved) {
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      // Givens always win; useProgress has already rejected incompatible saves (spec 7.6).
      if (!puzzle.givens.has(cell)) initialGrid[cell] = saved.grid[cell] ?? 0;
    }
    // Plan C3: 'playing', or 'idle' when the grid holds only givens. A finished game's save
    // is deleted on win (spec 7.6), so no 'won' restore path is defined.
    const onlyGivens = initialGrid.every((n, cell) => (puzzle.givens.has(cell) ? true : n === 0));
    initialStatus = onlyGivens ? 'idle' : 'playing';
    timer.reset(saved.elapsedMs);
  } else {
    timer.reset(0);
  }

  const state = reactive({
    levelId: level.id,
    difficulty,
    grid: initialGrid,
    steps: saved?.steps ?? 0,
    // A ref inside reactive() is unwrapped, so state.elapsedMs follows the timer.
    elapsedMs: timer.elapsedMs,
    assisted: saved?.assisted ?? false,
    status: initialStatus,
    undo: [] as Move[],
    selected: null as Cell | null,
    pending: '',
    inputMode: saved?.inputMode ?? 'trail',
  }) as GameState;

  const head = computed(() => headOf(state.grid));
  const headCell = computed<Cell | null>(() => {
    if (head.value === 0) return null;
    const cell = cellOfNumber(state.grid, head.value);
    return cell === -1 ? null : cell;
  });
  const conflicts = computed(() => conflictMap(findConflicts(state.grid, puzzle)));
  const full = computed(() => isFull(state.grid));

  const isGiven = (cell: Cell): boolean => puzzle.givens.has(cell);

  function write(cell: Cell, n: number): void {
    const next = state.grid.slice();
    next[cell] = n;
    state.grid = next;
  }

  function place(cell: Cell, n: number): boolean {
    if (!isCell(cell) || isGiven(cell)) return false;
    if (!Number.isInteger(n) || n < 1 || n > CELL_COUNT) return false;
    state.undo.push({ cell, prev: state.grid[cell], next: n });
    write(cell, n);
    state.steps += 1;
    state.status = 'playing';
    timer.start();
    // Spec 7.3: a full, solved grid after place wins and stops the timer.
    if (isFull(state.grid) && isSolved(state.grid, puzzle)) {
      state.status = 'won';
      timer.stop();
    }
    return true;
  }

  function clear(cell: Cell): boolean {
    if (!isCell(cell) || isGiven(cell) || state.grid[cell] === 0) return false;
    state.undo.push({ cell, prev: state.grid[cell], next: 0 });
    write(cell, 0);
    return true;
  }

  function undo(): boolean {
    const move = state.undo.pop();
    if (!move) return false;
    write(move.cell, move.prev);
    return true;
  }

  function reset(): void {
    state.grid = givensGrid(puzzle);
    state.steps = 0;
    state.undo = [];
    state.status = 'idle';
    state.selected = null;
    state.pending = '';
    timer.reset(0);
  }

  function markAssisted(): void {
    state.assisted = true;
  }

  function trailPress(cell: Cell): TrailResult {
    if (!isCell(cell)) return 'rejected';
    const h = head.value;
    const hc = headCell.value;
    if (hc === null) return 'rejected';
    if (state.grid[cell] === 0 && h < CELL_COUNT && adjacent(cell, hc)) {
      return place(cell, h + 1) ? 'placed' : 'rejected';
    }
    if (h >= 2 && cell === cellOfNumber(state.grid, h - 1) && !isGiven(hc)) {
      return clear(hc) ? 'retreated' : 'rejected';
    }
    return 'rejected';
  }

  function trailStep(dir: Direction): 'placed' | 'rejected' {
    const hc = headCell.value;
    if (hc === null || head.value >= CELL_COUNT) return 'rejected';
    const target = step(hc, dir);
    if (target === -1 || state.grid[target] !== 0 || isGiven(target)) return 'rejected';
    return place(target, head.value + 1) ? 'placed' : 'rejected';
  }

  function select(cell: Cell | null): void {
    state.selected = cell;
  }

  function digit(d: number): boolean {
    if (!Number.isInteger(d) || d < 0 || d > 9) return false;
    if (state.pending.length >= MAX_PENDING) return false;
    const next = state.pending + String(d);
    if (next[0] === '0' || Number(next) > CELL_COUNT) return false;
    state.pending = next;
    return true;
  }

  function backspace(): void {
    if (state.pending !== '') {
      state.pending = state.pending.slice(0, -1);
    } else if (state.selected !== null) {
      clear(state.selected);
    }
  }

  function confirmPending(): boolean {
    if (state.pending === '' || state.selected === null) return false;
    if (!place(state.selected, Number(state.pending))) return false;
    state.pending = '';
    return true;
  }

  function setInputMode(m: InputMode): void {
    state.inputMode = m;
  }

  function toggleInputMode(): void {
    setInputMode(state.inputMode === 'trail' ? 'direct' : 'trail');
  }

  /** Spec 5.6: point at the reference path, never run a solver in the browser. */
  function hint(): { cell: Cell; divergedAt: number | null } | null {
    const h = head.value;
    if (h >= CELL_COUNT) return null;
    let diverged = Infinity;
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      const n = state.grid[cell];
      if (n !== 0 && n !== level.numberAt[cell] && n < diverged) diverged = n;
    }
    markAssisted();
    if (diverged === Infinity) return { cell: level.cellOf[h], divergedAt: null };
    return { cell: cellOfNumber(state.grid, diverged) as Cell, divergedAt: diverged };
  }

  function snapshot(): SavedProgress {
    return {
      grid: Array.from(state.grid),
      steps: state.steps,
      elapsedMs: timer.elapsedMs.value,
      assisted: state.assisted,
      inputMode: state.inputMode,
      savedAt: new Date().toISOString(),
    };
  }

  return {
    state: readonly(state) as Readonly<GameState>,
    puzzle,
    head,
    headCell,
    conflicts,
    isFull: full,
    elapsedMs: timer.elapsedMs,
    place,
    clear,
    undo,
    reset,
    markAssisted,
    trailPress,
    trailStep,
    select,
    digit,
    backspace,
    confirmPending,
    setInputMode,
    toggleInputMode,
    hint,
    snapshot,
  };
}
