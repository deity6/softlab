import * as THREE from 'three';
import gsap from 'gsap';
import { CELL } from './constants.js';
import { hiddenMatrix, placeMatrix } from './utils.js';

/** 原代码里的字面量 5726555 = 0x57615B */
const BLOCK_COLOR = 5726555;
/** 每个方块由 2×2 共 4 个小面片拼成，单块面片边长 0.475 格（留缝） */
const QUAD = 0.475;
/** 4096/4 = 1024 个方块上限，原站是 2048/4 = 512 */
const MAX_INSTANCES = 2048;

/**
 * 原 `class B` —— 地形方块。
 * 一个 InstancedMesh 承载全部方块：每 4 个 instance 拼成一个格子方块，
 * 这样破坏时可以让 4 个碎片各自飞散。
 */
export class BlockField {
  constructor() {
    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(QUAD * CELL, QUAD * CELL),
      new THREE.MeshBasicMaterial({ color: BLOCK_COLOR }),
      MAX_INSTANCES,
    );
    this.freeIndices = Array.from({ length: MAX_INSTANCES }, (_, i) => i);
    this.timelines = new Set();
    this.mesh.frustumCulled = false;

    const hidden = hiddenMatrix();
    for (let i = 0; i < MAX_INSTANCES; i += 1) this.mesh.setMatrixAt(i, hidden);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  /** 返回一个方块句柄：{ x, y, remove, runBreakAnimation } */
  create(x, y) {
    if (this.freeIndices.length < 4) {
      throw new Error('Maximum block count (512) exceeded.');
    }
    const indices = this.freeIndices.splice(-4);
    const offset = { y: 0 };
    const parts = indices.map((index, i) => ({
      index,
      x: ((i % 2) + 0.5 - 1) * QUAD,
      y: (Math.floor(i / 2) + 0.5 - 1) * QUAD,
      scale: 1,
      matrix: new THREE.Matrix4(),
    }));

    const apply = (part) => {
      part.matrix.makeScale(part.scale, part.scale, 1);
      placeMatrix(part.matrix, x + part.x, y + part.y + offset.y, 1, 1);
      this.mesh.setMatrixAt(part.index, part.matrix);
      this.mesh.instanceMatrix.needsUpdate = true;
    };
    parts.forEach(apply);

    let removed = false;
    let timeline = null;

    const remove = () => {
      if (removed) return;
      removed = true;
      timeline?.kill();
      if (timeline) this.timelines.delete(timeline);
      for (const part of parts) {
        this.mesh.setMatrixAt(part.index, hiddenMatrix());
        this.freeIndices.push(part.index);
      }
      this.mesh.instanceMatrix.needsUpdate = true;
    };

    return {
      x,
      y,
      remove,
      runBreakAnimation: () => {
        timeline = gsap.timeline({
          onComplete: () => {
            if (timeline) this.timelines.delete(timeline);
            remove();
          },
        });
        this.timelines.add(timeline);
        // 整块先向上浮一点
        timeline.to(
          offset,
          { y: 0.4, ease: 'power2.out', duration: 0.5, onUpdate: () => parts.forEach(apply) },
          0,
        );
        // 四片碎片各自缩放归零、上抛、横向散开
        for (const part of parts) {
          const delay = 0.1 * Math.random() + 0.1;
          const dur = 0.3 + 0.3 * Math.random();
          timeline.to(
            part,
            {
              scale: 0,
              y: '-=' + (0.5 * Math.random() + 0.5),
              x: '+=' + (Math.random() - 0.5),
              duration: dur,
              ease: 'power2.out',
              onUpdate: () => apply(part),
            },
            delay,
          );
        }
      },
    };
  }

  dispose() {
    this.timelines.forEach((t) => t.kill());
    this.timelines.clear();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}
