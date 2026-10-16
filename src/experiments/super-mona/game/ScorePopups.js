import * as THREE from 'three';
import gsap from 'gsap';
import { CELL, SCORE_GLYPHS } from './constants.js';
import { SCORE_FRAG, SCORE_VERT } from './shaders.js';
import { placeGroup } from './utils.js';

const GLYPH_COLS = 3;
const GLYPH_ROWS = 5;
const PIXEL = 0.2;
const NORMAL_COLOR = '#9d9d9d';
const MEGA_COLOR = '#e1c600';

/**
 * 原 `class ew` —— 分数飘字。
 * 每个字符用 3×5 点阵小方块拼出，mega 分数走会闪的 shader；
 * resolvePosition 会把短时间内同位置的飘字往上顶，避免叠在一起看不清。
 */
export class ScorePopups {
  constructor() {
    this.recent = [];
  }

  create(value, x, y, isMega, elapsed) {
    const position = this.resolvePosition(x, y, elapsed);
    const chars = `+${value}`.split('');
    const width = (GLYPH_COLS * chars.length + (chars.length - 1) * 1) * PIXEL;

    const group = new THREE.Group();
    const quad = new THREE.PlaneGeometry(PIXEL * CELL, PIXEL * CELL);

    let flashMaterial = null;
    let material;
    if (isMega) {
      flashMaterial = new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color(MEGA_COLOR) },
        },
        vertexShader: SCORE_VERT,
        fragmentShader: SCORE_FRAG,
      });
      material = flashMaterial;
    } else {
      material = new THREE.MeshBasicMaterial({ color: NORMAL_COLOR, transparent: true });
    }

    chars.forEach((char, charIndex) => {
      const glyph = SCORE_GLYPHS[char];
      if (!glyph) return;
      const baseX = charIndex * (GLYPH_COLS + 1) * PIXEL;
      const glyphGroup = new THREE.Group();
      glyph.forEach((row, rowIndex) => {
        for (let colIndex = 0; colIndex < GLYPH_COLS; colIndex += 1) {
          if (row[colIndex] !== '1') continue;
          const pixel = new THREE.Mesh(quad, material);
          pixel.position.set(
            (baseX + (colIndex + 0.5) * PIXEL - width / 2) * CELL,
            (0.5 - (rowIndex + 0.5) * PIXEL) * CELL,
            0,
          );
          pixel.renderOrder = 10;
          glyphGroup.add(pixel);
        }
      });
      group.add(glyphGroup);
    });

    placeGroup(group, position.x - width / 2, position.y, width, 1);
    group.position.z = 0.2;

    return {
      mesh: group,
      runAnimation: (onComplete) => {
        const timeline = gsap.timeline({ onComplete });
        group.scale.set(0, 0, 1);
        timeline
          .to(group.scale, { x: 1, y: 1, duration: 0.25, ease: 'back.out(3)' }, 0)
          .to(group.position, { y: '+=' + 4 * CELL, duration: 1, ease: 'power2.out' }, 0);
        if (flashMaterial) {
          timeline.to(flashMaterial.uniforms.uTime, { value: 1, duration: 1, ease: 'none' }, 0);
        }
      },
    };
  }

  /** 0.75 秒窗口内，同位置（±3 / ±1.2）的飘字依次上移 1.2 格，最多顶 4 次 */
  resolvePosition(x, y, elapsed) {
    const cutoff = elapsed - 0.75;
    this.recent = this.recent.filter((r) => r.time >= cutoff);
    let ny = y;
    for (
      let i = 0;
      i < 4 &&
      this.recent.some((r) => Math.abs(r.x - x) < 3 && Math.abs(r.y - ny) < 1.2);
      i += 1
    ) {
      ny += 1.2;
    }
    const position = { x, y: ny };
    this.recent.push({ time: elapsed, ...position });
    return position;
  }
}
