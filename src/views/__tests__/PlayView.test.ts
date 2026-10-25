import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router';
import { FIXTURE_PATH, FIXTURE_RECORD } from '../../core/__fixtures__/level-fixture';
import { decodeLevel, derivePuzzle } from '../../core/level-decode';
import { useConfirm } from '../../composables/useConfirm';
import { useLevelStore } from '../../composables/useLevelStore';
import { useRecords } from '../../composables/useRecords';
import { __resetSettings } from '../../composables/useSettings';
import { useToast } from '../../composables/useToast';
import { installE2eHooks } from '../../e2e-hooks';
import PlayView from '../PlayView.vue';

// The PDF pipeline (font fetch, jsPDF) has its own tests; here only the view's wiring matters.
const pdfMock = vi.hoisted(() => ({ exportPdf: vi.fn<(...args: unknown[]) => Promise<boolean>>() }));
vi.mock('../../composables/usePdfExport', async () => {
  const { ref } = await import('vue');
  return { usePdfExport: () => ({ busy: ref(false), exportPdf: pdfMock.exportPdf }) };
});

const easyGivens = derivePuzzle(decodeLevel(FIXTURE_RECORD, 1), 'easy').givens;

function fixtureFile(count = 1) {
  return {
    schema: 1,
    libraryVersion: 1,
    generator: 't',
    masterSeed: 's',
    count,
    levels: Array.from({ length: count }, () => FIXTURE_RECORD),
  };
}

const wrappers: VueWrapper[] = [];
let router: Router | null = null;

const q = (selector: string): HTMLElement | null => document.body.querySelector<HTMLElement>(selector);
const cellAt = (wrapper: VueWrapper, cell: number) => wrapper.get(`.pt-board [data-cell="${cell}"]`);
/** WinModal is the only modal with a next-random button. */
const winModal = (): HTMLElement | null =>
  q('.modal [data-action="nextRandom"]')?.closest<HTMLElement>('.modal') ?? null;

/** Opens the action bar's "more" menu and picks `action` (spec §4.2). */
async function menuAction(wrapper: VueWrapper, action: 'viewSolution' | 'exportPdf' | 'restart'): Promise<void> {
  await wrapper.get('[data-action="more"]').trigger('click');
  await flushPromises();
  await wrapper.get(`[role="menu"] [data-action="${action}"]`).trigger('click');
}

async function click(el: HTMLElement | null | undefined): Promise<void> {
  expect(el).toBeTruthy();
  el!.click();
  await flushPromises();
}

/** Trail-press the reference path from `from` to `to` (givens are already on the board). */
async function pressPath(wrapper: VueWrapper, to: number, from = 2): Promise<void> {
  for (let k = from; k <= to; k++) {
    const cell = FIXTURE_PATH[k - 1];
    if (!easyGivens.has(cell)) await cellAt(wrapper, cell).trigger('pointerdown');
  }
  await flushPromises();
}

async function settleConfirm(ok: boolean): Promise<void> {
  await flushPromises();
  const pending = useConfirm().pending.value;
  expect(pending).not.toBeNull();
  pending!.settle(ok);
  await flushPromises();
}

async function mountAt(path: string): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: defineComponent({ render: () => h('div', { 'data-view': 'home' }) }) },
      {
        path: '/play/:id(\\d+)/:difficulty(easy|advanced|challenge)',
        name: 'play',
        component: PlayView,
        props: true,
      },
    ],
  });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(RouterView, { global: { plugins: [router] }, attachTo: document.body });
  wrappers.push(wrapper);
  await flushPromises();
  return wrapper;
}

