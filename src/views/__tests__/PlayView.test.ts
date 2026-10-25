import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { createMemoryHistory, createRouter, RouterView, type Router } from 'vue-router';
import {
  FIXTURE_ALT_PATH,
  FIXTURE_AMBIGUOUS_HINT_MASK,
  FIXTURE_PATH,
  FIXTURE_RECORD,
  fixtureGrid,
} from '../../core/__fixtures__/level-fixture';
import { decodeLevel, derivePuzzle } from '../../core/level-decode';
import { useConfirm } from '../../composables/useConfirm';
import { useLevelStore } from '../../composables/useLevelStore';
import { useRecords } from '../../composables/useRecords';
import { __resetSettings } from '../../composables/useSettings';
import { useToast } from '../../composables/useToast';
import { installE2eHooks } from '../../e2e-hooks';
import GameBoard from '../../components/board/GameBoard.vue';
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

// Controls-help spec §4–§5: the first-time hint card and the top bar's help dialog.
describe('PlayView: controls hint and help', () => {
  const UI = 'prime-trail:v1:ui';
  const hintCard = (w: VueWrapper) => w.find('[data-controls-hint]');
  const storedUi = () => JSON.parse(localStorage.getItem(UI) ?? 'null') as Record<string, unknown> | null;
  const helpDialog = () => q('.modal [data-help-section]')?.closest<HTMLElement>('.modal') ?? null;

  function stubPointer(coarse: boolean): void {
    vi.stubGlobal(
      'matchMedia',
      vi.fn((query: string) => ({ matches: coarse && query === '(pointer: coarse)', media: query })),
    );
  }

  afterEach(() => vi.unstubAllGlobals());

  it('shows the hint between the top bar and the board on a first visit', async () => {
    const wrapper = await mountAt('/play/1/easy');
    const card = hintCard(wrapper);
    expect(card.exists()).toBe(true);
    expect(card.attributes('role')).toBe('note');
    const topbar = wrapper.get('.pt-play-topbar').element;
    const boardWrap = wrapper.get('.pt-play__board-wrap').element;
    expect(topbar.nextElementSibling).toBe(card.element);
    expect(card.element.nextElementSibling).toBe(boardWrap);
    // It does not take focus from the board.
    expect(document.activeElement).toBe(wrapper.get('.pt-board').element);
  });

  it('a press that fills a cell hides it and remembers that', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await cellAt(wrapper, FIXTURE_PATH[3]).trigger('pointerdown');
    expect(hintCard(wrapper).exists()).toBe(false);
    expect(storedUi()).toEqual({ controlsHintSeen: true });
  });

  it('an arrow key that extends hides it', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await wrapper.get('.pt-board').trigger('keydown', { key: 'ArrowDown' });
    expect(hintCard(wrapper).exists()).toBe(false);
    expect(storedUi()?.controlsHintSeen).toBe(true);
  });

  it('a direct-mode confirm that fills hides it', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await wrapper.get('.pt-mode-toggle button[data-mode="direct"]').trigger('click');
    await cellAt(wrapper, 29).trigger('pointerdown');
    await wrapper.get('.pt-number-pad [data-key="4"]').trigger('click');
    expect(hintCard(wrapper).exists()).toBe(true);
    await wrapper.get('.pt-number-pad [data-key="confirm"]').trigger('click');
    expect(hintCard(wrapper).exists()).toBe(false);
  });

  it('a multi-cell drag writes the flag once', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const wrapper = await mountAt('/play/1/easy');
    const boardEl = wrapper.get('.pt-board');
    const doc = document as { elementFromPoint: unknown };
    const original = doc.elementFromPoint;
    try {
      await cellAt(wrapper, FIXTURE_PATH[3]).trigger('pointerdown', { pointerId: 1 });
      for (const n of [6, 8]) {
        const target = cellAt(wrapper, FIXTURE_PATH[n - 1]).element;
        doc.elementFromPoint = vi.fn(() => target); // jsdom has no layout
        await boardEl.trigger('pointermove', { pointerId: 1 });
      }
      await boardEl.trigger('pointerup', { pointerId: 1 });
    } finally {
      doc.elementFromPoint = original;
    }
    expect(cellAt(wrapper, FIXTURE_PATH[7]).text()).toBe('8');
    expect(hintCard(wrapper).exists()).toBe(false);
    expect(setItem.mock.calls.filter(([k]) => k === UI)).toHaveLength(1);
  });

  it('hint, undo, rejected presses and restart leave it showing', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await wrapper.get('[data-action="hint"]').trigger('click');
    await cellAt(wrapper, 55).trigger('pointerdown'); // rejected
    await wrapper.get('[data-action="undo"]').trigger('click');
    await wrapper.get('.pt-board').trigger('keydown', { key: 'Backspace' });
    await wrapper.get('.pt-board').trigger('keydown', { key: 'z', ctrlKey: true });
    await wrapper.get('.pt-board').trigger('keydown', { key: 'Tab' }); // to direct
    await wrapper.get('.pt-board').trigger('keydown', { key: 'Backspace' });
    await wrapper.get('.pt-board').trigger('keydown', { key: 'Tab' }); // back to trail
    await menuAction(wrapper, 'restart');
    await settleConfirm(true);
    await flushPromises();
    expect(hintCard(wrapper).exists()).toBe(true);
    expect(storedUi()?.controlsHintSeen).toBeUndefined();
  });

  it('the close button hides it and remembers that', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await wrapper.get('[data-action="dismissHint"]').trigger('click');
    expect(hintCard(wrapper).exists()).toBe(false);
    expect(storedUi()).toEqual({ controlsHintSeen: true });
  });

  it('opening help hides it, remembers that, and opens the dialog', async () => {
    const wrapper = await mountAt('/play/1/easy');
    const help = wrapper.get('[data-action="help"]');
    expect(help.attributes('aria-label')).toBe('操作說明');
    await help.trigger('click');
    await flushPromises();
    expect(hintCard(wrapper).exists()).toBe(false);
    expect(storedUi()?.controlsHintSeen).toBe(true);
    expect(helpDialog()).not.toBeNull();
    await click(helpDialog()!.querySelector<HTMLElement>('.btn-close'));
    expect(helpDialog()).toBeNull();
    // Help stays available after the hint is gone.
    await wrapper.get('[data-action="help"]').trigger('click');
    await flushPromises();
    expect(helpDialog()).not.toBeNull();
  });

  it('the help button is the last item of the top bar, after the timer', async () => {
    const wrapper = await mountAt('/play/1/easy');
    const bar = wrapper.get('.pt-play-topbar').element;
    expect(bar.lastElementChild?.getAttribute('data-action')).toBe('help');
    expect(bar.lastElementChild?.previousElementSibling?.hasAttribute('data-timer')).toBe(true);
  });

  it('does not show once seen, and keeps the home page flag', async () => {
    localStorage.setItem(UI, JSON.stringify({ rulesCollapsed: true, controlsHintSeen: true }));
    const wrapper = await mountAt('/play/1/easy');
    expect(hintCard(wrapper).exists()).toBe(false);
    expect(wrapper.find('[data-action="help"]').exists()).toBe(true);
  });

  it('a first look keeps rulesCollapsed when it writes the flag', async () => {
    localStorage.setItem(UI, JSON.stringify({ rulesCollapsed: true }));
    const wrapper = await mountAt('/play/1/easy');
    await wrapper.get('[data-action="dismissHint"]').trigger('click');
    expect(storedUi()).toEqual({ rulesCollapsed: true, controlsHintSeen: true });
  });

  it('a broken ui value counts as not seen', async () => {
    localStorage.setItem(UI, '[1]');
    const wrapper = await mountAt('/play/1/easy');
    expect(hintCard(wrapper).exists()).toBe(true);
  });

  it('a restored save with moves does not show it and records it as seen', async () => {
    const wrapper1 = await mountAt('/play/1/easy');
    await pressPath(wrapper1, 6);
    wrappers.splice(0).forEach((w) => w.unmount()); // flushes the save
    localStorage.removeItem(UI);
    const wrapper = await mountAt('/play/1/easy');
    expect(wrapper.find('.pt-status-bar [data-steps]').text()).not.toBe('步數 0');
    expect(hintCard(wrapper).exists()).toBe(false);
    expect(storedUi()?.controlsHintSeen).toBe(true);
  });

  it('without matchMedia it shows the keyboard text', async () => {
    const wrapper = await mountAt('/play/1/easy');
    expect(hintCard(wrapper).text()).toContain('方向鍵');
    expect(hintCard(wrapper).find('kbd').exists()).toBe(true);
  });

  it('a fine pointer shows the keyboard text and lists the keyboard help first', async () => {
    stubPointer(false);
    const wrapper = await mountAt('/play/1/easy');
    expect(hintCard(wrapper).text()).toContain('方向鍵');
    await wrapper.get('[data-action="help"]').trigger('click');
    await flushPromises();
    expect(helpDialog()!.querySelector<HTMLElement>('[data-help-section]')!.dataset.helpSection).toBe('pointer');
  });

  it('a coarse pointer shows the touch text and lists the touch help first', async () => {
    stubPointer(true);
    const wrapper = await mountAt('/play/1/easy');
    expect(hintCard(wrapper).text()).toContain('拖曳');
    expect(hintCard(wrapper).find('kbd').exists()).toBe(false);
    await wrapper.get('[data-action="help"]').trigger('click');
    await flushPromises();
    expect(helpDialog()!.querySelector<HTMLElement>('[data-help-section]')!.dataset.helpSection).toBe('touch');
  });

  it('switching to direct mode switches the hint text', async () => {
    stubPointer(true);
    const wrapper = await mountAt('/play/1/easy');
    expect(hintCard(wrapper).text()).toContain('拖曳');
    await wrapper.get('.pt-mode-toggle button[data-mode="direct"]').trigger('click');
    expect(hintCard(wrapper).text()).not.toContain('拖曳');
    expect(hintCard(wrapper).text()).toContain('數字鍵盤');
  });

  it('while help is open the board keys do nothing; Esc closes it', async () => {
    localStorage.setItem(UI, JSON.stringify({ controlsHintSeen: true }));
    const wrapper = await mountAt('/play/1/easy');
    await wrapper.get('[data-action="help"]').trigger('click');
    await flushPromises();
    expect(helpDialog()).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    await flushPromises();
    expect(cellAt(wrapper, 29).text()).toBe('');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await flushPromises();
    expect(helpDialog()).toBeNull();
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

// Demo-playback spec §6 (dead-end hint on easy) and §5.4 (completed line on win).
describe('PlayView: dead-end hint', () => {
  /** Trail-press `cells` in order, skipping cells that are givens on the current board. */
  async function pressCells(wrapper: VueWrapper, cells: readonly number[]): Promise<void> {
    for (const cell of cells) {
      if (!cellAt(wrapper, cell).classes().includes('is-given')) await cellAt(wrapper, cell).trigger('pointerdown');
    }
    await flushPromises();
  }
  // Reference path to 39 (cell 71), then 40 at 61 (41 is the given at 60), 42 at 50 (43 is the
  // given at 40): cell 70 is walled in by 60, 71 and 80, so the trail is doomed (trap).
  const TRAP_PREFIX = FIXTURE_PATH.slice(1, 39);
  const TRAP_MOVES = [61, 60, 50, 40];
  const deadLine = (w: VueWrapper) => w.find('[data-dead-end]');

  it('easy: a move that traps a cell marks the head ✕, frames the trapped cell and explains why', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await pressCells(wrapper, TRAP_PREFIX);
    await pressCells(wrapper, [61]);
    expect(deadLine(wrapper).exists()).toBe(false);
    expect(wrapper.findAll('.is-mark-reject, .is-mark-trap')).toHaveLength(0);
    await pressCells(wrapper, [50]);
    expect(cellAt(wrapper, 40).classes()).toContain('is-mark-reject'); // head: 43, the given after 42
    expect(cellAt(wrapper, 70).classes()).toContain('is-mark-trap');
    expect(wrapper.findAll('.is-mark-reject')).toHaveLength(1);
    expect(wrapper.findAll('.is-mark-trap')).toHaveLength(1);
    const line = deadLine(wrapper);
    expect(line.text()).toContain('紅框的格子會被四面圍住');
    expect(line.attributes('aria-live')).toBe('polite');
    // The line sits under the board, before the status bar.
    const order = Array.from((wrapper.element as HTMLElement).querySelectorAll('[data-dead-end], .pt-status-bar'));
    expect(order.map((el) => el.hasAttribute('data-dead-end'))).toEqual([true, false]);
    expect(wrapper.find('[data-assisted]').exists()).toBe(false);

    await wrapper.get('[data-action="undo"]').trigger('click');
    await flushPromises();
    expect(deadLine(wrapper).exists()).toBe(false);
    expect(wrapper.findAll('.is-mark-reject, .is-mark-trap')).toHaveLength(0);
    expect(wrapper.find('[data-assisted]').exists()).toBe(false);
  });

  it('easy: far fills in the target, distance and steps left', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await pressCells(wrapper, FIXTURE_PATH.slice(1, 8)); // head 8 at cell 58
    await pressCells(wrapper, [57]); // 9 here: 11 (cell 79) is 4 steps away with 2 to go
    expect(deadLine(wrapper).text()).toContain('從龍頭走到 11 至少要 4 步，但只剩 2 步');
    expect(cellAt(wrapper, 57).classes()).toContain('is-mark-reject');
    expect(cellAt(wrapper, 79).classes()).toContain('is-mark-trap');
  });

  it('advanced: the same board shows nothing', async () => {
    const wrapper = await mountAt('/play/1/advanced');
    await pressCells(wrapper, [...TRAP_PREFIX, ...TRAP_MOVES]);
    expect(cellAt(wrapper, 40).text()).toBe('43');
    expect(deadLine(wrapper).exists()).toBe(false);
    expect(wrapper.findAll('.is-mark-reject, .is-mark-trap')).toHaveLength(0);
  });

  it('writes no storage key of its own', async () => {
    const control = await mountAt('/play/1/easy');
    await pressCells(control, [...TRAP_PREFIX, 61]);
    wrappers.splice(0).forEach((w) => w.unmount());
    const expected = Object.keys(localStorage).sort();
    localStorage.clear();
    const wrapper = await mountAt('/play/1/easy');
    await pressCells(wrapper, [...TRAP_PREFIX, 61, 50]);
    expect(deadLine(wrapper).exists()).toBe(true);
    wrappers.splice(0).forEach((w) => w.unmount());
    expect(Object.keys(localStorage).sort()).toEqual(expected);
  });
});

