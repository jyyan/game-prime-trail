import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import PlayActions from '../PlayActions.vue';

const wrappers: VueWrapper[] = [];

function mountActions(canUndo = true) {
  const outside = document.createElement('button');
  outside.dataset.outside = '';
  document.body.appendChild(outside);
  const wrapper = mount(PlayActions, { props: { canUndo }, attachTo: document.body });
  wrappers.push(wrapper);
  return { wrapper, outside };
}

const menu = (w: VueWrapper) => w.find('[role="menu"]');
const trigger = (w: VueWrapper) => w.get('button[data-action="more"]');

async function openByClick(w: VueWrapper): Promise<void> {
  await trigger(w).trigger('click');
  await flushPromises();
}

afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  document.body.innerHTML = '';
});

describe('PlayActions', () => {
  it('shows undo, hint and more; mode toggle and clear are gone (spec §4.2)', () => {
    const { wrapper } = mountActions();
    const actions = wrapper.findAll('.pt-play-actions > button, .pt-play-actions__more > button').map((b) => b.attributes('data-action'));
    expect(actions).toEqual(['undo', 'hint', 'more']);
    expect(wrapper.find('[data-action="toggleMode"]').exists()).toBe(false);
    expect(wrapper.find('[data-action="clear"]').exists()).toBe(false);
    expect(menu(wrapper).exists()).toBe(false);
  });

  it('undo follows canUndo and emits; hint emits', async () => {
    const { wrapper } = mountActions(false);
    expect(wrapper.get('[data-action="undo"]').attributes('disabled')).toBeDefined();
    await wrapper.setProps({ canUndo: true });
    await wrapper.get('[data-action="undo"]').trigger('click');
    await wrapper.get('[data-action="hint"]').trigger('click');
    expect(wrapper.emitted('undo')).toEqual([[]]);
    expect(wrapper.emitted('hint')).toEqual([[]]);
  });

  it('the more button opens a menu of view solution, PDF and a separated danger restart', async () => {
    const { wrapper } = mountActions();
    expect(trigger(wrapper).attributes('aria-haspopup')).toBe('menu');
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('false');
    await openByClick(wrapper);
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('true');
    const items = menu(wrapper).findAll('[role="menuitem"]');
    expect(items.map((i) => i.attributes('data-action'))).toEqual(['viewSolution', 'exportPdf', 'restart']);
    expect(items.map((i) => i.text())).toEqual(['看解答', '匯出 PDF', '重新開始']);
    expect(items[2].classes()).toContain('pt-play-actions__item--danger');
    expect(menu(wrapper).find('[role="separator"]').exists()).toBe(true);
    // Opening moves focus into the menu, so board keys cannot reach the board meanwhile.
    expect(document.activeElement).toBe(items[0].element);
  });

  it.each([
    ['viewSolution', 'viewSolution'],
    ['exportPdf', 'exportPdf'],
    ['restart', 'restart'],
  ] as const)('picking %s emits it, closes the menu and returns focus to the trigger', async (action, event) => {
    const { wrapper } = mountActions();
    await openByClick(wrapper);
    await menu(wrapper).get(`[data-action="${action}"]`).trigger('click');
    expect(wrapper.emitted(event)).toEqual([[]]);
    expect(menu(wrapper).exists()).toBe(false);
    expect(document.activeElement).toBe(trigger(wrapper).element);
  });

  it('Escape closes the menu and returns focus to the trigger', async () => {
    const { wrapper } = mountActions();
    await openByClick(wrapper);
    await menu(wrapper).get('[data-action="exportPdf"]').trigger('keydown', { key: 'Escape' });
    expect(menu(wrapper).exists()).toBe(false);
    expect(trigger(wrapper).attributes('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger(wrapper).element);
    expect(wrapper.emitted('exportPdf')).toBeUndefined();
  });

  it('arrow keys move through the items and wrap around', async () => {
    const { wrapper } = mountActions();
    await openByClick(wrapper);
    const items = menu(wrapper).findAll('[role="menuitem"]');
    await items[0].trigger('keydown', { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1].element);
    await items[1].trigger('keydown', { key: 'ArrowDown' });
    await items[2].trigger('keydown', { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0].element);
    await items[0].trigger('keydown', { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[2].element);
  });

  it('a pointer press outside closes the menu; a press inside does not', async () => {
    const { wrapper, outside } = mountActions();
    await openByClick(wrapper);
    menu(wrapper).element.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await flushPromises();
    expect(menu(wrapper).exists()).toBe(true);
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await flushPromises();
    expect(menu(wrapper).exists()).toBe(false);
    expect(wrapper.emitted('restart')).toBeUndefined();
  });

  it('clicking the trigger again closes the menu', async () => {
    const { wrapper } = mountActions();
    await openByClick(wrapper);
    await openByClick(wrapper);
    expect(menu(wrapper).exists()).toBe(false);
  });

  it('Tab out of the menu closes it', async () => {
    const { wrapper } = mountActions();
    await openByClick(wrapper);
    await menu(wrapper).get('[data-action="viewSolution"]').trigger('keydown', { key: 'Tab' });
    expect(menu(wrapper).exists()).toBe(false);
  });
});
