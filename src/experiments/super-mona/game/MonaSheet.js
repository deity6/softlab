import * as THREE from 'three';
import { ASSETS, MONA_CLIPS, MONA_SHEET } from './constants.js';
import { GHOST_FRAG, GHOST_VERT, MONA_SPRITE_FRAG, MONA_SPRITE_VERT } from './shaders.js';

const { sheetW, sheetH, frameW, frameH } = MONA_SHEET;

/**
 * 原 `et`：把 {state, frameIndex, facing} 换算成图集 UV。
 * repeat 用 (frameW-1)/sheetW 留 1px 内缩，避免相邻帧渗色。
 */
export function frameUv({ state, frameIndex, facing }) {
  const frame = MONA_CLIPS[state][frameIndex];
  const left = facing === 'left';
  return {
    repeat: [(left ? -1 : 1) * ((frameW - 1) / sheetW), (frameH - 1) / sheetH],
    offset: [
      frame.x / sheetW + (left ? (frameW - 0.5) / sheetW : 0.5 / sheetW),
      1 - (frame.y + frameH) / sheetH + 0.5 / sheetH,
    ],
  };
}

/** 原 `class ei` —— 残影材质：只取精灵的 alpha 剪影，填纯色 */
export class Ghost {
  constructor(color, opacity) {
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uMap: { value: null },
        uOffset: { value: new THREE.Vector2() },
        uRepeat: { value: new THREE.Vector2(1, 1) },
        uColor: { value: new THREE.Color(0xffffff) },
        uOpacity: { value: 1 },
      },
      vertexShader: GHOST_VERT,
      fragmentShader: GHOST_FRAG,
    });
    this.setColor(color);
    this.material.uniforms.uOpacity.value = opacity;
  }

  setColor(color) {
    this.material.uniforms.uColor.value.set(color);
  }

  setTexture(texture) {
    this.material.uniforms.uMap.value = texture;
    this.material.needsUpdate = true;
  }

  apply(snapshot) {
    const { offset, repeat } = frameUv(snapshot);
    this.material.uniforms.uRepeat.value.set(repeat[0], repeat[1]);
    this.material.uniforms.uOffset.value.set(offset[0], offset[1]);
  }

  dispose() {
    this.material.dispose();
  }
}

/**
 * 原 `class es` —— Mona 的精灵动画 + 材质。
 * Super 态的彩虹流动色在片元着色器里完成（applySuperMona）。
 */
