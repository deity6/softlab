import * as THREE from 'three';
import { GRID_FADE_FRAG, GRID_FADE_VERT } from './shaders.js';

/**
 * 原 `class b` —— 网格线。
 * 竖直线用 InstancedMesh 复用同一个 1×1 平面，随 scrollX 循环平移；
 * fade=true 时使用自定义 shader，让靠左的线条逐渐淡出（hero 待机场景用）。
 */
export class Grid {
  constructor(gridX, fade = false) {
    this.group = new THREE.Group();
    this.lineMatrix = new THREE.Matrix4();
    this.cellSize = 1 / gridX;
    this.gridX = gridX;
    this.verticalLineCount = gridX + 1;

    const height = 26 / gridX;
    const material = fade
      ? new THREE.ShaderMaterial({
          transparent: true,
          depthTest: false,
          depthWrite: false,
          uniforms: { uColor: { value: new THREE.Color(0xd9dfdb) } },
          vertexShader: GRID_FADE_VERT,
          fragmentShader: GRID_FADE_FRAG,
        })
      : new THREE.MeshBasicMaterial({ color: 0xd9dfdb });

    this.lines = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      material,
      this.verticalLineCount + 27,
    );
    if (fade) this.lines.renderOrder = -100;
    this.lines.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.lines.frustumCulled = false;
    this.group.add(this.lines);

    for (let i = 0; i <= gridX; i += 1) {
      this.positionVerticalLine(i, i * this.cellSize - 0.5, height);
    }
    for (let j = 0; j <= 26; j += 1) {
      this.lineMatrix.makeScale(1, 0.001, 1);
      this.lineMatrix.setPosition(0, (j / 26 - 0.5) * height, 0);
      this.lines.setMatrixAt(this.verticalLineCount + j, this.lineMatrix);
    }
    this.lines.instanceMatrix.needsUpdate = true;
  }

  update(scrollX) {
    const height = 26 / this.gridX;
    for (let i = 0; i < this.verticalLineCount; i += 1) {
      const raw = (i - scrollX) % this.verticalLineCount;
      const wrapped = raw < 0 ? raw + this.verticalLineCount : raw;
      this.positionVerticalLine(i, wrapped * this.cellSize - 0.5, height);
    }
    this.lines.instanceMatrix.needsUpdate = true;
  }

  positionVerticalLine(index, x, height) {
    this.lineMatrix.makeScale(0.001, height, 1);
    this.lineMatrix.setPosition(x, 0, 0);
    this.lines.setMatrixAt(index, this.lineMatrix);
  }

  dispose() {
    this.lines.geometry.dispose();
    this.lines.material.dispose();
    this.lines.dispose();
  }
}
