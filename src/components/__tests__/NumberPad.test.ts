import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import NumberPad from '../input/NumberPad.vue';

function mountPad(props: Partial<{ disabled: boolean }> = {}) {
  return mount(NumberPad, { props: { disabled: false, ...props } });
}

describe('NumberPad', () => {
  it('renders keys 0-9, clear and confirm', () => {
    const wrapper = mountPad();
    for (let d = 0; d <= 9; d++) {
      expect(wrapper.find(`button[data-key="${d}"]`).exists()).toBe(true);
    }
    expect(wrapper.find('button[data-key="clear"]').exists()).toBe(true);
    expect(wrapper.find('button[data-key="confirm"]').exists()).toBe(true);
  });

  it('emits digit with the pressed number', async () => {
    const wrapper = mountPad();
    await wrapper.find('button[data-key="7"]').trigger('click');
    await wrapper.find('button[data-key="0"]').trigger('click');
    expect(wrapper.emitted('digit')).toEqual([[7], [0]]);
  });

  it('emits clear and confirm once each', async () => {
    const wrapper = mountPad();
    await wrapper.find('button[data-key="clear"]').trigger('click');
    await wrapper.find('button[data-key="confirm"]').trigger('click');
    expect(wrapper.emitted('clear')).toEqual([[]]);
    expect(wrapper.emitted('confirm')).toEqual([[]]);
  });

  it('disables every key when disabled', async () => {
    const wrapper = mountPad({ disabled: true });
    const buttons = wrapper.findAll('button');
    expect(buttons).toHaveLength(12);
    for (const button of buttons) {
      expect(button.attributes('disabled')).toBeDefined();
    }
    await wrapper.find('button[data-key="3"]').trigger('click');
    expect(wrapper.emitted('digit')).toBeUndefined();
  });

  it('has no pending display of its own: the status bar shows it (UI refresh §4.3)', () => {
    const wrapper = mountPad();
    expect(wrapper.find('[data-pending]').exists()).toBe(false);
    expect(wrapper.find('output').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('輸入中');
  });

  it('labels keys through i18n', () => {
    const wrapper = mountPad();
    expect(wrapper.find('button[data-key="4"]').attributes('aria-label')).toBe('數字 4');
    expect(wrapper.find('button[data-key="clear"]').text()).toBe('清除');
    expect(wrapper.find('button[data-key="confirm"]').text()).toBe('確認');
  });
});
