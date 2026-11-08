import { describe, expect, it } from 'vitest';

import { linePath, type Point } from './trend-path';

/** Samples every cubic segment of a path and returns, per segment, its two end y values and the sampled ys. */
function segments(d: string) {
  const start = /^M([\d.-]+),([\d.-]+)/.exec(d)!;
  let from = { x: Number(start[1]), y: Number(start[2]) };
  const out: { y0: number; y1: number; ys: number[] }[] = [];
  for (const c of d.matchAll(/C([\d.e-]+),([\d.e-]+) ([\d.e-]+),([\d.e-]+) ([\d.e-]+),([\d.e-]+)/g)) {
    const [c1y, c2y, x, y] = [Number(c[2]), Number(c[4]), Number(c[5]), Number(c[6])];
    const ys = Array.from({ length: 21 }, (_, k) => {
      const t = k / 20;
      return (1 - t) ** 3 * from.y + 3 * (1 - t) ** 2 * t * c1y + 3 * (1 - t) * t ** 2 * c2y + t ** 3 * y;
    });
    out.push({ y0: from.y, y1: y, ys });
    from = { x, y };
  }
  return out;
}

const line = (ys: number[]): Point[] => ys.map((y, i) => ({ x: (i / (ys.length - 1)) * 100, y }));

describe('linePath (monotone trend line)', () => {
  it.each([
    ['a jump after a flat run', [100, 100, 100, 8, 8, 8]],
    ['a spike', [100, 100, 8, 100, 100]],
    ['zig-zag', [50, 8, 100, 20, 90, 8, 100]],
    ['steady rise', [100, 80, 60, 40, 20, 8]],
  ])('never goes past the values of its two days: %s', (_, ys) => {
    for (const seg of segments(linePath(line(ys)))) {
      const low = Math.min(seg.y0, seg.y1) - 1e-9;
      const high = Math.max(seg.y0, seg.y1) + 1e-9;
      for (const y of seg.ys) {
        expect(y).toBeGreaterThanOrEqual(low);
        expect(y).toBeLessThanOrEqual(high);
      }
    }
  });

  it('is still curved, not straight, through changing values', () => {
    const d = linePath(line([100, 60, 40, 30]));
    const [first] = segments(d);
    const mid = first!.ys[10]!;
    expect(mid).not.toBeCloseTo((first!.y0 + first!.y1) / 2, 3);
  });

  it('breaks the line at a missing day and draws a lone day as a dot', () => {
    const d = linePath([{ x: 0, y: 10 }, null, { x: 50, y: 20 }, { x: 100, y: 30 }, null]);
    expect(d.match(/M/g)).toHaveLength(2);
    expect(linePath([{ x: 0, y: 10 }])).toBe('M0,10h0');
  });
});
