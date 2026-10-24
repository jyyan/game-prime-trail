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

  // The glob is resolved at transform time, so only one of these two runs in a given checkout.
  // The 'missing' outcome itself is also pinned by the 'null loader → missing' case below, which
  // goes through the same `!loader` branch the default loader takes when the file is absent.
  it.skipIf(HAS_LEVELS_JSON)('default loader: missing when src/data/levels.json is absent', async () => {
    vi.resetModules();
    const fresh = await import('../useLevelStore');
    const store = fresh.useLevelStore();
    expect(store.status.value).toBe('idle');
    await store.load();
    expect(store.status.value).toBe('missing');
    expect(store.libraryVersion.value).toBeNull();
  });

  it.runIf(HAS_LEVELS_JSON)('default loader: ready when src/data/levels.json exists', async () => {
    vi.resetModules();
    const fresh = await import('../useLevelStore');
    const store = fresh.useLevelStore();
    expect(store.status.value).toBe('idle');
    await store.load();
    expect(store.status.value).toBe('ready');
    expect(store.count.value).toBeGreaterThan(0);
    expect(typeof store.libraryVersion.value).toBe('number');
    expect(store.getLevel(1).id).toBe(1);
    expect(store.getLevel(store.count.value).id).toBe(store.count.value);
  });

  it('synchronously throwing loader → error, and a later load retries', async () => {
    const store = useLevelStore();
    let calls = 0;
    store.__setLoader((() => {
      calls++;
      if (calls === 1) throw new Error('sync boom');
      return Promise.resolve(fixtureFile());
    }) as () => Promise<unknown>);
    await store.load();
    expect(store.status.value).toBe('error');
    await store.load();
    expect(calls).toBe(2);
    expect(store.status.value).toBe('ready');
  });

  it('rejected loader → error, and a later load retries', async () => {
    const store = useLevelStore();
    const loader = vi
      .fn<() => Promise<unknown>>()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValue(fixtureFile());
    store.__setLoader(loader);
    await store.load();
    expect(store.status.value).toBe('error');
    await store.load();
    expect(loader).toHaveBeenCalledTimes(2);
    expect(store.status.value).toBe('ready');
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
