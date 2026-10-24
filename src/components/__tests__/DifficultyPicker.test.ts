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
    const mark = wrapper.find('[data-difficulty="easy"] [data-completion="cleared"]');
    expect(mark.exists()).toBe(true);
    expect(mark.text()).toContain('✔');
    expect(mark.text()).not.toContain('輔助完成');
    expect(wrapper.find('[data-difficulty="advanced"] [data-completion="none"]').text()).toBe('');
  });

  it('labels an assisted-only clear', () => {
    const wrapper = mountPicker({ completion: { ...none, challenge: 'assisted' } });
    const mark = wrapper.find('[data-difficulty="challenge"] [data-completion="assisted"]');
    expect(mark.exists()).toBe(true);
    expect(mark.text()).toContain('✓');
    expect(mark.text()).toContain('輔助完成');
    expect(mark.text()).not.toContain('✔');
    expect(wrapper.find('[data-difficulty="easy"]').text()).not.toContain('輔助完成');
  });

  it('shows best time and steps', () => {
    const wrapper = mountPicker({ best: { ...noBest, easy: entry({ bestMs: 754_000, bestSteps: 80, clears: 1 }) } });
    const text = wrapper.find('[data-difficulty="easy"]').text();
    expect(text).toContain('最快 12:34');
    expect(text).toContain('最少 80 步');
  });

  it('marks the selected difficulty', async () => {
    const wrapper = mountPicker({ modelValue: 'challenge' });
    const challenge = () => wrapper.find('[data-difficulty="challenge"]');
    const easy = () => wrapper.find('[data-difficulty="easy"]');
    expect(challenge().attributes('aria-pressed')).toBe('true');
    expect(challenge().classes()).toContain('btn-primary');
    expect(easy().attributes('aria-pressed')).toBe('false');
    expect(easy().classes()).toContain('btn-outline-primary');
    expect(easy().classes()).not.toContain('btn-primary');
    await wrapper.setProps({ modelValue: 'easy' });
    expect(easy().attributes('aria-pressed')).toBe('true');
    expect(easy().classes()).toContain('btn-primary');
    expect(challenge().attributes('aria-pressed')).toBe('false');
  });

  it('shows only the parts of a best record that exist', () => {
    const wrapper = mountPicker({
      best: {
        easy: entry({ assistedClears: 1 }),
        advanced: entry({ bestMs: 61_000, clears: 1 }),
        challenge: entry({ bestSteps: 95, clears: 1 }),
      },
    });
    expect(wrapper.find('[data-difficulty="easy"] [data-best]').text()).toBe('');
    expect(wrapper.find('[data-difficulty="advanced"] [data-best]').text()).toBe('最快 01:01');
    expect(wrapper.find('[data-difficulty="challenge"] [data-best]').text()).toBe('最少 95 步');
  });

  it('shows no best text without a record', () => {
    const wrapper = mountPicker();
    for (const item of wrapper.findAll('[data-best]')) expect(item.text()).toBe('');
  });

  it('emits update:modelValue on click', async () => {
    const wrapper = mountPicker();
    await wrapper.find('[data-difficulty="advanced"]').trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['advanced']]);
  });
});
