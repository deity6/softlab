import { useEffect, useRef } from 'react';
import { virtualPointer } from '../lib/virtualPointer';

interface CharState {
  el: HTMLElement;
  baseX: number;
  baseY: number;
  ox: number;
  oy: number;
  vx: number;
  vy: number;
}

interface Props {
  text: string;
  /** rendered before the accent run */
  accentFrom?: number;
  className?: string;
  /** max push distance in px */
  push?: number;
  /** cursor falloff radius in px */
  radius?: number;
}

/** 桌面 wordmark 的**实测字号**（`clamp(58px, 15.5vw, 232px)` 在 1440 宽下 ≈ 223px）。
 *  push / radius 这些数值都是在这个尺寸上一遍遍试出来的，所以它就是缩放基准。 */
const REF_FONT = 223;

/**
 * Characters are individual soft bodies: the cursor shoves them away and a
 * critically-damped spring pulls them home. Cheap, but it is the same idea the
 * whole site is built on, applied to type.
 *
 * The dodge is deliberately oversized. At display size a 30px nudge is
 * invisible on a 180px-tall wordmark, so a pushed character also tilts, swells
 * and grows a layered offset shadow — the sticker trick the reference site
 * uses — and then springs back.
 *
 * Both `pointermove` and `mousemove` are listened to: some input paths only
 * deliver one of them, and a wordmark that silently stops responding is worse
 * than two cheap listeners.
 */
