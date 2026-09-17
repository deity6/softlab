import { measureChars, type EffectContext, type EffectInstance } from './types';

/**
 * Ripple — clicking drops a wave into the text. Every glyph is a buoy: it rides
 * the wave as it passes. Nothing about the text is drawn; the DOM itself moves.
 *
 * The wave front is also drawn, because the glyphs only show it where there
 * happen to be glyphs. Click in an empty corner and nothing used to happen at
 * all — you could not tell whether the click registered, or where the wave
 * started, or which way it was travelling. The ring is that missing feedback:
 * it originates at the click and expands at the same speed the glyphs ride.
 */

interface Wave {
  x: number;
  y: number;
  age: number;
}

const SPEED = 560;
const BAND = 96;
const LIFE = 1.5;
const AMPLITUDE = 24;
const ACCENT = '59, 130, 246';

export function createRipple(ctx: EffectContext): EffectInstance {
  const { stage, chars } = ctx;

  const base = measureChars(stage, chars);
  const offset = chars.map(() => 0);
  const waves: Wave[] = [];

  const layer = document.createElement('canvas');
  layer.className = 'fx-layer fx-ripple';
  stage.appendChild(layer);
  const g = layer.getContext('2d');

  let W = 1;
  let H = 1;
  let raf = 0;
  let last = performance.now();

  function resize(): void {
    if (!g) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, stage.clientWidth);
    H = Math.max(1, stage.clientHeight);
    layer.width = Math.round(W * dpr);
    layer.height = Math.round(H * dpr);
    layer.style.width = `${W}px`;
    layer.style.height = `${H}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  const ro = new ResizeObserver(() => {
    for (const el of chars) el.style.transform = '';
    const next = measureChars(stage, chars);
    for (let i = 0; i < base.length; i++) if (next[i]) base[i] = next[i];
    resize();
  });
  ro.observe(stage);

  const onDown = (e: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    waves.push({ x: e.clientX - r.left, y: e.clientY - r.top, age: 0 });
    if (waves.length > 8) waves.shift();
  };
  stage.addEventListener('pointerdown', onDown);

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    for (let i = waves.length - 1; i >= 0; i--) {
      waves[i].age += dt;
      if (waves[i].age > LIFE) waves.splice(i, 1);
    }

    // --- glyphs ride the wave
    for (let i = 0; i < chars.length; i++) {
      let target = 0;
      for (const w of waves) {
        const radius = w.age * SPEED;
        const delta = Math.hypot(base[i].x - w.x, base[i].y - w.y) - radius;
        if (delta < -BAND || delta > BAND) continue;
        const shape = Math.sin((delta / BAND) * Math.PI); // 0 → 1 → 0
        const decay = 1 - w.age / LIFE;
        target += shape * AMPLITUDE * decay * decay;
      }
      // Glyphs have inertia — the wave keeps sloshing after it has passed.
      offset[i] += (target - offset[i]) * Math.min(1, dt * 12);
      chars[i].style.transform =
        offset[i] > 0.02 || offset[i] < -0.02
          ? `translate3d(0, ${offset[i].toFixed(2)}px, 0)`
          : '';
    }

    // --- and the wave front itself is drawn, so an empty corner still shows it
    if (!g) return;
    g.clearRect(0, 0, W, H);
    for (const w of waves) {
      const radius = w.age * SPEED;
      const decay = 1 - w.age / LIFE;
      if (decay <= 0) continue;

      // Trailing ring, a beat behind the front — reads as a water surface.
      g.beginPath();
      g.arc(w.x, w.y, radius * 0.74, 0, Math.PI * 2);
      g.strokeStyle = `rgba(${ACCENT}, ${(0.13 * decay * decay).toFixed(3)})`;
      g.lineWidth = 1.5;
      g.stroke();

      // The front: brightest at the start, thinning and fading as it travels.
      g.beginPath();
      g.arc(w.x, w.y, radius, 0, Math.PI * 2);
      g.strokeStyle = `rgba(${ACCENT}, ${(0.46 * decay).toFixed(3)})`;
      g.lineWidth = 1 + 3.4 * decay;
      g.stroke();

      // Origin marker: a short-lived dot so the click point is unambiguous.
      if (w.age < 0.34) {
        const t = 1 - w.age / 0.34;
        g.beginPath();
        g.arc(w.x, w.y, 3 + 7 * (1 - t), 0, Math.PI * 2);
        g.strokeStyle = `rgba(${ACCENT}, ${(0.75 * t).toFixed(3)})`;
        g.lineWidth = 2;
        g.stroke();
      }
    }
  }
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      stage.removeEventListener('pointerdown', onDown);
      for (const el of chars) el.style.transform = '';
      layer.remove();
    },
  };
}
