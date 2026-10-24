import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { Completion, Difficulty, LastPlayed, RecordEntry } from '../../core/types';
import LevelPicker from '../picker/LevelPicker.vue';

interface Props {
  modelValue: number | null;
  count: number;
  completion: (id: number, d: Difficulty) => Completion;
  best: (id: number, d: Difficulty) => RecordEntry | null;
  lastPlayed: LastPlayed | null;
  canResume: boolean;
}

function mountPicker(props: Partial<Props> = {}) {
  return mount(LevelPicker, {
    props: {
      modelValue: null,
      count: 1000,
      completion: () => 'none',
      best: () => null,
      lastPlayed: null,
      canResume: false,
      ...props,
    },
  });
}

const startButton = (wrapper: ReturnType<typeof mountPicker>) => wrapper.find('button[data-action="start"]');

describe('LevelPicker', () => {
  it('disables start and explains an out-of-range id', () => {
    const wrapper = mountPicker({ modelValue: 0 });
    expect(startButton(wrapper).attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-invalid-id]').text()).toBe('請輸入 1 到 1000 的地圖編號');
  });

  it('disables start for ids above count and non-integers', async () => {
    const wrapper = mountPicker({ modelValue: 1001 });
    expect(startButton(wrapper).attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-invalid-id]').exists()).toBe(true);
    await wrapper.setProps({ modelValue: 2.5 });
    expect(startButton(wrapper).attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-invalid-id]').exists()).toBe(true);
    await wrapper.setProps({ modelValue: 1000 });
    expect(startButton(wrapper).attributes('disabled')).toBeUndefined();
    expect(wrapper.find('[data-invalid-id]').exists()).toBe(false);
  });

  it('treats an empty field as an invalid id', () => {
    const wrapper = mountPicker({ modelValue: null });
    expect(startButton(wrapper).attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-invalid-id]').text()).toBe('請輸入 1 到 1000 的地圖編號');
  });

  it('does not emit start for an invalid id, even via Enter', async () => {
    const wrapper = mountPicker({ modelValue: 2.5 });
    await wrapper.find('input[data-level-id]').trigger('keydown', { key: 'Enter' });
    await startButton(wrapper).trigger('click');
    expect(wrapper.emitted('start')).toBeUndefined();
  });

  it('emits start with the id and the current difficulty', async () => {
    const wrapper = mountPicker({ modelValue: 5 });
    expect(wrapper.find('[data-invalid-id]').exists()).toBe(false);
    await startButton(wrapper).trigger('click');
    expect(wrapper.emitted('start')).toEqual([[5, 'easy']]);
    await wrapper.find('[data-difficulty="challenge"]').trigger('click');
    await startButton(wrapper).trigger('click');
    expect(wrapper.emitted('start')?.[1]).toEqual([5, 'challenge']);
  });

  it('emits update:modelValue from the id field', async () => {
    const wrapper = mountPicker();
    const field = wrapper.find('input[data-level-id]');
    await field.setValue('42');
    await field.setValue('');
    expect(wrapper.emitted('update:modelValue')).toEqual([[42], [null]]);
  });

  it('parses decimal, padded and non-numeric field input', async () => {
    const wrapper = mountPicker();
    const field = wrapper.find('input[data-level-id]');
    await field.setValue('2.5');
    await field.setValue('007');
    // jsdom sanitises number inputs; override `value` to feed raw text through the parser.
    Object.defineProperty(field.element, 'value', { configurable: true, get: () => ' abc ' });
    await field.trigger('input');
    Object.defineProperty(field.element, 'value', { configurable: true, get: () => ' 12 ' });
    await field.trigger('input');
    expect(wrapper.emitted('update:modelValue')).toEqual([[2.5], [7], [null], [12]]);
  });

  it('keeps start disabled after a decimal is typed', async () => {
    const wrapper = mountPicker();
    await wrapper.find('input[data-level-id]').setValue('2.5');
    const [typed] = wrapper.emitted<[number | null]>('update:modelValue')![0];
    await wrapper.setProps({ modelValue: typed });
    expect(startButton(wrapper).attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-invalid-id]').exists()).toBe(true);
  });

  it('shows completion and best for the selected id', () => {
    const wrapper = mountPicker({
      modelValue: 5,
      completion: (id, d) => (id === 5 && d === 'easy' ? 'cleared' : 'none'),
      best: (id, d) =>
        id === 5 && d === 'easy'
          ? { bestMs: 61_000, bestSteps: 90, clears: 1, assistedClears: 0, lastClearedAt: '2026-10-24T00:00:00Z' }
          : null,
    });
    expect(wrapper.find('[data-difficulty="easy"] [data-completion="cleared"]').exists()).toBe(true);
    expect(wrapper.find('[data-difficulty="easy"]').text()).toContain('最快 01:01');
  });

  it('shows no completion for an invalid id', () => {
    const wrapper = mountPicker({ modelValue: 0, completion: () => 'cleared' });
    expect(wrapper.find('[data-completion="cleared"]').exists()).toBe(false);
  });

  it('offers resume only when canResume', async () => {
    const lastPlayed: LastPlayed = { levelId: 123, difficulty: 'advanced', savedAt: '2026-10-24T00:00:00Z' };
    const wrapper = mountPicker({ canResume: true, lastPlayed });
    const resume = wrapper.find('button[data-action="resume"]');
    expect(resume.exists()).toBe(true);
    expect(resume.text()).toContain('#0123・進階');
    await resume.trigger('click');
    expect(wrapper.emitted('resume')).toEqual([[123, 'advanced']]);

    await wrapper.setProps({ canResume: false });
    expect(wrapper.find('button[data-action="resume"]').exists()).toBe(false);
  });

  it('emits random', async () => {
    const wrapper = mountPicker();
    await wrapper.find('button[data-action="random"]').trigger('click');
    expect(wrapper.emitted('random')).toEqual([[]]);
  });
});
