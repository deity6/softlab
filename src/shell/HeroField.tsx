import { useEffect, useRef } from 'react';
import {
  FULLSCREEN_VS,
  bindFullscreen,
  buildProgram,
  createFullscreenBuffer,
  fitCanvas,
  getGL,
  startLoop,
} from '../lib/webgl';
import { HASH, NOISE } from '../lib/glsl';
import { onThemeChange } from '../lib/theme';

/**
 * The hero background: a slow domain-warped field with contour lines, so the
 * page reads like a material-analysis chart rather than a gradient mesh.
 * Cursor proximity pushes a warm displacement through it.
 */
const FRAG = `
precision highp float;
varying vec2 v_uv;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_mouseActive;
uniform vec3 u_paper, u_wash, u_line, u_accent;

${HASH}
${NOISE}

void main() {
  float aspect = u_res.x / max(u_res.y, 1.0);
  vec2 p = (v_uv - 0.5) * vec2(aspect, 1.0) * 2.2;
  float t = u_time * 0.05;

  // Domain warp — two rounds is enough for a flowing, non-repeating field.
  vec2 q = vec2(fbm(p + t), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(
    fbm(p + 2.0 * q + vec2(1.7, 9.2) + 0.12 * t),
    fbm(p + 2.0 * q + vec2(8.3, 2.8) - 0.10 * t)
  );
  float f = fbm(p + 2.2 * r);
  float v = f * 0.74 + r.x * 0.26;

  // Cursor: a well in the field. Because colour comes from contours and not
  // from v itself, this reads as the map deforming under the pointer rather
  // than a pink smudge floating on top of it.
  vec2 m = (u_mouse - 0.5) * vec2(aspect, 1.0) * 2.2;
  vec2 dm = p - m;
  float pull = exp(-dot(dm, dm) * 1.5) * u_mouseActive;
  v -= pull * 0.8;

  // Read from the theme rather than hard-coded. The three are the exact sRGB
  // values of --paper, --paper-deep and the contour line, so the field tracks
  // the page instead of staying stubbornly pale under a dark theme — which is
  // what the visitor sees as "the hero board is still bright white".
  vec3 paper = u_paper;
  vec3 wash  = u_wash;
  vec3 line  = u_line;

  // Mostly paper. The field only reads through its contours, so the type on
  // top never has to fight a muddy gradient.
  vec3 col = mix(paper, wash, smoothstep(0.22, 0.88, v) * 0.9);

  // Topographic slicing — a material-analysis readout, not a lava lamp.
  float slice = v * 11.0 + t * 1.2;
  float minorBand = fract(slice);
  float minor = smoothstep(0.0, 0.02, minorBand) * smoothstep(0.07, 0.035, minorBand);
  float majorBand = fract(slice * 0.2);
  float major = smoothstep(0.0, 0.012, majorBand) * smoothstep(0.05, 0.022, majorBand);
  col = mix(col, line, minor * 0.26 + major * 0.18);

  // A single accent following the cursor.
  col = mix(col, u_accent, pull * 0.12);

  gl_FragColor = vec4(col, 1.0);
}
`;

