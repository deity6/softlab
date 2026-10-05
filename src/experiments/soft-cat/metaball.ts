/**
 * Metaball field extraction — the "liquid" part of the soft cat.
 *
 * A metaball is not a circle. Every ball contributes an inverse-square
 * influence `r² / d²` to every point in space, and **the shape is wherever the
 * summed field crosses a threshold**. That single change is what makes two
 * balls fuse into one connected blob as they approach, split apart as they
 * separate, and stretch into a peanut when you pull one away — none of which a
 * set of drawn circles can do.
 *
 * How the contour is found:
 *
 *   1. Sample the field on a coarse grid. Per-pixel would be 1.2e8 evaluations
 *      a second at full HD and would not keep up; one sample every `cell`
 *      pixels looks the same and costs ~1/30th.
 *   2. Run marching squares over that grid: each cell's four corners give a
 *      4-bit state, and each state contributes a line segment.
 *   3. Place the segment endpoints by **linear interpolation** on the field.
 *      Without this step the contour is a staircase of cell-sized steps; with
 *      it the outline is a smooth curve.
 *   4. Stitch the loose segments into closed loops by matching endpoints.
 *
 * The output is a set of vector loops, which is the point: a bitmap field could
 * not then be stroked with a hand-drawn wobble.
 */

export interface Ball {
  x: number;
  y: number;
  r: number;
}

export interface Seg {
  a: [number, number];
  b: [number, number];
}

/**
 * Summed inverse-square field at a point. `1.0` is the surface, so a ball on
 * its own is visible out to roughly its own radius.
 */
export function fieldAt(balls: Ball[], x: number, y: number): number {
  let sum = 0;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i];
    const dx = x - b.x;
    const dy = y - b.y;
    const d2 = dx * dx + dy * dy;
    sum += (b.r * b.r) / (d2 > 0.01 ? d2 : 0.01);
  }
  return sum;
}

/** Sampling grid covering the balls' bounding box plus a margin. */
export interface Grid {
  originX: number;
  originY: number;
  cell: number;
  cols: number;
  rows: number;
  values: Float32Array;
}

export function sampleField(balls: Ball[], cell: number, margin = 24): Grid {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxR = 0;
  for (const b of balls) {
    minX = Math.min(minX, b.x - b.r);
    maxX = Math.max(maxX, b.x + b.r);
    minY = Math.min(minY, b.y - b.r);
    maxY = Math.max(maxY, b.y + b.r);
    maxR = Math.max(maxR, b.r);
  }
  if (!Number.isFinite(minX)) {
    return { originX: 0, originY: 0, cell, cols: 1, rows: 1, values: new Float32Array(1) };
  }

  // A ball's influence falls off as 1/d², so beyond `margin` it is noise. Cap
  // the box to keep a long cat from dragging a huge grid around.
  const pad = Math.min(margin, maxR * 1.6) + cell * 2;
  const originX = Math.floor((minX - pad) / cell) * cell;
  const originY = Math.floor((minY - pad) / cell) * cell;
  const cols = Math.max(2, Math.ceil((maxX + pad - originX) / cell) + 1);
  const rows = Math.max(2, Math.ceil((maxY + pad - originY) / cell) + 1);
  const values = new Float32Array(cols * rows);

  for (let r = 0; r < rows; r++) {
    const py = originY + r * cell;
    const row = r * cols;
    for (let c = 0; c < cols; c++) {
      values[row + c] = fieldAt(balls, originX + c * cell, py);
    }
  }
  return { originX, originY, cell, cols, rows, values };
}

