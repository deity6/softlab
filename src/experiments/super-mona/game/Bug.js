import * as THREE from 'three';
import { ASSETS, BUG_SHEET, CELL, GRID_Y } from './constants.js';
import {
  BUG_COLLISION_H,
  BUG_COLLISION_W,
  BUG_H,
  groundPatrolBounds,
  platformBounds,
  updateBugMovement,
  updatePlatform,
} from './bugMotion.js';
import { BUG_FRAG, BUG_VERT } from './shaders.js';
import { hiddenMatrix, placeMatrix } from './utils.js';

/**
 * 尺寸与运动学都搬去了 `bugMotion.js` —— 那一层不依赖 three，服务端重放要用。
 * 下面文件末尾的 `export { ... BUG_COLLISION_H ... }` 负责把它们转发出去。
 */
const BUG_W = BUG_COLLISION_W;

const MAX_BUGS = 128;
/** 帧宽/高在图集里的 UV 跨度（各内缩 1px 防渗色，原 `F` / `z`） */
const UV_W = (BUG_SHEET.frameW - 1) / BUG_SHEET.imageW;
const UV_H = (BUG_SHEET.frameH - 1) / BUG_SHEET.imageH;

/** 把 Aseprite 元数据展开成逐帧数组 */
const FRAME_LIST = BUG_SHEET.durations.map((durationMs, i) => ({
  x: (i % 3) * BUG_SHEET.frameW,
  y: Math.floor(i / 3) * BUG_SHEET.frameH,
  durationMs,
}));

const CLIPS = Object.fromEntries(
  Object.entries(BUG_SHEET.clips).map(([name, { from, to }]) => [
    name,
    FRAME_LIST.slice(from, to + 1),
  ]),
);

/** 原 `class q` —— 单只虫子的动画状态 */
class BugSprite {
  constructor(index, mesh, onDispose) {
    this.index = index;
    this.mesh = mesh;
    this.clip = 'Walk';
    this.frameIndex = 0;
    this.elapsedInFrameMs = 0;
    this.facing = 'right';
    this.disposed = false;
    this.matrix = new THREE.Matrix4();
    this.onDispose = onDispose;
    this.applyFrame();
  }

  get isSquished() {
    return this.clip === 'squish';
  }

  get isFinished() {
    const frames = CLIPS[this.clip];
    return (
      this.isSquished &&
      this.frameIndex === frames.length - 1 &&
      this.elapsedInFrameMs >= frames[this.frameIndex].durationMs
    );
  }

  squish() {
    this.clip = 'squish';
    this.frameIndex = 0;
    this.elapsedInFrameMs = 0;
    this.applyFrame();
  }

  update(dt, direction) {
    if (direction !== 0) this.facing = direction < 0 ? 'left' : 'right';
    const frames = CLIPS[this.clip];
    this.elapsedInFrameMs += 1000 * Math.min(Math.max(dt, 0), 0.1);
    while (
      this.elapsedInFrameMs >= frames[this.frameIndex].durationMs &&
      (!this.isSquished || this.frameIndex !== frames.length - 1)
    ) {
      this.elapsedInFrameMs -= frames[this.frameIndex].durationMs;
      this.frameIndex = (this.frameIndex + 1) % frames.length;
    }
    this.applyFrame();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.onDispose();
  }

