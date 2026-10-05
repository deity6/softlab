/**
 * Soft Cat — a long-bodied cat that deforms under a hand.
 *
 * The reference for this one is a drawn GIF of a hand pressing into a
 * dachshund-shaped cat. The read there is entirely about *local* deformation:
 * a hand lands on the back and the body dips right there, the head and tail
 * barely move, and when the hand lifts the dip springs out. So the body is not
 * one rigid blob being squashed — it is a chain of independent spring-dampers,
 * and a press only reaches the segments it is actually over.
 *
 * Same idea as the 3D soft-matter experiment, but flattened: no solver, no
 * renderer, no HDRI. Just Canvas 2D, a spine of segments, and enough squash on
 * the segment under the hand that the silhouette visibly gives way.
 *
 *   spine[i] = { x, y, r }  — y and r are the animated state, x is fixed
 *   press influence        = exp(-(dx / HAND_RADIUS)²)
 *   y   += PRESS  * influence      (dips)
 *   r   -= SQUASH * influence      (flattens, so it reads as volume moving
 *                                   sideways rather than the cat teleporting
 *                                   downward)
 *
 * Everything else — head, ears, four legs, tail — hangs off the spine and
 * reacts separately, so petting the ear wiggles the ear and petting the tail
 * swings the tail, instead of the whole animal doing the same thing.
 */

import { contoursOf, traceLoop, type Ball } from './metaball';

const SEGMENTS = 26;
const HAND_RADIUS = 118;
/** Vertical distance from the segment that a press reaches out to. */
const PRESS_WINDOW = 150;

const STIFF = 128;
const DAMP = 15.5;
const PRESS = 30;
const SQUASH = 0.62;

/** Metaball sampling pitch, in px. Smaller = smoother and slower. */
const FIELD_CELL = 6;
/**
 * Drawn ball radius as a fraction of the physics radius. The isosurface of a
 * chain of overlapping balls sits far outside any single ball, so this has to
 * be well below 1 for the silhouette to match the body it is describing.
 */
const FIELD_K = 0.4;

/** Radius profile along the body — a capsule, so the nose and rump are round. */
function bodyProfile(t: number): number {
  return Math.pow(Math.sin(Math.PI * Math.min(0.999, Math.max(0.001, t))), 0.38);
}

/**
 * Stable pseudo-random in 0..1. The wobble on every hand-drawn stroke is
 * derived from this, and it is seeded per stroke rather than per frame —
 * re-randomising each frame reads as vibration, not as ink.
 */
function noise(i: number, seed: number): number {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

interface Whisker {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  tipX: number;
  tipY: number;
}

/**
 * Whisker paths, in head-local coordinates.
 *
 * Reach is deliberately kept well under one head-radius. The first pass ran
 * 0.78–0.88 r, which put the tips level with the ears — at that length they
 * stop reading as fur and start reading as wires bolted to the face. `drift`
 * is the slow shared wobble, so all six move together instead of buzzing.
 */
function whiskerGeometry(
  h: { x: number; y: number; r: number },
  drift: number,
): Whisker[] {
  const out: Whisker[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const x0 = side * h.r * 0.15;
      const y0 = h.r * (0.16 + i * 0.088);
      // 0.40 → 0.49 r. Short enough to stay off the silhouette.
      const len = h.r * (0.4 + i * 0.045);
      const tipX = side * (h.r * 0.15 + len);
      // Upper whiskers lift, lower ones lie almost flat.
      const lift = h.r * (0.1 - i * 0.045);
      const tipY = y0 - lift + drift * 0.6;
      out.push({
        x0,
        y0,
        cx: (x0 + tipX) * 0.5,
        cy: y0 - lift * 0.85 + drift * 0.25,
        tipX,
        tipY,
      });
    }
  }
  return out;
}