beforeEach(() => {
  localStorage.clear();
  __resetSettings();
  useLevelStore().__setLoader(async () => fixtureFile());
  for (const toast of [...useToast().toasts.value]) useToast().dismiss(toast.id);
  useConfirm().pending.value?.settle(false);
  pdfMock.exportPdf.mockReset();
  pdfMock.exportPdf.mockResolvedValue(true);
});

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  router = null;
  vi.restoreAllMocks();
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('PlayView', () => {
  it('renders the top bar, board, status bar and actions for /play/1/easy', async () => {
    const wrapper = await mountAt('/play/1/easy');
    expect(wrapper.find('.pt-board').exists()).toBe(true);
    expect(wrapper.get('[data-level-title]').text()).toBe('地圖 #0001・簡單');
    expect(wrapper.get('[data-timer]').text()).toBe('00:00');
    expect(wrapper.get('[data-action="home"]').text()).toContain('首頁');
    expect(wrapper.get('.pt-status-bar [data-steps]').text()).toBe('步數 0');
    expect(wrapper.find('.pt-play-actions').exists()).toBe(true);
    expect(wrapper.find('.pt-board [data-cell="19"]').text()).toBe('3');
  });

  it('focuses the board on mount so keys work at once', async () => {
    const wrapper = await mountAt('/play/1/easy');
    expect(document.activeElement).toBe(wrapper.get('.pt-board').element);
  });

  it('the top bar home button goes to / and keeps the move made just before', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await cellAt(wrapper, FIXTURE_PATH[3]).trigger('pointerdown');
    await wrapper.get('[data-action="home"]').trigger('click');
    await flushPromises();
    expect(router!.currentRoute.value.fullPath).toBe('/');
    // Left before the autosave debounce fired: unmounting flushes it.
    const saved = JSON.parse(localStorage.getItem('prime-trail:v1:L1:progress') ?? '{}') as Record<
      string,
      { steps: number }
    >;
    expect(saved['1:easy']?.steps).toBe(1);
  });

  it('trail mode shows the next number and follows the head', async () => {
    const wrapper = await mountAt('/play/1/easy');
    // Easy gives 1 and the primes, so the head starts past 1; the next number skips nothing it shows.
    const nextOf = () => Number(wrapper.get('[data-next-value]').text());
    const first = nextOf();
    await cellAt(wrapper, FIXTURE_PATH[first - 1]).trigger('pointerdown');
    expect(cellAt(wrapper, FIXTURE_PATH[first - 1]).text()).toBe(String(first));
    expect(nextOf()).toBeGreaterThan(first);
    await wrapper.get('[data-action="undo"]').trigger('click');
    expect(nextOf()).toBe(first);
  });

  it('direct mode shows the pending digits in the status bar: 1, 0, 0 reads 100', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await wrapper.get('.pt-mode-toggle button[data-mode="direct"]').trigger('click');
    expect(wrapper.find('[data-next]').exists()).toBe(false);
    expect(wrapper.find('.pt-number-pad [data-pending]').exists()).toBe(false);
    const pending = () => wrapper.get('.pt-status-bar [data-pending]').text();
    expect(pending()).toBe('');
    await wrapper.get('.pt-number-pad [data-key="1"]').trigger('click');
    expect(pending()).toBe('1');
    await wrapper.get('.pt-number-pad [data-key="0"]').trigger('click');
    await wrapper.get('.pt-number-pad [data-key="0"]').trigger('click');
    expect(pending()).toBe('100');
    expect(wrapper.get('[data-pending-box]').classes()).not.toContain('is-rejected');
  });

  it('a digit past 100 is refused but still gives feedback, from the pad and the keyboard', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await wrapper.get('.pt-mode-toggle button[data-mode="direct"]').trigger('click');
    for (const d of ['1', '0', '0']) await wrapper.get(`.pt-number-pad [data-key="${d}"]`).trigger('click');
    await wrapper.get('.pt-number-pad [data-key="5"]').trigger('click');
    expect(wrapper.get('.pt-status-bar [data-pending]').text()).toBe('100');
    expect(wrapper.get('[data-pending-box]').classes()).toContain('is-rejected');
    expect(wrapper.find('[data-pending-rejected]').exists()).toBe(true);

    await wrapper.get('.pt-number-pad [data-key="clear"]').trigger('click');
    expect(wrapper.get('.pt-status-bar [data-pending]').text()).toBe('10');
    // 101 is out of range too; this time the key comes from the keyboard on the board.
    await wrapper.get('.pt-board').trigger('keydown', { key: '1' });
    expect(wrapper.get('.pt-status-bar [data-pending]').text()).toBe('10');
    expect(wrapper.get('[data-pending-box]').classes()).toContain('is-rejected');
  });

  it('an accepted digit does not flash the pending box', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await wrapper.get('.pt-mode-toggle button[data-mode="direct"]').trigger('click');
    await wrapper.get('.pt-board').trigger('keydown', { key: '4' });
    expect(wrapper.get('.pt-status-bar [data-pending]').text()).toBe('4');
    expect(wrapper.get('[data-pending-box]').classes()).not.toContain('is-rejected');
  });

  it('shows the number pad only in direct mode', async () => {
    const wrapper = await mountAt('/play/1/easy');
    expect(wrapper.find('.pt-number-pad').exists()).toBe(false);
    await wrapper.get('.pt-mode-toggle button[data-mode="direct"]').trigger('click');
    expect(wrapper.find('.pt-number-pad').exists()).toBe(true);
    await wrapper.get('.pt-mode-toggle button[data-mode="trail"]').trigger('click');
    expect(wrapper.find('.pt-number-pad').exists()).toBe(false);
  });

  it('the action bar has no mode or clear button: InputModeToggle is the only mode switch', async () => {
    const wrapper = await mountAt('/play/1/easy');
    expect(wrapper.find('[data-action="toggleMode"]').exists()).toBe(false);
    expect(wrapper.find('.pt-play-actions [data-action="clear"]').exists()).toBe(false);
    expect(wrapper.findAll('.pt-mode-toggle button[data-mode]')).toHaveLength(2);
  });

  it('a press on the board goes through the session', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await cellAt(wrapper, FIXTURE_PATH[3]).trigger('pointerdown');
    expect(cellAt(wrapper, FIXTURE_PATH[3]).text()).toBe('4');
    expect(wrapper.get('.pt-status-bar [data-steps]').text()).toBe('步數 1');
    expect(wrapper.get('[data-action="undo"]').attributes('disabled')).toBeUndefined();
  });

  it('keys on the board go through the session', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await wrapper.get('.pt-board').trigger('keydown', { key: 'ArrowDown' });
    expect(cellAt(wrapper, 29).text()).toBe('4');
    await wrapper.get('.pt-board').trigger('keydown', { key: 'Tab' });
    expect(wrapper.find('.pt-number-pad').exists()).toBe(true);
  });

  it('a rejected press shakes that cell on the board', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await cellAt(wrapper, 55).trigger('pointerdown');
    await flushPromises();
    expect(cellAt(wrapper, 55).classes()).toContain('is-shake');
    expect(cellAt(wrapper, 55).text()).toBe('');
  });

  it('undo takes back the last cell; hint highlights the next one and marks assisted', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await cellAt(wrapper, FIXTURE_PATH[3]).trigger('pointerdown');
    await wrapper.get('[data-action="undo"]').trigger('click');
    expect(cellAt(wrapper, FIXTURE_PATH[3]).text()).toBe('');
    expect(wrapper.get('[data-action="undo"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-assisted]').exists()).toBe(false);
    await wrapper.get('[data-action="hint"]').trigger('click');
    expect(cellAt(wrapper, FIXTURE_PATH[3]).classes()).toContain('is-highlight');
    expect(wrapper.find('[data-assisted]').exists()).toBe(true);
  });

  it('restart asks first, then clears the board', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await pressPath(wrapper, 6);
    expect(cellAt(wrapper, FIXTURE_PATH[5]).text()).toBe('6');
    await menuAction(wrapper, 'restart');
    await settleConfirm(false);
    expect(cellAt(wrapper, FIXTURE_PATH[5]).text()).toBe('6');
    await menuAction(wrapper, 'restart');
    await settleConfirm(true);
    expect(cellAt(wrapper, FIXTURE_PATH[5]).text()).toBe('');
    expect(cellAt(wrapper, FIXTURE_PATH[2]).text()).toBe('3'); // givens stay
  });

  it('the view-solution action asks first, then opens the solution', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await menuAction(wrapper, 'viewSolution');
    await flushPromises();
    expect(useConfirm().pending.value?.message).toBe('看過解答後，這局不列入最佳紀錄。');
    useConfirm().pending.value!.settle(true);
    await flushPromises();
    expect(q('.pt-solution')).not.toBeNull();
    expect(wrapper.find('[data-assisted]').exists()).toBe(true);
  });

  it('the PDF action opens the export dialog; a successful export closes it', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await menuAction(wrapper, 'exportPdf');
    await flushPromises();
    expect(q('[data-include-solution]')).not.toBeNull();
    await click(q('.modal [data-action="export"]'));
    expect(pdfMock.exportPdf).toHaveBeenCalledTimes(1);
    expect(pdfMock.exportPdf.mock.calls[0].slice(1)).toEqual(['easy', false]);
    expect(q('[data-include-solution]')).toBeNull();
  });

  it('a failed PDF export leaves the dialog open', async () => {
    pdfMock.exportPdf.mockResolvedValue(false);
    const wrapper = await mountAt('/play/1/easy');
    await menuAction(wrapper, 'exportPdf');
    await flushPromises();
    await click(q('.modal [data-action="export"]'));
    expect(pdfMock.exportPdf).toHaveBeenCalledTimes(1);
    expect(q('[data-include-solution]')).not.toBeNull();
  });

  it('PDF with the solution mid-game asks, then marks the game assisted', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await cellAt(wrapper, FIXTURE_PATH[3]).trigger('pointerdown');
    expect(wrapper.find('[data-assisted]').exists()).toBe(false);
    await menuAction(wrapper, 'exportPdf');
    await flushPromises();
    const box = q('[data-include-solution]') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    await settleConfirm(true);
    expect(wrapper.find('[data-assisted]').exists()).toBe(true);
    await click(q('.modal [data-action="export"]'));
    expect(pdfMock.exportPdf.mock.calls[0].slice(1)).toEqual(['easy', true]);
  });

  it('a missing library shows the levelMissing text', async () => {
    useLevelStore().__setLoader(null);
    const wrapper = await mountAt('/play/1/easy');
    expect(wrapper.text()).toContain('找不到這張地圖');
    expect(wrapper.find('.pt-board').exists()).toBe(false);
  });

  it('an id outside the library shows the levelMissing text', async () => {
    const wrapper = await mountAt('/play/2/easy');
    expect(wrapper.text()).toContain('找不到這張地圖');
  });
});

