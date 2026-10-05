/**
 * Minimal WebGL helpers. Every experiment here draws its effect with raw
 * WebGL, no Three.js needed — the 3D experiment uses Three directly.
 */
import { virtualPointer } from './virtualPointer';

export type GL = WebGLRenderingContext;

export function getGL(canvas: HTMLCanvasElement): GL | null {
  const opts: WebGLContextAttributes = {
    alpha: true,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    powerPreference: 'high-performance',
  };
  return (canvas.getContext('webgl', opts) ||
    canvas.getContext('experimental-webgl', opts)) as GL | null;
}

function compile(gl: GL, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('could not create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${log}`);
  }
  return shader;
}

export interface BuiltProgram {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
  attribs: Record<string, number>;
}

export function buildProgram(
  gl: GL,
  fragSource: string,
  vertSource: string,
  uniformNames: string[],
  attribNames: string[],
): BuiltProgram {
  const vs = compile(gl, gl.VERTEX_SHADER, vertSource);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSource);
  const program = gl.createProgram();
  if (!program) throw new Error('could not create program');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`program link failed: ${log}`);
  }
  const uniforms: Record<string, WebGLUniformLocation | null> = {};
  for (const name of uniformNames) uniforms[name] = gl.getUniformLocation(program, name);
  const attribs: Record<string, number> = {};
  for (const name of attribNames) attribs[name] = gl.getAttribLocation(program, name);
  return { program, uniforms, attribs };
}

export const FULLSCREEN_VS = `attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = a_pos * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

export function createFullscreenBuffer(gl: GL): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) throw new Error('could not create buffer');
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  // One oversized triangle — cheaper than a quad, no diagonal seam.
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  return buffer;
}

export function bindFullscreen(gl: GL, buffer: WebGLBuffer, location: number): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.enableVertexAttribArray(location);
  gl.vertexAttribPointer(location, 2, gl.FLOAT, false, 0, 0);
}

/** Resize the backing store to match CSS size. Returns true when it changed. */
export function fitCanvas(canvas: HTMLCanvasElement, maxDpr = 2): boolean {
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width === w && canvas.height === h) return false;
  canvas.width = w;
  canvas.height = h;
  return true;
}

export interface Frame {
  /** seconds since the loop started */
  t: number;
  /** seconds since the previous frame, clamped */
  dt: number;
  width: number;
  height: number;
  pointer: { x: number; y: number; inside: boolean; active: boolean };
}

/**
 * Drives a render callback on rAF, pauses when the tab is hidden and stops
 * entirely when the owning element leaves the document.
 */
export function startLoop(
  canvas: HTMLCanvasElement,
  canvasSize: () => { width: number; height: number },
  render: (frame: Frame) => void,
): () => void {
  let raf = 0;
  let last = performance.now();
  let start = last;
  let running = true;

  const pointer = { x: 0.5, y: 0.5, inside: false, active: false };
  const onPointerMove = (e: PointerEvent) => {
    // 球接管期间真实指针让位（和 ElasticText 里同一条规矩）
    if (virtualPointer.hijacked) return;
    const rect = canvas.getBoundingClientRect();
    pointer.x = (e.clientX - rect.left) / rect.width;
    pointer.y = 1 - (e.clientY - rect.top) / rect.height;
    pointer.inside = true;
  };
  const onPointerLeave = () => {
    pointer.inside = false;
  };
  const onPointerDown = () => {
    pointer.active = true;
  };
  const onPointerUp = () => {
    pointer.active = false;
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerup', onPointerUp, { passive: true });
  canvas.addEventListener('pointerleave', onPointerLeave);

  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (running && !raf) {
      last = performance.now();
      raf = requestAnimationFrame(tick);
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  function tick(now: number) {
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    // 球写的是和鼠标**同一个共享坐标**，所以"响应悬浮"的画布也必须响应它 ——
    // 否则球就成了一个"半个站都不认的指针"，而它本来的意义正是替代鼠标指针。
    if (virtualPointer.hijacked && virtualPointer.active) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = (virtualPointer.x - rect.left) / rect.width;
      pointer.y = 1 - (virtualPointer.y - rect.top) / rect.height;
      pointer.inside = true;
    }
    const size = canvasSize();
    render({ t: (now - start) / 1000, dt, width: size.width, height: size.height, pointer });
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointerleave', onPointerLeave);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
