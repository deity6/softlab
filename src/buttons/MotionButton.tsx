import { useEffect, useRef, type CSSProperties, type RefObject } from 'react';
import type { ButtonEntry } from './registry';
import { durationMs } from '../motion/tokens';
import { createWater, type WaterHandle } from './water';

const ARROW_SVG =
  '<svg viewBox="0 0 16 16" fill="none"><path d="M2 8h11M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const CHECK_SVG = '<svg viewBox="0 0 20 20" width="100%" height="100%"><path d="M4 10.5 8 14.5 16 6"/></svg>';

/**
 * Effects that answer to hover. In a demo people press things first, so these
 * also fire once on click: `.is-live` mirrors their :hover rule long enough to
 * play, then everything springs back (see the demo-buttons block in index.css).
 *
 * `elastic-stretch` is deliberately NOT here any more — it became a click
 * effect with its own stacking behaviour (see bindElasticStretch), and running
 * both would replay it twice per press.
 */
const REPLAYS_ON_CLICK = new Set([
  'fill-sweep', 'border-draw', 'liquid-fill', 'glow-pulse',
  'arrow-slide', 'split-reveal',
]);

interface MotionApi {
  progress(el: Element, pct: number): unknown;
  reset(el: Element, delay?: number): unknown;
}

/**
 * Drives the progress effect. The motion system exposes `progress(el, pct)` but
 * deliberately does not own a clock — that belongs to the app — so the demo
 * runs its own rAF ramp and then resets.
 */
function runProgress(el: HTMLElement) {
  const api = (window as unknown as { MotionButtons?: MotionApi }).MotionButtons;
  if (!api) return;

  const dur = 1600;
  const start = performance.now();
  const tick = (now: number) => {
    const p = Math.min(1, (now - start) / dur);
    // ⭐ 尾段收束（tail settle，见 docs/motion-timing-standard.md §4）：
    //    指数从 3 提到 4 —— 最后 10% 的进度要多花约 56% 的时间，
    //    读起来就是"进度条快满了，正慢慢爬到位"。这正是用户点名的"加载感"。
    //    （旧的 ^3 尾部只占 46%，收尾不够"黏"。）
    api.progress(el, (1 - Math.pow(1 - p, 4)) * 100);
    if (p < 1) requestAnimationFrame(tick);
    else setTimeout(() => api.reset(el), 1200);
  };
  requestAnimationFrame(tick);
}

/**
 * The ring Border Draw traces.
 *
 * SVG is the right tool here — a CSS border cannot animate as one continuous
 * lap, but `stroke-dashoffset` can. The mistakes were in how I drove it:
 *
 *   ① Measured the viewBox from `clientWidth`, which EXCLUDES the border, so
 *      the ring was scaled down inside the button and never hugged its edge.
 *      Now it is measured from the full border box and the svg is offset out to
 *      the button's outer edge.
 *   ② Rotated the rect 90° to start at 12 o'clock — but the viewBox is not
 *      square, so the "pill" rendered as a tall vertical capsule.
 *   ③ `preserveAspectRatio="none"` with a fixed viewBox stretched the caps into
 *      ellipses.
 *
 * The ring is a sibling overlay rather than a replacement for the border: the
 * CSS border stays in place (transparent at rest) so the layout box, the flex
 * centring and the pill radius are all unchanged — the ring just draws exactly
 * on top of it.
 */
function BorderRing({ hostRef }: { hostRef: RefObject<HTMLButtonElement | null> }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rectRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const svg = svgRef.current;
    const rect = rectRef.current;
    if (!host || !svg || !rect) return;

    const STROKE = 1.5;

    const measure = () => {
      // offsetWidth/Height include the border — that is the box the ring must
      // trace. (clientWidth would exclude it and inset the ring.)
      const w = Math.max(1, host.offsetWidth);
      const h = Math.max(1, host.offsetHeight);
      // 1 user unit = 1 CSS px: no stretching, and SVG's own antialiasing keeps
      // the 1.5px stroke clean (a conic-gradient sweep rasterised into moiré).
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

      // ⚠️ rx and ry MUST be set to the SAME value — half the height.
      //
      // This was the bug behind three "it renders as an ellipse" reports.
      // `rx: 999px` is clamped to width/2 (69.25) while `ry: 999px` is clamped
      // to height/2 (23.25). SVG clamps the two independently, and when they
      // differ the corners become *elliptical* arcs; with rx = width/2 the top
      // edge's straight run collapses to zero, so the whole capsule degenerates
      // into an ellipse. Measured perimeter was 308.3 vs 330.1 for a true pill.
      //
      // A capsule is: a rectangle in the middle, a semicircle at each end, and
      // its four vertices come from rx = ry = height/2.
      const r = Math.max(0, (h - STROKE) / 2);
      const x = STROKE / 2;
      const y = STROKE / 2;
      const bw = Math.max(0, w - STROKE);
      const bh = Math.max(0, h - STROKE);
      rect.setAttribute('x', String(x));
      rect.setAttribute('y', String(y));
      rect.setAttribute('width', String(bw));
      rect.setAttribute('height', String(bh));
      rect.setAttribute('rx', String(r));
      rect.setAttribute('ry', String(r));

      // An absolutely positioned child resolves % against the PADDING box, so
      // the svg has to be pushed out by the border width to reach the outer
      // edge. Read it rather than assume it.
      const borderW = parseFloat(getComputedStyle(host).borderTopWidth) || 0;
      host.style.setProperty('--mo-ring-inset', `${borderW}px`);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [hostRef]);

  return (
    <svg className="mo-ring" ref={svgRef} aria-hidden>
      <rect ref={rectRef} pathLength={100} />
    </svg>
  );
}