export default function ElasticText({ text, accentFrom, className, push = 52, radius = 340 }: Props) {
  const hostRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const els = Array.from(host.querySelectorAll<HTMLElement>('[data-char]'));
    if (!els.length) return;

    const chars: CharState[] = els.map((el) => ({
      el,
      baseX: 0,
      baseY: 0,
      ox: 0,
      oy: 0,
      vx: 0,
      vy: 0,
    }));

    // Dev-only probe: `window.__elastic` reports the live cursor, the target
    // each character is being pulled toward, and where it actually is. Without
    // it the only way to debug this is guesswork from screenshots.
    // ⚠️ 必须定义在 measure() **之前**：measure 会往里写 push/radius，而首次
    //    measure() 紧随其后就调用 —— 放在后面就是 TDZ 报错。
    const dbg = import.meta.env.DEV
      ? ((window as unknown as Record<string, unknown>).__elastic = {
          mouse: virtualPointer,
          active: false,
          targets: [] as number[],
          offsets: [] as number[],
          moves: 0,
          /** 按字号缩放后的实际推力 / 半径，以及缩放系数本身（改推力时用它核对两端） */
          push: 0,
          radius: 0,
          fontK: 0,
          fontSize: 0,
        })
      : null;

    /* 推开距离与作用半径按**实际字号**等比缩放。
       它们本来是在桌面那个 223px 的 wordmark 上试出来的固定像素值；手机上字号只有
       ~60px，同样的 56px 推力比一个字母还大 —— 读起来就是"字被炸开"，而不是"让开"
       （用户 2026-09-17 在移动端看到并反馈"躲避效果更夸张了，和桌面同步一下"）。
       缩放之后两端观感一致，而且窗口 resize / 字号变化会自动跟随 ——
       不需要任何设备判定，也就不会出现"判定错了效果就崩"这种事。 */
    let pushNow = push;
    let radiusNow = radius;
    let r2 = radiusNow * radiusNow;

    const measure = () => {
      const hr = host.getBoundingClientRect();
      const fs = parseFloat(getComputedStyle(host).fontSize) || REF_FONT;
      const k = Math.min(1.2, Math.max(0.16, fs / REF_FONT));
      pushNow = push * k;
      radiusNow = radius * k;
      r2 = radiusNow * radiusNow;
      if (dbg) {
        dbg.push = Math.round(pushNow * 10) / 10;
        dbg.radius = Math.round(radiusNow);
        dbg.fontK = Math.round(k * 1000) / 1000;
        dbg.fontSize = Math.round(fs);
      }
      for (const c of chars) {
        const prev = c.el.style.transform;
        c.el.style.transform = 'none';
        const r = c.el.getBoundingClientRect();
        c.el.style.transform = prev;
        c.baseX = r.left + r.width / 2 - hr.left;
        c.baseY = r.top + r.height / 2 - hr.top;
      }
    };
    measure();

    // The pointer is read from a single shared source now (`src/lib/virtualPointer`):
    // the real cursor on desktop, the draggable orb on touch. Owning the listeners
    // here would make the orb a *fake event*; reading a shared coordinate makes it
    // a *real pointer position* — which is the whole point of the orb.
    let lastX = NaN;
    let lastY = NaN;
    const onMove = (e: PointerEvent | MouseEvent) => {
      // The orb hijacks the pointer while it is being dragged or coasting.
      // Without this the real mouse and the orb would fight over one coordinate
      // and the wordmark would jitter between the two.
      if (virtualPointer.hijacked) return;
      // Both `pointermove` and `mousemove` fire for a real cursor, and some
      // environments also replay a stale position. Dropping repeats costs
      // nothing and stops two sources from fighting over the same frame.
      if (e.clientX === lastX && e.clientY === lastY) return;
      lastX = e.clientX;
      lastY = e.clientY;
      virtualPointer.x = e.clientX;
      virtualPointer.y = e.clientY;
      virtualPointer.active = true;
    };
    const onLeave = () => {
      virtualPointer.active = false;
      virtualPointer.x = -9999;
      virtualPointer.y = -9999;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);

    const ro = new ResizeObserver(measure);
    ro.observe(host);

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const hr = host.getBoundingClientRect();
      const px = virtualPointer.x;
      const py = virtualPointer.y;
      const live = virtualPointer.active;

      if (dbg) {
        dbg.active = live;
        dbg.moves = px === -9999 ? 0 : 1;
      }

      for (let ci = 0; ci < chars.length; ci++) {
        const c = chars[ci];
        const wx = hr.left + c.baseX;
        const wy = hr.top + c.baseY;
        const dx = wx - px;
        const dy = wy - py;
        const d2 = dx * dx + dy * dy;

        let tx = 0;
        let ty = 0;
        if (live && d2 < r2) {
          const d = Math.sqrt(d2) || 1;
          const force = 1 - d / radiusNow;
          // The character directly under the cursor has no direction to flee
          // in (dx,dy ≈ 0), so it would sit still. Give it a guaranteed upward
          // pop, which is what "the letter jumps out of the way" reads as.
          const near = Math.max(0, 1 - d / (radiusNow * 0.25));
          const amount = force * force * pushNow;
          tx = (dx / d) * amount;
          ty = (dy / d) * amount - near * (pushNow * 0.39);
        }
        if (dbg) {
          dbg.targets[ci] = Math.round(Math.hypot(tx, ty) * 10) / 10;
        }

        // Spring toward the target. The old form had a `-k·x` rest term whose
        // steady state was 90/(90+240)·tx ≈ 0.27·tx, so a 56px shove moved the
        // glyph 7px — invisible. Aim straight at the target and let damping
        // supply the bounce; ζ ≈ 0.7 gives one clean overshoot on release.
        const k = 150;
        const damp = 17;
        c.vx += ((tx - c.ox) * k - damp * c.vx) * dt;
        c.vy += ((ty - c.oy) * k - damp * c.vy) * dt;
        const nx = c.ox + c.vx * dt;
        const ny = c.oy + c.vy * dt;
        if (Math.abs(nx) < 0.004 && Math.abs(c.vx) < 0.004) {
          c.ox = 0; c.vx = 0;
        } else {
          c.ox = nx;
        }
        if (Math.abs(ny) < 0.004 && Math.abs(c.vy) < 0.004) {
          c.oy = 0; c.vy = 0;
        } else {
          c.oy = ny;
        }

        // How far this character currently is from home, 0..1. It drives the
        // tilt, the swell and the shadow, so a shoved letter reads as shoved.
        const amp = Math.min(1, Math.hypot(c.ox, c.oy) / (pushNow || 1));
        const tilt = (c.ox / (pushNow || 1)) * 9;
        if (dbg) {
          dbg.offsets[ci] = Math.round(Math.hypot(c.ox, c.oy) * 10) / 10;
        }
        c.el.style.transform =
          `translate3d(${c.ox.toFixed(2)}px, ${c.oy.toFixed(2)}px, 0)` +
          ` rotate(${tilt.toFixed(2)}deg) scale(${(1 + amp * 0.16).toFixed(3)})`;

        if (amp > 0.02) {
          c.el.style.textShadow =
            `${(3 * amp).toFixed(1)}px ${(3 * amp).toFixed(1)}px 0 rgba(59, 130, 246, 0.5), ` +
            `${(7 * amp).toFixed(1)}px ${(7 * amp).toFixed(1)}px 0 rgba(20, 24, 31, 0.14)`;
        } else if (c.el.style.textShadow) {
          c.el.style.textShadow = '';
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      ro.disconnect();
      for (const c of chars) {
        c.el.style.transform = '';
        c.el.style.textShadow = '';
      }
    };
  }, [radius, push]);

  const chars = Array.from(text);
  return (
    <span ref={hostRef} className={className} aria-label={text}>
      {chars.map((ch, i) => (
        <span
          key={`${ch}-${i}`}
          data-char
          aria-hidden
          style={{
            display: 'inline-block',
            whiteSpace: 'pre',
            willChange: 'transform',
            color: accentFrom !== undefined && i >= accentFrom ? 'var(--accent)' : undefined,
          }}
        >
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </span>
  );
}
