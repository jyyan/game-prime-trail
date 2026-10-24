import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { fixtureGrid, fixturePuzzle, FIXTURE_PATH } from '../../../core/__fixtures__/level-fixture';
import { PRIMES } from '../../../core/primes';
import type { Cell, ConflictKind, InputMode, Puzzle } from '../../../core/types';
import { t } from '../../../i18n';
import GameBoard from '../GameBoard.vue';

const puzzle: Puzzle = fixturePuzzle(PRIMES);

function givenGrid(p: Puzzle): Uint8Array {
  const grid = new Uint8Array(100);
  for (const [cell, n] of p.givens) grid[cell] = n;
  return grid;
}

interface Props {
  puzzle: Puzzle;
  grid: Uint8Array;
  conflicts: ReadonlyMap<Cell, ConflictKind[]>;
  selected: Cell | null;
  head: Cell | null;
  highlight: Cell | null;
  mode: InputMode;
  readonly: boolean;
}

const wrappers: VueWrapper[] = [];

function mountBoard(props: Partial<Props> = {}) {
  const wrapper = mount(GameBoard, {
    props: {
      puzzle,
      grid: givenGrid(puzzle),
      conflicts: new Map(),
      selected: null,
      head: null,
      highlight: null,
      mode: 'trail',
      readonly: false,
      ...props,
    } satisfies Props,
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  return wrapper;
}

/** Make document.elementFromPoint resolve to the given cell button (jsdom has no layout). */
function pointAt(wrapper: VueWrapper, cell: Cell | null): void {
  const el = cell === null ? document.body : wrapper.get(`[data-cell="${cell}"]`).element;
  (document as { elementFromPoint: (x: number, y: number) => Element | null }).elementFromPoint =
    vi.fn(() => el);
}

const originalElementFromPoint = document.elementFromPoint;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  document.body.innerHTML = '';
  (document as { elementFromPoint: unknown }).elementFromPoint = originalElementFromPoint;
  vi.useRealTimers();
});

describe('GameBoard rendering', () => {
  it('renders 100 .pt-cell buttons with data-cell 0..99', () => {
    const cells = mountBoard().findAll('.pt-cell');
    expect(cells).toHaveLength(100);
    expect(cells.map((c) => Number(c.attributes('data-cell'))).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 100 }, (_, i) => i),
    );
  });

  it('root is .pt-board with tabindex=0 and data-mode matching mode', async () => {
    const wrapper = mountBoard({ mode: 'trail' });
    const root = wrapper.get('.pt-board');
    expect(root.element).toBe(wrapper.element);
    expect(root.attributes('tabindex')).toBe('0');
    expect(root.attributes('data-mode')).toBe('trail');
    await wrapper.setProps({ mode: 'direct' });
    expect(root.attributes('data-mode')).toBe('direct');
  });

  it('marks the start and prime cells', () => {
    const wrapper = mountBoard();
    expect(wrapper.get('[data-cell="9"]').classes()).toContain('is-prime');
    expect(wrapper.get('[data-cell="8"]').classes()).toContain('is-start');
    expect(wrapper.get('[data-cell="8"]').classes()).not.toContain('is-prime');
    expect(wrapper.get('[data-cell="18"]').classes()).not.toContain('is-prime');
  });

  it('renders given values and marks them is-given', () => {
    const wrapper = mountBoard();
    expect(wrapper.get('[data-cell="8"]').text()).toBe('1');
    expect(wrapper.get('[data-cell="9"]').text()).toBe('2');
    const cell97 = FIXTURE_PATH[96];
    expect(wrapper.get(`[data-cell="${cell97}"]`).text()).toBe('97');
    expect(wrapper.get(`[data-cell="${cell97}"]`).classes()).toContain('is-given');
    expect(wrapper.get('[data-cell="18"]').text()).toBe('');
    expect(wrapper.get('[data-cell="18"]').classes()).not.toContain('is-given');
  });

  it('renders player values from grid, including 100', () => {
    const wrapper = mountBoard({ grid: fixtureGrid(FIXTURE_PATH) });
    expect(wrapper.get(`[data-cell="${FIXTURE_PATH[99]}"]`).text()).toBe('100');
    expect(wrapper.get(`[data-cell="${FIXTURE_PATH[3]}"]`).text()).toBe('4');
  });

  it('applies selected, head, highlight and conflict classes', () => {
    const wrapper = mountBoard({
      selected: 18,
      head: 9,
      highlight: 19,
      conflicts: new Map<Cell, ConflictKind[]>([[18, ['duplicate']]]),
    });
    expect(wrapper.get('[data-cell="18"]').classes()).toEqual(
      expect.arrayContaining(['is-selected', 'is-conflict']),
    );
    expect(wrapper.get('[data-cell="9"]').classes()).toContain('is-head');
    expect(wrapper.get('[data-cell="19"]').classes()).toContain('is-highlight');
    expect(wrapper.findAll('.is-conflict')).toHaveLength(1);
  });

  it('ignores conflict entries with an empty kind list', () => {
    const wrapper = mountBoard({ conflicts: new Map<Cell, ConflictKind[]>([[18, []]]) });
    expect(wrapper.findAll('.is-conflict')).toHaveLength(0);
  });

  it('aria-label comes from board.cellLabel', () => {
    const wrapper = mountBoard();
    expect(wrapper.get('[data-cell="9"]').attributes('aria-label')).toBe(
      t('board.cellLabel', { r: 1, c: 10, content: t('board.number', { n: 2 }) }),
    );
    expect(wrapper.get('[data-cell="18"]').attributes('aria-label')).toBe(
      t('board.cellLabel', { r: 2, c: 9, content: t('board.empty') }),
    );
  });

  it('renders the head marker for the puzzle start', () => {
    const markers = mountBoard().findAll('.pt-head-marker');
    expect(markers).toHaveLength(1);
    expect(markers[0].classes()).toContain('pt-head-marker--top');
  });
});