/**
 * Renders one motion-system button.
 *
 * The DOM structure each effect needs is written here in JSX on purpose: the
 * behaviour layer in `motion.buttons.js` builds those nodes only when it cannot
 * find them, so providing them up front keeps React the sole owner of the tree
 * and stops the two from fighting over children.
 */
export default function MotionButton({ entry, size }: { entry: ButtonEntry; size?: 'sm' | 'lg' }) {
  const ref = useRef<HTMLButtonElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waterRef = useRef<WaterHandle | null>(null);

  // Liquid Fill: own the surface simulation for as long as the button is
  // mounted, and drive it from the same hover/click states as everything else.
  useEffect(() => {
    if (entry.id !== 'liquid-fill') return;
    const btn = ref.current;
    const canvas = canvasRef.current;
    if (!btn || !canvas) return;

    const water = createWater(canvas, () =>
      getComputedStyle(btn).getPropertyValue('--mo-accent').trim() || '#3b82f6',
    );
    waterRef.current = water;

    const fill = () => water.setLevel(1);
    const drain = () => water.setLevel(0);

    btn.addEventListener('pointerenter', fill);
    btn.addEventListener('pointerleave', drain);
    btn.addEventListener('focus', fill);
    btn.addEventListener('blur', drain);
    // click-to-replay keeps the water up for the same beat as the CSS effects
    const onClick = () => {
      fill();
      window.setTimeout(drain, durationMs(entry.token) + 120);
    };
    btn.addEventListener('click', onClick);

    return () => {
      btn.removeEventListener('pointerenter', fill);
      btn.removeEventListener('pointerleave', drain);
      btn.removeEventListener('focus', fill);
      btn.removeEventListener('blur', drain);
      btn.removeEventListener('click', onClick);
      water.destroy();
      waterRef.current = null;
    };
  }, [entry.id, entry.token]);

  useEffect(() => {
    if (!REPLAYS_ON_CLICK.has(entry.id)) return;
    const el = ref.current;
    if (!el) return;
    // Hold `is-live` for the effect's own duration (plus a small settle beat).
    // A hard-coded 760ms used to cut longer effects off partway — Border Draw
    // and Glow Pulse are 800ms, so their replay snapped back mid-draw.
    const hold = durationMs(entry.token) + 120;
    let timer = 0;
    const onClick = () => {
      el.classList.add('is-live');
      window.clearTimeout(timer);
      timer = window.setTimeout(() => el.classList.remove('is-live'), hold);
    };
    el.addEventListener('click', onClick);
    return () => {
      el.removeEventListener('click', onClick);
      window.clearTimeout(timer);
      el.classList.remove('is-live');
    };
  }, [entry.id, entry.token]);

  const cls = [
    'mo-btn',
    size === 'sm' ? 'mo-btn--sm' : '',
    size === 'lg' ? 'mo-btn--lg' : '',
    `mo-${entry.id}`,
  ]
    .filter(Boolean)
    .join(' ');

  const common = {
    type: 'button' as const,
    ref,
    className: cls,
    'data-mo': entry.id,
    'data-mo-next': entry.next,
    'data-mo-click': entry.click,
  };

  switch (entry.id) {
    // Border Draw: a measured SVG ring, one continuous lap.
    case 'border-draw':
      return (
        <button {...common}>
          <BorderRing hostRef={ref} />
          {entry.label}
        </button>
      );


    // Liquid Fill: a real surface simulation, so the water can slosh, overshoot
    // and sit unevenly instead of rising as one flat rectangle.
    case 'liquid-fill':
      return (
        <button {...common}>
          <canvas className="mo-water-canvas" ref={canvasRef} aria-hidden />
          {entry.label}
        </button>
      );

    case 'arrow-slide':
      return (
        <button {...common}>
          <span className="mo-label">{entry.label}</span>
          <span className="mo-ico" aria-hidden dangerouslySetInnerHTML={{ __html: ARROW_SVG }} />
        </button>
      );

    // Magnetic: the label is wrapped so the inner counter-move has a target.
    case 'magnetic':
      return (
        <button {...common}>
          <span className="mo-label">{entry.label}</span>
        </button>
      );

    // Cursor Spot: a damped refractive lens under the pointer, plus a gloss
    // band that sweeps diagonally to the right on click.
    case 'cursor-spot':
      return (
        <button {...common}>
          <span className="mo-spot" aria-hidden />
          <span className="mo-gloss" aria-hidden />
          <span className="mo-label">{entry.label}</span>
        </button>
      );

    case 'text-swap':
      return (
        <button {...common} data-mo-next={entry.next ?? entry.label}>
          <span className="mo-swap">
            <span className="mo-swap__current">{entry.label}</span>
            <span className="mo-swap__next">{entry.next ?? entry.label}</span>
          </span>
          <span className="mo-ico" aria-hidden dangerouslySetInnerHTML={{ __html: ARROW_SVG }} />
        </button>
      );

    // Split Reveal: the label is split PER CHARACTER, not clipped down the
    // middle. Clipping (`inset(0 50% 0 0)`) cut whichever glyph straddled the
    // centre in half, and the two halves stayed opaque after moving, so the
    // old and new text stacked into "SREVEALEDT". Per-character spans let each
    // glyph travel outward and fade to 0, while the new text fades in — no
    // clipping, nothing left behind.
    case 'split-reveal': {
      const oldChars = [...entry.label];
      const nextChars = [...(entry.next ?? entry.label)];
      const mid = (oldChars.length - 1) / 2;
      return (
        <button {...common}>
          <span className="mo-split">
            <span className="mo-split__ghost" aria-hidden>
              {entry.label}
            </span>
            <span className="mo-split__old" aria-hidden>
              {oldChars.map((ch, i) => (
                <span
                  className="mo-split__ch"
                  key={i}
                  style={{ '--mo-dir': (i - mid).toFixed(2) } as CSSProperties}
                >
                  {ch === ' ' ? '\u00A0' : ch}
                </span>
              ))}
            </span>
            <span className="mo-split__next">
              {nextChars.map((ch, i) => (
                <span
                  className="mo-split__nch"
                  key={i}
                  style={{ '--mo-i': i } as CSSProperties}
                >
                  {ch === ' ' ? '\u00A0' : ch}
                </span>
              ))}
            </span>
          </span>
        </button>
      );
    }

    // 3D Flip: two fill layers that alternate — blue rises from the bottom,
    // then green covers it from the top, and so on. The button starts with NO
    // fill (like any other button); the fills only appear once it is triggered.
    case 'flip-3d':
      return (
        <button {...common} aria-pressed="false">
          <span className="mo-flip__fill mo-flip__fill--blue" aria-hidden />
          <span className="mo-flip__fill mo-flip__fill--green" aria-hidden />
          <span className="mo-flip__inner">
            <span className="mo-flip__side mo-flip__front">{entry.label}</span>
            <span className="mo-flip__side mo-flip__back">{entry.next ?? entry.label}</span>
          </span>
        </button>
      );

    // Loading Morph: 三个层 —— 初始文案 / 转圈 / 完成文案。
    // 完成态要**换文案**（Save → Saved），否则"转完又回到原点"——
    // 对一个 save 按钮来说那样不合理。两段文案各自一个 span，靠
    // `.is-loading` / `.is-done` 切换透明度，宽度由 CSS 令牌驱动。
    case 'loading-morph':
      return (
        <button {...common} aria-live="polite">
          <span className="mo-label">{entry.label}</span>
          <span className="mo-done" aria-hidden>
            {entry.next ?? 'Saved'}
          </span>
          <span className="mo-spinner" aria-hidden />
        </button>
      );

    // Success Morph: **形状不变**，加载感靠 ::before 的扫掠光带（见 PART 12）——
    // 刻意不做成 Loading Morph 那种"收缩成圆"，两者要能一眼分开。
    // 完成时整块转绿，对勾用描边画出来，外面散一圈泛光。
    case 'success-morph':
      return (
        <button {...common} aria-live="polite">
          <span className="mo-label">{entry.label}</span>
          <span className="mo-check" aria-hidden dangerouslySetInnerHTML={{ __html: CHECK_SVG }} />
        </button>
      );

    case 'progress':
      return (
        <button {...common} onClick={(e) => runProgress(e.currentTarget)}>
          <span className="mo-label">{entry.label}</span>
          <span className="mo-pct">0%</span>
        </button>
      );

    case 'particle-burst':
      return (
        <button {...common}>
          {entry.label}
          {Array.from({ length: 24 }, (_, i) => (
            <span className="mo-particle" key={i} aria-hidden />
          ))}
        </button>
      );

    // Ripple: the label needs its own stacking context so the rings can pass
    // behind the text without hiding it (rings are z-index 0, label is 1).
    case 'ripple':
      return (
        <button {...common}>
          <span className="mo-label">{entry.label}</span>
        </button>
      );

    default:
      return <button {...common}>{entry.label}</button>;
  }
}
