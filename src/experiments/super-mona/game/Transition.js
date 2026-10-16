import * as THREE from 'three';
import gsap from 'gsap';
import { TRANSITION_COLORS } from './constants.js';
import { TRANSITION_FRAG, TRANSITION_VERT } from './shaders.js';

/**
 * 原 `class eV` —— 场景切换用的彩条幕布。
 * 6 层纯色平面直接写裁剪空间，靠 uOffsetY 从 -2 → 0 → 2 依次扫过，
 * 在完全盖住画面的那一刻回调 onCovered（此时才真正切换场景）。
 */
export class Transition {
  constructor() {
    this.group = new THREE.Group();
    this.layers = [];
    this.timeline = null;
    this.group.renderOrder = 100;
  }

  start({ onCovered, onComplete }) {
    if (this.timeline) return false;
    this.createLayers();

    const step = 0.08;
    const coverDuration = 0.35;
    const coveredAt = (TRANSITION_COLORS.length - 1) * step + coverDuration;
    const uncoverAt = coveredAt + 0.1;

    this.timeline = gsap.timeline({
      onComplete: () => {
        this.timeline = null;
        this.clearLayers();
        onComplete?.();
      },
    });

    this.layers.forEach((layer, i) => {
      this.timeline.to(
        layer.material.uniforms.uOffsetY,
        { value: 0, duration: coverDuration, ease: 'power2.inOut' },
        step * i,
      );
    });

    this.timeline.call(onCovered, undefined, coveredAt);

    this.layers.forEach((layer, i) => {
      this.timeline.to(
        layer.material.uniforms.uOffsetY,
        { value: 2, duration: 0.4, ease: 'power2.inOut' },
        uncoverAt + step * i,
      );
    });

    return true;
  }

  stop() {
    this.timeline?.kill();
    this.timeline = null;
    this.clearLayers();
  }

  dispose() {
    this.stop();
  }

  createLayers() {
    this.clearLayers();
    TRANSITION_COLORS.forEach((color, i) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2, 2),
        new THREE.ShaderMaterial({
          uniforms: {
            uColor: { value: new THREE.Color(color) },
            uOffsetY: { value: -2 },
          },
          vertexShader: TRANSITION_VERT,
          fragmentShader: TRANSITION_FRAG,
          depthTest: false,
          depthWrite: false,
          transparent: true,
        }),
      );
      mesh.renderOrder = 100 + i;
      mesh.frustumCulled = false;
      this.layers.push(mesh);
      this.group.add(mesh);
    });
  }

  clearLayers() {
    this.layers.forEach((mesh) => {
      this.group.remove(mesh);
      mesh.geometry.dispose();
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((m) => m.dispose());
    });
    this.layers.length = 0;
  }
}
