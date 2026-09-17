/**
 * A 1-D shallow-water surface, drawn into a canvas.
 *
 * Why a canvas instead of CSS: a CSS "wave" is a fixed ellipse sliding
 * sideways. Real water has a surface whose height varies along the button —
 * ripples travelling at different speeds, a bulge when the level overshoots, an
 * edge that is never a straight line. None of that is expressible as a
 * background-image.
 *
 * The model is a height-field / spring chain:
 *   each column:  a = k·(neighbourAvg − h) − c·v ;  v += a·dt ;  h += v·dt
 * plus a level that is itself a spring, so raising the target makes the water
 * surge, overshoot, slosh and settle.
 *
 * ── Stability ────────────────────────────────────────────────────────────────
 * The first version expressed k and c as per-SUB-STEP constants and applied the
 * level's impulse once per sub-step. Both were wrong: the damping worked out to
 * ζ ≈ 0.07 (barely damped), so the surface rang into spikes, and the impulse got
 * multiplied by ~60. The visible result was a hard vertical seam in the water
 * and a fill that never quite reached the top (measured 95.5%).
 *
 * Everything here is in PER-SECOND units and integrated with a fixed sub-step
 * that satisfies the explicit-diffusion stability limit (c·dt < 1).
 */

interface Cell {
  h: number; // surface height offset from the level, in "wave units"
  v: number; // vertical velocity
}

export interface WaterHandle {
  /** drive the water level to a fraction of the button height (0..1) */
  setLevel(frac: number): void;
  level(): number;
  destroy(): void;
}

// --- surface (per second) ---------------------------------------------------
const SURF_K = 130; // spring back to the neighbour average, ω ≈ 11.4 rad/s
const SURF_ZETA = 0.12; // lightly damped: ripples travel across and ring
const SURF_C = 2 * SURF_ZETA * Math.sqrt(SURF_K);
const SPREAD = 6; // neighbour coupling, /s

// --- level (per second) -----------------------------------------------------
const LEVEL_K = 9; // ω ≈ 3.0 rad/s → ~600ms rise, matching the lazy token
const LEVEL_ZETA = 0.5; // a clear overshoot, then settle
const LEVEL_C = 2 * LEVEL_ZETA * Math.sqrt(LEVEL_K);

/** How much the rising level disturbs the surface.
 *  Tuned by measurement: at 0.9 the accumulated wave height was ~0.9px —
 *  sub-pixel, so the surface read as dead flat (measured spread = 0). */
const SURGE = 60;

const SUB = 1 / 120; // fixed physics step

export function createWater(canvas: HTMLCanvasElement, color: () => string): WaterHandle {
  const ctx = canvas.getContext('2d');
  let cols: Cell[] = [];
  let width = 0;
  let height = 0;
  let dpr = 1;

  let level = 0; // 0 empty, 1 full
  let levelV = 0;
  let target = 0;

  let raf = 0;
  let running = false;
  let last = 0;
  let acc = 0;

  const resize = () => {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === width && h === height) return;
    width = w;
    height = h;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const n = Math.max(10, Math.round(w / 3));
    cols = Array.from({ length: n }, () => ({ h: 0, v: 0 }));
  };

  const stepSurface = (dt: number) => {
    const n = cols.length;
    if (!n) return;
    for (let i = 0; i < n; i++) {
      const c = cols[i];
      const l = cols[(i - 1 + n) % n];
      const r = cols[(i + 1) % n];
      const avg = (l.h + r.h) / 2;
      // tension pulls toward the neighbours, coupling lets the ripple travel
      const a = (SURF_K + SPREAD) * (avg - c.h) - SURF_C * c.v;
      c.v += a * dt;
    }
    for (let i = 0; i < n; i++) {
      const c = cols[i];
      c.h += c.v * dt;
      // clamp: a runaway column is what produced the vertical seam
      if (c.h > 1) { c.h = 1; c.v = Math.min(0, c.v); }
      if (c.h < -1) { c.h = -1; c.v = Math.max(0, c.v); }
    }
  };

  const stepLevel = (dt: number) => {
    const a = (target - level) * LEVEL_K - LEVEL_C * levelV;
    levelV += a * dt;
    level += levelV * dt;

    // The moving level drags the surface with it. Scaled by dt (so it is a
    // per-second impulse, not per-sub-step) and kept small.
    const n = cols.length;
    if (n) {
      const push = levelV * SURGE * dt;
      const t = performance.now() / 300;
      for (let i = 0; i < n; i++) {
        const wobble = Math.sin((i / n) * Math.PI * 2 + t);
        cols[i].v -= push * (1 + wobble * 0.5);
      }
    }
  };

  const draw = () => {
    if (!ctx) return;
    const W = width;
    const H = height;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (level <= 0.001) return;

    const surfaceY = (1 - level) * H;
    const n = cols.length || 1;
    // wave amplitude in px, proportional to the button so it scales
    const amp = Math.min(9, H * 0.19);

    ctx.beginPath();
    ctx.moveTo(-2, H + 4);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * (W + 4) - 2;
      ctx.lineTo(x, surfaceY + cols[i].h * amp);
    }
    ctx.lineTo(W + 2, H + 4);
    ctx.closePath();

    ctx.fillStyle = color();
    ctx.fill();

    // A lighter band under the surface reads as refraction and keeps the fill
    // from looking like flat paint.
    ctx.save();
    ctx.clip();
    const grad = ctx.createLinearGradient(0, surfaceY - amp, 0, surfaceY + amp * 3);
    grad.addColorStop(0, 'rgba(255,255,255,0.32)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, surfaceY - amp * 2, W, amp * 5);
    ctx.restore();
  };

  const atRest = () =>
    target === 0 && level < 0.002 && cols.every((c) => Math.abs(c.h) < 0.002 && Math.abs(c.v) < 0.02);

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    const frame = Math.min((now - last) / 1000, 0.05);
    last = now;
    acc += frame;
    // fixed sub-steps: the simulation must not depend on frame rate
    let guard = 0;
    while (acc >= SUB && guard < 20) {
      stepSurface(SUB);
      stepLevel(SUB);
      acc -= SUB;
      guard++;
    }
    draw();
    if (atRest()) {
      level = 0;
      levelV = 0;
      for (const c of cols) { c.h = 0; c.v = 0; }
      running = false;
      cancelAnimationFrame(raf);
      raf = 0;
      draw();
    }
  };

  const ensureRunning = () => {
    if (running) return;
    running = true;
    last = performance.now();
    acc = 0;
    raf = requestAnimationFrame(loop);
  };

  const ro = new ResizeObserver(() => { resize(); draw(); });
  ro.observe(canvas);
  resize();
  draw();

  return {
    setLevel(frac: number) {
      const next = Math.max(0, Math.min(1, frac));
      // a one-off splash as the fill starts, so the surface has relief
      // immediately instead of staying glass-flat until the surge builds
      if (next > 0.5 && target <= 0.5) {
        const n = cols.length;
        for (let i = 0; i < n; i++) {
          const k = Math.sin((i / n) * Math.PI * 4);
          cols[i].v += k * 3.0;
        }
      }
      target = next;
      ensureRunning();
    },
    level: () => level,
    destroy() {
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      running = false;
    },
  };
}