describe('GameBoard pointer events', () => {
  it('pointerdown on a cell emits press', async () => {
    const wrapper = mountBoard({ mode: 'direct' });
    await wrapper.get('[data-cell="18"]').trigger('pointerdown', { pointerId: 1 });
    expect(wrapper.emitted('press')).toEqual([[18]]);
  });

  it('pointerdown outside any cell does not emit press', async () => {
    const wrapper = mountBoard();
    await wrapper.get('.pt-head-marker').trigger('pointerdown', { pointerId: 1 });
    expect(wrapper.emitted('press')).toBeUndefined();
  });

  it('trail drag emits drag once per newly entered cell', async () => {
    const wrapper = mountBoard({ mode: 'trail' });
    const board = wrapper.get('.pt-board');
    await wrapper.get('[data-cell="18"]').trigger('pointerdown', { pointerId: 1 });
    expect(wrapper.emitted('press')).toEqual([[18]]);

    // Still over the starting cell: no drag.
    pointAt(wrapper, 18);
    await board.trigger('pointermove', { pointerId: 1 });
    expect(wrapper.emitted('drag')).toBeUndefined();

    pointAt(wrapper, 28);
    await board.trigger('pointermove', { pointerId: 1 });
    expect(wrapper.emitted('drag')).toEqual([[28]]);

    // Same cell again: no repeat.
    await board.trigger('pointermove', { pointerId: 1 });
    expect(wrapper.emitted('drag')).toEqual([[28]]);

    pointAt(wrapper, 38);
    await board.trigger('pointermove', { pointerId: 1 });
    expect(wrapper.emitted('drag')).toEqual([[28], [38]]);
  });

  it('leaving the board and coming back to the same cell does not re-emit', async () => {
    const wrapper = mountBoard({ mode: 'trail' });
    const board = wrapper.get('.pt-board');
    await wrapper.get('[data-cell="18"]').trigger('pointerdown', { pointerId: 1 });
    pointAt(wrapper, 28);
    await board.trigger('pointermove', { pointerId: 1 });
    pointAt(wrapper, null);
    await board.trigger('pointermove', { pointerId: 1 });
    pointAt(wrapper, 28);
    await board.trigger('pointermove', { pointerId: 1 });
    expect(wrapper.emitted('drag')).toEqual([[28]]);
  });

  it('ignores moves from a different pointer', async () => {
    const wrapper = mountBoard({ mode: 'trail' });
    const board = wrapper.get('.pt-board');
    await wrapper.get('[data-cell="18"]').trigger('pointerdown', { pointerId: 1 });
    pointAt(wrapper, 28);
    await board.trigger('pointermove', { pointerId: 2 });
    expect(wrapper.emitted('drag')).toBeUndefined();
  });

  it('pointercancel emits dragend and stops the drag', async () => {
    const wrapper = mountBoard({ mode: 'trail' });
    const board = wrapper.get('.pt-board');
    await wrapper.get('[data-cell="18"]').trigger('pointerdown', { pointerId: 1 });
    await board.trigger('pointercancel', { pointerId: 1 });
    expect(wrapper.emitted('dragend')).toEqual([[]]);
    pointAt(wrapper, 28);
    await board.trigger('pointermove', { pointerId: 1 });
    expect(wrapper.emitted('drag')).toBeUndefined();
  });

  it('pointerup emits dragend', async () => {
    const wrapper = mountBoard({ mode: 'trail' });
    await wrapper.get('[data-cell="18"]').trigger('pointerdown', { pointerId: 1 });
    await wrapper.get('.pt-board').trigger('pointerup', { pointerId: 1 });
    expect(wrapper.emitted('dragend')).toEqual([[]]);
  });

  it('direct mode: pointerup and pointercancel emit dragend', async () => {
    const wrapper = mountBoard({ mode: 'direct' });
    const board = wrapper.get('.pt-board');
    await wrapper.get('[data-cell="18"]').trigger('pointerdown', { pointerId: 1 });
    await board.trigger('pointerup', { pointerId: 1 });
    await board.trigger('pointercancel', { pointerId: 1 });
    expect(wrapper.emitted('dragend')).toEqual([[], []]);
  });

  it('trail drag: another pointer lifting does not end the drag', async () => {
    const wrapper = mountBoard({ mode: 'trail' });
    const board = wrapper.get('.pt-board');
    await wrapper.get('[data-cell="18"]').trigger('pointerdown', { pointerId: 1 });
    await board.trigger('pointerup', { pointerId: 2 });
    expect(wrapper.emitted('dragend')).toBeUndefined();
    pointAt(wrapper, 28);
    await board.trigger('pointermove', { pointerId: 1 });
    expect(wrapper.emitted('drag')).toEqual([[28]]);
    await board.trigger('pointerup', { pointerId: 1 });
    expect(wrapper.emitted('dragend')).toEqual([[]]);
  });

  it('captures the pointer on the board when a trail drag starts', async () => {
    const wrapper = mountBoard({ mode: 'trail' });
    const el = wrapper.element as HTMLElement;
    const capture = vi.fn();
    (el as { setPointerCapture: unknown }).setPointerCapture = capture;
    await wrapper.get('[data-cell="18"]').trigger('pointerdown', { pointerId: 7 });
    expect(capture).toHaveBeenCalledWith(7);
  });

  it('direct mode: pointermove never emits drag and no pointer capture', async () => {
    const wrapper = mountBoard({ mode: 'direct' });
    const el = wrapper.element as HTMLElement;
    const capture = vi.fn();
    (el as { setPointerCapture: unknown }).setPointerCapture = capture;
    const board = wrapper.get('.pt-board');
    await wrapper.get('[data-cell="18"]').trigger('pointerdown', { pointerId: 1 });
    pointAt(wrapper, 28);
    await board.trigger('pointermove', { pointerId: 1 });
    expect(wrapper.emitted('press')).toEqual([[18]]);
    expect(wrapper.emitted('drag')).toBeUndefined();
    expect(capture).not.toHaveBeenCalled();
  });

  it('readonly: pointer and key events emit nothing', async () => {
    const wrapper = mountBoard({ readonly: true });
    const board = wrapper.get('.pt-board');
    await wrapper.get('[data-cell="18"]').trigger('pointerdown', { pointerId: 1 });
    pointAt(wrapper, 28);
    await board.trigger('pointermove', { pointerId: 1 });
    await board.trigger('pointerup', { pointerId: 1 });
    await board.trigger('pointercancel', { pointerId: 1 });
    await board.trigger('keydown', { key: 'ArrowUp' });
    expect(wrapper.emitted('press')).toBeUndefined();
    expect(wrapper.emitted('drag')).toBeUndefined();
    expect(wrapper.emitted('dragend')).toBeUndefined();
    expect(wrapper.emitted('key')).toBeUndefined();
  });
});

