import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_RECORD } from '../../core/__fixtures__/level-fixture';
import { useLevelStore } from '../useLevelStore';

// Same glob as the store, so the expectation tracks whether the library has been generated yet.
const HAS_LEVELS_JSON = Object.keys(import.meta.glob('../../data/levels.json')).length > 0;

function fixtureFile(overrides: Record<string, unknown> = {}) {
  return {
    schema: 1,
    libraryVersion: 1,
    generator: 't',
    masterSeed: 's',
    count: 1,
    levels: [FIXTURE_RECORD],
    ...overrides,
  };
}

describe('useLevelStore', () => {
  beforeEach(() => localStorage.clear());

  it('default loader: missing when src/data/levels.json does not exist', async () => {
    vi.resetModules();
    const fresh = await import('../useLevelStore');
    const store = fresh.useLevelStore();
    expect(store.status.value).toBe('idle');
    await store.load();
    expect(store.status.value).toBe(HAS_LEVELS_JSON ? 'ready' : 'missing');
  });

  it('rejected loader → error', async () => {
    const store = useLevelStore();
    store.__setLoader(() => Promise.reject(new Error('network')));
    await store.load();
    expect(store.status.value).toBe('error');
    expect(() => store.getLevel(1)).toThrow(Error);
  });

  it('null loader → missing', async () => {
    const store = useLevelStore();
    store.__setLoader(null);
    await store.load();
    expect(store.status.value).toBe('missing');
  });

  it('valid file → ready, decodes and caches levels', async () => {
    const store = useLevelStore();
    store.__setLoader(async () => fixtureFile());
    expect(store.status.value).toBe('idle');
    expect(() => store.getLevel(1)).toThrow(Error);
    const pending = store.load();
    expect(store.status.value).toBe('loading');
    await pending;
    expect(store.status.value).toBe('ready');
    expect(store.libraryVersion.value).toBe(1);
    expect(store.count.value).toBe(1);
    expect(store.getLevel(1).start).toBe(8);
    expect(store.getLevel(1).id).toBe(1);
    expect(store.getLevel(1)).toBe(store.getLevel(1));
    expect(() => store.getLevel(2)).toThrow(RangeError);
    expect(() => store.getLevel(0)).toThrow(RangeError);
    expect(store.randomId(() => 0)).toBe(1);
    expect(store.randomId(() => 0.9999)).toBe(store.count.value);
  });

  it('unwraps a JSON module default export', async () => {
    const store = useLevelStore();
    store.__setLoader(async () => ({ default: fixtureFile({ libraryVersion: 3 }) }));
    await store.load();
    expect(store.status.value).toBe('ready');
    expect(store.libraryVersion.value).toBe(3);
  });

  it('randomId spans 1..count', async () => {
    const store = useLevelStore();
    store.__setLoader(async () =>
      fixtureFile({ count: 3, levels: [FIXTURE_RECORD, FIXTURE_RECORD, FIXTURE_RECORD] }),
    );
    await store.load();
    expect(store.randomId(() => 0)).toBe(1);
    expect(store.randomId(() => 0.5)).toBe(2);
    expect(store.randomId(() => 0.9999)).toBe(3);
  });

  it('schema 2 → error', async () => {
    const store = useLevelStore();
    store.__setLoader(async () => fixtureFile({ schema: 2 }));
    await store.load();
    expect(store.status.value).toBe('error');
    expect(store.libraryVersion.value).toBeNull();
  });

  it('concurrent load calls share one loader invocation', async () => {
    const store = useLevelStore();
    const loader = vi.fn(async () => fixtureFile());
    store.__setLoader(loader);
    await Promise.all([store.load(), store.load()]);
    await store.load();
    expect(loader).toHaveBeenCalledTimes(1);
    expect(store.status.value).toBe('ready');
  });
});
