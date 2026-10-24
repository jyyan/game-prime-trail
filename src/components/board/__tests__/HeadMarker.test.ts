import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import HeadMarker from '../HeadMarker.vue';

function markers(start: number) {
  return mount(HeadMarker, { props: { start } }).findAll('.pt-head-marker');
}

describe('HeadMarker', () => {
  it('start=8 renders one top marker', () => {
    const m = markers(8);
    expect(m).toHaveLength(1);
    expect(m[0].classes()).toContain('pt-head-marker--top');
  });

  it('start=0 renders top and left markers', () => {
    const m = markers(0);
    expect(m).toHaveLength(2);
    expect(m.flatMap((w) => w.classes())).toEqual(
      expect.arrayContaining(['pt-head-marker--top', 'pt-head-marker--left']),
    );
  });

  it('start=99 renders bottom and right markers', () => {
    const m = markers(99);
    expect(m).toHaveLength(2);
    expect(m.flatMap((w) => w.classes())).toEqual(
      expect.arrayContaining(['pt-head-marker--bottom', 'pt-head-marker--right']),
    );
  });

  it('start=40 renders a single left marker', () => {
    const m = markers(40);
    expect(m).toHaveLength(1);
    expect(m[0].classes()).toContain('pt-head-marker--left');
  });

  it('exposes --row and --col for positioning', () => {
    const style = markers(8)[0].attributes('style') ?? '';
    expect(style).toContain('--row: 0');
    expect(style).toContain('--col: 8');
  });

  it('is hidden from assistive technology', () => {
    expect(markers(8)[0].attributes('aria-hidden')).toBe('true');
  });
});
