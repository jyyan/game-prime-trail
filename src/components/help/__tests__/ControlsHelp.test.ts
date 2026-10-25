import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import ControlsHelp from '../ControlsHelp.vue';

const wrappers: VueWrapper[] = [];

async function mountHelp(device: 'touch' | 'pointer', modelValue = true) {
  const wrapper = mount(ControlsHelp, { props: { device, modelValue }, attachTo: document.body });
  wrappers.push(wrapper);
  await nextTick();
  return wrapper;
}

const sections = () =>
  [...document.body.querySelectorAll<HTMLElement>('.modal [data-help-section]')].map((s) => s.dataset.helpSection);
const section = (name: string) => document.body.querySelector<HTMLElement>(`.modal [data-help-section="${name}"]`)!;

afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount());
  document.body.innerHTML = '';
  document.body.className = '';
});

// Controls-help spec §5: both device sections, the current device first, then the shared buttons.
describe('ControlsHelp', () => {
  it('renders nothing while closed', async () => {
    await mountHelp('pointer', false);
    expect(document.body.querySelector('.modal')).toBeNull();
  });

  it('is a dialog titled 操作說明', async () => {
    await mountHelp('pointer');
    const modal = document.body.querySelector('.modal')!;
    expect(modal.getAttribute('role')).toBe('dialog');
    expect(modal.querySelector('.modal-title')!.textContent).toBe('操作說明');
  });

  it('touch: the touch section comes first, both are present', async () => {
    await mountHelp('touch');
    expect(sections()).toEqual(['touch', 'pointer', 'shared']);
  });

  it('pointer: the pointer section comes first, both are present', async () => {
    await mountHelp('pointer');
    expect(sections()).toEqual(['pointer', 'touch', 'shared']);
  });

  it('each device section has a trail and a direct part', async () => {
    await mountHelp('pointer');
    for (const name of ['touch', 'pointer']) {
      expect(section(name).textContent).toContain('接續模式');
      expect(section(name).textContent).toContain('指定模式');
    }
  });

  it('covers the touch operations of main spec §7.3', async () => {
    await mountHelp('touch');
    const text = section('touch').textContent!;
    for (const s of ['延伸一格', '拖曳', '退一步', '數字鍵盤', '「確認」', '「清除」']) expect(text).toContain(s);
    expect(section('touch').querySelector('kbd')).toBeNull();
  });

  it('covers the keyboard operations of main spec §7.3 with <kbd> keys', async () => {
    await mountHelp('pointer');
    const keys = [...section('pointer').querySelectorAll('kbd')].map((k) => k.textContent);
    for (const k of ['↑', '↓', '←', '→', 'Backspace', 'Delete', 'Tab', 'Ctrl', 'Cmd', 'Z', '0–9', 'Enter']) {
      expect(keys).toContain(k);
    }
    expect(section('pointer').textContent).toContain('移動選取格');
  });

  it('the shared part covers undo, hint and the more menu', async () => {
    await mountHelp('pointer');
    const text = section('shared').textContent!;
    for (const s of ['「復原」', '「提示」', '「看解答」', '「匯出 PDF」', '「重新開始」']) expect(text).toContain(s);
  });

  it('the close button asks to close', async () => {
    const w = await mountHelp('pointer');
    document.body.querySelector<HTMLButtonElement>('.modal .btn-close')!.click();
    await nextTick();
    expect(w.emitted('update:modelValue')).toEqual([[false]]);
  });
});
