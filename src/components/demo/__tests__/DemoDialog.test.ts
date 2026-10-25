import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FIXTURE_PATH, FIXTURE_RECORD } from '../../../core/__fixtures__/level-fixture';
import { DEMO_PACING as P, playbackMs, type DemoEvent, type DemoTrace } from '../../../core/demo-solver';
import { useLevelStore } from '../../../composables/useLevelStore';
import { t } from '../../../i18n';
import DemoDialog from '../DemoDialog.vue';

// Trace along the fixture's reference path: 2, 3, 4, stuck after 4 (left: not prime; down: traps 49),
// back to 2, then the whole path. Head 29 has neighbours 19 (used), 39 and 28.
function fixtureTrace(): DemoTrace {
  const events: DemoEvent[] = [
    { type: 'place', cell: FIXTURE_PATH[1], n: 2 },
    { type: 'place', cell: FIXTURE_PATH[2], n: 3 },
    { type: 'place', cell: FIXTURE_PATH[3], n: 4 },
    {
      type: 'stuck',
      n: 4,
      head: 29,
      reasons: [
        { cell: 19, kind: 'used' },
        { cell: 39, kind: 'trap', cells: [49] },
        { cell: 28, kind: 'notPrime' },
      ],
    },
    { type: 'unplace', cell: FIXTURE_PATH[3], n: 4 },
    { type: 'unplace', cell: FIXTURE_PATH[2], n: 3 },
  ];
  for (let n = 3; n <= 100; n++) events.push({ type: 'place', cell: FIXTURE_PATH[n - 1], n });
  return { solved: true, events, backtracks: 1 };
}

const TRACE = fixtureTrace();
const STUCK_AT = P.introMs + 2 * P.primeMs + P.placeMs;

// pickDemo is replaced so the dialog test controls which map comes up; the real one is covered in
// src/core/__tests__/demo-solver.test.ts.
const pickDemo = vi.hoisted(() => vi.fn());
vi.mock('../../../core/demo-solver', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../core/demo-solver')>();
  return { ...real, pickDemo };
});

function fixtureFile(count = 3) {
  return {
    schema: 1,
    libraryVersion: 1,
    generator: 't',
    masterSeed: 's',
    count,
    levels: Array.from({ length: count }, () => FIXTURE_RECORD),
  };
}

let wrapper: VueWrapper | null = null;