export class MonaSheet {
  constructor() {
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        uMap: { value: null },
        uOffset: { value: new THREE.Vector2() },
        uRepeat: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uIsSuper: { value: 0 },
      },
      vertexShader: MONA_SPRITE_VERT,
      fragmentShader: MONA_SPRITE_FRAG,
    });
    this.facing = 'right';
    this.texture = null;
    this.state = 'Idle';
    this.frameIndex = 0;
    this.elapsedInFrameMs = 0;
    this.ghosts = [];
    this.launchFrameAwaitingDraw = false;
    this.landingRemainingMs = null;
    this.landingAwaitingFirstDraw = false;
    this.disposed = false;

    loadMonaSheet(this);
  }

  onJumped() {
    this.landingRemainingMs = null;
    this.landingAwaitingFirstDraw = false;
    this.launchFrameAwaitingDraw = true;
    this.enter('Jump_Up', true);
  }

  onLanded() {
    this.launchFrameAwaitingDraw = false;
    this.landingRemainingMs = MONA_SHEET.frameMs;
    this.landingAwaitingFirstDraw = true;
    this.enter('Land', true);
  }

  /**
   * @param {number} dt 秒
   * @param {boolean} grounded 是否站在地面上
   * @param {number} velocityY 垂直速度（向上为正）
   * @param {number} direction 水平输入方向
   * @param {boolean} isSuper
   */
  update(dt, grounded, velocityY, direction, isSuper) {
    this.material.uniforms.uTime.value += Math.max(dt, 0);
    this.material.uniforms.uIsSuper.value = Number(isSuper);
    const ms = 1000 * Math.min(Math.max(dt, 0), 0.1);

    if (this.landingRemainingMs !== null) {
      if (!this.landingAwaitingFirstDraw) {
        this.landingRemainingMs -= ms;
        if (this.landingRemainingMs <= 2) {
          this.landingRemainingMs = null;
          this.enter(direction === 0 ? 'Idle' : 'Walk');
        }
      }
    } else if (grounded) {
      if (!this.enter(direction === 0 ? 'Idle' : 'Walk')) this.advance(ms, 0);
    } else if (velocityY > 0) {
      if (this.state !== 'Jump_Up') this.enter('Jump_Up');
      if (!this.launchFrameAwaitingDraw) this.advance(ms, 2);
    } else if (this.state !== 'JumpDown') {
      this.enter('JumpDown');
    } else {
      this.advance(ms, 2);
    }

    this.applyFrame();

    if (this.launchFrameAwaitingDraw && this.state === 'Jump_Up') {
      this.launchFrameAwaitingDraw = false;
      this.frameIndex = 1;
      this.elapsedInFrameMs = 0;
    }
    if (this.landingAwaitingFirstDraw && this.state === 'Land') {
      this.landingAwaitingFirstDraw = false;
    }
  }

  createGhost(color, opacity) {
    const ghost = new Ghost(color, opacity);
    if (this.texture) ghost.setTexture(this.texture);
    this.ghosts.push(ghost);
    return ghost;
  }

  snapshot() {
    return { state: this.state, frameIndex: this.frameIndex, facing: this.facing };
  }

  setFacing(direction) {
    if (direction === 0) return;
    this.facing = direction < 0 ? 'left' : 'right';
  }

  setSuper(enabled) {
    this.material.uniforms.uIsSuper.value = Number(enabled);
  }

  dispose() {
    this.disposed = true;
    this.ghosts.forEach((g) => g.dispose());
    this.ghosts = [];
    this.texture?.dispose();
    this.material.dispose();
  }

  /** 原 `enter`：force 或状态不同才切换，返回是否发生了切换 */
  enter(state, force = false) {
    if (!force && state === this.state) return false;
    this.state = state;
    this.frameIndex = 0;
    this.elapsedInFrameMs = 0;
    return true;
  }

  advance(ms, loopTo) {
    const frames = MONA_CLIPS[this.state];
    this.elapsedInFrameMs += ms;
    while (this.elapsedInFrameMs >= frames[this.frameIndex].durationMs) {
      this.elapsedInFrameMs -= frames[this.frameIndex].durationMs;
      this.frameIndex = this.frameIndex + 1 < frames.length ? this.frameIndex + 1 : loopTo;
    }
  }

  applyFrame() {
    const { offset, repeat } = frameUv(this.snapshot());
    this.material.uniforms.uRepeat.value.set(repeat[0], repeat[1]);
    this.material.uniforms.uOffset.value.set(offset[0], offset[1]);
  }
}

function loadMonaSheet(sheet) {
  new THREE.TextureLoader().load(
    ASSETS.monaSheet,
    (texture) => {
      if (sheet.disposed) {
        texture.dispose();
        return;
      }
      const image = texture.image;
      if (image.naturalWidth !== sheetW || image.naturalHeight !== sheetH) {
        texture.dispose();
        console.error(
          `Unable to initialize Mona: UniverseGameSet_01.png is ${image.naturalWidth}x${image.naturalHeight}; expected ${sheetW}x${sheetH}.`,
        );
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      sheet.texture = texture;
      sheet.material.uniforms.uMap.value = texture;
      sheet.material.needsUpdate = true;
      sheet.ghosts.forEach((g) => g.setTexture(texture));
      sheet.applyFrame();
    },
    undefined,
    (err) => console.error('Unable to load Mona sprite sheet UniverseGameSet_01.png.', err),
  );
}
