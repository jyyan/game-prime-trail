import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import StatusBar from '../ui/StatusBar.vue';

const base = { levelId: 123, difficulty: 'advanced', elapsedMs: 754_000, steps: 57, assisted: false } as const;

describe('StatusBar', () => {
  it('renders level, difficulty, time and steps', () => {
    const wrapper = mount(StatusBar, { props: base });
    const text = wrapper.text();
    expect(text).toContain('地圖 #0123');
    expect(text).toContain('進階');
    expect(text).toContain('12:34');
    expect(text).toContain('步數 57');
    expect(text).toContain('地圖 #0123・進階・12:34・步數 57');
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
});
