/**
 * 落日云间列车 — WebGL2 渲染器
 *
 * Two passes, exactly like the reference: the scene shader draws into an
 * off-screen texture, the post shader grades it onto the screen. The scene
 * pass reads the *previous* frame (ping-pong pair) which is what produces the
 * long-exposure smear — so there is no way to render this with the simpler
 * "draw straight to the canvas" helpers in `lib/webgl.ts`.
 *
 * The noise lookup table is generated here, not loaded: 1024×1024 single
 * channel, xorshift seeded with 93451. The seed is load-bearing — change it
 * and the cloud shapes change, because the shader samples this table directly
 * rather than hashing coordinates in-shader.
 *
 * Provenance: the shader itself is by mdb ("Up in the CloudSea", supplied to
 * Rice-dog's code-codex, redistributed via incarnation-gem/sunset-cloud-train).
 * Kept verbatim in `scene.frag`; only the post pass and the colour grading
 * are ours. See the experiment's `source` field in the registry.
 */
import sceneFrag from './scene.frag?raw';
import postFrag from './post.frag?raw';

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

/**
 * The foreground is sampled 5× and averaged; the reference collapses the time
 * spread from 4 units to 4/3 so the motion blur stays tight. Kept as a
 * transform rather than a second file so the provenance diff is one line.
 */
const SCENE = sceneFrag.replace('t+4.*float(i)/float(n)/60.', 't+(4./3.)*float(i)/float(n)/60.');

export type TintKey = 'skyTint' | 'smokeTint' | 'trainTint';

export interface CloudTrainSettings {
  /* scene pass */
  speed: number;
  zoom: number;
  offset: number;
  amplitude: number;
  detail: number;
  feedback: number;
  introDuration: number;
  introFeather: number;
  skyTint: string;
  smokeTint: string;
  trainTint: string;
  /* post pass */
  exposure: number;
  saturation: number;
  hue: number;
  temperature: number;
  vignette: number;
  resolution: number;
  /* colour grade — ours, not the reference's */
  gradeShadow: string;
  gradeMid: string;
  gradeHigh: string;
  gradeAmount: number;
  grain: number;
  /* run state */
  introEnabled: boolean;
  paused: boolean;
}

export const DEFAULT_SETTINGS: CloudTrainSettings = {
  speed: 0.4,
  zoom: 0.8,
  offset: 0,
  amplitude: 0.6,
  detail: 8,
  /**
   * Frame smear, as a fraction of the previous frame. The reference shipped
   * 0.3, which on *this* picture reads as a double exposure rather than as
   * motion: the clouds are the only thing moving, and at that much blend their
   * edges double. 0.11 keeps a sense of flow while letting the layer edges
   * stay single. The slider goes to 0.85 for anyone who wants the look back.
   */
  feedback: 0.16,
  introDuration: 3,
  introFeather: 0.15,
  skyTint: '#94b3ff',
  smokeTint: '#ffffff',
  trainTint: '#7a3033',
  exposure: 1,
  saturation: 1,
  hue: 0,
  temperature: 0,
  vignette: 1,
  resolution: 0.75,
  gradeShadow: '#1b2440',
  gradeMid: '#8f7f92',
  gradeHigh: '#ffe6c4',
  gradeAmount: 0.55,
  grain: 0.16,
  introEnabled: true,
  paused: false,
};