describe('PlayView: completed line', () => {
  const trailProp = (w: VueWrapper) => w.findComponent(GameBoard).props('trail') ?? null;

  it("a win draws the line along the player's own grid, not the reference path", async () => {
    // {1} + primes >= 19 has two solutions; FIXTURE_ALT_PATH differs from the reference at 12-18.
    useLevelStore().__setLoader(async () => ({
      ...fixtureFile(),
      levels: [{ ...FIXTURE_RECORD, h: FIXTURE_AMBIGUOUS_HINT_MASK }],
    }));
    const wrapper = await mountAt('/play/1/advanced');
    for (let k = 2; k < 100; k++) {
      const cell = FIXTURE_ALT_PATH[k - 1];
      if (!cellAt(wrapper, cell).classes().includes('is-given')) await cellAt(wrapper, cell).trigger('pointerdown');
    }
    await flushPromises();
    expect(trailProp(wrapper)).toBeNull();
    expect(wrapper.find('svg.pt-trail').exists()).toBe(false);
    await cellAt(wrapper, FIXTURE_ALT_PATH[99]).trigger('pointerdown');
    await flushPromises();
    expect(winModal()).not.toBeNull();
    expect(trailProp(wrapper)).toEqual([...FIXTURE_ALT_PATH]);
    expect(trailProp(wrapper)).not.toEqual([...FIXTURE_PATH]);
    expect(wrapper.find('svg.pt-trail polyline').exists()).toBe(true);
    expect(cellAt(wrapper, FIXTURE_ALT_PATH[11]).find('.pt-num-corner').text()).toBe('12');
  });

  it('restart after a win removes the line', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await pressPath(wrapper, 100);
    expect(trailProp(wrapper)).toEqual([...FIXTURE_PATH]);
    expect(wrapper.find('[data-dead-end]').exists()).toBe(false);
    await menuAction(wrapper, 'restart');
    await settleConfirm(true);
    expect(trailProp(wrapper)).toBeNull();
    expect(wrapper.find('svg.pt-trail').exists()).toBe(false);
  });

  it('a restored save holding the finished trail draws the line', async () => {
    localStorage.setItem(
      'prime-trail:v1:L1:progress',
      JSON.stringify({
        '1:easy': {
          grid: [...fixtureGrid(FIXTURE_PATH)],
          steps: 74,
          elapsedMs: 1000,
          assisted: false,
          inputMode: 'trail',
          savedAt: new Date().toISOString(),
        },
      }),
    );
    const wrapper = await mountAt('/play/1/easy');
    expect(trailProp(wrapper)).toEqual([...FIXTURE_PATH]);
    expect(wrapper.find('svg.pt-trail polyline').exists()).toBe(true);
  });

  it('an unfinished board has no line', async () => {
    const wrapper = await mountAt('/play/1/easy');
    await pressPath(wrapper, 99);
    expect(trailProp(wrapper)).toBeNull();
  });

  it('trail mode: the head frame follows the head until the win, then is gone', async () => {
    const wrapper = await mountAt('/play/1/easy');
    const headProp = () => wrapper.findComponent(GameBoard).props('head') ?? null;
    await pressPath(wrapper, 99);
    expect(headProp()).not.toBeNull();
    expect(wrapper.find('.is-head').exists()).toBe(true);
    await pressPath(wrapper, 100);
    expect(winModal()).not.toBeNull();
    expect(headProp()).toBeNull();
    expect(wrapper.find('.is-head').exists()).toBe(false);
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