describe('GameBoard keyboard and exposed methods', () => {
  it('keydown ArrowUp on .pt-board emits key with the event', async () => {
    const wrapper = mountBoard();
    await wrapper.get('.pt-board').trigger('keydown', { key: 'ArrowUp' });
    const emitted = wrapper.emitted('key');
    expect(emitted).toHaveLength(1);
    expect((emitted![0][0] as KeyboardEvent).key).toBe('ArrowUp');
  });

  it('Enter on a focused cell emits press, not key', async () => {
    const wrapper = mountBoard({ mode: 'direct' });
    await wrapper.get('[data-cell="18"]').trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('press')).toEqual([[18]]);
    expect(wrapper.emitted('key')).toBeUndefined();
  });

  it('Enter on the board itself emits key, not press', async () => {
    const wrapper = mountBoard({ mode: 'direct' });
    await wrapper.get('.pt-board').trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('press')).toBeUndefined();
    expect(wrapper.emitted('key')).toHaveLength(1);
  });

  it('other keys on a focused cell still emit key', async () => {
    const wrapper = mountBoard({ mode: 'direct' });
    await wrapper.get('[data-cell="18"]').trigger('keydown', { key: '5' });
    expect(wrapper.emitted('press')).toBeUndefined();
    expect((wrapper.emitted('key')![0][0] as KeyboardEvent).key).toBe('5');
  });

  it('readonly: Enter on a cell emits nothing', async () => {
    const wrapper = mountBoard({ readonly: true });
    await wrapper.get('[data-cell="18"]').trigger('keydown', { key: 'Enter' });
    expect(wrapper.emitted('press')).toBeUndefined();
    expect(wrapper.emitted('key')).toBeUndefined();
  });

  it('shake(cell) adds is-shake for 150 ms', async () => {
    const wrapper = mountBoard();
    (wrapper.vm as unknown as { shake(cell: Cell): void }).shake(18);
    await nextTick();
    await nextTick();
    expect(wrapper.get('[data-cell="18"]').classes()).toContain('is-shake');
    vi.advanceTimersByTime(149);
    await nextTick();
    expect(wrapper.get('[data-cell="18"]').classes()).toContain('is-shake');
    vi.advanceTimersByTime(1);
    await nextTick();
    expect(wrapper.get('[data-cell="18"]').classes()).not.toContain('is-shake');
  });

  it('a second shake restarts the 150 ms window', async () => {
    const wrapper = mountBoard();
    const vm = wrapper.vm as unknown as { shake(cell: Cell): void };
    vm.shake(18);
    await nextTick();
    await nextTick();
    vi.advanceTimersByTime(100);
    vm.shake(28);
    await nextTick();
    await nextTick();
    expect(wrapper.get('[data-cell="18"]').classes()).not.toContain('is-shake');
    expect(wrapper.get('[data-cell="28"]').classes()).toContain('is-shake');
    vi.advanceTimersByTime(100);
    await nextTick();
    expect(wrapper.get('[data-cell="28"]').classes()).toContain('is-shake');
    vi.advanceTimersByTime(50);
    await nextTick();
    expect(wrapper.findAll('.is-shake')).toHaveLength(0);
  });

  it('two shakes before the next tick keep the full 150 ms window', async () => {
    const wrapper = mountBoard();
    const vm = wrapper.vm as unknown as { shake(cell: Cell): void };
    vm.shake(18);
    vm.shake(28);
    await nextTick();
    await nextTick();
    expect(wrapper.get('[data-cell="18"]').classes()).not.toContain('is-shake');
    expect(wrapper.get('[data-cell="28"]').classes()).toContain('is-shake');
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(149);
    await nextTick();
    expect(wrapper.get('[data-cell="28"]').classes()).toContain('is-shake');
    vi.advanceTimersByTime(1);
    await nextTick();
    expect(wrapper.findAll('.is-shake')).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('shake right before unmount leaves no timer behind', async () => {
    const wrapper = mountBoard();
    (wrapper.vm as unknown as { shake(cell: Cell): void }).shake(18);
    wrappers.splice(wrappers.indexOf(wrapper), 1);
    wrapper.unmount();
    await nextTick();
    await nextTick();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('focus() focuses the board element', () => {
    const wrapper = mountBoard();
    (wrapper.vm as unknown as { focus(): void }).focus();
    expect(document.activeElement).toBe(wrapper.element);
  });
});
