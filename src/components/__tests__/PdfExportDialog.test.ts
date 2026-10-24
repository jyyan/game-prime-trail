import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import type { GameStatus } from '../../core/types';
import { useConfirm } from '../../composables/useConfirm';
import PdfExportDialog from '../game/PdfExportDialog.vue';

const wrappers: VueWrapper[] = [];

async function mountDialog(gameStatus: GameStatus, extra: Record<string, unknown> = {}) {
  const wrapper = mount(PdfExportDialog, {
    props: { modelValue: true, gameStatus, ...extra },
    attachTo: document.body,
  });
  wrappers.push(wrapper);
  await nextTick();
  return wrapper;
}

const checkbox = () => document.body.querySelector<HTMLInputElement>('input[data-include-solution]')!;
const exportButton = () => document.body.querySelector<HTMLButtonElement>('button[data-action="export"]')!;

async function check(): Promise<void> {
  const box = checkbox();
  box.checked = true;
  box.dispatchEvent(new Event('change'));
  await flushPromises();
}

afterEach(() => {
  useConfirm().pending.value?.settle(false);
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('PdfExportDialog', () => {
  it('starts unchecked and exports without the solution', async () => {
    const wrapper = await mountDialog('playing');
    expect(document.body.querySelector('.modal-title')?.textContent).toBe('匯出 PDF');
    expect(checkbox().checked).toBe(false);
    exportButton().click();
    expect(wrapper.emitted('export')).toEqual([[{ includeSolution: false }]]);
  });

  it('does not confirm while idle', async () => {
    const wrapper = await mountDialog('idle');
    await check();
    expect(useConfirm().pending.value).toBeNull();
    expect(wrapper.emitted('markAssisted')).toBeUndefined();
    expect(checkbox().checked).toBe(true);
    exportButton().click();
    expect(wrapper.emitted('export')).toEqual([[{ includeSolution: true }]]);
  });

  it('does not confirm after winning', async () => {
    const wrapper = await mountDialog('won');
    await check();
    expect(useConfirm().pending.value).toBeNull();
    expect(wrapper.emitted('markAssisted')).toBeUndefined();
    expect(checkbox().checked).toBe(true);
  });

  it('confirms while playing and marks assisted on OK', async () => {
    const wrapper = await mountDialog('playing');
    await check();
    const pending = useConfirm().pending.value;
    expect(pending).not.toBeNull();
    expect(pending?.message).toBe('匯出含解答的 PDF 後，這局不列入最佳紀錄。');
    expect(exportButton().disabled).toBe(true);
    pending!.settle(true);
    await flushPromises();
    expect(wrapper.emitted('markAssisted')).toEqual([[]]);
    expect(checkbox().checked).toBe(true);
    exportButton().click();
    expect(wrapper.emitted('export')).toEqual([[{ includeSolution: true }]]);
  });

  it('unchecks when the confirmation is cancelled', async () => {
    const wrapper = await mountDialog('playing');
    await check();
    useConfirm().pending.value!.settle(false);
    await flushPromises();
    expect(wrapper.emitted('markAssisted')).toBeUndefined();
    expect(checkbox().checked).toBe(false);
    exportButton().click();
    expect(wrapper.emitted('export')).toEqual([[{ includeSolution: false }]]);
  });

  it('skips the confirmation when the game is already assisted', async () => {
    const wrapper = await mountDialog('playing', { assisted: true });
    await check();
    expect(useConfirm().pending.value).toBeNull();
    expect(wrapper.emitted('markAssisted')).toBeUndefined();
    expect(checkbox().checked).toBe(true);
  });

  it('resets the option each time it opens', async () => {
    const wrapper = await mountDialog('idle');
    await check();
    await wrapper.setProps({ modelValue: false });
    await wrapper.setProps({ modelValue: true });
    expect(checkbox().checked).toBe(false);
  });

  it('closes via the cancel button', async () => {
    const wrapper = await mountDialog('idle');
    document.body.querySelector<HTMLButtonElement>('button[data-action="cancel"]')!.click();
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });
});