/** Multiply an #rrggbb colour towards black (k<1) or white (k>1). */
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${clamp(((n >> 16) & 255) * k)},${clamp(((n >> 8) & 255) * k)},${clamp((n & 255) * k)})`;
}

export interface CatInit {
  color: string;
}

export interface CatHandle {
  setColor(hex: string): void;
  /** Silence the purr. Creating the audio context is deferred to the first gesture. */
  setMuted(muted: boolean): void;
  dispose(): void;
}

interface Heart {
  x: number;
  y: number;
  vy: number;
  life: number;
  size: number;
}

export function createCat(container: HTMLElement, init: CatInit): CatHandle {
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.style.touchAction = 'none';
  container.appendChild(canvas);
  const g = canvas.getContext('2d')!;

  let W = 1;
  let H = 1;
  let dpr = 1;

  // ------------------------------------------------------------- the animal
  /** Rest positions, recomputed on resize. */
  const restX = new Float32Array(SEGMENTS);
  const restY = new Float32Array(SEGMENTS);
  const restR = new Float32Array(SEGMENTS);
  /** Animated state. */
  const y = new Float32Array(SEGMENTS);
  const vy = new Float32Array(SEGMENTS);
  const r = new Float32Array(SEGMENTS);
  const vr = new Float32Array(SEGMENTS);

  let bodyTop = 0;
  let bodyLen = 0;
  let bodyR = 0;
  let animalY = 0;

  let color = init.color;
  /** Set while the pointer is over the stage. */
  let px = -9999;
  let py = -9999;
  let inside = false;
  let pressing = false;
  let clock = 0;

  // Per-part reactions, each its own little spring.
  let earWobble = 0;
  let earVel = 0;
  let tailSwing = 0;
  let tailVel = 0;
  /** 1 = eyes shut. Driven by a loose cycle, not a metronome. */
  let blink = 0;
  let blinkTimer = 1.6;
  /** Whisker drift, in px. */
  let whisk = 0;
  let pawSquash = [0, 0, 0, 0];
  let pawVel = [0, 0, 0, 0];
  const hearts: Heart[] = [];
  let lastHeart = 0;

  function measure(): void {
    W = Math.max(1, container.clientWidth);
    H = Math.max(1, container.clientHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    animalY = H * (W < 640 ? 0.46 : 0.5);
    // The cat is the whole point of the page — on a phone it should fill the
    // width rather than sit as a small figure in the middle of it.
    bodyLen = Math.min(W * (W < 640 ? 0.82 : 0.6), 660);
    // 0.075 rather than something slimmer: at 0.058 the body came out at 17:1
    // length to height, which reads as a strap rather than as an animal.
    bodyR = Math.max(22, Math.min(bodyLen * 0.075, 52));
    bodyTop = animalY - bodyLen * 0.02;

    const left = W / 2 - bodyLen / 2;
    for (let i = 0; i < SEGMENTS; i++) {
      const t = (i + 0.5) / SEGMENTS;
      restX[i] = left + bodyLen * t;
      restY[i] = bodyTop;
      restR[i] = bodyR * bodyProfile(t);
    }
    // First layout (and every resize) snaps the body to rest.
    for (let i = 0; i < SEGMENTS; i++) {
      y[i] = restY[i];
      r[i] = restR[i];
      vy[i] = 0;
      vr[i] = 0;
    }
  }

  // ------------------------------------------------------------------ audio
  /**
   * Purr, synthesised — no audio files.
   *
   * A cat's purr is a ~25 Hz pulse train, so: a sawtooth at that frequency,
   * lowpassed to strip the buzz, with its gain amplitude-modulated by a
   * slightly detuned second oscillator (the two drift in and out of phase,
   * which is what makes it sound alive rather than like a held tone).
   *
   * The context is only created on the first real gesture — browsers refuse to
   * start audio otherwise, and building it up front would leave a suspended
   * context for every visitor who never touches the cat.
   */
  let audio: { ctx: AudioContext; gain: GainNode } | null = null;
  let audioTried = false;
  let muted = false;
  /** True while a pointer capture is held, which suppresses `pointerleave`. */
  let captured = false;

  function ensureAudio(): void {
    if (audio) {
      if (audio.ctx.state === 'suspended' && !muted) void audio.ctx.resume();
      return;
    }
    if (audioTried || muted) return;
    audioTried = true;
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      const ctx = new Ctor();

      // Two gain stages, and the split is the whole point.
      //
      // `out` is the master level: setPurr drives it from 0 up, and 0 really
      // means silent. The LFO must NOT connect here — AudioParam connections
      // are *additive*, so an LFO wired straight to the master would bias it
      // by ±0.55 and the purr could never be turned off no matter what level
      // was written. (That was the bug: it read as a latching switch.)
      const out = ctx.createGain();
      out.gain.value = 0;
      out.connect(ctx.destination);

      // `mod` sits at unity and is wobbled by the LFO, which is what gives the
      // purr its granular pulse instead of a flat tone.
      const mod = ctx.createGain();
      mod.gain.value = 0.55;
      mod.connect(out);

      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 26;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 210;

      const lfo = ctx.createOscillator();
      lfo.frequency.value = 20.5;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.45;
      lfo.connect(lfoGain);
      lfoGain.connect(mod.gain);

      osc.connect(lp);
      lp.connect(mod);
      osc.start();
      lfo.start();
      audio = { ctx, gain: out };
    } catch {
      /* sound is a bonus; never let it break the cat */
    }
  }

  /** Last level written, so we only touch the automation when it changes. */
  let purrLevel = -1;

  function setPurr(level: number): void {
    if (!audio || muted) return;
    const target = Math.max(0, Math.min(1, level)) * 0.055;
    // Called every frame; writing the same automation 60×/s stacks up events
    // on the param for no audible benefit.
    if (Math.abs(target - purrLevel) < 0.0004) return;
    purrLevel = target;
    audio.gain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.14);
  }
  // ------------------------------------------------------------------ input
  function toLocal(e: PointerEvent): void {
    const box = canvas.getBoundingClientRect();
    px = e.clientX - box.left;
    py = e.clientY - box.top;
    inside = true;
  }
  const onMove = (e: PointerEvent) => {
    toLocal(e);
    // Recover from a lost pointerup. If the button is no longer down but we
    // still think it is, the release went somewhere we never heard — window
    // blur, a capture that got dropped, an event consumed elsewhere. Without
    // this the purr latches on and never stops, which reads as a broken
    // on/off switch rather than as a stuck flag.
    if (pressing && (e.buttons & 1) === 0) {
      pressing = false;
      if (captured) {
        captured = false;
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          /* already released */
        }
      }
    }
  };
  const onDown = (e: PointerEvent) => {
    toLocal(e);
    pressing = true;
    ensureAudio();
    try {
      canvas.setPointerCapture(e.pointerId);
      captured = true;
    } catch {
      /* capture is an optimisation; the cat works without it */
    }
    e.preventDefault();
  };
  const onUp = (e: PointerEvent) => {
    pressing = false;
    captured = false;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
  };
  const onLeave = () => {
    // Engaging a pointer capture fires `pointerleave` on the capturing element.
    // Without this guard, pressing the cat clears `inside` on the very same
    // frame — the body snaps back, the purr cuts out, and nothing reads as
    // "held" even though the button is down.
    if (captured) return;
    inside = false;
    px = -9999;
    py = -9999;
  };

  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  // Release can land outside the canvas or on another element; the window
  // listener is the backstop for that. `blur` cannot reuse `onUp` — it is not
  // a pointer event and carries no pointerId.
  const onBlur = () => {
    pressing = false;
    captured = false;
  };
  window.addEventListener('pointerup', onUp);
  window.addEventListener('blur', onBlur);
  const ro = new ResizeObserver(measure);
  ro.observe(container);
  measure();

  // ----------------------------------------------------------------- parts
  /** Where the four paws hang, as fractions along the body. */
  const PAW_T = [0.2, 0.35, 0.63, 0.79];

  function pawPosition(i: number): { x: number; y: number } {
    const t = PAW_T[i];
    const idx = Math.min(SEGMENTS - 1, Math.max(0, Math.round(t * (SEGMENTS - 1))));
    const ground = restY[idx] + r[idx] + bodyR * 1.3;
    return { x: restX[idx], y: ground - pawSquash[i] * 10 };
  }

  function headCenter(): { x: number; y: number; r: number } {
    const i = 0;
    return {
      x: restX[i] - bodyR * 0.72,
      y: y[i] + bodyR * 0.06,
      r: bodyR * 1.16,
    };
  }

  function tailBase(): { x: number; y: number } {
    const i = SEGMENTS - 1;
    return { x: restX[i] + bodyR * 0.45, y: y[i] - bodyR * 0.1 };
  }

  // --------------------------------------------------------------- physics
  function step(dt: number): void {
    clock += dt;
    const strength = pressing ? 1.5 : 1;
    /** Deepest press anywhere on the spine this frame — drives the purr. */
    let maxHit = 0;

    for (let i = 0; i < SEGMENTS; i++) {
      // Breathing: a slow swell travelling down the body, so a cat at rest
      // still looks alive.
      const breath = Math.sin(clock * 1.7 - i * 0.32) * bodyR * 0.022;

      let targetY = restY[i] + breath;
      let targetR = restR[i] - breath * 0.55;

      if (inside) {
        const dx = px - restX[i];
        const dy = py - (y[i] - r[i]);
        const falloff = Math.exp(-(dx * dx) / (HAND_RADIUS * HAND_RADIUS));
        // Only press where the hand actually is: a press at the head must not
        // move the rump.
        const reach = Math.exp(-(dy * dy) / (PRESS_WINDOW * PRESS_WINDOW));
        const hit = falloff * reach * strength;
        if (hit > maxHit) maxHit = hit;
        // Both clamps matter. Without them a hard press drives the segment
        // further than its own radius, the isosurface pinches shut and the cat
        // comes apart into two blobs mid-press.
        targetY += Math.min(PRESS * hit, restR[i] * 0.55);
        targetR -= restR[i] * Math.min(SQUASH * hit, 0.46);
      }

      vy[i] += ((targetY - y[i]) * STIFF - vy[i] * DAMP) * dt;
      vr[i] += ((targetR - r[i]) * STIFF * 0.9 - vr[i] * DAMP) * dt;
      y[i] += vy[i] * dt;
      r[i] += vr[i] * dt;
      if (r[i] < restR[i] * 0.2) r[i] = restR[i] * 0.2;
    }

    // --- ear, tail and paws each react to being touched, not to the body.
    const head = headCenter();
    const earL = { x: head.x - head.r * 0.5, y: head.y - head.r * 0.86 };
    const earR = { x: head.x + head.r * 0.42, y: head.y - head.r * 0.9 };
    const earHit = inside
      ? Math.max(
          Math.exp(-dist2(px, py, earL.x, earL.y) / (bodyR * bodyR * 6.5)),
          Math.exp(-dist2(px, py, earR.x, earR.y) / (bodyR * bodyR * 6.5)),
        )
      : 0;
    earVel += (earHit * 42 - earWobble * 150 - earVel * 11) * dt;
    earWobble += earVel * dt;

    // Blink on a loose cycle. Regular timing reads as a machine; a random gap
    // of a couple of seconds reads as an animal.
    blinkTimer -= dt;
    if (blinkTimer <= 0) {
      blink = 1;
      blinkTimer = 1.8 + Math.random() * 3.4;
    }
    if (blink > 0) blink = Math.max(0, blink - dt * 6.5);

    // Whiskers mostly follow the breathing, and get dragged by the tail when
    // the cat is agitated — one cheap line that ties two parts of the body
    // together so they do not look independently animated.
    whisk = Math.sin(clock * 0.9) * 0.5 + tailSwing * 0.25;

    const tb = tailBase();
    const tailHit = inside
      ? Math.exp(-dist2(px, py, tb.x + bodyR * 1.5, tb.y - bodyR * 2.2) / (bodyR * bodyR * 14))
      : 0;
    tailVel += (tailHit * 60 - tailSwing * 120 - tailVel * 9) * dt;
    tailSwing += tailVel * dt;

    for (let i = 0; i < 4; i++) {
      const p = pawPosition(i);
      const hit = inside
        ? Math.exp(-dist2(px, py, p.x, p.y) / (bodyR * bodyR * 5))
        : 0;
      pawVel[i] += (hit * 34 - pawSquash[i] * 190 - pawVel[i] * 12) * dt;
      pawSquash[i] = Math.max(-0.2, pawSquash[i] + pawVel[i] * dt);
    }

    // --- hearts pop out of whatever is being petted
    if (inside && clock - lastHeart > 0.34) {
      lastHeart = clock;
      // Prefer the pointer itself when it is over the animal — snapping to a
      // named part is only the fallback for ear/tail/paw hits, and using it
      // everywhere made hearts appear off to one side of the hand.
      const onBody =
        px > restX[0] - bodyR * 1.6 &&
        px < restX[SEGMENTS - 1] + bodyR * 1.6 &&
        Math.abs(py - (bodyTop + bodyR)) < bodyR * 3;
      let hx = px;
      let hy = py;
      if (!onBody) {
        let best = Infinity;
        const spots = [head, tb, ...PAW_T.map((_, i) => pawPosition(i))];
        for (const s of spots) {
          const d = dist2(px, py, s.x, s.y);
          if (d < best) { best = d; hx = s.x; hy = s.y; }
        }
      }
      if (onBody) {
        hearts.push({
          x: hx + (Math.random() - 0.5) * bodyR * 0.9,
          y: hy - bodyR * 0.5,
          vy: -26 - Math.random() * 16,
          life: 1,
          size: bodyR * (0.32 + Math.random() * 0.16),
        });
      }
    }
    for (let i = hearts.length - 1; i >= 0; i--) {
      const h = hearts[i];
      h.y += h.vy * dt;
      h.x += Math.sin(h.y * 0.05) * 12 * dt;
      h.life -= dt / 1.15;
      if (h.life <= 0) hearts.splice(i, 1);
    }
    if (hearts.length > 26) hearts.splice(0, hearts.length - 26);

    // Purr while anything is being touched — body, ear or tail alike. Held
    // down it goes to full; a light stroke gets a fraction of that.
    const stroked = Math.max(maxHit, earHit * 0.85, tailHit * 0.85);
    setPurr(stroked > 0.22 ? (pressing ? 1 : 0.62) : 0);
  }

  function dist2(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }

  // ------------------------------------------------------------------ paint
  // ------------------------------------------------------- liquid rendering
  /**
   * The animal as a field of balls.
   *
   * Every spine segment is already a ball — that is the whole trick. The
   * physics stays exactly as it was; only the drawing changes, from "outline
   * the segments" to "extract the isosurface of their summed field".
   *
   * The head blobs deliberately overlap the first spine segments so the neck
   * fuses rather than pinches. That overlap is what makes the whole thing read
   * as one piece of jelly instead of a sausage with a ball stuck on the end,
   * and it is exactly what a drawn outline could never do.
   */
  function collectBalls(): Ball[] {
    const balls: Ball[] = [];
    // The field is a *sum*: on the body's centre line about ten balls overlap
    // at once, so the surface lands at roughly √10 ≈ 3× the ball radius.
    // Drawn radius therefore has to be much smaller than the physics radius,
    // or the cat inflates into one solid slab.
    const k = FIELD_K;
    for (let i = 0; i < SEGMENTS; i++) {
      balls.push({ x: restX[i], y: y[i], r: Math.max(r[i], bodyR * 0.5) * k });
    }
    const h = headCenter();
    balls.push({ x: h.x, y: h.y, r: h.r * k });
    balls.push({ x: h.x + h.r * 0.45, y: h.y + h.r * 0.04, r: h.r * 0.72 * k });
    return balls;
  }

  /**
   * Lay the path down twice with a small fixed offset, the way a pencil goes
   * over a line again. The offsets come from a per-stroke seed, so the wobble
   * is stable frame to frame — re-randomising each frame reads as vibration.
   */
  function inkStroke(loop: [number, number][], width: number, seed: number): void {
    for (let pass = 0; pass < 2; pass++) {
      g.beginPath();
      traceLoop(g, loop, (i, p) => {
        const amp = pass === 0 ? 2.2 : 3.6;
        const a = (noise(i * 7 + pass * 131, seed) - 0.5) * amp;
        const b = (noise(i * 13 + pass * 977, seed + 17) - 0.5) * amp;
        return [p[0] + a, p[1] + b];
      });
      g.lineWidth = pass === 0 ? width : width * 0.55;
      g.globalAlpha = pass === 0 ? 0.85 : 0.38;
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  function drawBody(): void {
    const loops = contoursOf(collectBalls(), FIELD_CELL, 1, bodyR * 1.8);
    if (!loops.length) return;

    g.save();
    g.fillStyle = color;
    g.strokeStyle = shade(color, 0.6);
    g.lineJoin = 'round';
    g.lineCap = 'round';

    g.beginPath();
    for (const loop of loops) traceLoop(g, loop);
    g.fill('nonzero');

    // Ink on top of the fill, so the wobble reads as an outline rather than as
    // a halo around a hard edge. A different seed per loop keeps two loops
    // from wobbling in lockstep.
    const width = Math.max(1.6, bodyR * 0.11);
    let seed = 1;
    for (const loop of loops) {
      inkStroke(loop, width, seed);
      seed += 3.7;
    }
    g.restore();
  }

  function drawShadow(): void {
    // Sits just under the paws, not in the middle of the floor.
    const ground = bodyTop + bodyR * 2.36;
    g.save();
    g.globalAlpha = 0.13;
    g.fillStyle = '#14181f';
    g.beginPath();
    g.ellipse(W / 2, ground, bodyLen * 0.44 + bodyR * 0.5, bodyR * 0.46, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  function drawTail(): void {
    const b = tailBase();
    g.save();
    g.strokeStyle = color;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const tipX = b.x + bodyR * (1.5 + tailSwing * 0.1);
    const tipY = b.y - bodyR * (2.5 + tailSwing * 0.06);
    g.beginPath();
    g.moveTo(b.x, b.y);
    g.quadraticCurveTo(
      b.x + bodyR * 1.9,
      b.y - bodyR * 1.6 + tailSwing * 0.4,
      tipX,
      tipY,
    );
    g.lineWidth = bodyR * 0.42;
    g.stroke();
    g.restore();
  }

  function drawLegs(): void {
    g.save();
    g.fillStyle = color;
    for (let i = 0; i < 4; i++) {
      const p = pawPosition(i);
      const idx = Math.round(PAW_T[i] * (SEGMENTS - 1));
      const topY = y[idx] + r[idx] - bodyR * 0.3;
      const w = bodyR * 0.42 * (1 - pawSquash[i] * 0.18);
      const h = p.y - topY;
      g.beginPath();
      // Rounded capsule: the foot is a fat round, the shank a straight stalk.
      g.moveTo(p.x - w, topY);
      g.lineTo(p.x - w, p.y - w * 0.9);
      g.quadraticCurveTo(p.x - w, p.y, p.x, p.y);
      g.quadraticCurveTo(p.x + w, p.y, p.x + w, p.y - w * 0.9);
      g.lineTo(p.x + w, topY);
      g.closePath();
      g.fill();
      void h;
    }
    g.restore();
  }

  /**
   * Ears are drawn, not fused. A metaball ear would just round off into the
   * head — the whole point of an ear is its point.
   */
  function drawEars(): void {
    const h = headCenter();
    g.save();
    g.translate(h.x, h.y);
    g.rotate(earWobble * 0.02);
    g.fillStyle = color;
    g.strokeStyle = shade(color, 0.6);
    g.lineWidth = Math.max(1.4, h.r * 0.07);
    g.lineJoin = 'round';

    for (const side of [-1, 1]) {
      const ex = side * h.r * 0.44;
      const ey = -h.r * 0.62;
      const wob = side * earWobble * 0.9;
      g.beginPath();
      g.moveTo(ex - h.r * 0.34, ey + h.r * 0.52);
      g.quadraticCurveTo(
        ex + wob - h.r * 0.26,
        ey - h.r * 0.74,
        ex + wob + h.r * 0.05,
        ey - h.r * 0.96,
      );
      g.quadraticCurveTo(
        ex + wob + h.r * 0.42,
        ey - h.r * 0.44,
        ex + h.r * 0.36,
        ey + h.r * 0.52,
      );
      g.closePath();
      g.fill();
      g.stroke();
    }
    g.restore();
  }

  /**
   * Face: slit pupils that track the pointer, a blink, a nose, and whiskers
   * that drift with the tail. None of it is physics — it is all the small
   * signals that make the thing read as alive rather than as a shape that
   * happens to deform.
   */
  function drawFace(): void {
    const h = headCenter();
    const eyeY = -h.r * 0.04;
    const eyeX = h.r * 0.31;
    const lookX = inside ? Math.max(-1, Math.min(1, (px - h.x) / (h.r * 3))) : 0;
    const lookY = inside ? Math.max(-1, Math.min(1, (py - h.y) / (h.r * 3))) : 0;

    g.save();
    g.translate(h.x, h.y);
    g.lineCap = 'round';

    for (const side of [-1, 1]) {
      const ex = side * eyeX;
      if (blink > 0.5) {
        g.strokeStyle = '#1b1b22';
        g.lineWidth = Math.max(1.4, h.r * 0.075);
        g.beginPath();
        g.arc(ex, eyeY, h.r * 0.17, Math.PI * 0.15, Math.PI * 0.85);
        g.stroke();
        continue;
      }
      g.fillStyle = '#fdfdff';
      g.beginPath();
      g.ellipse(ex, eyeY, h.r * 0.175, h.r * 0.2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#1b1b22';
      g.beginPath();
      g.ellipse(
        ex + lookX * h.r * 0.055,
        eyeY + lookY * h.r * 0.045,
        h.r * 0.07,
        h.r * 0.15,
        0,
        0,
        Math.PI * 2,
      );
      g.fill();
      g.fillStyle = 'rgba(255,255,255,0.92)';
      g.beginPath();
      g.arc(ex - h.r * 0.05, eyeY - h.r * 0.07, h.r * 0.042, 0, Math.PI * 2);
      g.fill();
    }

    // Nose
    g.beginPath();
    g.moveTo(-h.r * 0.085, h.r * 0.26);
    g.lineTo(h.r * 0.085, h.r * 0.26);
    g.lineTo(0, h.r * 0.375);
    g.closePath();
    g.fillStyle = '#e0788f';
    g.fill();
    g.strokeStyle = shade(color, 0.55);
    g.lineWidth = Math.max(1, h.r * 0.04);
    g.stroke();

    // Mouth
    g.strokeStyle = 'rgba(30,30,38,0.62)';
    g.lineWidth = Math.max(1, h.r * 0.05);
    g.beginPath();
    g.moveTo(0, h.r * 0.375);
    g.lineTo(0, h.r * 0.45);
    g.stroke();
    g.beginPath();
    g.arc(-h.r * 0.11, h.r * 0.45, h.r * 0.13, 0, Math.PI * 0.85);
    g.arc(h.r * 0.11, h.r * 0.45, h.r * 0.13, Math.PI * 0.15, Math.PI);
    g.stroke();

    // Whiskers. See whiskerGeometry() — short, and faded along the stroke.
    g.lineWidth = Math.max(0.8, h.r * 0.022);
    for (const w of whiskerGeometry(h, whisk)) {
      const fade = g.createLinearGradient(w.x0, w.y0, w.tipX, w.tipY);
      fade.addColorStop(0, 'rgba(30,30,38,0.34)');
      fade.addColorStop(0.5, 'rgba(30,30,38,0.19)');
      fade.addColorStop(1, 'rgba(30,30,38,0)');
      g.strokeStyle = fade;
      g.beginPath();
      g.moveTo(w.x0, w.y0);
      g.quadraticCurveTo(w.cx, w.cy, w.tipX, w.tipY);
      g.stroke();
    }

    g.restore();
  }

  function drawHand(): void {
    if (!inside) return;
    const hover = Math.max(0, 1 - Math.hypot(px - W / 2, py - bodyTop) / (bodyLen * 0.8));
    g.save();
    g.translate(px, py);
    // The hand tips forward as it presses, which is what makes the contact read.
    g.rotate(-0.28 + (pressing ? 0.16 : 0) - hover * 0.05);

    const skin = '#f7d6bd';
    const line = '#cf9f7d';
    g.fillStyle = skin;
    g.strokeStyle = line;
    g.lineJoin = 'round';

    // Palm
    g.beginPath();
    g.ellipse(0, -30, 24, 20, 0, 0, Math.PI * 2);
    g.fill();

    // Fingers, splayed and curling towards the cat. Long enough to actually
    // reach it — short stubs read as a paw hovering above the animal.
    const reach = 40;
    for (let i = 0; i < 4; i++) {
      const fx = -17 + i * 11.5;
      const len = reach - Math.abs(i - 1.5) * 5;
      const tipX = fx + (i - 1.5) * 1.8;
      const tipY = -22 + len;
      g.beginPath();
      g.moveTo(fx, -24);
      g.quadraticCurveTo(fx + 2, -24 + len * 0.62, tipX, tipY);
      g.lineWidth = 11.5;
      g.lineCap = 'round';
      g.strokeStyle = skin;
      g.stroke();
      g.lineWidth = 1.8;
      g.strokeStyle = line;
      g.beginPath();
      g.arc(tipX, tipY, 5.6, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    }

    // Thumb, tucked in on the left.
    g.beginPath();
    g.moveTo(-21, -34);
    g.quadraticCurveTo(-35, -26, -29, -12);
    g.strokeStyle = skin;
    g.lineWidth = 13;
    g.lineCap = 'round';
    g.stroke();

    g.lineWidth = 1.6;
    g.strokeStyle = line;
    g.beginPath();
    g.arc(0, -4, 12, Math.PI * 0.15, Math.PI * 0.85);
    g.stroke();

    g.restore();
  }

  function heartPath(x: number, y: number, s: number): void {
    g.beginPath();
    g.moveTo(x, y + s * 0.75);
    g.bezierCurveTo(x - s * 1.4, y - s * 0.4, x - s * 0.5, y - s * 1.35, x, y - s * 0.5);
    g.bezierCurveTo(x + s * 0.5, y - s * 1.35, x + s * 1.4, y - s * 0.4, x, y + s * 0.75);
    g.closePath();
  }

  function drawHearts(): void {
    for (const h of hearts) {
      const t = Math.max(0, Math.min(1, h.life));
      g.save();
      g.globalAlpha = t * 0.85;
      g.fillStyle = '#ff6f9c';
      heartPath(h.x, h.y, h.size * (0.6 + t * 0.5));
      g.fill();
      g.restore();
    }
  }

  function paint(): void {
    g.clearRect(0, 0, W, H);
    drawShadow();
    drawTail();
    drawLegs();
    // Body and head come out of one fused field, so there is no seam between
    // them for the eye to catch.
    drawBody();
    drawEars();
    drawFace();
    drawHearts();
    drawHand();
  }

  // -------------------------------------------------------------- main loop
  let raf = 0;
  let last = performance.now();
  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    try {
      step(dt);
      paint();
    } catch (err) {
      console.error('[softlab] cat frame threw', err);
    }
  }
  raf = requestAnimationFrame(frame);

  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__catDebug = {
      /** Canvas-local point for a named part, so a test can aim a pointer at it. */
      pointOf(part: string): { x: number; y: number } {
        const h = headCenter();
        const tb = tailBase();
        if (part === 'back') {
          const i = Math.round(SEGMENTS * 0.5);
          return { x: restX[i], y: y[i] - r[i] };
        }
        if (part === 'ear') return { x: h.x - h.r * 0.5, y: h.y - h.r * 0.86 };
        if (part === 'tail') return { x: tb.x + bodyR * 1.5, y: tb.y - bodyR * 2.2 };
        if (part === 'paw') return pawPosition(0);
        if (part === 'head') return { x: h.x, y: h.y };
        return { x: W / 2, y: bodyTop };
      },
      /** Whisker reach as a fraction of the head radius. */
      whiskers(): number[] {
        const h = headCenter();
        return whiskerGeometry(h, whisk).map(
          (w) => Math.hypot(w.tipX - w.x0, w.tipY - w.y0) / h.r,
        );
      },
      /** Sum of every deviation from rest. 0 = perfectly settled. */
      spread(): number {
        let s = 0;
        for (let i = 0; i < SEGMENTS; i++) {
          s += Math.abs(y[i] - restY[i]) + Math.abs(r[i] - restR[i]);
        }
        return s;
      },
      /** How far the given segment's top edge has sunk, in px. */
      dipAt(i: number): number {
        return y[i] - restY[i] - (r[i] - restR[i]);
      },
      /** Top edge of the body at a fraction along its length. */
      topAt(t: number): number {
        const i = Math.min(SEGMENTS - 1, Math.max(0, Math.round(t * (SEGMENTS - 1))));
        return y[i] - r[i];
      },
      hearts: () => hearts.length,
      /** Pointer state, for diagnosing a press that fails to register. */
      pointer: () => ({ inside, pressing, px: Math.round(px), py: Math.round(py) }),
      /** Purr state: the level we asked for, and what the param actually holds. */
      purr: () => ({
        muted,
        requested: Math.round(purrLevel * 10000) / 10000,
        actual: audio ? Math.round(audio.gain.gain.value * 10000) / 10000 : null,
        state: audio ? audio.ctx.state : 'none',
      }),
      get bodyR() { return bodyR; },
      get bodyLen() { return bodyLen; },
      get size() { return { W, H }; },
    };
  }

  return {
    setColor(hex: string) {
      color = hex;
    },
    setMuted(value: boolean) {
      muted = value;
      // Force the next setPurr to actually write, instead of being skipped as
      // "no change" against a level from before the mute.
      purrLevel = -1;
      // Suspending the context is the only reliable "off": a gain ramp alone
      // still runs the oscillators, and any later setTargetAtTime call would
      // resurrect the level before the ramp ever reached zero.
      if (value) {
        if (audio) {
          audio.gain.gain.cancelScheduledValues(audio.ctx.currentTime);
          audio.gain.gain.setValueAtTime(0, audio.ctx.currentTime);
          if (audio.ctx.state === 'running') void audio.ctx.suspend();
        }
      } else {
        ensureAudio();
      }
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      void audio?.ctx.close();
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('blur', onBlur);
      canvas.remove();
    },
  };
}
