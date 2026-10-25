import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { defineComponent } from 'vue';
import { FIXTURE_RECORD } from '../../core/__fixtures__/level-fixture';
import { CELL_COUNT, type SavedProgress } from '../../core/types';
import { useLevelStore } from '../../composables/useLevelStore';
import { useProgress } from '../../composables/useProgress';
import { useRecords } from '../../composables/useRecords';
import { t } from '../../i18n';
import HomeView from '../HomeView.vue';

const Stub = defineComponent({ template: '<div />' });

function fixtureFile(count = 1) {
  return {
    schema: 1,
    libraryVersion: 1,
    generator: 't',
    masterSeed: 's',
    count,
    levels: Array.from({ length: count }, () => FIXTURE_RECORD),
  };
}

function snap(): SavedProgress {
  const grid = new Array<number>(CELL_COUNT).fill(0);
  grid[FIXTURE_RECORD.s] = 1;
  return { grid, steps: 3, elapsedMs: 4000, assisted: false, inputMode: 'trail', savedAt: new Date().toISOString() };
}

let router: Router;

async function mountHome(loader: (() => Promise<unknown>) | null = () => Promise.resolve(fixtureFile())) {
  useLevelStore().__setLoader(loader);
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: HomeView },
      { path: '/play/:id(\\d+)/:difficulty(easy|advanced|challenge)', name: 'play', component: Stub },
    ],
  });
  await router.push('/');
  await router.isReady();
  const wrapper = mount(HomeView, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

async function typeId(wrapper: Awaited<ReturnType<typeof mountHome>>, id: string) {
  await wrapper.find('input[data-level-id]').setValue(id);
}

// v-show toggles an inline `display: none`; read it directly (isVisible() is unreliable on detached mounts).
function rulesShown(wrapper: Awaited<ReturnType<typeof mountHome>>): boolean {
  const body = wrapper.find('[data-rules-body]');
  return body.exists() && !(body.attributes('style') ?? '').includes('display: none');
}

describe('HomeView', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('loads the library on mount and renders LevelPicker when ready', async () => {
    const wrapper = await mountHome();
    expect(useLevelStore().status.value).toBe('ready');
    expect(wrapper.find('.pt-level-picker').exists()).toBe(true);
    expect(wrapper.find('[data-state="missing"]').exists()).toBe(false);
  });

  it('marks a normal clear as cleared for the typed id', async () => {
    useRecords(1).recordClear(1, 'easy', { elapsedMs: 1000, steps: 74, assisted: false });
    const wrapper = await mountHome();
    await typeId(wrapper, '1');
    expect(wrapper.find('[data-difficulty="easy"] [data-completion="cleared"]').exists()).toBe(true);
    expect(wrapper.find('[data-difficulty="advanced"] [data-completion="none"]').exists()).toBe(true);
    expect(wrapper.find('[data-difficulty="easy"] [data-best]').text()).toContain('74');
  });

  it('marks an assisted-only clear as assisted', async () => {
    useRecords(1).recordClear(1, 'easy', { elapsedMs: 1000, steps: 74, assisted: true });
    const wrapper = await mountHome();
    await typeId(wrapper, '1');
    expect(wrapper.find('[data-difficulty="easy"] [data-completion="assisted"]').exists()).toBe(true);
  });

  it('shows "continue" for lastPlayed and navigates to it', async () => {
    useProgress(1).save(1, 'advanced', snap());
    const wrapper = await mountHome();
    const resume = wrapper.find('button[data-action="resume"]');
    expect(resume.exists()).toBe(true);
    expect(resume.text()).toContain('#0001・進階');
    await resume.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/play/1/advanced');
  });

  it('hides "continue" when lastPlayed points to a save that no longer exists', async () => {
    useProgress(1).save(1, 'advanced', snap());
    // Drop the progress map but keep the lastPlayed pointer (spec §7.5, backlog R21).
    localStorage.removeItem('prime-trail:v1:L1:progress');
    expect(useProgress(1).lastPlayed()).not.toBeNull();
    const wrapper = await mountHome();
    expect(wrapper.find('button[data-action="resume"]').exists()).toBe(false);
  });

  it('hides "continue" when nothing was played', async () => {
    const wrapper = await mountHome();
    expect(wrapper.find('button[data-action="resume"]').exists()).toBe(false);
  });

  it('start navigates to /play/:id/:difficulty', async () => {
    const wrapper = await mountHome();
    await typeId(wrapper, '1');
    await wrapper.find('button[data-action="start"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.fullPath).toBe('/play/1/easy');
  });

  it('random fills an id within 1…count', async () => {
    const wrapper = await mountHome(() => Promise.resolve(fixtureFile(3)));
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    await wrapper.find('button[data-action="random"]').trigger('click');
    expect((wrapper.find('input[data-level-id]').element as HTMLInputElement).value).toBe('3');
    vi.spyOn(Math, 'random').mockReturnValue(0);
    await wrapper.find('button[data-action="random"]').trigger('click');
    expect((wrapper.find('input[data-level-id]').element as HTMLInputElement).value).toBe('1');
    expect(wrapper.find('button[data-action="start"]').attributes('disabled')).toBeUndefined();
  });

  it('shows the missing illustration and explanation when the library is missing', async () => {
    const wrapper = await mountHome(null);
    expect(useLevelStore().status.value).toBe('missing');
    expect(wrapper.find('.pt-level-picker').exists()).toBe(false);
    const missing = wrapper.find('[data-state="missing"]');
    expect(missing.text()).toContain(t('home.missingTitle'));
    expect(missing.text()).toContain(t('home.missingBody'));
    const img = missing.find('img[data-missing-img]');
    expect(img.attributes('src')).toBe('/illustrations/missing.webp');
    expect(img.attributes('alt')).toBe(t('home.missingAlt'));
    expect(img.attributes('width')).toBeDefined();
    expect(img.attributes('height')).toBeDefined();
  });

  it('renders the hero illustration, title and subtitle', async () => {
    const wrapper = await mountHome();
    const img = wrapper.find('img[data-hero]');
    expect(img.attributes('src')).toBe('/illustrations/hero.webp');
    expect(img.attributes('alt')).toBe(t('home.heroAlt'));
    expect(img.attributes('width')).toBeDefined();
    expect(img.attributes('height')).toBeDefined();
    expect(wrapper.find('h1').text()).toBe('Prime Trail');
    expect(wrapper.text()).toContain(t('home.subtitle'));
  });

  it('shows the three rules expanded by default', async () => {
    const wrapper = await mountHome();
    const toggle = wrapper.find('button[data-action="toggleRules"]');
    expect(toggle.attributes('aria-expanded')).toBe('true');
    const body = wrapper.find('[data-rules-body]');
    expect(rulesShown(wrapper)).toBe(true);
    expect(body.findAll('li').map((li) => li.text())).toEqual([t('home.rule1'), t('home.rule2'), t('home.rule3')]);
    expect(toggle.attributes('aria-controls')).toBe(body.attributes('id'));
  });

  it('remembers the collapsed rules card in prime-trail:v1:ui', async () => {
    localStorage.setItem('prime-trail:v1:ui', JSON.stringify({ other: 1 }));
    const wrapper = await mountHome();
    await wrapper.find('button[data-action="toggleRules"]').trigger('click');
    expect(rulesShown(wrapper)).toBe(false);
    expect(wrapper.find('button[data-action="toggleRules"]').attributes('aria-expanded')).toBe('false');
    expect(JSON.parse(localStorage.getItem('prime-trail:v1:ui')!)).toEqual({ other: 1, rulesCollapsed: true });
    wrapper.unmount();

    const again = await mountHome();
    expect(rulesShown(again)).toBe(false);
    await again.find('button[data-action="toggleRules"]').trigger('click');
    expect(rulesShown(again)).toBe(true);
    expect(JSON.parse(localStorage.getItem('prime-trail:v1:ui')!)).toEqual({ other: 1, rulesCollapsed: false });
  });

  it('ignores a broken ui entry and keeps the rules expanded', async () => {
    localStorage.setItem('prime-trail:v1:ui', '{oops');
    const wrapper = await mountHome();
    expect(rulesShown(wrapper)).toBe(true);
  });

  it('shows no error for the empty field on first load (R30)', async () => {
    const wrapper = await mountHome();
    expect(wrapper.find('button[data-action="start"]').attributes('disabled')).toBeDefined();
    expect(wrapper.find('[data-invalid-id]').exists()).toBe(false);
    await wrapper.find('input[data-level-id]').trigger('blur');
    expect(wrapper.find('[data-invalid-id]').exists()).toBe(false);
  });

  it('shows the error for an out-of-range id after blur', async () => {
    const wrapper = await mountHome(() => Promise.resolve(fixtureFile(3)));
    await typeId(wrapper, '4');
    expect(wrapper.find('[data-invalid-id]').exists()).toBe(false);
    await wrapper.find('input[data-level-id]').trigger('blur');
    expect(wrapper.find('[data-invalid-id]').text()).toBe(t('picker.invalidId', { max: 3 }));
  });

  it('keeps the demo button visible when the rules card is collapsed', async () => {
    const wrapper = await mountHome();
    const demo = () => wrapper.find('[data-rules] button[data-action="demo"]');
    expect(demo().exists()).toBe(true);
    expect(demo().text()).toBe(t('demo.open'));
    await wrapper.find('button[data-action="toggleRules"]').trigger('click');
    expect(rulesShown(wrapper)).toBe(false);
    expect(demo().exists()).toBe(true);
    // Not inside the collapsible body, so v-show does not hide it.
    expect(wrapper.find('[data-rules-body] button[data-action="demo"]').exists()).toBe(false);
    expect(demo().attributes('style') ?? '').not.toContain('display: none');
    expect(demo().attributes('disabled')).toBeUndefined();
  });

  it('opens the demo dialog from the demo button', async () => {
    const wrapper = await mountHome();
    // Only the wiring is checked here (playback and the error line are covered by DemoDialog.test.ts).
    expect(document.body.querySelector('[data-demo]')).toBeNull();
    await wrapper.find('button[data-action="demo"]').trigger('click');
    await flushPromises();
    expect(document.body.querySelector('[role="dialog"] [data-demo]')).not.toBeNull();
    expect(document.body.querySelector('.modal-title')?.textContent).toBe(t('demo.title'));
    (document.body.querySelector('.btn-close') as HTMLButtonElement).click();
    await flushPromises();
    expect(document.body.querySelector('[data-demo]')).toBeNull();
    wrapper.unmount();
  });

  it('shows the demo button busy while the library loads', async () => {
    const wrapper = await mountHome(() => new Promise(() => {}));
    const demo = wrapper.find('button[data-action="demo"]');
    expect(demo.attributes('disabled')).toBeDefined();
    expect(demo.attributes('aria-busy')).toBe('true');
  });

  it('shows a load error when the library fails to parse', async () => {
    const wrapper = await mountHome(() => Promise.resolve({ schema: 999 }));
    expect(useLevelStore().status.value).toBe('error');
    expect(wrapper.find('.pt-level-picker').exists()).toBe(false);
    expect(wrapper.find('[data-state="error"]').text()).toBe(t('home.loadError'));
  });
});
