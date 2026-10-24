import { CELL_COUNT, DIFFICULTIES } from '../core/types';
import type { Difficulty, LastPlayed, Puzzle, SavedProgress } from '../core/types';
import { isPlainObject, readJson, storageKey, writeJson } from './storage';

export const MAX_PROGRESS_ENTRIES = 20;

function isNonNegNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

export function isSavedProgress(v: unknown): v is SavedProgress {
  return (
    isPlainObject(v) &&
    Array.isArray(v.grid) &&
    isNonNegNumber(v.steps) &&
    isNonNegNumber(v.elapsedMs) &&
    typeof v.assisted === 'boolean' &&
    (v.inputMode === 'trail' || v.inputMode === 'direct') &&
    typeof v.savedAt === 'string'
  );
}

function isLastPlayed(v: unknown): v is LastPlayed {
  return (
    isPlainObject(v) &&
    Number.isInteger(v.levelId) &&
    (v.levelId as number) >= 1 &&
    DIFFICULTIES.includes(v.difficulty as Difficulty) &&
    typeof v.savedAt === 'string'
  );
}

function progressKey(levelId: number, difficulty: Difficulty): string {
  return `${levelId}:${difficulty}`;
}

/** Saved grid must fit the current puzzle (spec §7.6); otherwise the save is discarded. */
function fitsPuzzle(snap: SavedProgress, puzzle: Puzzle): boolean {
  const { grid } = snap;
  if (grid.length !== CELL_COUNT) return false;
  for (const value of grid) {
    if (!Number.isInteger(value) || value < 0 || value > CELL_COUNT) return false;
  }
  for (const [cell, value] of puzzle.givens) if (grid[cell] !== value) return false;
  return true;
}

function savedAtTime(snap: SavedProgress): number {
  const t = Date.parse(snap.savedAt);
  return Number.isNaN(t) ? -Infinity : t;
}

/** In-progress autosaves and `lastPlayed` (spec §7.5, §7.6). */
export function useProgress(libraryVersion: number, storage?: Storage) {
  const progressStorageKey = storageKey('progress', libraryVersion);
  const lastPlayedKey = storageKey('lastPlayed', libraryVersion);

  function readAll(): Record<string, SavedProgress> {
    const raw = readJson(progressStorageKey, isPlainObject, storage);
    const out: Record<string, SavedProgress> = {};
    if (!raw) return out;
    for (const [k, v] of Object.entries(raw)) if (isSavedProgress(v)) out[k] = v;
    return out;
  }

  /** Raw `lastPlayed` key; callers hide "continue" when `has()` is false for it (spec §7.5). */
  function lastPlayed(): LastPlayed | null {
    return readJson(lastPlayedKey, isLastPlayed, storage);
  }

  function remove(levelId: number, difficulty: Difficulty): void {
    const all = readAll();
    const k = progressKey(levelId, difficulty);
    if (k in all) {
      delete all[k];
      writeJson(progressStorageKey, all, storage);
    }
    const last = lastPlayed();
    if (last && last.levelId === levelId && last.difficulty === difficulty) {
      writeJson(lastPlayedKey, null, storage);
    }
  }

  function load(levelId: number, difficulty: Difficulty, puzzle: Puzzle): SavedProgress | null {
    const snap = readAll()[progressKey(levelId, difficulty)];
    if (!snap) return null;
    if (!fitsPuzzle(snap, puzzle)) {
      remove(levelId, difficulty);
      return null;
    }
    return snap;
  }

  function save(levelId: number, difficulty: Difficulty, snap: SavedProgress): void {
    const all = readAll();
    const k = progressKey(levelId, difficulty);
    all[k] = snap;
    const keys = Object.keys(all);
    if (keys.length > MAX_PROGRESS_ENTRIES) {
      // LRU by savedAt; the entry being saved is never evicted.
      const evictable = keys
        .filter((key) => key !== k)
        .sort((a, b) => savedAtTime(all[a]) - savedAtTime(all[b]));
      for (const key of evictable.slice(0, keys.length - MAX_PROGRESS_ENTRIES)) delete all[key];
    }
    writeJson(progressStorageKey, all, storage);
    writeJson(lastPlayedKey, { levelId, difficulty, savedAt: snap.savedAt }, storage);
  }

  function has(levelId: number, difficulty: Difficulty): boolean {
    return progressKey(levelId, difficulty) in readAll();
  }

  return { load, save, remove, lastPlayed, has };
}
