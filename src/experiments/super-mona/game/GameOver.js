import * as THREE from 'three';
import { CELL, GAME_OVER_BOARD, GAME_OVER_GLYPHS, GRID_X, GRID_Y } from './constants.js';
import { Mona } from './Mona.js';
import { placeGroup, placeMatrix } from './utils.js';

const BOARD_COLOR = 0xdde1dd;
const TYPE_COLOR = 5726555;

/** 原 `en` */
const BOARD = GAME_OVER_BOARD;
/** 原 `eo` / `eh` / `el` */
const BOARD_X = Math.floor((GRID_X - BOARD.width) / 2);
const BOARD_Y = GRID_Y - BOARD.top - BOARD.height;
const BOARD_CENTER_OFFSET = BOARD_X + BOARD.width / 2 - GRID_X / 2;

/** 原 `ec` */
const TYPE_CELL = 0.95 * CELL;

const makeBox = (w, h) =>
  new THREE.Mesh(
    new THREE.PlaneGeometry(w * CELL, h * CELL),
    new THREE.MeshBasicMaterial({ color: BOARD_COLOR }),
  );

/**
 * 原 `class eu` —— 结算板。
 * 一个 21×8 的浅色画框，Mona 在里面以固定节奏无限跑跳（0.9s 一跳、0.6s 滞空、峰值 1.75 格），
 * 并拖出残影。
 */
export class GameOverBoard {
  constructor() {
    this.group = new THREE.Group();
    this.mona = new Mona();
    this.elapsed = 0;
    this.jumpElapsed = 0;
    this.jumping = false;
    this.virtualTrailX = 0;

    const { width, height, boundarySize } = BOARD;
    const main = makeBox(width, height);
    const bottom = makeBox(width, boundarySize);
    const right = makeBox(boundarySize, height);
    const top = makeBox(width, boundarySize);
    const left = makeBox(boundarySize, height);
    const boxes = [main, bottom, right, top, left];

    this.mona.x = BOARD_X + 4;
    this.monaBaseY = BOARD_Y + 1;
    this.mona.y = this.monaBaseY;

    placeGroup(main, BOARD_X, BOARD_Y, width, height);
    placeGroup(bottom, BOARD_X, BOARD_Y + height, width, boundarySize);
    placeGroup(right, BOARD_X + width, BOARD_Y, boundarySize, height);
    placeGroup(top, BOARD_X, BOARD_Y - boundarySize, width, boundarySize);
    placeGroup(left, BOARD_X - boundarySize, BOARD_Y, boundarySize, height);
    boxes.forEach((b) => {
      b.position.z = 0.05;
    });

    this.group.add(...boxes);
    this.mona.createTrails(this.group);
    this.mona.sprite.setFacing(1);
    this.mona.update(0, 0, false);
    this.group.add(this.mona.mesh);
    this.group.visible = false;
  }

  show(scrollX) {
    this.group.position.x = -scrollX * CELL;
    this.group.visible = true;
    return BOARD_CENTER_OFFSET - scrollX;
  }

  update(dt) {
    if (!this.group.visible) return;
    this.elapsed += dt;
    this.virtualTrailX += this.mona.MOVE_SPEED * dt;
    this.jumpElapsed = (this.jumpElapsed + dt) % (0.6 + 0.3);

    const airborne = this.jumpElapsed < 0.6;
    if (airborne && !this.jumping) {
      this.mona.sprite.onJumped();
      this.mona.jumpsRemaining = 1;
    } else if (!airborne && this.jumping) {
      this.mona.sprite.onLanded();
      this.mona.jumpsRemaining = 2;
    }
    this.jumping = airborne;

    const progress = Math.min(1, this.jumpElapsed / 0.6);
    const arc = airborne ? 1.75 * Math.sin(progress * Math.PI) : 0;
    this.mona.y = this.monaBaseY + arc;
    this.mona.velocityY = airborne ? Math.cos(progress * Math.PI) : 0;
    this.mona.update(dt, 1, false);
    this.mona.updateTrails(this.elapsed, true, this.mona.x + this.virtualTrailX);
  }

  dispose() {
    this.mona.dispose();
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const material of materials) {
          if (!this.mona.ownsMaterial(material)) material.dispose();
        }
      }
    });
  }
}

/** 原 `eg` —— 把 "GAME OVER" 字模排成 instance 坐标 */
const GAME_OVER_WORDS = ['GAME', 'OVER'];

function buildTypeLayout() {
  const positions = [];
  let cursor = 18;
  for (let wi = 0; wi < GAME_OVER_WORDS.length; wi += 1) {
    const word = GAME_OVER_WORDS[wi];
    for (let ci = 0; ci < word.length; ci += 1) {
      const glyph = GAME_OVER_GLYPHS[word[ci]];
      const glyphWidth = glyph[0]?.length ?? 0;
      for (let row = 0; row < glyph.length; row += 1) {
        const line = glyph[row];
        for (let col = 0; col < line.length; col += 1) {
          if (line[col] === '#') {
            positions.push({ x: cursor + col, y: 2 + glyph.length - 1 - row });
          }
        }
      }
      cursor += glyphWidth;
      if (ci < word.length - 1) cursor += 1;
    }
    if (wi < GAME_OVER_WORDS.length - 1) cursor += 3;
  }
  return positions;
}

const TYPE_LAYOUT = buildTypeLayout();

/**
 * 原 `class ef` —— 用 .95 格的小方块把一个 InstancedMesh 拼成 "GAME OVER"。
 */
export class GameOverType {
  constructor() {
    this.mesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(TYPE_CELL, TYPE_CELL),
      new THREE.MeshBasicMaterial({ color: TYPE_COLOR }),
      TYPE_LAYOUT.length,
    );
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < TYPE_LAYOUT.length; i += 1) {
      const cellPos = TYPE_LAYOUT[i];
      placeMatrix(matrix, cellPos.x, cellPos.y, 1, 1);
      this.mesh.setMatrixAt(i, matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  show(scrollX) {
    this.mesh.position.x = -scrollX * CELL;
    this.mesh.visible = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}
