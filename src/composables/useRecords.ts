import type { Completion, Difficulty, RecordEntry } from '../core/types';
import { isPlainObject, readJson, storageKey, writeJson } from './storage';

export interface ClearResult {
  elapsedMs: number;
  steps: number;
  assisted: boolean;
}

export interface RecordClearOutcome {
  entry: RecordEntry;
  isNewBest: { time: boolean; steps: boolean };
}

function isNullableCount(v: unknown): v is number | null {
  return v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
}

function isCount(v: unknown): v is number {
  return Number.isInteger(v) && (v as number) >= 0;
}

export function isRecordEntry(v: unknown): v is RecordEntry {
  return (
    isPlainObject(v) &&
    isNullableCount(v.bestMs) &&
    isNullableCount(v.bestSteps) &&
    isCount(v.clears) &&
    isCount(v.assistedClears) &&
    typeof v.lastClearedAt === 'string'
  );
}

function recordKey(levelId: number, difficulty: Difficulty): string {
  return `${levelId}:${difficulty}`;
}

/** Best records per `${levelId}:${difficulty}` (spec §7.4, §7.5). Malformed entries are dropped. */
export function useRecords(libraryVersion: number, storage?: Storage) {
  const key = storageKey('records', libraryVersion);

  function readAll(): Record<string, RecordEntry> {
    const raw = readJson(key, isPlainObject, storage);
    const out: Record<string, RecordEntry> = {};
    if (!raw) return out;
    for (const [k, v] of Object.entries(raw)) if (isRecordEntry(v)) out[k] = v;
    return out;
  }

  function get(levelId: number, difficulty: Difficulty): RecordEntry | null {
    return readAll()[recordKey(levelId, difficulty)] ?? null;
  }

  function completion(levelId: number, difficulty: Difficulty): Completion {
    const entry = get(levelId, difficulty);
    if (!entry) return 'none';
    if (entry.clears > 0) return 'cleared';
    if (entry.assistedClears > 0) return 'assisted';
    return 'none';
  }

  function recordClear(
    levelId: number,
    difficulty: Difficulty,
    result: ClearResult,
  ): RecordClearOutcome {
    const records = readAll();
    const k = recordKey(levelId, difficulty);
    const prev: RecordEntry = records[k] ?? {
      bestMs: null,
      bestSteps: null,
      clears: 0,
      assistedClears: 0,
      lastClearedAt: '',
    };
    const lastClearedAt = new Date().toISOString();
    let entry: RecordEntry;
    let isNewBest = { time: false, steps: false };
    if (result.assisted) {
      // Assisted clears count as completed but never touch the bests.
      entry = { ...prev, assistedClears: prev.assistedClears + 1, lastClearedAt };
    } else {
      isNewBest = {
        time: prev.bestMs === null || result.elapsedMs < prev.bestMs,
        steps: prev.bestSteps === null || result.steps < prev.bestSteps,
      };
      entry = {
        ...prev,
        clears: prev.clears + 1,
        bestMs: isNewBest.time ? result.elapsedMs : prev.bestMs,
        bestSteps: isNewBest.steps ? result.steps : prev.bestSteps,
        lastClearedAt,
      };
    }
    records[k] = entry;
    writeJson(key, records, storage);
    return { entry, isNewBest };
  }

  function all(): Readonly<Record<string, RecordEntry>> {
    return Object.freeze(readAll());
  }

  return { get, completion, recordClear, all };
}
