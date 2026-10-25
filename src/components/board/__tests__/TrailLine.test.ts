import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { FIXTURE_PATH } from '../../../core/__fixtures__/level-fixture';
import { colOf, rowOf } from '../../../core/geometry';
import TrailLine from '../TrailLine.vue';

function parsePoints(attr: string | undefined): Array<[number, number]> {
  return (attr ?? '')
    .trim()
    .split(/\s+/)
    .map((p) => p.split(',').map(Number) as [number, number]);
}

describe('TrailLine', () => {
  const wrapper = mount(TrailLine, { props: { trail: FIXTURE_PATH } });
  const pts = parsePoints(wrapper.get('polyline').attributes('points'));

  it('draws 100 points, i.e. 99 segments', () => {
    expect(pts).toHaveLength(100);
  });

  it('segment k joins the centres of trail[k-1] and trail[k]', () => {
    for (let k = 1; k < 100; k++) {
      const a = FIXTURE_PATH[k - 1];
      const b = FIXTURE_PATH[k];
      expect(pts[k - 1]).toEqual([colOf(a) + 1, rowOf(a) + 1]);
      expect(pts[k]).toEqual([colOf(b) + 1, rowOf(b) + 1]);
    }
  });

  it('is decorative: aria-hidden svg whose viewBox contains every point', () => {
    const svg = wrapper.get('svg');
    expect(svg.attributes('aria-hidden')).toBe('true');
    const [, , w, h] = (svg.attributes('viewBox') ?? '').split(/\s+/).map(Number);
    expect(w).toBe(h);
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThan(0);
      expect(x).toBeLessThan(w);
      expect(y).toBeGreaterThan(0);
      expect(y).toBeLessThan(h);
    }
    expect(svg.classes()).toContain('pt-trail');
  });
});
