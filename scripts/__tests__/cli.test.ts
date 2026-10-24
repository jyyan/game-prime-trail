// @vitest-environment node
import { availableParallelism } from 'node:os';
import { describe, expect, it } from 'vitest';
import { parseArgs } from '../lib/cli';

describe('parseArgs', () => {
  it('defaults to every id, all cores, no recompute', () => {
    const opts = parseArgs([]);
    expect(opts.ids).toHaveLength(1000);
    expect(opts.ids[0]).toBe(1);
    expect(opts.ids[999]).toBe(1000);
    expect(opts.workers).toBe(availableParallelism());
    expect(opts).toMatchObject({ recompute: [], assemble: false, partial: false });
  });

  it('parses id ranges and lists', () => {
    expect(parseArgs(['--ids', '1-3,7']).ids).toEqual([1, 2, 3, 7]);
    expect(parseArgs(['--ids=7,2-3,3']).ids).toEqual([2, 3, 7]);
  });

  it('parses workers, recompute and flags', () => {
    expect(parseArgs(['--workers', '2']).workers).toBe(2);
    expect(parseArgs(['--recompute', 'h,c']).recompute).toEqual(['h', 'c']);
    expect(parseArgs(['--assemble', '--partial'])).toMatchObject({ assemble: true, partial: true });
    expect(parseArgs(['--', '--partial']).partial).toBe(true);
  });

  it('rejects bad input', () => {
    expect(() => parseArgs(['--ids', '0-3'])).toThrow(/outside/);
    expect(() => parseArgs(['--ids', '1001'])).toThrow(/outside/);
    expect(() => parseArgs(['--ids', '3-1'])).toThrow(/outside/);
    expect(() => parseArgs(['--ids', 'a'])).toThrow(/bad range/);
    expect(() => parseArgs(['--workers', '0'])).toThrow(/positive/);
    expect(() => parseArgs(['--workers'])).toThrow(/missing value/);
    expect(() => parseArgs(['--recompute', 's'])).toThrow(/unknown field/);
    expect(() => parseArgs(['--fast'])).toThrow(/unknown argument/);
  });
});