  setTransform(x, y, rotation = 0) {
    if (this.disposed) return;
    this.matrix.makeRotationZ(rotation);
    placeMatrix(this.matrix, x, y, BUG_W, BUG_H);
    this.mesh.setMatrixAt(this.index, this.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  applyFrame() {
    const frame = CLIPS[this.clip][this.frameIndex];
    const mirrored = this.facing === 'right';
    const repeat = [(mirrored ? -1 : 1) * UV_W, UV_H];
    const offset = [
      frame.x / BUG_SHEET.imageW +
        (mirrored ? (BUG_SHEET.frameW - 0.5) / BUG_SHEET.imageW : 0.5 / BUG_SHEET.imageW),
      1 - (frame.y + BUG_SHEET.frameH) / BUG_SHEET.imageH + 0.5 / BUG_SHEET.imageH,
    ];
    const offsetAttr = this.mesh.geometry.getAttribute('instanceOffset');
    const repeatAttr = this.mesh.geometry.getAttribute('instanceRepeat');
    offsetAttr.setXY(this.index, offset[0], offset[1]);
    repeatAttr.setXY(this.index, repeat[0], repeat[1]);
    offsetAttr.needsUpdate = true;
    repeatAttr.needsUpdate = true;
  }
}

/**
 * 原 `class j` —— 虫子精灵表。
 * 用两个自定义 instance 属性（instanceOffset / instanceRepeat）把图集 UV
 * 直接送进顶点着色器，因此 128 只虫子只需一次 draw call。
 */
export class BugSheet {
  constructor() {
    this.texture = null;
    this.sprites = new Set();
    this.freeIndices = Array.from({ length: MAX_BUGS }, (_, i) => i);
    this.disposed = false;

    const geometry = new THREE.PlaneGeometry(BUG_W * CELL, BUG_H * CELL);
    geometry.setAttribute(
      'instanceOffset',
      new THREE.InstancedBufferAttribute(new Float32Array(MAX_BUGS * 2), 2),
    );
    geometry.setAttribute(
      'instanceRepeat',
      new THREE.InstancedBufferAttribute(new Float32Array(MAX_BUGS * 2), 2),
    );

    this.mesh = new THREE.InstancedMesh(
      geometry,
      new THREE.ShaderMaterial({
        transparent: true,
        visible: false,
        uniforms: { uMap: { value: null } },
        vertexShader: BUG_VERT,
        fragmentShader: BUG_FRAG,
      }),
      MAX_BUGS,
    );
    this.mesh.frustumCulled = false;
    this.mesh.count = MAX_BUGS;

    const hidden = hiddenMatrix();
    for (let i = 0; i < MAX_BUGS; i += 1) this.mesh.setMatrixAt(i, hidden);

    loadBugTexture(this);
  }

  createSprite() {
    const index = this.freeIndices.pop();
    if (index === undefined) throw new Error('Maximum bug count (128) exceeded.');
    let sprite;
    sprite = new BugSprite(index, this.mesh, () => {
      this.sprites.delete(sprite);
      this.freeIndices.push(index);
      this.mesh.setMatrixAt(index, hiddenMatrix());
      this.mesh.instanceMatrix.needsUpdate = true;
    });
    this.sprites.add(sprite);
    return sprite;
  }

  dispose() {
    this.disposed = true;
    this.sprites.forEach((s) => s.dispose());
    this.sprites.clear();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
    this.texture?.dispose();
    this.texture = null;
  }
}

function loadBugTexture(sheet) {
  new THREE.TextureLoader().load(
    ASSETS.bugSheet,
    (texture) => {
      if (sheet.disposed) {
        texture.dispose();
        return;
      }
      const image = texture.image;
      if (image.naturalWidth !== BUG_SHEET.imageW || image.naturalHeight !== BUG_SHEET.imageH) {
        texture.dispose();
        console.error(
          `Unable to initialize bugs: UniverseBug_02.png is ${image.naturalWidth}x${image.naturalHeight}; expected ${BUG_SHEET.imageW}x${BUG_SHEET.imageH}.`,
        );
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      sheet.texture = texture;
      sheet.mesh.material.uniforms.uMap.value = texture;
      sheet.mesh.material.visible = true;
    },
    undefined,
    (err) => console.error('Unable to load bug sprite sheet UniverseBug_02.png.', err),
  );
}

/**
 * 原 `class J` —— 虫子实体。
 * 支持地面巡逻、站在方块上巡逻、被踩扁、被击飞旋转。
 */
export class Bug {
  static groundPatrolBounds(x) {
    return groundPatrolBounds(x);
  }

  /** 原 `J.getSpeed(v) = 2.5 + 0.25v` */
  static getSpeed(scrollBonus) {
    return 2.5 + 0.25 * scrollBonus;
  }

  constructor(sprite, x, y, direction, minX, maxX, canFall = false) {
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.minX = minX;
    this.maxX = maxX;
    this.canFall = canFall;
    this.velocityY = 0;
    this.knockedOut = false;
    this.spin = 0;
    this.rotation = 0;
    this.driftX = 0;
    this.patrolDirection = direction;
    this.maxX = Math.max(minX, maxX);
    this.sprite = sprite;
    this.positionMesh();
  }

  getBounds() {
    return { x: this.x, y: this.y, width: BUG_W, height: BUG_COLLISION_H };
  }

  isStandingOn(block) {
    const top = block.y + 1;
    return (
      !this.sprite.isSquished &&
      !this.knockedOut &&
      Math.abs(this.y - top) <= 0.5 &&
      this.x < block.x + 1 &&
      this.x + BUG_W > block.x
    );
  }

  // 位移与站立判定都在 `bugMotion.js`，这里只负责把结果画出来 ——
  // 服务端要拿同一份物理去重放虫子的位置（见那个文件的说明）。
  updateMovement(dt, gravity, blocks, speed) {
    updateBugMovement(this, dt, gravity, blocks, speed);
    this.positionMesh();
  }

  knockOut(velocity, direction) {
    this.knockedOut = true;
    this.direction = 0;
    this.velocityY = velocity;
    this.spin = -direction * Math.PI * 2;
    this.driftX = direction;
  }

  updateKnockedOut(dt, gravity) {
    this.velocityY -= gravity * dt;
    this.y += this.velocityY * dt;
    this.x += 1.5 * this.driftX * dt;
    this.rotation += this.spin * dt;
    this.positionMesh();
  }

  updatePlatform(dt, gravity, blocks) {
    updatePlatform(this, dt, gravity, blocks);
  }

  /** 找出当前所站连续方块段的可行走区间，避免走到边缘掉下去 */
  getPlatformBounds(blocks) {
    return platformBounds(this, blocks);
  }

  positionMesh() {
    this.sprite.setTransform(this.x, this.y, this.rotation);
  }
}

export { BUG_H, BUG_W, BUG_COLLISION_H, GRID_Y };