export default function HeroField() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = getGL(canvas);
    if (!gl) return;

    let built;
    try {
      built = buildProgram(gl, FRAG, FULLSCREEN_VS, ['u_res', 'u_time', 'u_mouse', 'u_mouseActive', 'u_paper', 'u_wash', 'u_line', 'u_accent'], ['a_pos']);
    } catch (err) {
      console.warn('[softlab] hero field disabled:', err);
      (window as unknown as Record<string, unknown>).__heroDiag = { stage: 'shader-failed', err: String(err) };
      return;
    }

    const diag: Record<string, unknown> = { stage: 'running', frames: 0, w: 0, h: 0, cw: 0 };
    (window as unknown as Record<string, unknown>).__heroDiag = diag;

    const buffer = createFullscreenBuffer(gl);
    gl.useProgram(built.program);
    bindFullscreen(gl, buffer, built.attribs.a_pos);

    /* The field's three paper tones are the page's, read once from the
       cascade and cached. Watching the dark-mode media query (rather than
       re-reading a computed style every frame) keeps this off the hot path:
       the theme changes at most twice per visit. */
    type Rgb = [number, number, number];
    const readVar = (name: string, fallback: Rgb): Rgb => {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      if (!v) return fallback;
      // Handles #rrggbb and `r g b`; anything else (a color-mix expression,
      // a named colour) falls back rather than silently rendering black.
      const hex = v.match(/^#([0-9a-f]{6})$/i);
      if (hex) {
        // Two characters per channel, at offsets 0 / 2 / 4. An off-by-one here
        // is silent: slicing at [1,3,5] reads `#0b0e14` as rgb(176,225,20) —
        // a bright green — and in light mode the three channels all exceed 1
        // and get clamped to white, which is why the bug only *showed* in dark.
        return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16) / 255) as Rgb;
      }
      const nums = v.match(/-?[\d.]+/g);
      if (nums && nums.length >= 3) {
        return [Number(nums[0]) / 255, Number(nums[1]) / 255, Number(nums[2]) / 255];
      }
      return fallback;
    };

    let tone: { paper: Rgb; wash: Rgb; line: Rgb; accent: Rgb } = {
      paper: readVar('--paper', [0.961, 0.969, 0.98]),
      wash: readVar('--paper-deep', [0.906, 0.922, 0.949]),
      line: readVar('--line-strong', [0.663, 0.714, 0.788]),
      accent: readVar('--accent', [0.231, 0.51, 0.965]),
    };
    // The dark-mode tokens are alpha-blended over the page behind them; the
    // canvas is opaque, so resolve them against the dark paper first.
    /* The canvas paints the page background, so it has to be told when the
       *effective* theme changes — not when the OS does. Reading
       `data-scheme` off <html> is what makes an explicit switch work here:
       listening only to the media query would keep the field pale after a
       visitor picked dark by hand. */
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const retheme = () => {
      const eff = document.documentElement.dataset.scheme;
      const isDark = eff ? eff === 'dark' : dark.matches;
      if (isDark) {
        tone = {
          paper: readVar('--paper', [0.043, 0.055, 0.078]),
          wash: readVar('--paper-deep', [0.027, 0.035, 0.063]),
          line: [0.2, 0.24, 0.32],
          accent: readVar('--accent', [0.478, 0.663, 1]),
        };
      } else {
        tone = {
          paper: readVar('--paper', [0.961, 0.969, 0.98]),
          wash: readVar('--paper-deep', [0.906, 0.922, 0.949]),
          line: readVar('--line-strong', [0.663, 0.714, 0.788]),
          accent: readVar('--accent', [0.231, 0.51, 0.965]),
        };
      }
    };
    retheme();
    dark.addEventListener('change', retheme);
    /* The important one. `dark.addEventListener` only fires when the *OS*
       changes its mind; pressing the sun/moon in the header does not touch
       that media query at all, so the field kept its old palette until a
       reload. This is the listener that makes the switch visible here. */
    const offTheme = onThemeChange(retheme);

    const start = performance.now();
    const stop = startLoop(
      canvas,
      () => ({ width: canvas.width, height: canvas.height }),
      ({ pointer }) => {
        fitCanvas(canvas, 1.5);
        diag.frames = (diag.frames as number) + 1;
        diag.w = canvas.width;
        diag.h = canvas.height;
        diag.cw = canvas.clientWidth;
        // Dev-only: 让验收脚本能读到"这个场到底认了谁的坐标"。
        // 球接管后这里必须跟着球走 —— 否则说明球只是个画在页面上的装饰。
        diag.pointer = [
          Number(pointer.x.toFixed(4)),
          Number(pointer.y.toFixed(4)),
          pointer.inside,
        ];
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.useProgram(built!.program);
        gl.uniform2f(built!.uniforms.u_res, canvas.width, canvas.height);
        gl.uniform1f(built!.uniforms.u_time, (performance.now() - start) / 1000);
        gl.uniform2f(built!.uniforms.u_mouse, pointer.x, pointer.y);
        gl.uniform1f(built!.uniforms.u_mouseActive, pointer.inside ? 1 : 0);
        gl.uniform3f(built!.uniforms.u_paper, ...tone.paper);
        gl.uniform3f(built!.uniforms.u_wash, ...tone.wash);
        gl.uniform3f(built!.uniforms.u_line, ...tone.line);
        gl.uniform3f(built!.uniforms.u_accent, ...tone.accent);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    );

    return () => {
      stop();
      offTheme();
      dark.removeEventListener('change', retheme);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(built.program);
    };
  }, []);

  return <canvas ref={ref} className="hero__field" aria-hidden />;
}
