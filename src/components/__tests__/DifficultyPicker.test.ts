import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { Completion, Difficulty, RecordEntry } from '../../core/types';
import DifficultyPicker from '../picker/DifficultyPicker.vue';

const none: Record<Difficulty, Completion> = { easy: 'none', advanced: 'none', challenge: 'none' };
const noBest: Record<Difficulty, RecordEntry | null> = { easy: null, advanced: null, challenge: null };

function entry(partial: Partial<RecordEntry>): RecordEntry {
  return { bestMs: null, bestSteps: null, clears: 0, assistedClears: 0, lastClearedAt: '2026-10-24T00:00:00Z', ...partial };
}

function mountPicker(props: Partial<{ modelValue: Difficulty; completion: Record<Difficulty, Completion>; best: Record<Difficulty, RecordEntry | null> }> = {}) {
  return mount(DifficultyPicker, { props: { modelValue: 'easy', completion: none, best: noBest, ...props } });
}

describe('DifficultyPicker', () => {
  it('renders one entry per difficulty', () => {
    const wrapper = mountPicker();
    const items = wrapper.findAll('[data-difficulty]');
    expect(items.map((item) => item.attributes('data-difficulty'))).toEqual(['easy', 'advanced', 'challenge']);
    expect(wrapper.find('[data-difficulty="advanced"]').text()).toContain('進階');
    for (const item of items) {
      expect(item.find('[data-completion="none"]').exists()).toBe(true);
    }
  });

  it('marks a cleared difficulty', () => {
    const wrapper = mountPicker({ completion: { ...none, easy: 'cleared' } });
    expect(wrapper.find('[data-difficulty="easy"] [data-completion="cleared"]').exists()).toBe(true);
    expect(wrapper.find('[data-difficulty="advanced"] [data-completion="none"]').exists()).toBe(true);
  });

  it('labels an assisted-only clear', () => {
    const wrapper = mountPicker({ completion: { ...none, challenge: 'assisted' } });
    const mark = wrapper.find('[data-difficulty="challenge"] [data-completion="assisted"]');
    expect(mark.exists()).toBe(true);
    expect(wrapper.find('[data-difficulty="challenge"]').text()).toContain('輔助完成');
  });

  it('shows best time and steps', () => {
    const wrapper = mountPicker({ best: { ...noBest, easy: entry({ bestMs: 754_000, bestSteps: 80, clears: 1 }) } });
    const text = wrapper.find('[data-difficulty="easy"]').text();
    expect(text).toContain('最快 12:34');
    expect(text).toContain('最少 80 步');
  });

  it('marks the selected difficulty', () => {
    const wrapper = mountPicker({ modelValue: 'challenge' });
    expect(wrapper.find('[data-difficulty="challenge"]').attributes('aria-pressed')).toBe('true');
    expect(wrapper.find('[data-difficulty="easy"]').attributes('aria-pressed')).toBe('false');
  });

  it('emits update:modelValue on click', async () => {
    const wrapper = mountPicker();
    await wrapper.find('[data-difficulty="advanced"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['advanced']]);
  });
});
