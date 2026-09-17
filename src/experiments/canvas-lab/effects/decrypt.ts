import { measureChars, randomCipher, type EffectContext, type EffectInstance } from './types';

/**
 * Decrypt Reveal — glyphs near the cursor scramble, then resolve.
 *
 * Two things make it read as decryption instead of flicker:
 *
 *   1. Each glyph carries its own 0→1 progress rather than a binary on/off.
 *      The odds of a real glyph showing at any tick are `progress²`, so a
 *      character goes all-cipher → mostly-cipher → mostly-real → locked, and
 *      you can watch it settle. A glyph that flips clean in one frame is just
 *      a blink.
 *   2. Bullet time. Cursor speed drives a time scale: sit still and the world
 *      drops to ~0.14×, so the reveal crawls and you can actually see it;
 *      sweep across and it runs at normal speed. Sweeping fast is what the
 *      effect used to feel like all the time.
 *
 * Layout stability is a separate problem: a cipher character can be wider than
 * the letter it replaces, which re-flows the line and makes the whole paragraph
 * jump while it scrambles. We pin every glyph box to its resting width up
 * front, so substitution never moves anything.
 */

const RADIUS = 215;
/** Cursor speed, in px/s, that maps to real time. */
const SPEED_REF = 820;
/** Floor when the cursor is parked — the bullet-time end of the range. */
const MIN_SCALE = 0.14;
const MAX_SCALE = 1.8;
/** Base tick, in ms, between glyph reshuffles. Scaled by time too. */
const TICK_MS = 42;

export function createDecrypt(ctx: EffectContext): EffectInstance {
  const { stage, prose, chars, accent } = ctx;

  const original = chars.map((el) => el.dataset.orig ?? el.textContent ?? '');
  chars.forEach((el, i) => {
    el.dataset.orig = original[i];
  });

  const base = measureChars(stage, chars);

  // Pin the glyph boxes. A hair of slack over the measured width absorbs
  // antialiasing round-off without visibly spacing the letters out.
  prose.dataset.pinned = 'true';
  const pin = () => {
    for (let i = 0; i < chars.length; i++) {
      chars[i].style.width = `${Math.ceil((base[i]?.w ?? 0) * 1.06)}px`;
    }
  };
  pin();

  /** 0 = clean, 1 = mid, 2 = hot — avoids restyling every tick */
  const heat = new Int8Array(chars.length).fill(-1);
  const progress = new Float32Array(chars.length);

  let pointerX = -9999;
  let pointerY = -9999;
  let lastCX = 0;
  let lastCY = 0;
  let hadPointer = false;
  let moved = 0;
  let speed = 0;
  let raf = 0;
  let last = performance.now();
  /** Virtual clock in ms — advances at `timeScale`, drives the glyph churn. */
  let vt = 0;
  let lastChurn = 0;
  /** Proximity cached from this frame's progress pass, read by the churn pass. */
  const near = new Float32Array(chars.length);

  const onMove = (e: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    pointerX = e.clientX - r.left;
    pointerY = e.clientY - r.top;
    if (hadPointer) moved += Math.hypot(e.clientX - lastCX, e.clientY - lastCY);
    lastCX = e.clientX;
    lastCY = e.clientY;
    hadPointer = true;
  };
  const onLeave = () => {
    pointerX = -9999;
    pointerY = -9999;
    hadPointer = false;
  };
  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerleave', onLeave);

  const ro = new ResizeObserver(() => {
    for (const el of chars) {
      el.style.transform = '';
      el.style.width = '';
    }
    const next = measureChars(stage, chars);
    for (let i = 0; i < base.length; i++) if (next[i]) base[i] = next[i];
    pin();
  });
  ro.observe(stage);

  function setTier(i: number, tier: number): void {
    if (heat[i] === tier) return;
    heat[i] = tier;
    const el = chars[i];
    if (tier === 0) {
      el.style.color = '';
      el.style.textShadow = '';
    } else {
      el.style.color = tier === 2 ? accent : `color-mix(in srgb, var(--ink) 58%, ${accent})`;
      el.style.textShadow = tier === 2 ? '0 0 16px rgba(59,130,246,0.4)' : '';
    }
  }

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;

    // --- bullet time: smooth the cursor speed, then map it to a time scale.
    const instant = moved / Math.max(dt, 1e-3);
    moved = 0;
    const k = Math.pow(0.015, dt);
    speed = speed * k + instant * (1 - k);
    const timeScale = Math.min(MAX_SCALE, MIN_SCALE + speed / SPEED_REF);

    // Progress advances every frame off real dt, scaled by time. It used to
    // advance inside the throttled glyph pass, which multiplied the throttling
    // delay back in and made a full reveal take tens of seconds.
    const onStage = pointerX > -1000;
    const step = dt * timeScale;
    for (let i = 0; i < chars.length; i++) {
      let n = 0;
      if (onStage) {
        const dist = Math.hypot(base[i].x - pointerX, base[i].y - pointerY);
        if (dist < RADIUS) n = 1 - dist / RADIUS;
      }
      near[i] = n;
      if (n > 0) progress[i] = Math.min(1, progress[i] + step * (1.4 + n * 5.2));
      else progress[i] = Math.max(0, progress[i] - step * 1.15);
    }

    // --- glyph churn runs on the virtual clock, so bullet time slows the
    //     flicker as well as the reveal.
    vt += dt * 1000 * timeScale;
    if (vt - lastChurn < TICK_MS) return;
    lastChurn = vt;

    for (let i = 0; i < chars.length; i++) {
      const p = progress[i];
      setTier(i, p > 0.72 ? 2 : p > 0.04 ? 1 : 0);

      const el = chars[i];
      let next: string;
      if (p >= 1) next = original[i];
      else if (Math.random() < p * p) next = original[i];
      else next = randomCipher();
      if (el.textContent !== next) el.textContent = next;
    }
  }
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      delete prose.dataset.pinned;
      for (let i = 0; i < chars.length; i++) {
        chars[i].textContent = original[i];
        chars[i].style.color = '';
        chars[i].style.textShadow = '';
        chars[i].style.width = '';
      }
    },
  };
}
