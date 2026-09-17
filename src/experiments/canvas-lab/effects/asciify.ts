import type { EffectContext, EffectInstance } from './types';

/**
 * Asciify — the live DOM is sampled into a luminance grid and redrawn as ASCII,
 * revealed through a lens that follows the cursor.
 *
 * canvas-ui reads the page through the experimental HTML-in-canvas API. Where
 * that is unavailable it falls back to a GPU overlay that cannot see the DOM at
 * all. We take a third route: we already know every glyph and where it sits, so
 * we rasterise the text ourselves into an offscreen canvas, measure coverage per
 * cell, and emit characters. Same result, zero experimental APIs, and the text
 * underneath stays selectable.
 *
 * Why it looks like a grid and not like mush — two rules, both learned the hard
 * way:
 *
 *   1. The cell is the glyph's own advance box, measured at runtime with
 *      `measureText`. Pick a cell size by hand and the glyphs drift off the
 *      grid: a 9px cell holding a 5.4px glyph leaves gaps that read as noise.
 *      Match them and every row is flush.
 *   2. One glyph per cell, sized to that cell — never to the source text.
 *      Sizing by the source font (up to 104px on the headline) smears a single
 *      glyph across a dozen cells.
 *
 * Coverage is read off the alpha channel, so a cell that is half inside a
 * stroke comes back as half covered and gets a mid-density glyph.
 */

const RAMP = [' ', '.', ':', '-', '=', '+', '*', '#', '%', '@'];
/** Glyph size. The cell falls out of this, not the other way round. */
const FONT_PX = 11;
/**
 * Row pitch as a multiple of the glyph size. Deliberately near 1.0: a glyph
 * occupies roughly 0.72 em of height, so anything looser leaves gutter between
 * rows and the grid reads as scattered dots instead of as type.
 */
const LEADING = 1.02;
const LENS = 176;

export function createAsciify(ctx: EffectContext): EffectInstance {
  const { stage, prose, chars } = ctx;

  // The real text is punched out under the lens (see [data-masked] in the
  // stylesheet) so the ASCII layer replaces it instead of doubling over it.
  prose.dataset.masked = 'true';
  prose.style.setProperty('--fx-lens', `${LENS}px`);

  const layer = document.createElement('canvas');
  layer.className = 'fx-layer fx-asciify';
  stage.appendChild(layer);
  const g = layer.getContext('2d');

  const probe = document.createElement('canvas');
  const pg = probe.getContext('2d', { willReadFrequently: true });

  let pointerX = -9999;
  let pointerY = -9999;
  let dirty = true;
  let raf = 0;
  let ready = false;

  function build(): void {
    if (!g || !pg) return;
    const W = Math.max(1, stage.clientWidth);
    const H = Math.max(1, stage.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    layer.width = Math.round(W * dpr);
    layer.height = Math.round(H * dpr);
    layer.style.width = `${W}px`;
    layer.style.height = `${H}px`;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    // 1. Rasterise the real text at real positions, at 1:1, for sampling.
    probe.width = W;
    probe.height = H;
    pg.setTransform(1, 0, 0, 1, 0, 0);
    pg.clearRect(0, 0, W, H);
    pg.fillStyle = '#000';
    pg.textAlign = 'center';
    pg.textBaseline = 'middle';

    const sr = stage.getBoundingClientRect();
    const fontCache = new Map<Element, string>();
    for (const el of chars) {
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.bottom < sr.top || r.top > sr.bottom) continue;
      const parent = el.parentElement ?? el;
      let font = fontCache.get(parent);
      if (!font) {
        const cs = getComputedStyle(parent);
        font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        fontCache.set(parent, font);
      }
      pg.font = font;
      pg.fillText(el.textContent ?? '', r.left - sr.left + r.width / 2, r.top - sr.top + r.height / 2);
    }

    const data = pg.getImageData(0, 0, W, H).data;

    // 2. Fold the luminance field into cells and emit a glyph per cell.
    // Bold, because a regular-weight glyph in a 6px cell has less ink than the
    // stroke it is standing in for, and the swap reads as the type fading out.
    g.font = `700 ${FONT_PX}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#14181f';

    // Monospace advance is a fixed fraction of the em, so measuring one glyph
    // gives us the exact pitch to lay the grid out on.
    const CELL_W = g.measureText('M').width;
    const CELL_H = FONT_PX * LEADING;
    if (!(CELL_W > 0.5)) return;

    for (let y = 0; y < H; y += CELL_H) {
      for (let x = 0; x < W; x += CELL_W) {
        const px0 = x | 0;
        const py0 = y | 0;
        const px1 = Math.min(Math.ceil(x + CELL_W), W);
        const py1 = Math.min(Math.ceil(y + CELL_H), H);
        let sum = 0;
        let n = 0;
        for (let py = py0; py < py1; py++) {
          const row = py * W;
          for (let px = px0; px < px1; px++) {
            sum += data[(row + px) * 4 + 3];
            n++;
          }
        }
        if (!n) continue;
        // Gamma on coverage: thin strokes would otherwise land on '.' and ':'
        // and the whole grid reads as noise rather than as type.
        const coverage = Math.pow(sum / n / 255, 0.55);
        if (coverage < 0.05) continue;
        const idx = Math.min(RAMP.length - 1, Math.round(coverage * (RAMP.length - 1)));
        const glyph = RAMP[idx];
        if (glyph === ' ') continue;
        g.fillText(glyph, x + CELL_W / 2, y + CELL_H / 2);
      }
    }
    dirty = false;
    ready = true;
  }

  function frame(): void {
    raf = requestAnimationFrame(frame);
    if (dirty) build();
    if (!ready) return;
    const at = `${pointerX}px ${pointerY}px`;
    // Solid most of the way out, then a short falloff. A wide gradient leaves
    // most of the grid half-transparent, which reads as "faint noise" rather
    // than as type. The prose layer punches the matching hole (see CSS) so the
    // two are complementary rather than overlapping.
    layer.style.maskImage =
      `radial-gradient(circle ${LENS}px at ${at}, #000 0%, #000 72%, rgba(0,0,0,0) 100%)`;
    // The prose layer punches the matching hole so the two never overlap.
    prose.style.setProperty('--fx-x', `${pointerX}px`);
    prose.style.setProperty('--fx-y', `${pointerY}px`);
  }

  const onMove = (e: PointerEvent) => {
    const r = stage.getBoundingClientRect();
    pointerX = e.clientX - r.left;
    pointerY = e.clientY - r.top;
  };
  const onLeave = () => {
    pointerX = -9999;
    pointerY = -9999;
  };

  stage.addEventListener('pointermove', onMove);
  stage.addEventListener('pointerleave', onLeave);
  const ro = new ResizeObserver(() => {
    dirty = true;
  });
  ro.observe(stage);
  if (document.fonts?.ready) void document.fonts.ready.then(() => { dirty = true; });

  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerleave', onLeave);
      layer.remove();
      delete prose.dataset.masked;
      prose.style.removeProperty('--fx-lens');
      prose.style.removeProperty('--fx-x');
      prose.style.removeProperty('--fx-y');
    },
  };
}
