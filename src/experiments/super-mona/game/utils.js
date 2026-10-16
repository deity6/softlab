import * as THREE from 'three';
import { CELL, GRID_Y } from './constants.js';

/** 原 `S`：把格子坐标换算成 Object3D 的 position（z 默认 0.1） */
export function placeGroup(obj, col, row, w = 1, h = 1, z = 0.1) {
  obj.position.set(
    (col + w / 2) * CELL - 0.5,
    (-GRID_Y * CELL) / 2 + (row + h / 2) * CELL,
    z,
  );
}

/** 原 `M`：同上的 Matrix4 版本（用于 InstancedMesh） */
export function placeMatrix(matrix, col, row, w = 1, h = 1, z = 0.1) {
  matrix.setPosition(
    (col + w / 2) * CELL - 0.5,
    (-GRID_Y * CELL) / 2 + (row + h / 2) * CELL,
    z,
  );
  return matrix;
}

/** 原 `R`：缩放为 0 并挪到远处，等效于隐藏一个 instance */
export function hiddenMatrix() {
  return new THREE.Matrix4().makeScale(0, 0, 0).setPosition(1e6, 1e6, 0);
}

/** 原 `eY` */
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** 原 `ej`：AABB 相交判定 */
export const intersects = (a, b) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

export const roundTo = (value, step) => Math.round(value / step) * step;
