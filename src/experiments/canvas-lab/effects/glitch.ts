import type { EffectContext, EffectInstance } from './types';

/**
 * Glitch — a worn broadcast signal on top of the page.
 *
 * The chroma split is pure CSS on the real DOM (text-shadow + jitter), while a
 * canvas handles the things CSS is bad at: torn scanline tears and signal noise.
 * Bursts fire on a random schedule so the effect never becomes predictable.
 */

const TEAR_COUNT = 5;

export function createGlitch(ctx: EffectContext): EffectInstance {
  const { stage, prose } = ctx;

  const layer = document.createElement('canvas');
  layer.className = 'fx-layer fx-glitch';
  stage.appendChild(layer);
  const g = layer.getContext('2d');

  let raf = 0;
  let last = 0;
  let dirty = true;
  let burstTimer = 0;
  let burstEnd = 0;

  const ro = new ResizeObserver(() => {
    dirty = true;
  });
  ro.observe(stage);

  function scheduleBurst(): void {
    burstTimer = window.setTimeout(() => {
      const strength = 1 + Math.floor(Math.random() * 3);
      prose.dataset.glitch = String(strength);
      burstEnd = performance.now() + 110 + Math.random() * 330;
      scheduleBurst();
    }, 1100 + Math.random() * 2700);
  }
  scheduleBurst();

  function frame(now: number): void {
    raf = requestAnimationFrame(frame);
    if (!g) return;
    if (dirty) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      layer.width = Math.round(stage.clientWidth * dpr);
      layer.height = Math.round(stage.clientHeight * dpr);
      layer.style.width = `${stage.clientWidth}px`;
      layer.style.height = `${stage.clientHeight}px`;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      dirty = false;
    }
    if (now - last < 60) return;
    last = now;

    const W = stage.clientWidth;
    const H = stage.clientHeight;
    g.clearRect(0, 0, W, H);

    const bursting = prose.dataset.glitch !== undefined && now < burstEnd + 120;
    const intensity = bursting ? Number(prose.dataset.glitch) : 0;

    // Signal noise: a light static haze that breathes.
    const noiseAlpha = 0.018 + intensity * 0.012 + Math.sin(now * 0.002) * 0.006;
    g.fillStyle = `rgba(16,15,13,${Math.max(0, noiseAlpha).toFixed(4)})`;
    for (let y = 0; y < H; y += 4) {
      g.fillRect(0, y, W, 1);
    }

    if (!bursting) return;

    // Horizontal tears — the giveaway of a bad tape.
    for (let i = 0; i < TEAR_COUNT * intensity; i++) {
      const y = Math.random() * H;
      const h = 2 + Math.random() * 14;
      const shift = (Math.random() - 0.5) * 60;
      const rgb = Math.random() < 0.5;
      g.save();
      g.globalAlpha = 0.16 + Math.random() * 0.22;
      g.fillStyle = rgb ? 'rgb(59,130,246)' : 'rgb(0,214,255)';
      g.fillRect(shift, y, W, h);
      g.globalCompositeOperation = 'destination-out';
      g.fillRect(shift + (Math.random() - 0.5) * 40, y + 1, W, h - 2);
      g.restore();
    }

    // One bright tracking band sweeping downward.
    const bandY = ((now * 0.42) % (H + 200)) - 100;
    const grad = g.createLinearGradient(0, bandY, 0, bandY + 90);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, `rgba(255,255,255,${0.1 + intensity * 0.05})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, bandY, W, 90);
  }
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      cancelAnimationFrame(raf);
      window.clearTimeout(burstTimer);
      ro.disconnect();
      delete prose.dataset.glitch;
      layer.remove();
    },
  };
}
