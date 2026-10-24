import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import InputModeToggle from '../input/InputModeToggle.vue';

describe('InputModeToggle', () => {
  it('renders both modes and marks the active one', () => {
    const wrapper = mount(InputModeToggle, { props: { modelValue: 'trail' } });
    const trail = wrapper.find('[data-mode="trail"]');
    const direct = wrapper.find('[data-mode="direct"]');
    expect(trail.text()).toBe('接續模式');
    expect(direct.text()).toBe('指定模式');
    expect(trail.attributes('aria-pressed')).toBe('true');
    expect(direct.attributes('aria-pressed')).toBe('false');
  });

  it('gives both buttons the stretch class so they split the row (GAME-27)', () => {
    const wrapper = mount(InputModeToggle, { props: { modelValue: 'trail' } });
    const buttons = wrapper.findAll('button[data-mode]');
    expect(buttons).toHaveLength(2);
    for (const b of buttons) expect(b.classes()).toContain('pt-mode-toggle__btn');
  });

  it('emits update:modelValue when another mode is picked', async () => {
    const wrapper = mount(InputModeToggle, { props: { modelValue: 'trail' } });
    await wrapper.find('[data-mode="direct"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['direct']]);
  });

  it('does not emit when the active mode is clicked again', async () => {
    const wrapper = mount(InputModeToggle, { props: { modelValue: 'direct' } });
    await wrapper.find('[data-mode="direct"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toBeUndefined();
  });
});
