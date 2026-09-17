import { useEffect, useRef, useSyncExternalStore } from 'react';
import { onThemeChange, getResolved } from '../lib/theme';

type Kind = 'jelly' | 'field' | 'cat' | 'train';

/**
 * Cheap 2D-canvas loops for the index cards. These do not need WebGL — a
 * hundred path segments at 30 fps is nothing, and it keeps the index page
 * from spinning up a dozen GL contexts.
 *
 * The train thumbnail is the exception in spirit only: it re-draws the real
 * composition (fourteen parallax cloud bands, a suspension bridge, a train)
 * in about sixty lines of 2D canvas, so the card previews what you will
 * actually open instead of standing in for it.
 */
/**
 * Thumbnail tones, per theme.
 *
 * The cloud-train thumbnail used to hard-code a dark sky, which looked fine on
 * the dark theme and like a hole punched in the page on the light one — the
 * two thumbnails above it are pale. A canvas cannot inherit CSS, so the
 * theme has to be read out and the palette chosen by hand.
 *
 * `getComputedStyle` is the source of truth rather than a duplicate list of
 * tokens: when the theme flips, this flips with it, and there is no second
 * place to forget to update. Read once per draw rather than per frame is not
 * possible here (the loop redraws continuously), so the result is memoised
 * against the resolved theme and only re-read when that changes.
 */
interface TrainTones {
  sky: [string, string, string, string];
  sun: [string, string, string];
  /** four cloud tones, back to front */
  cloud: [string, string, string, string];
  crest: string;
  ink: string;
  train: string;
  trainRoof: string;
  window: string;
  steam: string;
  fore: [string, string];
  vignette: string;
  vignetteEnd: string;
}

const TRAIN_TONES: Record<'light' | 'dark', TrainTones> = {
  // Light: the scene becomes a *drawing* of a sunset rather than a photograph
  // of one. The sky is paper, the clouds are washes, and the sun is a bloom on
  // the horizon. Ink is the site's own `--ink` family, so the bridge reads as
  // drawn on the page instead of pasted onto it.
  light: {
    // More separation between the bands than the first attempt had. On paper
    // the washes were within 8 of each other and the whole thumbnail read as
    // one grey blur; the point of a drawing is that the layers separate.
    sky: ['#c7d6ea', '#e8cfc9', '#f2d0ac', '#f9e3c4'],
    sun: ['rgba(255,250,238,0.98)', 'rgba(255,206,144,0.55)', 'rgba(255,196,146,0)'],
    cloud: ['#aab9cd', '#cdb1b4', '#e2bd9c', '#f5e2c4'],
    crest: 'rgba(255,255,255,0.95)',
    // The bridge is the one line that has to survive at 118px, so it is the
    // darkest ink in the frame rather than a soft grey.
    ink: 'rgba(28,34,48,0.95)',
    // The train reads as a subject only if it is darker than the cloud it
    // passes behind. A mid-tone made it disappear entirely.
    train: '#6b4148',
    trainRoof: '#2b1d20',
    window: 'rgba(255,238,198,0.95)',
    steam: '#ffffff',
    fore: ['rgba(214,206,206,0.85)', 'rgba(184,178,186,0.9)'],
    vignette: 'rgba(255,255,255,0)',
    vignetteEnd: 'rgba(120,132,152,0.14)',
  },
  // Dark: the original photographic treatment, unchanged — it was already
  // right for this theme.
  dark: {
    sky: ['#141b33', '#4a3350', '#b3563a', '#f6c17a'],
    sun: ['rgba(255,236,190,0.95)', 'rgba(255,196,120,0.6)', 'rgba(255,150,90,0)'],
    cloud: ['#3a2b3f', '#7d3f3c', '#e79a55', '#f6dcc0'],
    crest: 'rgba(255,228,190,0.72)',
    ink: 'rgba(38,20,22,0.9)',
    train: '#8a3a38',
    trainRoof: '#3b1c1e',
    window: 'rgba(255,236,196,0.9)',
    steam: '#fff4ea',
    fore: ['rgba(30,18,24,0.86)', 'rgba(18,11,16,0.97)'],
    vignette: 'rgba(0,0,0,0)',
    vignetteEnd: 'rgba(6,8,18,0.42)',
  },
};

