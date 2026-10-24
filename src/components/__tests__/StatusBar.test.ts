import { mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import StatusBar from '../ui/StatusBar.vue';

const base = { steps: 57, assisted: false, mode: 'trail', next: 12, pending: '' } as const;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('StatusBar', () => {
  it('renders the steps; map, difficulty and time live in the top bar now', () => {
    const wrapper = mount(StatusBar, { props: base });
    const text = wrapper.text();
    expect(wrapper.get('[data-steps]').text()).toBe('步數 57');
    expect(text).not.toContain('地圖');
    expect(text).not.toMatch(/\d\d:\d\d/);
  });

  it('trail mode shows "next: n" in the big number style', () => {
    const wrapper = mount(StatusBar, { props: base });
    expect(wrapper.get('[data-next]').text()).toBe('下一個：12');
    expect(wrapper.get('[data-next-value]').classes()).toContain('pt-num');
    expect(wrapper.find('[data-pending]').exists()).toBe(false);
  });

  it('trail mode hides "next" once the head is 100', () => {
    const wrapper = mount(StatusBar, { props: { ...base, next: null } });
    expect(wrapper.find('[data-next]').exists()).toBe(false);
    expect(wrapper.get('[data-steps]').text()).toBe('步數 57');
  });

  it('direct mode shows the pending digits instead of "next", up to the three-digit 100', async () => {
    const wrapper = mount(StatusBar, { props: { ...base, mode: 'direct', pending: '' } });
    expect(wrapper.find('[data-next]').exists()).toBe(false);
    expect(wrapper.get('[data-pending-box]').text()).toContain('輸入中：');
    expect(wrapper.get('[data-pending]').text()).toBe('');
    for (const pending of ['1', '10', '100']) {
      await wrapper.setProps({ pending });
      expect(wrapper.get('[data-pending]').text()).toBe(pending);
    }
  });

  it('a bumped rejectSeq flashes the pending box and announces why, then clears', async () => {
    const wrapper = mount(StatusBar, { props: { ...base, mode: 'direct', pending: '100', rejectSeq: 0 } });
    expect(wrapper.get('[data-pending-box]').classes()).not.toContain('is-rejected');
    await wrapper.setProps({ rejectSeq: 1 });
    expect(wrapper.get('[data-pending-box]').classes()).toContain('is-rejected');
    expect(wrapper.get('[data-pending-rejected]').text()).toBe('數字超出 1 到 100，這一鍵沒有輸入');
    expect(wrapper.get('[data-pending]').text()).toBe('100');
    vi.advanceTimersByTime(300);
    await wrapper.vm.$nextTick();
    expect(wrapper.get('[data-pending-box]').classes()).not.toContain('is-rejected');
    expect(wrapper.find('[data-pending-rejected]').exists()).toBe(false);
  });

  it('hides the assisted badge by default', () => {
    const wrapper = mount(StatusBar, { props: base });
    expect(wrapper.find('[data-assisted]').exists()).toBe(false);
  });

  it('shows the assisted badge when assisted', () => {
    const wrapper = mount(StatusBar, { props: { ...base, assisted: true } });
    const badge = wrapper.find('.badge[data-assisted]');
    expect(badge.exists()).toBe(true);
    expect(badge.text()).toBe('輔助中・不列入最佳紀錄');
  });

  it('styles the assisted badge with its own token class, not a missing Bootstrap helper', () => {
    // GAME-27: .text-bg-* is not in the slimmed Bootstrap build, which left white text on white.
    const wrapper = mount(StatusBar, { props: { ...base, assisted: true } });
    const badge = wrapper.get('[data-assisted]');
    expect(badge.classes()).toContain('pt-status-bar__assisted');
    expect(badge.attributes('class')).not.toMatch(/text-bg-/);
  });
});
