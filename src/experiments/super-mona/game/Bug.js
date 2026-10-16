import * as THREE from 'three';
import { ASSETS, BUG_SHEET, CELL, GRID_Y } from './constants.js';
import { BUG_FRAG, BUG_VERT } from './shaders.js';
import { hiddenMatrix, placeMatrix } from './utils.js';

/** 精灵帧 26×27 像素，显示宽 2 格 → 高按同比例换算 */
const BUG_W = 2;
const BUG_H = (27 / 26) * BUG_W;
/** 原 `K = 20 * N / 27` */
const BUG_COLLISION_H = (20 * BUG_H) / 27;

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
    return { minX: Math.max(1, x - 8), maxX: x + 8 };
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

  updateMovement(dt, gravity, blocks, speed) {
    this.updatePlatform(dt, gravity, blocks);
    if (this.maxX <= this.minX) {
      this.x = this.minX;
      this.direction = 0;
    } else {
      this.x += this.direction * speed * dt;
      if (this.x <= this.minX) {
        this.x = this.minX;
        this.direction = 1;
        this.patrolDirection = 1;
      } else if (this.x >= this.maxX) {
        this.x = this.maxX;
        this.direction = -1;
        this.patrolDirection = -1;
      }
    }
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
    if (!this.canFall) return;
    if (this.velocityY === 0) {
      const bounds = this.getPlatformBounds(blocks);
      if (bounds) {
        this.minX = bounds.minX;
        this.maxX = bounds.maxX;
        this.x = Math.max(this.minX, Math.min(this.maxX, this.x));
        if (this.maxX <= this.minX) this.direction = 0;
        return;
      }
      this.direction = this.patrolDirection;
      const fallback = Bug.groundPatrolBounds(this.x);
      this.minX = fallback.minX;
      this.maxX = fallback.maxX;
    }
    const prevY = this.y;
    this.velocityY -= gravity * dt;
    this.y += this.velocityY * dt;
    let landing = 0;
    for (const block of blocks) {
      const top = block.y + 1;
      if (prevY >= top && this.y <= top && this.x < block.x + 1 && this.x + BUG_W > block.x) {
        landing = Math.max(landing, top);
      }
    }
    if (landing > 0) {
      this.y = landing;
      this.velocityY = 0;
    } else if (this.y <= 0) {
      this.y = 0;
      this.velocityY = 0;
      this.canFall = false;
      const bounds = Bug.groundPatrolBounds(this.x);
      this.minX = bounds.minX;
      this.maxX = bounds.maxX;
    }
  }

  /** 找出当前所站连续方块段的可行走区间，避免走到边缘掉下去 */
  getPlatformBounds(blocks) {
    const aligned = blocks
      .filter((b) => Math.abs(b.y + 1 - this.y) < 0.001)
      .sort((a, b) => a.x - b.x);
    let i = 0;
    while (i < aligned.length) {
      let end = i + 1;
      while (end < aligned.length && aligned[end].x === aligned[end - 1].x + 1) end += 1;
      const startX = aligned[i].x;
      const endX = aligned[end - 1].x + 1;
      const length = endX - startX;
      if (length <= BUG_W && this.x < endX && this.x + BUG_W > startX) {
        const center = startX + (length - BUG_W) / 2;
        return { minX: center, maxX: center };
      }
      const limit = endX - BUG_W;
      if (limit >= startX && this.x >= startX && this.x <= limit) {
        return { minX: startX, maxX: limit };
      }
      i = end;
    }
    return null;
  }

  positionMesh() {
    this.sprite.setTransform(this.x, this.y, this.rotation);
  }
}

export { BUG_H, BUG_W, BUG_COLLISION_H, GRID_Y };
