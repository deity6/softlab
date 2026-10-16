import * as THREE from 'three';
import gsap from 'gsap';
import { ASSETS, CELL, GRID_Y } from './constants.js';
import { placeGroup } from './utils.js';

const SIZE = 1.5;
/** 跟上 Mona 后能陪伴的秒数（原 12.5 * mul） */
const FOLLOW_SECONDS = 12.5;
/** 磁吸半径（原 `isWithinMagnetRadius` 里的 20） */
const MAGNET_RADIUS = 20;
/** 能落脚的方块高度上限（原 `canReach` 的 12） */
const REACH_MAX_Y = 12;

/**
 * 原 `class $` —— 鸭子。
 * 被 Mona 碰到后跟随一段时间，期间会把附近的拾取物吸过来；
 * 时间到了就斜着飞出屏幕。
 */
export class Ducky {
  constructor() {
    this.group = new THREE.Group();
    this.sprite = new THREE.Mesh(
      new THREE.PlaneGeometry(SIZE * CELL, SIZE * CELL),
      new THREE.MeshBasicMaterial({ transparent: true }),
    );
    this.texture = null;
    this.popIn = null;
    this.disposed = false;
    this.elapsed = 0;
    this.x = 0;
    this.y = 0;
    this.spawnX = 0;
    this.spawnY = 0;
    this.followingSeconds = 0;
    this.state = 'hidden';
    this.group.add(this.sprite);
    this.group.renderOrder = 2;
    this.group.visible = false;
    this.sprite.material.visible = false;

    new THREE.TextureLoader().load(ASSETS.ducky, (texture) => {
      if (this.disposed) {
        texture.dispose();
        return;
      }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      this.texture = texture;
      const material = this.sprite.material;
      material.map = texture;
      material.visible = true;
      material.needsUpdate = true;
    });
  }

  get isHidden() {
    return this.state === 'hidden';
  }

  get isWaiting() {
    return this.state === 'waiting';
  }

  get isFollowing() {
    return this.state === 'following';
  }

  get isDeparting() {
    return this.state === 'departing';
  }

  canReach(y) {
    return y <= REACH_MAX_Y;
  }

  isFarEnoughFromMega(duckyX, megaX) {
    return Math.abs(megaX - duckyX) >= 10;
  }

  getCatchupMultiplier(scrollBonus) {
    return 1 + 0.08 * scrollBonus;
  }

  spawn(x, y) {
    this.spawnX = x;
    this.spawnY = y;
    this.x = x;
    this.y = y;
    this.state = 'waiting';
    this.group.visible = true;
    this.playPopIn();
  }

  despawn() {
    this.popIn?.kill();
    this.popIn = null;
    this.state = 'hidden';
    this.group.visible = false;
    this.group.rotation.z = 0;
  }

  activate(durationMultiplier) {
    if (!this.isWaiting) return;
    this.followingSeconds = FOLLOW_SECONDS * durationMultiplier;
    this.state = 'following';
  }

  /** 把拾取物沿直线拉向自己，返回是否已经够到 */
  pullPickupToward(pickup, target, dt, catchupMultiplier) {
    const tx = target.x + target.width / 2;
    const ty = target.y + target.height / 2;
    const px = pickup.x + pickup.width / 2;
    const py = pickup.y + pickup.height / 2;
    const dx = tx - px;
    const dy = ty - py;
    const dist = Math.hypot(dx, dy);
    if (dist <= 1) return true;
    if (dist === 0) return false;
    const step = Math.min(dist, 24 * catchupMultiplier * dt);
    pickup.x += (dx / dist) * step;
    pickup.y += (dy / dist) * step;
    placeGroup(pickup.mesh, pickup.x, pickup.y, pickup.width, pickup.height);
    return dist - step <= 1;
  }

  update(dt, monaX, monaY, monaW, facing, catchupMultiplier = 1) {
    const step = Math.min(Math.max(dt, 0), 0.1);
    this.elapsed += step;
    if (this.isHidden) return;

    if (this.isWaiting) {
      this.x = this.spawnX;
      this.y = this.spawnY + 0.2 * Math.sin(5 * this.elapsed);
      this.faceTowards(monaX + monaW / 2);
    } else if (this.isFollowing) {
      this.faceTowards(monaX + monaW / 2);
      this.followingSeconds -= step;
      const targetY = monaY + 1.25 + 0.2 * Math.sin(5 * this.elapsed);
      const lerp = 1 - Math.exp(-(5 * step) * catchupMultiplier);
      this.x += (monaX + monaW / 2 + (facing === 'right' ? -1 : 1) * 3.5 - 0.75 - this.x) * lerp;
      this.y += (targetY - this.y) * lerp;
      if (this.followingSeconds <= 0) this.state = 'departing';
    } else {
      this.sprite.scale.x = 1;
      this.x -= 8 * step;
      this.y += 8 * step;
      if (this.y >= GRID_Y) {
        this.state = 'hidden';
        this.group.visible = false;
        this.group.rotation.z = 0;
        return;
      }
    }

    placeGroup(this.group, this.x, this.y, SIZE, SIZE);
    this.group.position.z = 0.2;
  }

  getBounds() {
    return { x: this.x, y: this.y, width: SIZE, height: SIZE };
  }

  isWithinMagnetRadius(pickup) {
    const x = pickup.x + pickup.width / 2;
    const y = pickup.y + pickup.height / 2;
    return Math.hypot(x - this.x - 0.75, y - this.y - 0.75) <= MAGNET_RADIUS;
  }

  dispose() {
    this.disposed = true;
    this.popIn?.kill();
    this.popIn = null;
    this.sprite.geometry.dispose();
    this.sprite.material.dispose();
    this.texture?.dispose();
    this.texture = null;
  }

  /** 出场：scale 0→1 回弹，同时轻微扭转 */
  playPopIn() {
    this.popIn?.kill();
    this.group.scale.set(0, 0, 1);
    this.group.rotation.z = -0.35;
    this.popIn = gsap
      .timeline()
      .to(this.group.scale, { x: 1, y: 1, duration: 0.5, ease: 'back.out(3)' }, 0)
      .to(this.group.rotation, { z: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, 0);
  }

  faceTowards(targetX) {
    const center = this.x + 0.75;
    if (targetX === center) return;
    this.sprite.scale.x = targetX > center ? -1 : 1;
  }
}
