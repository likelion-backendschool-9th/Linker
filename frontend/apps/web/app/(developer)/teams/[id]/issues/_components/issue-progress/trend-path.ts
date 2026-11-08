/** Plot point in the 0–100 SVG space of the trend chart. */
export type Point = { x: number; y: number };

const sign = (value: number) => (value < 0 ? -1 : 1);

/**
 * Tangents of a monotone cubic (Fritsch–Carlson, as d3 `curveMonotoneX`): a segment never goes
 * above or below its two end values, so a line can't dip under 0 or rise over the maximum.
 */
function tangents(line: Point[]) {
  const n = line.length;
  const h = line.slice(1).map((p, i) => p.x - line[i]!.x);
  const s = line.slice(1).map((p, i) => (h[i] ? (p.y - line[i]!.y) / h[i]! : 0));
  const m = new Array<number>(n).fill(0);
  for (let i = 1; i < n - 1; i += 1) {
    const s0 = s[i - 1]!;
    const s1 = s[i]!;
    const h0 = h[i - 1]!;
    const h1 = h[i]!;
    const p = (s0 * h1 + s1 * h0) / (h0 + h1);
    m[i] = (sign(s0) + sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }
  // End tangents from the neighbouring one, like d3 (`slope2`). The inner tangent is at most the end
  // slope with the same sign (or 0), so the end tangent stays within 1–1.5× that slope: no overshoot.
  m[0] = n > 2 ? (3 * s[0]! - m[1]!) / 2 : s[0]!;
  m[n - 1] = n > 2 ? (3 * s[n - 2]! - m[n - 2]!) / 2 : s[n - 2]!;
  return m;
}

/** Smooth monotone line through the points; a `null` day breaks the line. */
export function linePath(points: (Point | null)[]) {
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (const point of points) {
    if (point) run.push(point);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);

  return runs
    .map((line) => {
      const first = line[0]!;
      if (line.length === 1) return `M${first.x},${first.y}h0`;
      const m = tangents(line);
      let d = `M${first.x},${first.y}`;
      for (let i = 0; i < line.length - 1; i += 1) {
        const p1 = line[i]!;
        const p2 = line[i + 1]!;
        const dx = (p2.x - p1.x) / 3;
        d += `C${p1.x + dx},${p1.y + dx * m[i]!} ${p2.x - dx},${p2.y - dx * m[i + 1]!} ${p2.x},${p2.y}`;
      }
      return d;
    })
    .join('');
}
