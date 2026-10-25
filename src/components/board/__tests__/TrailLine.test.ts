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
    expect(FIXTURE_PATH).toHaveLength(100);
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

  it('is decorative: aria-hidden svg on the 11x11 board grid', () => {
    const svg = wrapper.get('svg');
    expect(svg.attributes('aria-hidden')).toBe('true');
    expect(svg.attributes('viewBox')).toBe('0 0 11 11');
    expect(svg.classes()).toContain('pt-trail');
  });
});
