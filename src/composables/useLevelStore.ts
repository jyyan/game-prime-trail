import { ref, shallowRef, type Ref } from 'vue';
import { decodeLevel, parseLevelFile } from '../core/level-decode';
import type { Level, LevelFile } from '../core/types';

export type LevelStoreStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'error';

type Loader = () => Promise<unknown>;

// Dynamic import keeps the level library out of the entry chunk (spec §3.4). The glob form
// lets the app build before `src/data/levels.json` exists: no match means status 'missing'.
const levelModules = import.meta.glob('../data/levels.json', { eager: false });
const defaultLoader: Loader | null = levelModules['../data/levels.json'] ?? null;

// Module-level singleton (spec §7).
const status = ref<LevelStoreStatus>('idle');
const libraryVersion = ref<number | null>(null);
const count = ref(0);
const file = shallowRef<LevelFile | null>(null);
const cache = new Map<number, Level>();
let loader: Loader | null = defaultLoader;
let inflight: Promise<void> | null = null;
let generation = 0;

function resetState(): void {
  generation++;
  inflight = null;
  status.value = 'idle';
  libraryVersion.value = null;
  count.value = 0;
  file.value = null;
  cache.clear();
}

function unwrapModule(mod: unknown): unknown {
  // A JSON module resolves to `{ default: data, ...namedKeys }`; injected loaders may return data.
  if (typeof mod === 'object' && mod !== null && 'default' in mod) {
    return (mod as { default: unknown }).default;
  }
  return mod;
}

function load(): Promise<void> {
  if (status.value === 'ready') return Promise.resolve();
  if (inflight) return inflight;
  if (!loader) {
    status.value = 'missing';
    return Promise.resolve();
  }
  const run = loader;
  const gen = generation;
  status.value = 'loading';
  inflight = (async () => {
    try {
      const parsed = parseLevelFile(unwrapModule(await run()));
      if (gen !== generation) return;
      file.value = parsed;
      libraryVersion.value = parsed.libraryVersion;
      count.value = parsed.count;
      status.value = 'ready';
    } catch {
      if (gen !== generation) return;
      status.value = 'error';
    } finally {
      if (gen === generation) inflight = null;
    }
  })();
  return inflight;
}

function getLevel(id: number): Level {
  const data = file.value;
  if (status.value !== 'ready' || !data) throw new Error('level store is not ready');
  if (!Number.isInteger(id) || id < 1 || id > data.count) {
    throw new RangeError(`level id ${id} out of range 1..${data.count}`);
  }
  let level = cache.get(id);
  if (!level) {
    level = decodeLevel(data.levels[id - 1], id);
    cache.set(id, level);
  }
  return level;
}

function randomId(rand: () => number = Math.random): number {
  if (status.value !== 'ready' || count.value < 1) throw new Error('level store is not ready');
  const id = 1 + Math.floor(rand() * count.value);
  return Math.min(Math.max(id, 1), count.value);
}

/** Test hook: replace the loader and reset the singleton to 'idle'. `null` simulates no file. */
function __setLoader(fn: Loader | null): void {
  loader = fn;
  resetState();
}

export interface LevelStore {
  status: Ref<LevelStoreStatus>;
  libraryVersion: Ref<number | null>;
  count: Ref<number>;
  load(): Promise<void>;
  getLevel(id: number): Level;
  randomId(rand?: () => number): number;
  __setLoader(fn: Loader | null): void;
}

export function useLevelStore(): LevelStore {
  return { status, libraryVersion, count, load, getLevel, randomId, __setLoader };
}