/** Marching squares over a sampled grid. Returns unordered line segments. */
export function marchingSquares(grid: Grid, threshold = 1): Seg[] {
  const { cols, rows, cell, originX, originY, values } = grid;
  const segs: Seg[] = [];
  const mix = (a: number, b: number) => {
    const d = b - a;
    return Math.abs(d) < 1e-9 ? 0.5 : (threshold - a) / d;
  };

  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const v0 = values[r * cols + c];
      const v1 = values[r * cols + c + 1];
      const v2 = values[(r + 1) * cols + c + 1];
      const v3 = values[(r + 1) * cols + c];

      let idx = 0;
      if (v0 > threshold) idx |= 1;
      if (v1 > threshold) idx |= 2;
      if (v2 > threshold) idx |= 4;
      if (v3 > threshold) idx |= 8;
      if (idx === 0 || idx === 15) continue;

      const x0 = originX + c * cell;
      const y0 = originY + r * cell;
      const x1 = x0 + cell;
      const y1 = y0 + cell;
      const top = (): [number, number] => [x0 + cell * mix(v0, v1), y0];
      const right = (): [number, number] => [x1, y0 + cell * mix(v1, v2)];
      const bottom = (): [number, number] => [x0 + cell * mix(v3, v2), y1];
      const left = (): [number, number] => [x0, y0 + cell * mix(v0, v3)];

      switch (idx) {
        case 1: case 14: segs.push({ a: left(), b: top() }); break;
        case 2: case 13: segs.push({ a: top(), b: right() }); break;
        case 3: case 12: segs.push({ a: left(), b: right() }); break;
        case 4: case 11: segs.push({ a: right(), b: bottom() }); break;
        case 6: case 9: segs.push({ a: top(), b: bottom() }); break;
        case 7: case 8: segs.push({ a: left(), b: bottom() }); break;
        // Saddles: the field is above threshold on opposite corners only, so
        // two separate pieces of contour pass through this cell.
        case 5:
          segs.push({ a: left(), b: top() });
          segs.push({ a: right(), b: bottom() });
          break;
        case 10:
          segs.push({ a: top(), b: right() });
          segs.push({ a: bottom(), b: left() });
          break;
      }
    }
  }
  return segs;
}

/**
 * Stitch loose segments into closed loops by endpoint matching. Adjacent cells
 * compute a shared edge point with the same formula, so keys match exactly; the
 * rounding is only there to absorb float noise.
 */
export function assembleLoops(segs: Seg[], minPoints = 6): [number, number][][] {
  if (!segs.length) return [];
  const keyOf = (p: [number, number]) => `${Math.round(p[0] * 100)},${Math.round(p[1] * 100)}`;

  const buckets = new Map<string, number[]>();
  segs.forEach((s, i) => {
    for (const p of [s.a, s.b]) {
      const k = keyOf(p);
      const list = buckets.get(k);
      if (list) list.push(i);
      else buckets.set(k, [i]);
    }
  });

  const used = new Uint8Array(segs.length);
  const loops: [number, number][][] = [];

  for (let start = 0; start < segs.length; start++) {
    if (used[start]) continue;
    used[start] = 1;

    const loop: [number, number][] = [segs[start].a, segs[start].b];
    let tail = segs[start].b;

    for (;;) {
      const candidates = buckets.get(keyOf(tail));
      if (!candidates) break;
      let next = -1;
      for (const c of candidates) {
        if (!used[c]) { next = c; break; }
      }
      if (next < 0) break;
      used[next] = 1;
      const s = segs[next];
      const step = keyOf(s.a) === keyOf(tail) ? s.b : s.a;
      loop.push(step);
      tail = step;
      if (loop.length > 40000) break; // paranoia against a malformed stitch
    }

    if (loop.length >= minPoints) loops.push(loop);
  }
  return loops;
}

/**
 * Smooth a loop through the midpoints of consecutive points (quadratic
 * Béziers). Rounds off the marching-squares sampling without inventing detail
 * that is not in the field.
 */
export function traceLoop(
  ctx: CanvasRenderingContext2D,
  loop: [number, number][],
  warp?: (i: number, p: [number, number]) => [number, number],
): void {
  const n = loop.length;
  const at = (i: number): [number, number] => warp ? warp(i, loop[i]) : loop[i];
  const mid = (a: [number, number], b: [number, number]): [number, number] =>
    [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

  const start = mid(at(n - 1), at(0));
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const p = at(i);
    const m = mid(p, at((i + 1) % n));
    ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
  }
  ctx.closePath();
}

/** Convenience: balls in, closed vector loops out. */
export function contoursOf(
  balls: Ball[],
  cell = 6,
  threshold = 1,
  margin = 24,
): [number, number][][] {
  const grid = sampleField(balls, cell, margin);
  return assembleLoops(marchingSquares(grid, threshold));
}
