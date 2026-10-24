import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import {
  FIXTURE_ALT_PATH,
  FIXTURE_PATH,
  FIXTURE_RECORD,
  fixtureGrid,
} from '../../../core/__fixtures__/level-fixture';
import { decodeLevel, derivePuzzle } from '../../../core/level-decode';
import SolutionView from '../SolutionView.vue';

const level = decodeLevel(FIXTURE_RECORD, 1);
const puzzle = derivePuzzle(level, 'challenge');

function mountView(props: { playerGrid: Uint8Array; solved: boolean }) {
  return mount(SolutionView, { props: { level, puzzle, ...props } });
}

const cellText = (wrapper: ReturnType<typeof mountView>, cell: number) =>
  wrapper.get(`[data-cell="${cell}"]`).text();

describe('SolutionView', () => {
  it('no "also valid" note before the win', () => {
    const wrapper = mountView({ playerGrid: fixtureGrid(FIXTURE_ALT_PATH), solved: false });
    expect(wrapper.find('[data-also-valid]').exists()).toBe(false);
  });

  it('a different winning grid is called out as also valid', () => {
    const wrapper = mountView({ playerGrid: fixtureGrid(FIXTURE_ALT_PATH), solved: true });
    expect(wrapper.get('[data-also-valid]').text()).toBe('你的解也合法');
  });

  it('winning with the reference path shows no note', () => {
    const wrapper = mountView({ playerGrid: fixtureGrid(FIXTURE_PATH), solved: true });
    expect(wrapper.find('[data-also-valid]').exists()).toBe(false);
  });

  it('the toggle switches between the reference and the player grid', async () => {
    const wrapper = mountView({ playerGrid: fixtureGrid(FIXTURE_ALT_PATH), solved: true });
    // Opens on the reference: 13 sits at cell 77 there, 17 in the alternative path.
    expect(cellText(wrapper, 77)).toBe('13');
    expect(wrapper.get('[data-view="reference"]').attributes('aria-pressed')).toBe('true');
    await wrapper.get('[data-view="mine"]').trigger('click');
    expect(cellText(wrapper, 77)).toBe('17');
    expect(wrapper.get('[data-view="mine"]').attributes('aria-pressed')).toBe('true');
    await wrapper.get('[data-view="reference"]').trigger('click');
    expect(cellText(wrapper, 77)).toBe('13');
  });

  it('the board is read-only', () => {
    const wrapper = mountView({ playerGrid: fixtureGrid(FIXTURE_PATH), solved: true });
    expect(wrapper.get('.pt-board').classes()).toContain('is-readonly');
  });

  it('marks conflicts only in the player view', async () => {
    const grid = fixtureGrid(FIXTURE_PATH.slice(0, 10));
    grid[FIXTURE_PATH[50]] = 4; // a duplicate 4 far from the path
    const wrapper = mountView({ playerGrid: grid, solved: false });
    expect(wrapper.findAll('.is-conflict')).toHaveLength(0);
    await wrapper.get('[data-view="mine"]').trigger('click');
    expect(wrapper.findAll('.is-conflict').length).toBeGreaterThan(0);
  });
});