async function open(random?: () => number, loader: (() => Promise<unknown>) | null = () => Promise.resolve(fixtureFile())) {
  useLevelStore().__setLoader(loader);
  wrapper = mount(DemoDialog, { props: { modelValue: true, random }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

const q = (sel: string): Element | null => document.body.querySelector(sel);
const text = (sel: string): string => q(sel)?.textContent?.trim() ?? '';

describe('DemoDialog', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    // Random 0 -> map 2, anything else -> map 3 (stand-in for the real random pick).
    pickDemo.mockReset();
    pickDemo.mockImplementation((_count: number, _get: unknown, random: () => number) => ({
      levelId: random() === 0 ? 2 : 3,
      trace: TRACE,
    }));
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = null;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts playing on open: map info, intro text and a read-only board', async () => {
    await open(() => 0);
    expect(pickDemo).toHaveBeenCalledTimes(1);
    expect(pickDemo.mock.calls[0][0]).toBe(3);
    expect(text('[data-demo-info]')).toBe('第 2 張地圖・簡單難度｜退回 1 次');
    expect(text('[data-demo-title]')).toBe(t('demo.intro', { n: 1 }));
    expect(q('[data-demo-say]')?.getAttribute('aria-live')).toBe('polite');
    expect(q('.pt-board.is-readonly')).not.toBeNull();
    expect(q('[data-cell="8"]')?.textContent?.trim()).toBe('1');
    vi.advanceTimersByTime(P.introMs);
    await flushPromises();
    expect(text('[data-demo-title]')).toBe(t('demo.prime', { n: 2 }));
    expect(q('[data-cell="9"]')?.classList.contains('is-head')).toBe(true);
    expect(q('[data-cell="29"]')?.textContent?.trim()).toBe('');
    vi.advanceTimersByTime(2 * P.primeMs);
    await flushPromises();
    expect(q('[data-cell="29"]')?.textContent?.trim()).toBe('4');
    expect(q('[data-cell="29"]')?.classList.contains('is-filled')).toBe(true);
    expect(text('[data-demo-title]')).toBe(t('demo.filling', { n: 4 }));
  });

  it('when stuck, lists the reasons and marks the board', async () => {
    await open(() => 0);
    vi.advanceTimersByTime(STUCK_AT);
    await flushPromises();
    expect(text('[data-demo-title]')).toBe('4 之後卡住了，5 沒有地方可以放：');
    const items = [...document.body.querySelectorAll('[data-demo-lines] li')].map((li) => li.textContent);
    expect(items).toEqual([
      '下面：填下去，紅框的格子會被四面圍住，再也走不進去',
      '左邊：這格是黃格，只能放質數，5 不是質數',
    ]);
    expect(q('[data-cell="39"]')?.classList.contains('is-mark-reject')).toBe(true);
    expect(q('[data-cell="28"]')?.classList.contains('is-mark-reject')).toBe(true);
    expect(q('[data-cell="49"]')?.classList.contains('is-mark-trap')).toBe(true);
    expect(q('[data-cell="19"]')?.className).not.toMatch(/is-mark/);
  });

  it('draws the trail when done', async () => {
    await open(() => 0);
    vi.advanceTimersByTime(playbackMs(TRACE));
    await flushPromises();
    expect(q('[data-demo]')?.getAttribute('data-done')).toBe('true');
    expect(text('[data-demo-title]')).toBe(t('demo.done', { k: 1 }));
    expect(q('svg.pt-trail polyline')).not.toBeNull();
  });

  it('"another one" swaps the map and replays from the start', async () => {
    const values = [0, 0.5];
    await open(() => values.shift() ?? 0.5);
    vi.advanceTimersByTime(playbackMs(TRACE));
    await flushPromises();
    expect(q('svg.pt-trail')).not.toBeNull();
    (q('button[data-action="demoAgain"]') as HTMLButtonElement).click();
    await flushPromises();
    expect(pickDemo).toHaveBeenCalledTimes(2);
    expect(text('[data-demo-info]')).toBe('第 3 張地圖・簡單難度｜退回 1 次');
    expect(text('[data-demo-title]')).toBe(t('demo.intro', { n: 1 }));
    expect(q('svg.pt-trail')).toBeNull();
    // 4 (cell 29) is not a given, so it is empty again; 2 and 3 are primes and shown on the easy board.
    expect(q('[data-cell="29"]')?.textContent?.trim()).toBe('');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('closing stops the playback: advancing time changes nothing', async () => {
    const w = await open(() => 0);
    vi.advanceTimersByTime(P.introMs);
    await flushPromises();
    await w.setProps({ modelValue: false });
    await flushPromises();
    expect(q('[data-demo]')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    const before = document.body.innerHTML;
    vi.advanceTimersByTime(600_000);
    await flushPromises();
    expect(document.body.innerHTML).toBe(before);

    // Reopening picks again and starts from the intro.
    await w.setProps({ modelValue: true });
    await flushPromises();
    expect(pickDemo).toHaveBeenCalledTimes(2);
    expect(text('[data-demo-title]')).toBe(t('demo.intro', { n: 1 }));
  });

  it('closing from the dialog emits update:modelValue', async () => {
    const w = await open(() => 0);
    (q('.btn-close') as HTMLButtonElement).click();
    await flushPromises();
    expect(w.emitted('update:modelValue')).toEqual([[false]]);
  });

  it('never writes localStorage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    const values = [0, 0.5];
    const w = await open(() => values.shift() ?? 0.5);
    vi.advanceTimersByTime(playbackMs(TRACE));
    await flushPromises();
    (q('button[data-action="demoAgain"]') as HTMLButtonElement).click();
    vi.advanceTimersByTime(STUCK_AT);
    await flushPromises();
    await w.setProps({ modelValue: false });
    await flushPromises();
    expect(setItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
  });

  it('shows one error line when the library is missing', async () => {
    await open(() => 0, null);
    expect(text('[data-demo-error]')).toBe(t('demo.loadFailed'));
    expect(q('.pt-board')).toBeNull();
    expect(pickDemo).not.toHaveBeenCalled();
  });

  it('shows one error line when no map fits', async () => {
    pickDemo.mockImplementation(() => {
      throw new Error('pickDemo: no map fits the demo limits');
    });
    await open(() => 0);
    expect(text('[data-demo-error]')).toBe(t('demo.loadFailed'));
    expect(q('.pt-board')).toBeNull();
  });

  it('shows the loading text while the library loads', async () => {
    let resolve: (v: unknown) => void = () => {};
    useLevelStore().__setLoader(() => new Promise((r) => (resolve = r)));
    wrapper = mount(DemoDialog, { props: { modelValue: true, random: () => 0 }, attachTo: document.body });
    await flushPromises();
    expect(text('[data-demo-say]')).toBe(t('demo.loading'));
    const again = q('button[data-action="demoAgain"]') as HTMLButtonElement;
    expect(again.disabled).toBe(true);
    expect(again.getAttribute('aria-busy')).toBe('true');
    resolve(fixtureFile());
    await flushPromises();
    expect(text('[data-demo-title]')).toBe(t('demo.intro', { n: 1 }));
    expect(pickDemo).toHaveBeenCalledTimes(1);
  });
});
