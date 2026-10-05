/**
 * 导出成一份能双击打开的 HTML。
 *
 * ⚠️ 一个必须知道的坑：整个文件是一个 TypeScript 模板字面量，所以**源码里
 * 绝不能出现连续的 `</script>`** —— 哪怕写成 `<\/script>`，HTML 解析器也会
 * 在那里提前关闭外层的 script 标签，导出的文件当场报废。关闭标签用
 * `${'<'}/script>` 拆开写。同理，两个 shader 常量都要过一遍
 * `.replace(/<\/script/gi, ...)`。
 *
 * What this is for: someone finds a light they like — or has dialled one in by
 * hand — and wants to keep it. "Remember it on this device" does not survive a
 * new phone, and it certainly does not survive sending it to somebody else.
 * The export is the difference between a setting and an object.
 *
 * How it works: the two shaders are inlined verbatim, the current settings are
 * baked in as a JSON literal, and the render loop is re-implemented in ~90
 * lines. No build step, no network, no imports — one file you can mail.
 *
 * What is deliberately *not* in the file: the panel UI. The export is a
 * picture of the effect, not the tool for making it. Carrying 20 palettes and
 * a colour picker would triple the size for a thing nobody opens twice.
 */
import sceneFrag from './scene.frag?raw';
import postFrag from './post.frag?raw';
import type { CloudTrainSettings } from './engine';

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

/**
 * The foreground is sampled five times and averaged; the reference collapses
 * the time spread from 4 to 4/3 so the blur stays tight. Same transform the
 * app applies, kept here too so the export matches what is on screen.
 */
const SCENE = sceneFrag.replace('t+4.*float(i)/float(n)/60.', 't+(4./3.)*float(i)/float(n)/60.');

/** Settings that must not be baked in: they are runtime, not look. */
function bakeable(s: CloudTrainSettings): CloudTrainSettings {
  return {
    ...s,
    // A frozen export is a still frame with the opening replay on loop; the
    // point is to see the light, not to re-watch the reveal.
    introEnabled: false,
    paused: false,
  };
}

/**
 * Escapes a string for embedding in a <script> body. `</script` inside a
 * string literal would end the tag early — the one sequence that can break
 * the whole file, and the only one that matters here.
 */
function safeJson(v: unknown): string {
  return JSON.stringify(v)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    // U+2028 / U+2029 are line terminators inside a JS string literal. They must
  // be written as escape sequences in the *source*; a literal character here
  // is a syntax error, and it is invisible in most editors.
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');
}

