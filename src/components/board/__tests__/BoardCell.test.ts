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
