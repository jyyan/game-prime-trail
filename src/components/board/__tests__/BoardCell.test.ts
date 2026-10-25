import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { t } from '../../../i18n';
import BoardCell from '../BoardCell.vue';

const base = {
  value: 0,
  kind: 'normal' as 'start' | 'prime' | 'normal',
  given: false,
  selected: false,
  head: false,
  highlight: false,
  conflict: false,
  shake: false,
  cell: 18,
};

function mountCell(props: Partial<typeof base> = {}) {
  return mount(BoardCell, { props: { ...base, ...props } });
}

describe('BoardCell', () => {
  it('renders a non-bootstrap button with data-cell', () => {
    const btn = mountCell().get('button');
    expect(btn.classes()).toContain('pt-cell');
    expect(btn.classes()).not.toContain('btn');
    expect(btn.attributes('type')).toBe('button');
    expect(btn.attributes('data-cell')).toBe('18');
  });

  it('kind=start adds is-start', () => {
    expect(mountCell({ kind: 'start' }).get('button').classes()).toContain('is-start');
  });

  it('kind=prime adds is-prime', () => {
    const cls = mountCell({ kind: 'prime' }).get('button').classes();
    expect(cls).toContain('is-prime');
    expect(cls).not.toContain('is-start');
  });

  it('given adds is-given', () => {
    expect(mountCell({ given: true }).get('button').classes()).toContain('is-given');
    expect(mountCell().get('button').classes()).not.toContain('is-given');
  });

  it('a player-filled value (non-given, value > 0) adds is-filled', () => {
    expect(mountCell({ value: 42 }).get('button').classes()).toContain('is-filled');
  });

  it('given or empty cells do not get is-filled', () => {
    expect(mountCell({ value: 42, given: true }).get('button').classes()).not.toContain(
      'is-filled',
    );
    expect(mountCell({ value: 0 }).get('button').classes()).not.toContain('is-filled');
    expect(mountCell({ value: 1, kind: 'start', given: true }).get('button').classes()).not.toContain(
      'is-filled',
    );
  });

  it('value=0 renders empty text', () => {
    expect(mountCell({ value: 0 }).get('button').text()).toBe('');
  });

  it('value=100 renders 100', () => {
    expect(mountCell({ value: 100 }).get('button').text()).toBe('100');
  });

  it('conflict adds is-conflict', () => {
    expect(mountCell({ conflict: true }).get('button').classes()).toContain('is-conflict');
    expect(mountCell().get('button').classes()).not.toContain('is-conflict');
  });

  it('state flags map to classes', () => {
    const cls = mountCell({ selected: true, head: true, highlight: true, shake: true })
      .get('button')
      .classes();
    expect(cls).toEqual(
      expect.arrayContaining(['is-selected', 'is-head', 'is-highlight', 'is-shake']),
    );
    const plain = mountCell().get('button').classes();
    for (const c of ['is-selected', 'is-head', 'is-highlight', 'is-shake']) {
      expect(plain).not.toContain(c);
    }
  });

  it('aria-label uses board.cellLabel with 1-based row and column', () => {
    const filled = mountCell({ value: 42, cell: 18 }).get('button').attributes('aria-label');
    expect(filled).toBe(
      t('board.cellLabel', { r: 2, c: 9, content: t('board.number', { n: 42 }) }),
    );
    const emptyPrime = mountCell({ kind: 'prime', cell: 9 }).get('button').attributes('aria-label');
    expect(emptyPrime).toBe(t('board.cellLabel', { r: 1, c: 10, content: t('board.primeCell') }));
    const empty = mountCell({ cell: 0 }).get('button').attributes('aria-label');
    expect(empty).toBe(t('board.cellLabel', { r: 1, c: 1, content: t('board.empty') }));
  });

  it('places itself in the inner 10x10 area of the grid (outer band is track 1)', () => {
    const style = mountCell({ cell: 18 }).get('button').attributes('style') ?? '';
    expect(style).toContain('grid-row: 3');
    expect(style).toContain('grid-column: 10');
  });

  it('is not a tab stop (the board itself takes focus)', () => {
    expect(mountCell().get('button').attributes('tabindex')).toBe('-1');
  });
});

describe('BoardCell marks and trail', () => {
  it('default has no mark/trail classes', () => {
    const btn = mountCell().get('button');
    expect(btn.classes().join(' ')).not.toMatch(/is-mark|is-trail/);
    expect(btn.find('span').exists()).toBe(false);
  });

  it.each([
    ['reject', 'deadEnd.markReject'],
    ['trap', 'deadEnd.markTrap'],
    ['branch', 'demo.markBranch'],
  ] as const)('mark=%s adds class and appends aria text', (mark, key) => {
    const btn = mount(BoardCell, { props: { ...base, mark } }).get('button');
    expect(btn.classes()).toContain(`is-mark-${mark}`);
    expect(btn.attributes('aria-label')).toContain(t(key));
  });

  it('trail adds is-trail and keeps the number text', () => {
    const btn = mount(BoardCell, { props: { ...base, value: 7, trail: true } }).get('button');
    expect(btn.classes()).toContain('is-trail');
    expect(btn.text()).toBe('7');
    expect(btn.get('span.pt-num-corner').text()).toBe('7');
  });

  it('without trail the number is a bare text node with the original surrounding whitespace', () => {
    const btn = mount(BoardCell, { props: { ...base, value: 7 } }).get('button');
    expect(btn.find('.pt-num-corner').exists()).toBe(false);
    expect(btn.element.textContent).toBe(' 7 ');
    const empty = mount(BoardCell, { props: { ...base, value: 0 } }).get('button');
    expect(empty.element.textContent).toBe('  ');
  });
});
