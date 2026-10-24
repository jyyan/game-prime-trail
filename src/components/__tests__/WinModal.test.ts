import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import WinModal from '../game/WinModal.vue';

const wrappers: VueWrapper[] = [];

const base = {
  modelValue: true,
  levelId: 7,
  difficulty: 'easy' as const,
  elapsedMs: 754_000,
  steps: 81,
  best: { bestMs: 754_000, bestSteps: 90 } as { bestMs: number | null; bestSteps: number | null } | null,
  isNewBest: { time: true, steps: false },
  assisted: false,
};

async function mountModal(props: Partial<typeof base> & Record<string, unknown> = {}) {
  const wrapper = mount(WinModal, { props: { ...base, ...props }, attachTo: document.body });
  wrappers.push(wrapper);
  await nextTick();
  return wrapper;
}

const q = <T extends HTMLElement = HTMLElement>(selector: string) => document.body.querySelector<T>(selector);

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
  document.body.innerHTML = '';
  document.body.className = '';
});

describe('WinModal', () => {
  it('renders nothing while closed', async () => {
    await mountModal({ modelValue: false });
    expect(q('.modal')).toBeNull();
  });

  it('shows the result and the new-best badge', async () => {
    await mountModal();
    expect(q('.modal-title')?.textContent).toBe('過關！');
    const body = q('.modal')?.textContent ?? '';
    expect(body).toContain('地圖 #0007');
    expect(body).toContain('簡單');
    expect(body).toContain('時間 12:34');
    expect(body).toContain('步數 81');
    expect(body).toContain('最快紀錄 12:34');
    expect(body).toContain('最少步數 90');
    expect(q('[data-new-best="time"]')?.textContent).toBe('新的最快紀錄');
    expect(q('[data-new-best="steps"]')).toBeNull();
    expect(body).not.toContain('本局不列入最佳紀錄');
  });

  it('switches to the assisted variant without badges', async () => {
    await mountModal({ assisted: true, isNewBest: { time: true, steps: true } });
    expect(q('.modal-title')?.textContent).toBe('輔助完成');
    expect(q('[data-new-best]')).toBeNull();
    expect(q('[data-not-recorded]')?.textContent).toBe('本局不列入最佳紀錄');
  });

  it('shows the steps badge for a new fewest-steps record', async () => {
    await mountModal({ isNewBest: { time: false, steps: true } });
    expect(q('[data-steps] [data-new-best="steps"]')?.textContent).toBe('新的最少步數');
    expect(q('[data-new-best="time"]')).toBeNull();
  });

  it('shows both badges when both records are new', async () => {
    await mountModal({ isNewBest: { time: true, steps: true } });
    expect(q('[data-time] [data-new-best="time"]')).not.toBeNull();
    expect(q('[data-steps] [data-new-best="steps"]')).not.toBeNull();
  });

  it('shows no badges when nothing is new', async () => {
    await mountModal({ isNewBest: { time: false, steps: false } });
    expect(q('[data-new-best]')).toBeNull();
  });

  it('shows only the best time when best steps is null', async () => {
    await mountModal({ best: { bestMs: 61_000, bestSteps: null } });
    expect(q('[data-best]')?.textContent).toBe('最快紀錄 01:01');
  });

  it('shows only the best steps when best time is null', async () => {
    await mountModal({ best: { bestMs: null, bestSteps: 95 } });
    expect(q('[data-best]')?.textContent).toBe('最少步數 95');
  });

  it('omits the best line when both best values are null', async () => {
    await mountModal({ best: { bestMs: null, bestSteps: null } });
    expect(q('[data-best]')).toBeNull();
  });

  it('omits the best line when there is no record', async () => {
    await mountModal({ best: null, isNewBest: { time: false, steps: false } });
    expect(q('[data-best]')).toBeNull();
  });

  it('emits one event per action button', async () => {
    const wrapper = await mountModal();
    const actions = ['viewSolution', 'nextRandom', 'backHome', 'exportPdf'] as const;
    for (const action of actions) {
      q(`button[data-action="${action}"]`)!.click();
    }
    for (const action of actions) {
      expect(wrapper.emitted(action), action).toEqual([[]]);
    }
  });

  it('shows the win illustration with a size and Chinese alt text', async () => {
    await mountModal();
    const img = q<HTMLImageElement>('img[data-win-art]');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toMatch(/illustrations\/win\.webp$/);
    expect(img!.getAttribute('width')).toBe('140');
    expect(img!.getAttribute('height')).toBe('140');
    expect(img!.getAttribute('alt')).toBe('小龍舉手歡呼，身旁有獎盃和彩帶');
  });

  it('renders time and steps as large Fredoka numbers with their labels', async () => {
    await mountModal();
    const time = q('[data-time]')!;
    const steps = q('[data-steps]')!;
    expect(time.querySelector('.pt-win__label')?.textContent).toBe('時間');
    expect(time.querySelector('.pt-win__value.pt-num')?.textContent).toBe('12:34');
    expect(steps.querySelector('.pt-win__label')?.textContent).toBe('步數');
    expect(steps.querySelector('.pt-win__value.pt-num')?.textContent).toBe('81');
    // Screen readers and text queries still read "label value" with one space between.
    expect(time.textContent).toContain('時間 12:34');
    expect(steps.textContent).toContain('步數 81');
  });

  it('styles new-record badges with the pink badge class, not a Bootstrap colour', async () => {
    await mountModal({ isNewBest: { time: true, steps: true } });
    for (const badge of document.body.querySelectorAll('[data-new-best]')) {
      expect(badge.classList.contains('pt-win__badge')).toBe(true);
      expect(badge.className).not.toMatch(/text-bg-/);
    }
  });

  it('makes next-random the only primary button and puts it first', async () => {
    await mountModal();
    const buttons = [...document.body.querySelectorAll<HTMLButtonElement>('.modal-footer button')];
    expect(buttons.map((b) => b.dataset.action)).toEqual(['nextRandom', 'viewSolution', 'exportPdf', 'backHome']);
    expect(document.body.querySelectorAll('.modal-footer .btn-primary')).toHaveLength(1);
    expect(buttons[0].classList.contains('btn-primary')).toBe(true);
    for (const b of buttons.slice(1)) expect(b.classList.contains('btn-outline-secondary')).toBe(true);
  });

  it('focuses the next-random button when opened', async () => {
    await mountModal();
    await nextTick();
    expect(document.activeElement).toBe(q('[data-action="nextRandom"]'));
  });

  it('forwards close requests as update:modelValue', async () => {
    const wrapper = await mountModal();
    q('.btn-close')!.click();
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]]);
  });
});
