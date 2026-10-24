import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import App from '../App.vue';
import router from '../router';

describe('smoke', () => {
  it('mounts App with the router', async () => {
    router.push('/');
    await router.isReady();
    const wrapper = mount(App, { global: { plugins: [router] } });
    expect(wrapper.html()).toContain('<main');
  });
});