export function buildExportHtml(settings: CloudTrainSettings, title: string): string {
  const json = safeJson(bakeable(settings));
  // `</script` cannot appear in the shaders (they are GLSL), but the guard is
  // free and the file is going to be opened by a text editor someone might have
  // saved a palette name into.
  const scene = SCENE.replace(/<\/script/gi, '<\\/script');
  const post = postFrag.replace(/<\/script/gi, '<\\/script');

  return `<!doctype html>
<html lang="zh-CN" data-scheme="dark" style="background:#0b0e14">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
<style>
  html,body{margin:0;height:100%;background:#0b0e14;overflow:hidden}
  canvas{display:block;width:100%;height:100%}
  .tag{position:fixed;left:14px;bottom:12px;font:10px/1.5 ui-monospace,SFMono-Regular,
    Menlo,Consolas,monospace;letter-spacing:.14em;text-transform:uppercase;
    color:rgb(255 255 255/.42);pointer-events:none;user-select:none}
  .err{position:fixed;inset:auto 0 0;margin:0;padding:14px 18px;background:#0b0e14;
    color:#ffb4a8;font:11px/1.6 ui-monospace,Menlo,Consolas,monospace}
</style>
</head>
<body>
<canvas id="c"></canvas>
<div class="tag">Cloud Train · ${title} · SOFT LAB</div>
<p class="err" id="err" hidden></p>
<script id="settings" type="application/json">${json}</script>
<script>
(function () {
  var S = JSON.parse(document.getElementById('settings').textContent);
  var cv = document.getElementById('c');
  var gl = cv.getContext('webgl2', { alpha: false, antialias: false, depth: false });
  var err = document.getElementById('err');
  if (!gl) {
    err.hidden = false;
    err.textContent = '需要 WebGL 2 · WebGL 2 required';
    return;
  }

  var programs = [], textures = [], bufs = [], fbos = [];
  function program(src) {
    var p = gl.createProgram(); programs.push(p);
    [[gl.VERTEX_SHADER, ${safeJson(VERT)}], [gl.FRAGMENT_SHADER, src]].forEach(function (pair) {
      var sh = gl.createShader(pair[0]);
      gl.shaderSource(sh, pair[1]); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        err.hidden = false; err.textContent = String(gl.getShaderInfoLog(sh));
        throw new Error('shader');
      }
      gl.attachShader(p, sh); gl.deleteShader(sh);
    });
    gl.bindAttribLocation(p, 0, 'p'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      err.hidden = false; err.textContent = String(gl.getProgramInfoLog(p));
      throw new Error('link');
    }
    return p;
  }

  var scene, post;
  try {
    scene = program(${safeJson(scene)});
    post = program(${safeJson(post)});
  } catch (e) { return; }

  function locs(p, names) {
    var o = {}; names.forEach(function (n) { o[n] = gl.getUniformLocation(p, n); });
    return o;
  }
  var a = locs(scene, ['iResolution','iTime','iChannel0','iChannel1','uFeedback','zoom',
    'offset','amplitude','uDetail','intro','introFeather','skyTint','smokeTint','trainTint']);
  var b = locs(post, ['resolution','scene','vignette','exposure','saturation','hue',
    'temperature','intro','introFeather','gradeShadow','gradeMid','gradeHigh',
    'gradeAmount','grain','grainSeed']);

  var quad = gl.createBuffer(); bufs.push(quad);
  gl.bindBuffer(gl.ARRAY_BUFFER, quad);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // The noise table. Seed and xorshift constants are load-bearing: this table
  // *is* the cloud shape, so a different seed gives a different picture.
  function tex() {
    var t = gl.createTexture(); textures.push(t);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }
  var noise = tex();
  var data = new Uint8Array(1024 * 1024), seed = 93451;
  for (var i = 0; i < data.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; data[i] = seed & 255;
  }
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, 1024, 1024, 0, gl.RED, gl.UNSIGNED_BYTE, data);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);

  var targets = [tex(), tex()];
  targets.forEach(function (t) {
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    fbos.push(gl.createFramebuffer());
  });

  var w = 0, h = 0, read = 0, history = false, t = 0, frame = 0;
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5) * S.resolution;
  var maxV = gl.getParameter(gl.MAX_VIEWPORT_DIMS);

  function size() {
    var dw = Math.max(1, Math.min(maxV[0], Math.round(cv.clientWidth * dpr)));
    var dh = Math.max(1, Math.min(maxV[1], Math.round(cv.clientHeight * dpr)));
    if (dw === w && dh === h) return;
    w = dw; h = dh; cv.width = w; cv.height = h; history = false;
    targets.forEach(function (tx, i) {
      gl.activeTexture(gl.TEXTURE0 + i + 1);
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[i]);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    });
    gl.viewport(0, 0, w, h);
  }

  function tint(loc, hex) {
    gl.uniform3f(loc,
      parseInt(hex.slice(1, 3), 16) / 255,
      parseInt(hex.slice(3, 5), 16) / 255,
      parseInt(hex.slice(5, 7), 16) / 255);
  }

  function draw(now) {
    requestAnimationFrame(draw);
    var dt = Math.min((now - (draw.last || now)) / 1000, 0.05);
    draw.last = now;
    t += dt * S.speed;
    size();

    var write = 1 - read;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbos[write]);
    gl.useProgram(scene);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, noise);
    gl.uniform1i(a.iChannel0, 0);
    gl.uniform1i(a.iChannel1, read + 1);
    gl.uniform3f(a.iResolution, w, h, 1);
    gl.uniform1f(a.iTime, t);
    gl.uniform1f(a.zoom, S.zoom);
    gl.uniform1f(a.offset, S.offset);
    gl.uniform1f(a.amplitude, S.amplitude);
    gl.uniform1f(a.uDetail, S.detail);
    gl.uniform1f(a.intro, 1);
    gl.uniform1f(a.introFeather, S.introFeather);
    gl.uniform1f(a.uFeedback, history ? S.feedback : 0);
    tint(a.skyTint, S.skyTint);
    tint(a.smokeTint, S.smokeTint);
    tint(a.trainTint, S.trainTint);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(post);
    gl.uniform1i(b.scene, write + 1);
    gl.uniform2f(b.resolution, w, h);
    gl.uniform1f(b.intro, 1);
    gl.uniform1f(b.introFeather, S.introFeather);
    gl.uniform1f(b.vignette, S.vignette);
    gl.uniform1f(b.exposure, S.exposure);
    gl.uniform1f(b.saturation, S.saturation);
    gl.uniform1f(b.hue, S.hue);
    gl.uniform1f(b.temperature, S.temperature);
    gl.uniform1f(b.gradeAmount, S.gradeAmount);
    gl.uniform1f(b.grain, S.grain);
    gl.uniform1f(b.grainSeed, (frame++ % 1024) * 1.618);
    tint(b.gradeShadow, S.gradeShadow);
    tint(b.gradeMid, S.gradeMid);
    tint(b.gradeHigh, S.gradeHigh);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    read = write; history = true;
  }

  // Pause when the tab is hidden — an export left open in a background tab
  // should not be the reason a laptop fan starts.
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) { draw.last = 0; requestAnimationFrame(draw); }
  });
  requestAnimationFrame(draw);
})();
${'<'}/script>
</body>
</html>
`;
}

export function downloadHtml(settings: CloudTrainSettings, title: string): void {
  const html = buildExportHtml(settings, title);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  // The filename carries the light's name, so a folder of exports is
  // browsable. Slugged: the names are Chinese, and a Chinese filename is fine
  // on every modern OS but arrives mangled over some transfers.
  const slug = title.replace(/[\\/:*?"<>|]/g, '').trim() || 'light';
  a.href = url;
  a.download = `cloud-train-${slug}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick: revoking synchronously can cancel the download in
  // some browsers before it starts reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