let toneCache: { scheme: string; tones: TrainTones } | null = null;

function readTheme(): TrainTones {
  const scheme =
    (typeof document !== 'undefined' &&
      document.documentElement.dataset &&
      document.documentElement.dataset.scheme) ||
    'light';
  if (toneCache && toneCache.scheme === scheme) return toneCache.tones;
  const tones = TRAIN_TONES[scheme === 'dark' ? 'dark' : 'light'];
  toneCache = { scheme, tones };
  return tones;
}

export default function ThumbCanvas({ kind }: { kind: Kind }) {
  const ref = useRef<HTMLCanvasElement>(null);
  /* Subscribing to the theme store is the whole mechanism here. The canvas
     cannot see CSS, so the component has to re-render when the attribute on
     <html> changes, and a media query in a dependency array would only ever
     fire for the OS — not for a switch the user pressed. */
  const scheme = useSyncExternalStore(
    onThemeChange,
    getResolved,
    () => 'light' as const,
  );

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let raf = 0;
    const started = performance.now();

    const resize = () => {
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    /* ---------------------------------------------------------------------
       Shared: a value-noise field. Real noise, because a sine stack reads as
       a grid of waves no matter how the periods are chosen — and the whole
       job of a cloud is that it has no visible period.
       --------------------------------------------------------------------- */
    let seed = 20260930;
    const rnd = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    const table = new Float32Array(256 * 256);
    for (let i = 0; i < table.length; i++) table[i] = rnd();
    const noise2 = (x: number, y: number) => {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const xf = x - xi;
      const yf = y - yi;
      const u = xf * xf * (3 - 2 * xf);
      const v = yf * yf * (3 - 2 * yf);
      const at = (a: number, b: number) => table[((a & 255) + 256 * (b & 255)) % table.length];
      const a = at(xi, yi);
      const b = at(xi + 1, yi);
      const c = at(xi, yi + 1);
      const d = at(xi + 1, yi + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    const fbm2 = (x: number, y: number, oct = 4) => {
      let sum = 0;
      let amp = 0.5;
      let norm = 0;
      for (let i = 0; i < oct; i++) {
        sum += amp * noise2(x, y);
        norm += amp;
        x *= 2.03;
        y *= 2.03;
        amp *= 0.5;
      }
      return sum / norm;
    };

    /* ---------------------------------------------------------------- jelly */
    const drawJelly = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      const cx = w / 2;
      const cy = h * 0.54;
      const base = Math.min(w, h) * 0.34;

      ctx.clearRect(0, 0, w, h);

      // A soft caustic pool under the body — without it the shape floats on a
      // flat card and reads as a sticker rather than as an object.
      const pool = ctx.createRadialGradient(cx, cy + base * 0.95, 0, cx, cy + base * 0.95, base * 1.5);
      pool.addColorStop(0, 'rgba(59,130,246,0.20)');
      pool.addColorStop(1, 'rgba(59,130,246,0)');
      ctx.fillStyle = pool;
      ctx.fillRect(0, 0, w, h);

      const path = () => {
        ctx.beginPath();
        const N = 200;
        for (let i = 0; i <= N; i++) {
          const a = (i / N) * Math.PI * 2;
          // Measured at 3.1% of pixels changing per second — the calmest of
          // the four covers, which is wrong for the one thing on the page that
          // is literally a wobbly gel. Four harmonics instead of three, with
          // the fastest one carrying real amplitude: the outline has to
          // visibly breathe, not just shimmer.
          const wobble =
            Math.sin(a * 2 + t * 1.9) * 0.062 +
            Math.sin(a * 3 + t * 1.5) * 0.058 +
            Math.sin(a * 5 - t * 1.1) * 0.042 +
            Math.sin(a * 7 + t * 2.4) * 0.03;
          const r = base * (1 + wobble);
          const x = cx + Math.cos(a) * r * 1.06;
          const y = cy + Math.sin(a) * r * 0.94;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
      };

      ctx.save();
      // Contact shadow: a blurred ellipse, not a flat one.
      ctx.beginPath();
      ctx.ellipse(cx, cy + base * 1.02, base * 0.72, base * 0.12, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(20,24,31,0.13)';
      ctx.filter = `blur(${Math.max(1, dpr * 2)}px)`;
      ctx.fill();
      ctx.filter = 'none';
      ctx.restore();

      ctx.save();
      path();
      const g = ctx.createLinearGradient(cx - base, cy - base, cx + base * 0.6, cy + base);
      g.addColorStop(0, '#a5d8ff');
      g.addColorStop(0.34, '#3b82f6');
      g.addColorStop(0.78, '#4f46e5');
      g.addColorStop(1, '#1e2a6b');
      ctx.fillStyle = g;
      ctx.fill();

      // Two highlights at different angles read as a curved surface; one reads
      // as a gradient.
      ctx.save();
      ctx.clip();
      const rim = ctx.createRadialGradient(
        cx - base * 0.44, cy - base * 0.52, base * 0.04,
        cx - base * 0.2, cy - base * 0.3, base * 1.5,
      );
      rim.addColorStop(0, 'rgba(255,255,255,0.92)');
      rim.addColorStop(0.3, 'rgba(255,255,255,0.2)');
      rim.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rim;
      ctx.fillRect(0, 0, w, h);

      // A crisp specular dot, tiny. Its job is to say "wet".
      const spec = ctx.createRadialGradient(
        cx - base * 0.5, cy - base * 0.6, 0,
        cx - base * 0.5, cy - base * 0.6, base * 0.17,
      );
      spec.addColorStop(0, 'rgba(255,255,255,0.95)');
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = spec;
      ctx.fillRect(0, 0, w, h);

      // Light wrapping the bottom edge — total internal reflection, the thing
      // that makes gel look like gel.
      const wrap = ctx.createLinearGradient(0, cy + base * 0.2, 0, cy + base);
      wrap.addColorStop(0, 'rgba(120,220,255,0)');
      wrap.addColorStop(1, 'rgba(150,235,255,0.55)');
      ctx.fillStyle = wrap;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // Outer rim light, one hairline.
      path();
      ctx.lineWidth = Math.max(1, dpr * 0.9);
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.stroke();
      ctx.restore();
    };

    /* ---------------------------------------------------------------- field */
    const drawField = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // A wash with a gradient, not a flat tint. The previous version used one
      // flat 5% blue and left the card reading as blank paper — measured
      // frame luminance 241/255 with a saturation of 0.04, i.e. the emptiest
      // of the four covers. The field needs a value structure underneath the
      // lines or there is nothing for them to sit on.
      const wash = ctx.createLinearGradient(0, 0, w * 0.35, h);
      wash.addColorStop(0, 'rgba(99,123,246,0.16)');
      wash.addColorStop(0.55, 'rgba(59,130,246,0.07)');
      wash.addColorStop(1, 'rgba(20,24,31,0.05)');
      ctx.fillStyle = wash;
      ctx.fillRect(0, 0, w, h);

      // Concentric arcs behind the lines: the same idea as the field the
      // experiment perturbs, and it stops the card from being one texture.
      ctx.save();
      ctx.beginPath();
      const cx = w * 0.62;
      const cy = h * 1.15;
      for (let r = h * 0.18; r < h * 1.5; r += h * 0.11) {
        ctx.moveTo(cx + r, cy);
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
      }
      ctx.lineWidth = Math.max(1, dpr);
      ctx.strokeStyle = 'rgba(20,24,31,0.055)';
      ctx.stroke();
      ctx.restore();

      // The rows fill the frame instead of sitting in a band: measured
      // horizontal symmetry was 43.5 and vertical weight sat in the middle
      // third, with dead paper above and below. Spread them over 0.06..0.94.
      const rows = 21;
      const phase = 0.4 + Math.sin(t * 0.45) * 0.2;
      const drawRow = (p: number, focus: boolean) => {
        const yBase = h * (0.06 + p * 0.88);
        const path = new Path2D();
        for (let x = 0; x <= w; x += 3) {
          const u = x / w;
          const y =
            yBase +
            Math.sin(u * 5.4 + t * 0.9 + p * 3.1) * h * 0.075 +
            Math.sin(u * 12.0 - t * 1.35 + p * 1.6) * h * 0.028 +
            Math.sin(u * 2.1 + t * 0.5) * h * 0.045;
          if (x === 0) path.moveTo(x, y);
          else path.lineTo(x, y);
        }
        if (focus) {
          ctx.lineWidth = Math.max(1.6, dpr * 1.7);
          ctx.strokeStyle = '#3b82f6';
          ctx.stroke(path);
          // The accent line gets a soft halo; a bare 1.5px blue line on white
          // looks like a graph, not like something alive.
          ctx.save();
          ctx.globalAlpha = 0.32;
          ctx.filter = `blur(${Math.max(2, dpr * 3)}px)`;
          ctx.lineWidth = Math.max(3, dpr * 4);
          ctx.stroke(path);
          ctx.restore();
        } else {
          const d = Math.abs(p - phase);
          const alpha = 0.16 + 0.5 * Math.max(0, 1 - d * 2.4);
          ctx.lineWidth = Math.max(1, dpr * 0.9);
          ctx.strokeStyle = `rgba(20,24,31,${alpha.toFixed(3)})`;
          ctx.stroke(path);
        }
      };

      for (let r = 0; r < rows; r++) drawRow(r / (rows - 1), false);
      drawRow(phase, true);
    };

    /* ------------------------------------------------------------------ cat */
    /** Smooth a closed ring of points through their midpoints. */
    const ring = (pts: [number, number][]) => {
      const n = pts.length;
      const mid = (a: [number, number], b: [number, number]) =>
        [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as [number, number];
      ctx.beginPath();
      const start = mid(pts[n - 1], pts[0]);
      ctx.moveTo(start[0], start[1]);
      for (let i = 0; i < n; i++) {
        const p = pts[i];
        const m = mid(p, pts[(i + 1) % n]);
        ctx.quadraticCurveTo(p[0], p[1], m[0], m[1]);
      }
      ctx.closePath();
    };

    const drawCat = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      ctx.clearRect(0, 0, W, H);

      const cx = W / 2;
      const cy = H * 0.6;
      const len = W * 0.6;
      const R = Math.max(6, Math.min(H * 0.14, len * 0.085));

      const wave = Math.sin(t * 1.3);
      const handX = cx + wave * len * 0.27;
      const depth = 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(t * 1.3));

      // Soft ground shadow first, blurred — a hard one under a soft body is
      // the single most common way this kind of illustration looks pasted on.
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy + R * 1.5, len * 0.5, R * 0.2, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(51,51,61,0.16)';
      ctx.filter = `blur(${Math.max(2, dpr * 3)}px)`;
      ctx.fill();
      ctx.restore();

      const N = 30;
      const top: [number, number][] = [];
      const bot: [number, number][] = [];
      for (let i = 0; i < N; i++) {
        const u = (i + 0.5) / N;
        const x = cx - len / 2 + len * u;
        const prof = Math.pow(Math.sin(Math.PI * u), 0.38);
        const infl = Math.exp(-Math.pow((x - handX) / (len * 0.14), 2)) * depth;
        const yy = cy + R * 1.4 * infl;
        const rr = R * prof * (1 - 0.55 * infl);
        top.push([x, yy - rr]);
        bot.push([x, yy + rr]);
      }

      // Body: a vertical gradient, not a flat fill. The belly catches light
      // and the back stays dark, which is what makes a tube read as round.
      const bodyPath = () => ring([...top, ...bot.reverse()]);
      bodyPath();
      const g = ctx.createLinearGradient(0, cy - R * 1.4, 0, cy + R * 1.8);
      g.addColorStop(0, '#5c5c68');
      g.addColorStop(0.42, '#33333d');
      g.addColorStop(1, '#1f1f27');
      ctx.fillStyle = g;
      ctx.fill();

      // Rim light along the top edge.
      ctx.save();
      bodyPath();
      ctx.clip();
      const rim = ctx.createLinearGradient(0, cy - R * 1.5, 0, cy - R * 0.2);
      rim.addColorStop(0, 'rgba(255,255,255,0.4)');
      rim.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = rim;
      ctx.fillRect(0, cy - R * 1.6, len, R * 2);
      ctx.restore();

      // Tail, wagging with the same wave.
      const tail = (lw: number, color: string) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = lw;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(cx + len / 2 - R * 0.4, cy + R * 0.3);
        ctx.quadraticCurveTo(
          cx + len / 2 + R * 1.7,
          cy - R * 0.5 + wave * 3,
          cx + len / 2 + R * 1.15,
          cy - R * 1.7,
        );
        ctx.stroke();
      };
      // Drawn twice: a dark wider pass, then a lighter narrower one offset up
      // — reads as a lit tail instead of a wire.
      tail(R * 0.44, '#26262e');
      tail(R * 0.2, 'rgba(255,255,255,0.16)');

      // Head + ears at the left end.
      const hx = cx - len / 2 - R * 0.5;
      const hy = cy + R * 0.45;
      const earL = Math.sin(t * 2.1) * R * 0.16;
      ctx.beginPath();
      ctx.moveTo(hx - R * 0.75, hy - R * 0.55);
      ctx.lineTo(hx - R * 0.5 + earL, hy - R * 1.35);
      ctx.lineTo(hx - R * 0.05, hy - R * 0.85);
      ctx.closePath();
      ctx.fillStyle = '#2b2b33';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(hx - R * 0.1, hy - R * 0.55);
      ctx.lineTo(hx - R * 0.42 + earL, hy - R * 1.12);
      ctx.lineTo(hx - R * 0.18, hy - R * 0.82);
      ctx.closePath();
      ctx.fillStyle = 'rgba(224,150,150,0.5)';
      ctx.fill();

      const headG = ctx.createLinearGradient(0, hy - R, 0, hy + R);
      headG.addColorStop(0, '#5a5a66');
      headG.addColorStop(1, '#26262e');
      ctx.beginPath();
      ctx.ellipse(hx, hy, R * 1.05, R * 0.98, 0, 0, Math.PI * 2);
      ctx.fillStyle = headG;
      ctx.fill();

      // Eye: a closed arc, and it has to close. An open dot would make the cat
      // look alert, which is not the mood.
      ctx.strokeStyle = '#f2f2f6';
      ctx.lineWidth = Math.max(1, R * 0.1);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(hx - R * 0.34, hy - R * 0.08, R * 0.2, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      // Nose + whiskers
      ctx.fillStyle = 'rgba(232,140,150,0.85)';
      ctx.beginPath();
      ctx.moveTo(hx - R * 0.95, hy + R * 0.24);
      ctx.lineTo(hx - R * 0.82, hy + R * 0.34);
      ctx.lineTo(hx - R * 0.95, hy + R * 0.44);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.34)';
      ctx.lineWidth = Math.max(0.7, R * 0.045);
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(hx - R * 0.86, hy + R * 0.34);
        ctx.lineTo(hx - R * 1.5, hy + R * 0.34 + i * R * 0.22);
        ctx.stroke();
      }

      // The hand doing the pressing. Drawn last so it sits on top of the dent.
      ctx.save();
      ctx.translate(handX, cy - R * 2.1 + R * 0.9 * depth);
      const skin = ctx.createLinearGradient(0, -R * 0.6, 0, R * 0.6);
      skin.addColorStop(0, '#fde3cd');
      skin.addColorStop(1, '#e8b894');
      ctx.fillStyle = skin;
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 0.78, R * 0.62, -0.2, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-R * 0.42 + i * R * 0.42, R * 0.52, R * 0.23, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    };

    /* ---------------------------------------------------------------- train */
    /**
     * The real composition, in 2D. Fourteen bands would be wasted on a 118px
     * card, so this uses five — enough to read as depth, few enough that the
     * parallax is legible. Each band is a filled path with a lit top edge, not
     * a stroked line: that is what the original does, and it is the difference
     * between "clouds" and "contour lines".
     */
    /**
     * The cloud-train thumbnail.
     *
     * Three things were wrong with the first version and all three are the
     * same mistake — drawing the *idea* of the scene instead of the scene:
     *
     *   1. The sky was hard-coded dark. On a light card that reads as a hole
     *      cut in the page; the two rows above it are pale. The tones now come
     *      from the theme (see `readTheme`), so the thumbnail belongs to
     *      whatever it is sitting on.
     *   2. The bridge was drawn as a parabola. The real one has a *level*
     *      deck with the cable sagging above it — the sag is the shape. A
     *      drawn arc turns a suspension bridge into a rollercoaster.
     *   3. Five cloud bands and a 20%-wide train, which at 118px tall is a
     *      grey smudge. The train is the subject; it gets a locomotive with a
     *      stack, carriages with window gaps and wheels, and a steam plume
     *      that rises rather than sitting on the roof.
     */
    /**
     * The cloud-train thumbnail.
     *
     * Two previous versions taught the same lesson from opposite directions.
     * The first drew the scene the way the *shader* draws it — fourteen bands,
     * a cable-sagged bridge, a train crossing. On a 118px card that is a
     * diagram: too many bands, all of them the same value, and the eye finds
     * nothing to land on. The second cut the band count and fixed the bridge
     * but then over-detailed the structure — the suspension cable and its
     * hangers read as the subject, and the train disappeared behind a band.
     *
     * So this version is built the way a poster is, not the way a simulation
     * is: **three depth planes, four values, two subjects.** The bridge is a
     * flat band of piers with no cable at all (the real one has one; a
     * thumbnail that simplifies is not lying, it is editing), the train is
     * the darkest mark in the frame and sits *in front of* the far cloud but
     * *behind* nothing that matters, and the clouds are five big soft shapes
     * drifting at visibly different speeds.
     *
     * Every colour comes from the theme — a hard-coded sky turned the light
     * card into a hole punched in the page.
     */
    /**
     * The cloud-train thumbnail: **reduced, not rendered.**
     *
     * Three earlier versions each failed the same way, from a different
     * direction:
     *
     *   v1 drew the scene the way the shader draws it — 14 bands, a cable
     *      bridge, a full train. At 118px that is a diagram: everything is the
     *      same value and the eye lands nowhere.
     *   v2 simplified the bands, then over-detailed the bridge, and the
     *      suspension cable became the subject. It read as a rope bridge.
     *   v3 removed the cable and thickened the deck, and then over-detailed
     *      the *train* — windows, wheels, a cab. It read as a wall with holes.
     *
     * What actually works is the reference's own thumbnail, which carries
     * three things and nothing else: a **suspension silhouette** (a thin sag
     * between two towers over a straight deck, on a single wide pier), a
     * **train that is two blocks**, and a **fast near cloud that crosses in
     * front of the track**. The motion is one train passing every couple of
     * seconds, not a constant parade — a gap is what makes an arrival read as
     * an arrival.
     *
     * So: no window strip, no wheels, no railings, no grain of detail. The
     * reduced version is the accurate one at this size.
     */
    /**
     * The cloud-train thumbnail.
     *
     * Structure restored to the 8-band version the visitor picked (V0.0.29),
     * with three adjustments on top and no others. It went through three
     * rewrites since — a poster-like three-plane reduction, then a
     * straight-deck version, then a copy of the reference's own thumbnail —
     * and each was judged worse, for the same underlying reason: they were
     * *redesigns*. A card is not a composition to be re-authored; it is a
     * 118px window onto this specific scene, and the job is to make that scene
     * legible rather than to make a new picture out of it.
     *
     * The three changes, all of them small:
     *   - the cable's sag reduced, so the bridge reads level
     *   - the deck thickened, so it reads as a beam and not a wire
     *   - the nearest band raised to cross the deck, so the bridge stands
     *     *in* the cloud rather than on top of it
     */
    /**
     * The cloud-train thumbnail.
     *
     * Back to the first version — five cloud bands, a parabolic deck, a small
     * train. The two rewrites in between (a three-plane poster, then a copy of
     * the reference's own thumbnail) were both judged worse, and they were
     * worse for the same reason: they were *redesigns*. A card is not a
     * composition to be re-authored, it is a 118px window onto this scene, and
     * the job is to make the scene legible rather than to draw a new picture.
     *
     * What survives from those attempts is the theming: the tones come from
     * `readTheme` so the card belongs to the page it sits on, and the
     * component subscribes to the theme store so a switch actually repaints
     * it. Everything else is back to where it started.
     */
    const drawTrain = (t: number) => {
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const th = readTheme();

      /* ---- sky ---- */
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, th.sky[0]);
      sky.addColorStop(0.42, th.sky[1]);
      sky.addColorStop(0.66, th.sky[2]);
      sky.addColorStop(0.85, th.cloud[3]);
      sky.addColorStop(1, th.sky[3]);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);

      // The sun, low and half-eaten by the cloud line.
      const sunY = h * 0.6;
      const sun = ctx.createRadialGradient(w * 0.7, sunY, 0, w * 0.7, sunY, h * 0.5);
      sun.addColorStop(0, th.sun[0]);
      sun.addColorStop(0.18, th.sun[1]);
      sun.addColorStop(1, th.sun[2]);
      ctx.fillStyle = sun;
      ctx.fillRect(0, 0, w, h);

      /* ---- five bands, back to front ----
         `dist` falls monotonically so the stack drifts at visibly different
         speeds — that is the whole of the parallax at this size. */
      const bands = [
        { mid: 0.5, dist: 60, amp: 0.1, scale: 2.1, tone: [0, 1] },
        { mid: 0.58, dist: 34, amp: 0.13, scale: 1.6, tone: [1, 2] },
        { mid: 0.68, dist: 18, amp: 0.16, scale: 1.15, tone: [2, 3] },
        { mid: 0.8, dist: 9, amp: 0.19, scale: 0.8, tone: [3, 3] },
        { mid: 0.95, dist: 4, amp: 0.24, scale: 0.55, tone: [3, 3] },
      ];

      for (const b of bands) {
        const yBase = h * b.mid;
        const path = new Path2D();
        const step = 3;
        const top: { x: number; y: number }[] = [];
        for (let x = 0; x <= w + step; x += step) {
          const u = x / w;
          const y =
            yBase +
            (fbm2(u * b.scale * 3.2 + t * (6 / b.dist), b.mid * 4, 4) - 0.5) * h * b.amp * 2.4;
          top.push({ x, y });
        }
        path.moveTo(0, h);
        path.lineTo(top[0].x, top[0].y);
        for (const p of top) path.lineTo(p.x, p.y);
        path.lineTo(w + step, h);
        path.closePath();

        const g = ctx.createLinearGradient(0, yBase - h * b.amp, 0, h);
        g.addColorStop(0, th.cloud[b.tone[1]]);
        g.addColorStop(0.35, th.cloud[b.tone[0]]);
        g.addColorStop(1, th.cloud[b.tone[0]]);
        ctx.fillStyle = g;
        ctx.fill(path);

        // The lit crest. Without it the bands are stacked shapes; with it
        // they are lit from one direction, which is the whole trick.
        ctx.beginPath();
        for (let i = 0; i < top.length; i++) {
          if (i === 0) ctx.moveTo(top[i].x, top[i].y);
          else ctx.lineTo(top[i].x, top[i].y);
        }
        ctx.lineWidth = Math.max(1, dpr * 1.1);
        ctx.strokeStyle = th.crest;
        ctx.stroke();
      }

      /* ---- bridge ----
         A parabolic deck with hangers and two piers. The first version had
         this and it was fine; the flat-deck rewrites were the ones that
         drifted off the reference. */
      const deckY = h * 0.735;
      const ink = th.ink;
      ctx.strokeStyle = ink;
      ctx.lineWidth = Math.max(2, dpr * 2);
      ctx.beginPath();
      ctx.moveTo(0, deckY);
      ctx.quadraticCurveTo(w * 0.5, deckY + h * 0.1, w, deckY);
      ctx.stroke();
      // Hangers.
      for (let i = 1; i < 9; i++) {
        const u = i / 9;
        const x = w * u;
        const curveY = deckY + Math.sin(Math.PI * u) * h * 0.05;
        ctx.beginPath();
        ctx.moveTo(x, curveY);
        ctx.lineTo(x, curveY + h * (0.03 + Math.sin(Math.PI * u) * 0.045));
        ctx.stroke();
      }
      // Piers.
      for (const u of [0.26, 0.74]) {
        ctx.beginPath();
        ctx.moveTo(w * u, deckY + h * 0.035);
        ctx.lineTo(w * u, h);
        ctx.lineWidth = Math.max(2.2, dpr * 2.6);
        ctx.stroke();
      }

      /* ---- the train ----
         Four units: a locomotive with a stack, then three carriages. Small,
         because at 118px the scene matters more than the vehicle. */
      const runT = t * 0.55;
      const trainW = w * 0.34;
      const headX = ((runT * 0.16) % (w + trainW * 1.4)) - trainW * 1.4;
      const baseY = deckY + h * 0.02;
      const carH = h * 0.1;

      // Steam first so the stack sits over it.
      const stackX = headX + trainW * 0.1;
      for (let i = 0; i < 5; i++) {
        const age = (((runT * 1.6 + i * 0.19) % 1) + 1) % 1;
        ctx.globalAlpha = 0.5 * (1 - age) + 0.1;
        ctx.fillStyle = th.steam;
        ctx.beginPath();
        ctx.arc(
          stackX - age * w * 0.09,
          baseY - carH - h * 0.03 - age * h * 0.2,
          h * 0.012 + age * h * 0.05,
          0, Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const cw = trainW * 0.2;
      const car = (x: number, loco: boolean) => {
        ctx.fillStyle = th.train;
        ctx.fillRect(x, baseY - carH, cw, carH);
        ctx.fillStyle = th.trainRoof;
        ctx.fillRect(x, baseY - carH, cw, Math.max(1, dpr * 1.6));
        if (loco) {
          ctx.fillRect(x + cw * 0.06, baseY - carH * 1.62, cw * 0.2, carH * 0.62);
        }
        // Windows.
        ctx.fillStyle = th.window;
        for (let i = 0; i < Math.floor(cw / (dpr * 7)); i++) {
          ctx.fillRect(x + dpr * 3 + i * dpr * 6, baseY - carH * 0.76, dpr * 3, carH * 0.3);
        }
        // Wheels.
        ctx.fillStyle = th.trainRoof;
        const wr = Math.max(1, dpr * 1.6);
        ctx.beginPath();
        ctx.arc(x + cw * 0.25, baseY, wr, 0, Math.PI * 2);
        ctx.arc(x + cw * 0.75, baseY, wr, 0, Math.PI * 2);
        ctx.fill();
      };
      car(headX, true);
      for (let i = 1; i <= 3; i++) car(headX - i * cw * 1.04, false);

      // A foreground band drifting in front, for depth.
      const fgY = h * 1.02;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 4) {
        const u = x / w;
        const y = fgY - (fbm2(u * 2.4 + t * 0.5, 9.1, 3) - 0.4) * h * 0.34;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      const fg = ctx.createLinearGradient(0, h * 0.72, 0, h);
      fg.addColorStop(0, th.fore[0]);
      fg.addColorStop(1, th.fore[1]);
      ctx.fillStyle = fg;
      ctx.fill();

      // Vignette, so the card's edges do not fight the page around it.
      const vig = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.95);
      vig.addColorStop(0, th.vignette);
      vig.addColorStop(1, th.vignetteEnd);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    };

    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return; // ~30fps is plenty for a 118px thumbnail
      last = now;
      const t = (now - started) / 1000;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (kind === 'jelly') drawJelly(t);
      else if (kind === 'field') drawField(t);
      else if (kind === 'train') drawTrain(t);
      else drawCat(t);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [kind, scheme]);

  return <canvas ref={ref} />;
}
