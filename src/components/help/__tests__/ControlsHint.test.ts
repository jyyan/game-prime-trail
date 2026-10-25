import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import ControlsHint from '../ControlsHint.vue';

type Device = 'touch' | 'pointer';
type Mode = 'trail' | 'direct';

const mountHint = (device: Device, mode: Mode) => mount(ControlsHint, { props: { device, mode } });

// Controls-help spec §4.3: the text follows the device and the current input mode.
describe('ControlsHint', () => {
  it('is a note with the "see help any time" line', () => {
    const w = mountHint('pointer', 'trail');
    const root = w.get('[data-controls-hint]');
    expect(root.attributes('role')).toBe('note');
    expect(root.text()).toContain('隨時可按右上角「？」再看說明');
  });

  it('touch + trail: drag along from the head, drag back to step back; no keys', () => {
    const w = mountHint('touch', 'trail');
    expect(w.text()).toContain('拖曳');
    expect(w.text()).toContain('拖回上一格');
    expect(w.text()).not.toContain('方向鍵');
    expect(w.find('kbd').exists()).toBe(false);
  });

  it('touch + direct: tap a cell, use the number pad, press confirm', () => {
    const w = mountHint('touch', 'direct');
    expect(w.text()).toContain('數字鍵盤');
    expect(w.text()).toContain('「確認」');
    expect(w.find('kbd').exists()).toBe(false);
  });

  it('pointer + trail: arrow keys, Backspace and Tab as <kbd>', () => {
    const w = mountHint('pointer', 'trail');
    expect(w.text()).toContain('方向鍵');
    expect(w.text()).not.toContain('拖曳');
    const keys = w.findAll('kbd').map((k) => k.text());
    expect(keys).toEqual(expect.arrayContaining(['↑', '↓', '←', '→', 'Backspace', 'Tab']));
  });

  it('pointer + direct: digits then Enter; arrows move the selection', () => {
    const w = mountHint('pointer', 'direct');
    expect(w.text()).toContain('移動選取格');
    const keys = w.findAll('kbd').map((k) => k.text());
    expect(keys).toEqual(expect.arrayContaining(['Enter', '↑']));
  });

  it('switches the text when the mode prop changes', async () => {
    const w = mountHint('pointer', 'trail');
    expect(w.text()).toContain('延伸一格');
    await w.setProps({ mode: 'direct' });
    expect(w.text()).not.toContain('延伸一格');
    expect(w.text()).toContain('移動選取格');
  });

  it('the close button has an i18n label and emits dismiss', async () => {
    const w = mountHint('touch', 'trail');
    const close = w.get('[data-action="dismissHint"]');
    expect(close.attributes('aria-label')).toBe('關閉操作提示');
    expect(close.attributes('type')).toBe('button');
    await close.trigger('click');
    expect(w.emitted('dismiss')).toHaveLength(1);
  });
});