describe('PlayView: winning', () => {
  it('a first clear opens WinModal with the new-best badges and the bests', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await pressPath(wrapper, 100);
    const modal = winModal();
    expect(modal).not.toBeNull();
    expect(modal!.textContent).toContain('過關！');
    expect(modal!.querySelector('[data-new-best="time"]')).not.toBeNull();
    expect(modal!.querySelector('[data-new-best="steps"]')).not.toBeNull();
    // Easy gives 1 and the 25 primes, so the clear takes 74 placements.
    expect(modal!.querySelector('[data-steps]')!.textContent).toContain('步數 74');
    expect(modal!.querySelector('[data-best]')!.textContent).toContain('最少步數 74');
    expect(wrapper.get('.pt-board').classes()).toContain('is-readonly');
  });

  it('a clear that beats nothing shows no badges, and the older bests', async () => {
    useRecords(1).recordClear(1, 'easy', { elapsedMs: 1, steps: 1, assisted: false });
    const wrapper = await mountAt('/play/1/easy');
    await pressPath(wrapper, 100);
    const modal = winModal()!;
    expect(modal.querySelector('[data-new-best]')).toBeNull();
    expect(modal.querySelector('[data-best]')!.textContent).toContain('最少步數 1');
  });

  it('WinModal PDF closes the win modal and opens the export dialog', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await pressPath(wrapper, 100);
    await click(winModal()!.querySelector<HTMLElement>('[data-action="exportPdf"]'));
    expect(winModal()).toBeNull();
    expect(q('[data-include-solution]')).not.toBeNull();
  });

  it('WinModal view-solution opens the solution without asking', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await pressPath(wrapper, 100);
    await click(winModal()!.querySelector<HTMLElement>('[data-action="viewSolution"]'));
    expect(useConfirm().pending.value).toBeNull();
    expect(winModal()).toBeNull();
    expect(q('.pt-solution')).not.toBeNull();
    expect(wrapper.find('[data-assisted]').exists()).toBe(false);
  });

  it('WinModal next-random on a one-map library restarts the same map', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await pressPath(wrapper, 100);
    await click(winModal()!.querySelector<HTMLElement>('[data-action="nextRandom"]'));
    expect(winModal()).toBeNull();
    expect(router!.currentRoute.value.fullPath).toBe('/play/1/easy');
    expect(cellAt(wrapper, FIXTURE_PATH[3]).text()).toBe('');
    expect(wrapper.get('.pt-board').classes()).not.toContain('is-readonly');
  });

  it('WinModal next-random with more maps navigates to another one', async () => {
    useLevelStore().__setLoader(async () => fixtureFile(2));
    vi.spyOn(Math, 'random').mockReturnValue(0.9);
    const wrapper = await mountAt('/play/1/easy');
    await pressPath(wrapper, 100);
    await click(winModal()!.querySelector<HTMLElement>('[data-action="nextRandom"]'));
    expect(router!.currentRoute.value.fullPath).toBe('/play/2/easy');
    expect(wrapper.get('[data-level-title]').text()).toContain('#0002');
    expect(winModal()).toBeNull();
  });

  it('WinModal back-home goes to /', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await pressPath(wrapper, 100);
    await click(winModal()!.querySelector<HTMLElement>('[data-action="backHome"]'));
    expect(router!.currentRoute.value.fullPath).toBe('/');
    expect(wrapper.find('[data-view="home"]').exists()).toBe(true);
  });
});

describe('installE2eHooks', () => {
  afterEach(() => {
    delete window.__primeTrail;
  });

  it('is a no-op unless VITE_E2E is 1', () => {
    installE2eHooks(useLevelStore(), {});
    expect(window.__primeTrail).toBeUndefined();
  });

  it('exposes the reference path once the store is ready', async () => {
    installE2eHooks(useLevelStore(), { VITE_E2E: '1' });
    await window.__primeTrail!.ready();
    expect(window.__primeTrail!.solutionOf(1)).toEqual([...FIXTURE_PATH]);
  });

  it('defaults to import.meta.env', () => {
    vi.stubEnv('VITE_E2E', '1');
    try {
      installE2eHooks(useLevelStore());
      expect(window.__primeTrail).toBeDefined();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