export function tintRgb(hex: string): [number, number, number] {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return [1, 1, 1];
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

export interface EngineHandle {
  /** Force a redraw — call after changing a setting while paused. */
  wake(): void;
  /** Restart the opening reveal. */
  replay(): void;
  dispose(): void;
}

interface StartArgs {
  canvas: HTMLCanvasElement;
  /** Read through a ref-like object so the loop always sees fresh settings. */
  settings: { current: CloudTrainSettings };
  /** Fired once the opening reveal finishes. */
  onIntroDone?: () => void;
  onIntroStart?: () => void;
}

export function startCloudTrain({
  canvas,
  settings,
  onIntroDone,
  onIntroStart,
}: StartArgs): EngineHandle {
  const gl = canvas.getContext('webgl2', {
    alpha: false,
    antialias: false,
    depth: false,
  }) as WebGL2RenderingContext | null;
  if (!gl) throw new Error('需要 WebGL 2 支持（WebGL 2 is required）');

  const programs: WebGLProgram[] = [];
  const textures: WebGLTexture[] = [];
  const buffers: WebGLBuffer[] = [];
  const fbos: WebGLFramebuffer[] = [];
  let raf = 0;
  let last = 0;
  let time = 0;
  let w = 0;
  let h = 0;
  let read = 0;
  let history = false;
  let dead = false;
  let frame = 0;
  let introProgress = settings.current.paused ? 1 : 0;
  let grainSeedAtPause = 0;
  let wasPaused = false;

  function program(src: string): WebGLProgram {
    const p = gl!.createProgram()!;
    programs.push(p);
    for (const [type, source] of [
      [gl!.VERTEX_SHADER, VERT],
      [gl!.FRAGMENT_SHADER, src],
    ] as const) {
      const s = gl!.createShader(type)!;
      gl!.shaderSource(s, source);
      gl!.compileShader(s);
      if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) {
        const e = gl!.getShaderInfoLog(s);
        gl!.deleteShader(s);
        throw new Error(e || 'Shader error');
      }
      gl!.attachShader(p, s);
      gl!.deleteShader(s);
    }
    gl!.bindAttribLocation(p, 0, 'p');
    gl!.linkProgram(p);
    if (!gl!.getProgramParameter(p, gl!.LINK_STATUS)) {
      throw new Error(gl!.getProgramInfoLog(p) || 'Link error');
    }
    return p;
  }

  function texture(): WebGLTexture {
    const t = gl!.createTexture()!;
    textures.push(t);
    gl!.bindTexture(gl!.TEXTURE_2D, t);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MIN_FILTER, gl!.LINEAR);
    gl!.texParameteri(gl!.TEXTURE_2D, gl!.TEXTURE_MAG_FILTER, gl!.LINEAR);
    return t;
  }

  function clean() {
    dead = true;
    cancelAnimationFrame(raf);
    for (const p of programs) gl!.deleteProgram(p);
    for (const t of textures) gl!.deleteTexture(t);
    for (const b of buffers) gl!.deleteBuffer(b);
    for (const f of fbos) gl!.deleteFramebuffer(f);
    // The context itself is deliberately not lost: React StrictMode runs the
    // effect twice on mount, and requesting a fresh context each time would
    // leak the first one.
  }

  try {
    const scene = program(SCENE);
    const post = program(postFrag);

    const locs = (p: WebGLProgram, names: string[]) =>
      Object.fromEntries(names.map((k) => [k, gl!.getUniformLocation(p, k)]));

    const tintKeys: TintKey[] = ['skyTint', 'smokeTint', 'trainTint'];
    const a = locs(scene, [
      'iResolution',
      'iTime',
      'iChannel0',
      'iChannel1',
      'uFeedback',
      'zoom',
      'offset',
      'amplitude',
      'uDetail',
      'intro',
      'introFeather',
      ...tintKeys,
    ]);
    const b = locs(post, [
      'resolution',
      'scene',
      'vignette',
      'exposure',
      'saturation',
      'hue',
      'temperature',
      'intro',
      'introFeather',
      'gradeShadow',
      'gradeMid',
      'gradeHigh',
      'gradeAmount',
      'grain',
      'grainSeed',
    ]);

    const quad = gl.createBuffer()!;
    buffers.push(quad);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    /* The noise table. Seed and xorshift constants are the reference's —
       this table *is* the cloud shape, so approximating it changes the art. */
    const noise = texture();
    const data = new Uint8Array(1024 * 1024);
    let seed = 93451;
    for (let i = 0; i < data.length; i++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      data[i] = seed & 255;
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1024, 1024, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

    const targets = [texture(), texture()];
    for (const t of targets) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      fbos.push(gl.createFramebuffer()!);
    }

    const reduced = matchMedia('(prefers-reduced-motion: reduce)');

    function request() {
      if (!dead && !raf && !document.hidden) raf = requestAnimationFrame(draw);
    }

    /* Per-frame `gl.uniform*` calls are the single biggest cost in this loop
       — roughly twenty of them, most of which would be re-sending the value
       that is already there. Skipping unchanged ones is the difference
       between a smooth 60fps and a laptop fan. */
    const cache = new Map<WebGLUniformLocation | null, number | string>();
    function scalar(location: WebGLUniformLocation | null, value: number) {
      if (location && cache.get(location) !== value) {
        gl!.uniform1f(location, value);
        cache.set(location, value);
      }
    }
    function tint(location: WebGLUniformLocation | null, value: string) {
      if (location && cache.get(location) !== value) {
        gl!.uniform3f(location, ...tintRgb(value));
        cache.set(location, value);
      }
    }

    const bounds = canvas.getBoundingClientRect();
    let cssWidth = bounds.width;
    let cssHeight = bounds.height;
    let pixelWidth = 1;
    let pixelHeight = 1;
    let scale = settings.current.resolution;
    const maxViewport = gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array;

    function updatePixelSize() {
      const d = Math.min(window.devicePixelRatio || 1, 1.5) * scale;
      pixelWidth = Math.max(1, Math.min(maxViewport[0], Math.round(cssWidth * d)));
      pixelHeight = Math.max(1, Math.min(maxViewport[1], Math.round(cssHeight * d)));
    }
    updatePixelSize();

    let activeUnit = -1;
    const bound = new Map<number, WebGLTexture | null>();
    function bindTexture(unit: number, t: WebGLTexture) {
      if (bound.get(unit) === t) return;
      if (activeUnit !== unit) {
        gl!.activeTexture(gl!.TEXTURE0 + unit);
        activeUnit = unit;
      }
      gl!.bindTexture(gl!.TEXTURE_2D, t);
      bound.set(unit, t);
    }
    function activate(unit: number) {
      if (activeUnit !== unit) {
        gl!.activeTexture(gl!.TEXTURE0 + unit);
        activeUnit = unit;
      }
    }

    bindTexture(0, noise);
    targets.forEach((t, i) => bindTexture(i + 1, t));
    gl.useProgram(scene);
    gl.uniform1i(a.iChannel0, 0);
    gl.uniform1i(a.iChannel1, 1);
    gl.useProgram(post);
    gl.uniform1i(b.scene, 2);

    function draw(now: number) {
      raf = 0;
      const s = settings.current;

      if (!s.introEnabled || reduced.matches) {
        if (introProgress < 1) {
          introProgress = 1;
          onIntroDone?.();
        }
      } else if (!s.paused) {
        if (introProgress === 0) onIntroStart?.();
        /* Wall-clock, not per-frame. Advancing by a clamped dt meant the
           reveal took at least 60 frames no matter what, so on a machine
           running at 10fps "3 seconds" of opening took 6 — measured 14s
           under software rendering, with the panel stuck off-screen the
           whole time. The animation clock below stays clamped (it feeds the
           clouds, where a spike would jump the whole picture); this one is
           pure UI timing and has no such constraint. */
        introProgress = Math.min(1, introProgress + (now - (last || now)) / (s.introDuration * 1000));
        if (introProgress >= 1) onIntroDone?.();
      }
      if (!s.paused && !reduced.matches) {
        time += Math.min((now - (last || now)) / 1000, 0.05) * s.speed;
      }
      last = now;

      const nw = pixelWidth;
      const nh = pixelHeight;
      if (w !== nw || h !== nh) {
        w = nw;
        h = nh;
        canvas.width = w;
        canvas.height = h;
        // A size change invalidates the smear history: the old frame is a
        // different aspect ratio and would flash for one frame.
        history = false;
        targets.forEach((t, i) => {
          bindTexture(i + 1, t);
          activate(i + 1);
          gl!.texImage2D(gl!.TEXTURE_2D, 0, gl!.RGBA, w, h, 0, gl!.RGBA, gl!.UNSIGNED_BYTE, null);
          gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbos[i] ?? null);
          gl!.framebufferTexture2D(gl!.FRAMEBUFFER, gl!.COLOR_ATTACHMENT0, gl!.TEXTURE_2D, t, 0);
          gl!.clearColor(0, 0, 0, 1);
          gl!.clear(gl!.COLOR_BUFFER_BIT);
        });
        gl!.useProgram(scene);
        gl!.uniform3f(a.iResolution, w, h, 1);
        gl!.useProgram(post);
        gl!.uniform2f(b.resolution, w, h);
        gl!.viewport(0, 0, w, h);
      }

      const write = 1 - read;
      gl!.bindFramebuffer(gl!.FRAMEBUFFER, fbos[write] ?? null);
      gl!.useProgram(scene);
      gl!.uniform1i(a.iChannel1, read + 1);
      for (const key of tintKeys) tint(a[key], s[key]);
      scalar(a.zoom, s.zoom);
      scalar(a.offset, s.offset);
      scalar(a.amplitude, s.amplitude);
      scalar(a.uDetail, s.detail);
      scalar(a.intro, introProgress);
      scalar(a.introFeather, s.introFeather);
      scalar(a.iTime, time);
      /* The frame smear is off while paused, and the reason is not
         "freeze looks better that way" — it is that the smear is a *moving*
         average. `uFeedback` mixes this frame with the previous one, and the
         previous frame shows the clouds a few pixels to the left. So while the
         loop runs, the blend is a motion-blur; the moment the loop stops, the
         two frames it is averaging are no longer adjacent in time, and the
         image is a double-exposure of the same moment.

         Pausing therefore has to *discard* the history, not reuse it: the
         frame you get when you stop is the first frame in a while that is
         simply what the scene looks like. */
      const smear =
        !s.paused && history && introProgress >= 1 ? s.feedback : 0;
      scalar(a.uFeedback, smear);
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);

      gl!.bindFramebuffer(gl!.FRAMEBUFFER, null);
      gl!.useProgram(post);
      gl!.uniform1i(b.scene, write + 1);
      scalar(b.intro, 1);
      scalar(b.introFeather, s.introFeather);
      scalar(b.vignette, s.vignette);
      scalar(b.exposure, s.exposure);
      scalar(b.saturation, s.saturation);
      scalar(b.hue, s.hue);
      scalar(b.temperature, s.temperature);
      tint(b.gradeShadow, s.gradeShadow);
      tint(b.gradeMid, s.gradeMid);
      tint(b.gradeHigh, s.gradeHigh);
      scalar(b.gradeAmount, s.gradeAmount);
      scalar(b.grain, s.grain);
      /* Grain seed. Frozen while paused, and that is the whole point: film
         grain belongs to the emulsion, so it should sit still on the screen
         and let the picture move over it. A seed that advances every frame
         turns it into television snow — and when the loop stops, that snow
         stops too, and what you are left looking at is a fixed speckle
         pattern that the moving frames had been hiding. Default grain is low
         for the same reason: 0.35 reads as sensor noise on a sunset, not as
         film. */
      scalar(b.grainSeed, s.paused ? grainSeedAtPause : (frame++ % 1024) * 1.618);
      if (s.paused && !wasPaused) grainSeedAtPause = (frame % 1024) * 1.618;
      wasPaused = s.paused;
      gl!.drawArrays(gl!.TRIANGLES, 0, 3);

      read = write;
      // `smear === 0` means the frame we just drew carries no trace of the
      // previous one, so it is a valid history seed. Leaving `history` true
      // while paused would let the next painted frame average against a
      // frame that was taken while the scene was still moving.
      history = smear > 0 || introProgress < 1;
      if (!s.paused && !reduced.matches && (s.speed !== 0 || introProgress < 1)) request();
    }

    const reset = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
      history = false;
      if (scale !== settings.current.resolution) {
        scale = settings.current.resolution;
        updatePixelSize();
      }
      request();
    };

    let dprQuery: MediaQueryList | null = null;
    const dprChanged = () => {
      if (dprQuery) dprQuery.removeEventListener('change', dprChanged);
      dprQuery = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      dprQuery.addEventListener('change', dprChanged);
      updatePixelSize();
      reset();
    };
    dprChanged();

    const resize = new ResizeObserver(([entry]) => {
      if (!entry) return;
      cssWidth = entry.contentRect.width;
      cssHeight = entry.contentRect.height;
      updatePixelSize();
      reset();
    });
    resize.observe(canvas);
    document.addEventListener('visibilitychange', reset);
    reduced.addEventListener('change', reset);
    request();

    return {
      wake: reset,
      replay: () => {
        introProgress = settings.current.paused ? 1 : 0;
        history = false;
        reset();
      },
      dispose: () => {
        resize.disconnect();
        if (dprQuery) dprQuery.removeEventListener('change', dprChanged);
        document.removeEventListener('visibilitychange', reset);
        reduced.removeEventListener('change', reset);
        clean();
      },
    };
  } catch (e) {
    clean();
    throw e;
  }
}
