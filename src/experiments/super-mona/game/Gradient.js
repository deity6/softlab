import * as THREE from 'three';
import { GRADIENT_SETS } from './constants.js';

/**
 * 三停渐变面片。
 *
 * 原站的拾取物块面是 `MeshBasicMaterial({ color })` —— 一个纯色，9 / 16 块堆
 * 在一起平平的。这里换成一条纵向的三停渐变，并且**一块只占整条渐变的一小截**
 * （由 `t0` / `t1` 给出），所以一个拾取物里所有块拼起来才是一条完整的过渡。
 *
 * 用自定义 ShaderMaterial 而不是贴图，是因为颜色要在出场 / 消失动画里连续变化，
 * 贴图做不到（每帧重画一张 canvas 太亏）。
 *
 * ⚠️ 自定义 ShaderMaterial 不走 three 的输出色彩管线，片段着色器末尾必须自己
 *    做 linear → sRGB。少了那一步整块会明显偏暗。
 */
const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform float uT0;
uniform float uT1;
varying vec2 vUv;

vec3 toSRGB(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = pow(max(c, vec3(0.0)), vec3(0.41666)) * 1.055 - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

void main() {
  float t = clamp(uT0 + (1.0 - vUv.y) * (uT1 - uT0), 0.0, 1.0);
  vec3 col = t < 0.5 ? mix(uA, uB, t * 2.0) : mix(uB, uC, (t - 0.5) * 2.0);
  gl_FragColor = vec4(toSRGB(col), 1.0);
}
`;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * 渐变色的可变引用。
 *
 * 接口刻意与 `THREE.Color` 对齐（`getHSL` / `copy` / `setHSL`），这样 `Pickup.js`
 * 里那套出场、消失动画一行都不用改就能驱动渐变 —— 原先操作的是
 * `mesh.material.color`，现在换成这个。
 *
 * 内部存三个停靠点相对「中间色」的偏移，动画改主色时三色一起平移，
 * 「浅 → 中 → 深」这个关系始终保持。
 */
export class GradientColor {
  constructor(uniforms, set) {
    this.uniforms = uniforms;
    const cols = set.map((c) => new THREE.Color(c));
    const mid = cols[1].getHSL({ h: 0, s: 0, l: 0 });
    this.shifts = cols.map((c) => {
      const h = c.getHSL({ h: 0, s: 0, l: 0 });
      return { dh: h.h - mid.h, ds: h.s - mid.s, dl: h.l - mid.l };
    });
    this.main = cols[1].clone();
    this.push();
  }

  getHSL(target) {
    return this.main.getHSL(target);
  }

  copy(other) {
    this.main.copy(other);
    this.push();
    return this;
  }

  setHSL(h, s, l) {
    this.main.setHSL(h, s, l);
    this.push();
    return this;
  }

  push() {
    const hsl = this.main.getHSL({ h: 0, s: 0, l: 0 });
    const keys = ['uA', 'uB', 'uC'];
    for (let i = 0; i < 3; i += 1) {
      const sh = this.shifts[i];
      this.uniforms[keys[i]].value.setHSL(
        (hsl.h + sh.dh + 1) % 1,
        clamp01(hsl.s + sh.ds),
        clamp01(hsl.l + sh.dl),
      );
    }
  }
}

/** 随机取一组配色。 */
export const randomGradientSet = () =>
  GRADIENT_SETS[Math.floor(Math.random() * GRADIENT_SETS.length)];

/**
 * 造一块面片。
 * @param {THREE.BufferGeometry} geometry
 * @param {string[]} set     三色配色组
 * @param {number} t0        这一块在整条渐变里的起点（0 = 最浅）
 * @param {number} t1        终点（1 = 最深）
 */
export function createGradientQuad(geometry, set, t0, t1) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
      uC: { value: new THREE.Color() },
      uT0: { value: t0 },
      uT1: { value: t1 },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.gradient = new GradientColor(material.uniforms, set);
  return mesh;
}
