import * as THREE from 'three';
import gsap from 'gsap';
import { CELL, PALETTE } from './constants.js';
import { MonaSheet } from './MonaSheet.js';
import { placeGroup } from './utils.js';

/** 残影用的调色板实例（原 `er`） */
const TRAIL_COLORS = PALETTE.map((c) => new THREE.Color(c));

/**
 * 原 `class ea` —— 玩家角色。
 * 数值全部照抄：宽 3 格 / 碰撞宽 2.6 格 / MOVE_SPEED 21 / JUMP_SPEED 30 / 二段跳。
 * 残影用 history 位置插值 + GSAP 控制 spread 的展开与收起。
 */
export class Mona {
  constructor() {
    this.WIDTH = 3;
    this.HEIGHT = (27 * this.WIDTH) / 26;
    this.COLLISION_WIDTH = 2.6;
    this.COLLISION_HEIGHT = (27 * this.COLLISION_WIDTH) / 26;
    this.COLLISION_OFFSET_X = (this.WIDTH - this.COLLISION_WIDTH) / 2;
    this.MOVE_SPEED = 21;
    this.JUMP_SPEED = 30;

    this.sprite = new MonaSheet();
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(this.WIDTH * CELL, this.HEIGHT * CELL),
      this.sprite.material,
    );
    this.x = 6;
    this.y = 0;
    this.velocityY = 0;
    this.jumpsRemaining = 2;
    this.invulnerableSeconds = 0;
    this.landingSeconds = 0;
    this.movement = 'resting';
    this.trails = [];
    this.history = [];
    this.trailTargetActive = false;
    this.trailTween = null;
  }

  get collisionX() {
    return this.x + this.COLLISION_OFFSET_X;
  }

  get facing() {
    return this.sprite.facing;
  }

  setSuper(enabled) {
    this.sprite.setSuper(enabled);
  }

  createTrails(parent) {
    for (let i = 0; i < TRAIL_COLORS.length; i += 1) {
      const ghost = this.sprite.createGhost(TRAIL_COLORS[i], 1);
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(this.WIDTH * CELL, this.HEIGHT * CELL),
        ghost.material,
      );
      mesh.visible = false;
      mesh.renderOrder = -1 - i;
      parent.add(mesh);
      this.trails.push({
        mesh,
        ghost,
        delay: 0.015 * (i + 1),
        color: TRAIL_COLORS[i].clone(),
        spread: 0,
      });
    }
  }

  jump() {
    if (this.jumpsRemaining <= 0) return false;
    this.velocityY = this.JUMP_SPEED;
    this.jumpsRemaining -= 1;
    this.sprite.onJumped();
    return true;
  }

  land(y, hard) {
    this.y = y;
    this.velocityY = 0;
    this.jumpsRemaining = 2;
    if (hard) {
      this.landingSeconds = 1 / 15;
      this.sprite.onLanded();
    }
  }

  hitCeiling(y) {
    this.y = y;
    this.velocityY = 0;
  }

  /** 踩虫子后的弹跳：只回一点高度，且不给满跳跃次数 */
  bounce(y, velocity) {
    this.y = y;
    this.velocityY = velocity;
    this.jumpsRemaining = 1;
    this.sprite.onJumped();
  }

  takeDamage() {
    if (this.invulnerableSeconds > 0) return false;
    this.invulnerableSeconds = 1.5;
    this.velocityY = 0;
    return true;
  }

  getBounds() {
    return {
      x: this.collisionX,
      y: this.y,
      width: this.COLLISION_WIDTH,
      height: this.COLLISION_HEIGHT,
    };
  }

  update(dt, direction, isSuper = false) {
    this.invulnerableSeconds = Math.max(0, this.invulnerableSeconds - dt);
    this.landingSeconds = Math.max(0, this.landingSeconds - dt);
    this.movement =
      this.landingSeconds > 0
        ? 'landing'
        : this.velocityY !== 0
          ? 'jumping'
          : direction === 0
            ? 'resting'
            : 'moving';
    this.sprite.update(
      dt,
      this.jumpsRemaining === 2 && this.velocityY === 0,
      this.velocityY,
      direction,
      isSuper,
    );
    placeGroup(this.mesh, this.x, this.y, this.WIDTH, this.HEIGHT);
    this.mesh.visible =
      this.invulnerableSeconds === 0 || Math.floor(12 * this.invulnerableSeconds) % 2 === 0;
  }

  /** @param {number} virtualX 结算板里 Mona 会持续前进，用虚拟 x 采样历史位置 */
  updateTrails(elapsed, active, virtualX = this.x) {
    this.recordSample(elapsed, virtualX);

    if (active !== this.trailTargetActive) {
      this.trailTargetActive = active;
      this.transitionTrails(active);
    }

    const scaled = elapsed / 0.2;
    const whole = Math.floor(scaled);
    const frac = scaled - whole;

    for (let i = 0; i < this.trails.length; i += 1) {
      const trail = this.trails[i];
      const sample =
        active || trail.spread > 0 ? this.sampleAt(elapsed - trail.delay * trail.spread) : null;
      if (!sample) {
        trail.mesh.visible = false;
        continue;
      }
      const ratio = i / (this.trails.length - 1);
      trail.color
        .copy(TRAIL_COLORS[(whole + i) % TRAIL_COLORS.length])
        .lerp(TRAIL_COLORS[(whole + i + 1) % TRAIL_COLORS.length], frac)
        .offsetHSL(0, 0.1 * ratio, 0.1 * ratio);
      trail.ghost.setColor(trail.color);
      trail.mesh.visible = this.mesh.visible;
      placeGroup(trail.mesh, this.x + sample.x - virtualX, sample.y, this.WIDTH, this.HEIGHT);
      trail.mesh.position.z = 0.09;
      trail.ghost.apply(sample.snapshot);
    }

    return active || this.trails.some((t) => t.spread > 0);
  }

  recordSample(time, x) {
    this.history.push({ time, x, y: this.y, snapshot: this.sprite.snapshot() });
    const cutoff = time - 0.015 * TRAIL_COLORS.length;
    while (this.history.length > 1 && this.history[1].time <= cutoff) this.history.shift();
  }

  sampleAt(time) {
    if (this.history.length === 0 || time < this.history[0].time) return null;
    for (let i = this.history.length - 1; i >= 0; i -= 1) {
      const sample = this.history[i];
      if (sample.time > time) continue;
      const next = this.history[i + 1];
      if (!next) return sample;
      const span = next.time - sample.time;
      const t = span > 0 ? (time - sample.time) / span : 0;
      return {
        time,
        x: sample.x + (next.x - sample.x) * t,
        y: sample.y + (next.y - sample.y) * t,
        snapshot: sample.snapshot,
      };
    }
    return null;
  }

  transitionTrails(active) {
    this.trailTween?.kill();
    this.trailTween = gsap
      .timeline({
        onComplete: () => {
          this.trailTween = null;
        },
      })
      .to(this.trails, {
        spread: Number(!!active),
        duration: active ? 0.35 : 0.3,
        ease: active ? 'power2.out' : 'power2.in',
        stagger: { each: active ? 0.03 : 0.025, from: active ? 'start' : 'end' },
        overwrite: true,
      });
  }

  ownsMaterial(material) {
    return material === this.sprite.material || this.trails.some((t) => material === t.ghost.material);
  }

  dispose() {
    this.trailTween?.kill();
    this.sprite.dispose();
  }
}
