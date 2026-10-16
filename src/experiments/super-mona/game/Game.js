import * as THREE from 'three';
import gsap from 'gsap';
import {
  CELL,
  GAME_KEYS,
  GRID_X,
  GRAVITY,
  POWERUP_DURATION_PENALTY,
  POWERUP_SPEED_SPAN,
  SCROLL_ACCEL_PER_SEC,
  SCROLL_SPEED_MAX,
  SCROLL_SPEED_MIN,
} from './constants.js';
import { Grid } from './Grid.js';
import { BlockField } from './BlockField.js';
import { BugSheet, BUG_COLLISION_H } from './Bug.js';
import { Mona } from './Mona.js';
import { Ducky } from './Ducky.js';
import { ScorePopups } from './ScorePopups.js';
import { GameOverBoard, GameOverType } from './GameOver.js';
import { LevelGenerator } from './LevelGenerator.js';
import { createPickup } from './Pickup.js';
import { sfx } from './Sfx.js';
import { createRng, randomSeed } from './rng.js';
import { intersects } from './utils.js';

/**
 * 原 `class eq` —— 游戏主循环。
 * 完整保留：Lehmer 种子关卡、顶破方块、踩虫弹跳、鸭子跟随+磁吸、
 * Super 时长随速度衰减、死亡后闪烁转场接结算板。
 */
export class Game {
  constructor(onStateChange) {
    this.onStateChange = onStateChange;

    this.group = new THREE.Group();
    this.grid = new Grid(GRID_X);
    this.blockField = new BlockField();
    this.bugSheet = new BugSheet();
    this.gameOverScoreBoard = new GameOverBoard();
    this.gameOverType = new GameOverType();
    this.worldGroup = new THREE.Group();
    this.mona = new Mona();
    this.ducky = new Ducky();

    this.elapsed = 0;
    this.blocks = [];
    this.platformYsByX = new Map();
    this.pickups = [];
    this.bugs = [];
    this.scorePopups = new ScorePopups();
    this.platformRows = [];
    this.pendingPickupSegments = [];
    this.nextGroundBugX = 28;
    this.nextDuckyAt = 12;

    this.seed = randomSeed();
    this.random = createRng(this.seed);
    this.level = new LevelGenerator(this);

    this.keys = new Set();
    this.scrollX = 0;
    this.scrollingStarted = false;
    this.lives = 3;
    this.score = 0;
    this.superSeconds = 0;
    this.superEnding = false;
    this.gameOver = false;
    this.gameOverScreenVisible = false;
    this.gameOverScoreBoardOffsetX = 0;
    this.disposed = false;
    this.gameOverTimeline = null;
    this.lastState = '';

    this.handleKeyDown = (e) => {
      if (!GAME_KEYS.has(e.code)) return;
      e.preventDefault();
      this.scrollingStarted = true;
      const isNewPress = !this.keys.has(e.code);
      this.keys.add(e.code);
      if (e.code === 'Space' && isNewPress && !this.gameOver) {
        const isDoubleJump = this.mona.jumpsRemaining === 1;
        if (this.mona.jump()) {
          sfx.playGameEffect('jump', this.isSuper, isDoubleJump ? 1.4 : 1, isDoubleJump ? 2 : 1);
        }
      }
    };
    this.handleKeyUp = (e) => {
      this.keys.delete(e.code);
    };
    this.handleBlur = () => {
      this.keys.clear();
    };

    this.group.add(
      this.grid.group,
      this.worldGroup,
      this.gameOverScoreBoard.group,
      this.gameOverType.mesh,
    );
    this.worldGroup.add(this.blockField.mesh, this.bugSheet.mesh);
    this.grid.update(this.scrollX);
    this.level.createLevel();
    this.worldGroup.add(this.mona.mesh);
    this.worldGroup.add(this.ducky.group);
    this.mona.createTrails(this.worldGroup);
    this.mona.update(0, 0);

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);

    this.emitState();
  }

  /** 原 getForcedScrollSpeed：从 2 格/秒线性加速到 20 */
  getForcedScrollSpeed() {
    return Math.min(SCROLL_SPEED_MAX, SCROLL_SPEED_MIN + SCROLL_ACCEL_PER_SEC * this.elapsed);
  }

  getDuckyCatchupMultiplier() {
    return this.ducky.getCatchupMultiplier(this.getForcedScrollSpeed() - SCROLL_SPEED_MIN);
  }

  /** 速度越快，道具持续时间越短（最多缩短 25%） */
  getPowerupDurationMultiplier() {
    return (
      1 -
      ((this.getForcedScrollSpeed() - SCROLL_SPEED_MIN) / POWERUP_SPEED_SPAN) *
        POWERUP_DURATION_PENALTY
    );
  }

  get isSuper() {
    return this.superSeconds > 0 || this.superEnding;
  }

  update(dt) {
    if (this.gameOver) {
      this.gameOverScoreBoard.update(dt);
      return;
    }

    // 玩家第一次按键前世界不滚动
    if (this.scrollingStarted) {
      this.elapsed += dt;
      this.scrollX += this.getForcedScrollSpeed() * dt;
      this.level.generateSceneUntil(this.scrollX + GRID_X + 80);
      this.cleanupScene();
    }

    const right = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    const left = this.keys.has('ArrowLeft') || this.keys.has('KeyA');
    const dir = Number(right) - Number(left);
    this.mona.sprite.setFacing(dir);

    const prevY = this.mona.y;
    const prevCollisionX = this.mona.collisionX;
    const targetX =
      Math.max(
        this.scrollX,
        Math.min(
          this.scrollX + GRID_X - this.mona.WIDTH,
          this.mona.x + dir * this.mona.MOVE_SPEED * dt,
        ),
      ) + this.mona.COLLISION_OFFSET_X;
    const moveSign = Math.sign(targetX - prevCollisionX);

    this.mona.velocityY -= GRAVITY * dt;
    this.mona.y += this.mona.velocityY * dt;

    const resolvedX = this.resolveHorizontalCollision(prevCollisionX, targetX, moveSign, prevY);
    this.mona.x = resolvedX - this.mona.COLLISION_OFFSET_X;

    if (this.mona.velocityY <= 0) {
      // 下落：找脚下最高的方块顶面
      let landing = 0;
      for (const block of this.blocks) {
        const top = block.y + 1;
        if (
          prevY >= top &&
          this.mona.y <= top &&
          this.mona.collisionX < block.x + 1 &&
          this.mona.collisionX + this.mona.COLLISION_WIDTH > block.x
        ) {
          landing = Math.max(landing, top);
        }
      }
      if (this.mona.y <= landing) {
        this.mona.land(landing, prevY > landing);
      }
    } else {
      // 上升：顶到方块就把它撞碎
      const ceiling = prevY + this.mona.COLLISION_HEIGHT;
      const newTop = this.mona.y + this.mona.COLLISION_HEIGHT;
      const index = this.blocks.findIndex(
        (block) =>
          ceiling <= block.y &&
          newTop >= block.y &&
          this.mona.collisionX < block.x + 1 &&
          this.mona.collisionX + this.mona.COLLISION_WIDTH > block.x,
      );
      if (index >= 0) {
        const [block] = this.blocks.splice(index, 1);
        this.unregisterPlatformBlock(block);
        sfx.playGameEffect('breakBlock', this.isSuper);
        block.runBreakAnimation();
        // 10% 概率碎块里掉出一个普通拾取物
        if (this.random() < 0.1) {
          const pickup = createPickup(block.x, block.y, 1, false);
          this.worldGroup.add(pickup.mesh);
          this.pickups.push(pickup);
        }
        this.mona.hitCeiling(block.y - this.mona.COLLISION_HEIGHT);
        this.addScore(10, block.x + 0.5, block.y + 1);
        this.squashBugsOnBlock(block);
      }
    }

    this.updatePickups(dt);
    this.updateBugs(dt);

    if (!this.superEnding && this.superSeconds > 0) {
      this.superSeconds = Math.max(0, this.superSeconds - dt);
      if (this.superSeconds === 0) this.superEnding = true;
    }

    this.worldGroup.position.x = -this.scrollX * CELL;
    this.grid.update(this.scrollX);
    this.mona.update(dt, dir, this.isSuper);
    this.updateDucky(dt);

    const trailsActive = this.mona.updateTrails(
      this.elapsed,
      this.superSeconds > 0 && !this.gameOver,
    );
    // 等残影收干净再真正退出 Super
    if (this.superEnding && !trailsActive) {
      this.superEnding = false;
      this.mona.setSuper(false);
      sfx.playGameEffect('megaEnd', true);
    }

    this.emitState();
  }

  /** 回收已经离开视野左侧 24 格的东西 */
  cleanupScene() {
    const cutoff = this.scrollX - 24;

    for (let i = this.blocks.length - 1; i >= 0; i -= 1) {
      const block = this.blocks[i];
      if (block.x + 1 >= cutoff) continue;
      this.unregisterPlatformBlock(block);
      block.remove();
      this.blocks.splice(i, 1);
    }

    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = this.pickups[i];
      if (pickup.x + pickup.width >= cutoff) continue;
      this.removeWorldMesh(pickup.mesh);
      this.pickups.splice(i, 1);
    }

    for (let i = this.bugs.length - 1; i >= 0; i -= 1) {
      if (this.bugs[i].maxX + 2 >= cutoff) continue;
      this.removeBug(i);
    }
  }

  /** 水平方向撞墙时贴住墙面，不做穿透 */
  resolveHorizontalCollision(fromX, toX, moveSign, prevY) {
    let x = toX;
    for (const block of this.blocks) {
      if (!(block.y + 1 > prevY + 0.01 && prevY + this.mona.COLLISION_HEIGHT > block.y)) continue;
      if (moveSign > 0 && fromX + this.mona.COLLISION_WIDTH <= block.x && x + this.mona.COLLISION_WIDTH > block.x) {
        x = Math.min(x, block.x - this.mona.COLLISION_WIDTH);
      } else if (moveSign < 0 && fromX >= block.x + 1 && x < block.x + 1) {
        x = Math.max(x, block.x + 1);
      }
    }
    return x;
  }

  updatePickups(dt) {
    const cutoff = this.scrollX + GRID_X;
    const step = Math.min(Math.max(dt, 0), 0.1);
    const catchup = this.getDuckyCatchupMultiplier();
    const monaBounds = this.mona.getBounds();

    for (let i = this.pickups.length - 1; i >= 0; i -= 1) {
      const pickup = this.pickups[i];

      if (pickup.x < cutoff && pickup.x + pickup.width > this.scrollX) {
        pickup.runAppearAnimation();
        pickup.runAppearAnimation = () => {};
      }

      let collected = intersects(monaBounds, pickup);
      const magnetizable =
        !pickup.mega &&
        (pickup.magnetized ||
          (this.ducky.isFollowing && this.ducky.isWithinMagnetRadius(pickup)));

      if (!collected && magnetizable) {
        pickup.magnetized = true;
        collected = this.ducky.pullPickupToward(pickup, monaBounds, step, catchup);
      }

      if (!collected) continue;

      sfx.playGameEffect(pickup.mega ? 'collectMega' : 'collect', this.isSuper);
      this.addScore(pickup.mega ? 100 : 50, pickup.x + pickup.width / 2, pickup.y + pickup.height);
      if (pickup.mega) {
        this.superSeconds = 10 * this.getPowerupDurationMultiplier();
        this.superEnding = false;
      }
      this.pickups.splice(i, 1);
      pickup.runDisappearAnimation(() => this.removeWorldMesh(pickup.mesh));
    }
  }

  updateDucky(dt) {
    // 到点了就在右侧一段可落脚的方块上生成
    if (this.ducky.isHidden && this.elapsed >= this.nextDuckyAt) {
      const reachable = this.blocks.filter(
        (b) =>
          this.ducky.canReach(b.y) &&
          b.x >= this.scrollX + GRID_X / 2 &&
          b.x < this.scrollX + GRID_X - 1,
      );
      const safe = reachable.filter(
        (b) =>
          !this.pickups.some(
            (p) => p.mega && !this.ducky.isFarEnoughFromMega(b.x + 0.5, p.x + p.width / 2),
          ),
      );
      const pool = safe.length > 0 ? safe : reachable;
      const spot = pool[Math.floor(this.random() * pool.length)];
      if (spot) this.ducky.spawn(spot.x, spot.y + 2);
    }

    const wasHidden = this.ducky.isHidden;
    const wasDeparting = this.ducky.isDeparting;

    this.ducky.update(
      dt,
      this.mona.x,
      this.mona.y,
      this.mona.WIDTH,
      this.mona.facing,
      this.getDuckyCatchupMultiplier(),
    );

    if (!wasDeparting && this.ducky.isDeparting) {
      sfx.playGameEffect('duckyLeave', this.isSuper);
    }

    if (
      this.ducky.isWaiting &&
      intersects(this.mona.getBounds(), this.ducky.getBounds())
    ) {
      this.ducky.activate(this.getPowerupDurationMultiplier());
      sfx.playGameEffect('catchDucky', false);
    }

    // 鸭子还在等，但已经被卷到屏幕左边就撤掉
    if (this.ducky.isWaiting) {
      const bounds = this.ducky.getBounds();
      if (bounds.x + bounds.width < this.scrollX) this.ducky.despawn();
    }

    if (!wasHidden && this.ducky.isHidden) {
      this.nextDuckyAt = this.elapsed + 12 + 8 * this.random();
    }
  }

  updateBugs(dt) {
    const scrollBonus = this.getForcedScrollSpeed() - 2;
    const speed = BugSpeed(scrollBonus);
    const monaBounds = this.mona.getBounds();

    for (let i = this.bugs.length - 1; i >= 0; i -= 1) {
      const bug = this.bugs[i];
      bug.sprite.update(dt, bug.direction);
      if (bug.sprite.isFinished) {
        this.removeBug(i);
        continue;
      }
      if (bug.sprite.isSquished) continue;

      if (bug.knockedOut) {
        bug.updateKnockedOut(dt, GRAVITY);
        if (bug.y + BUG_COLLISION_H < 0) this.removeBug(i);
        continue;
      }

      bug.updateMovement(dt, GRAVITY, this.blocks, speed);
      if (!intersects(monaBounds, bug.getBounds())) continue;

      // 从上方落下踩到，或者 Super 状态直接撞碎
      const stomping = this.mona.velocityY < 0 && this.mona.y > bug.y + BUG_COLLISION_H / 2;
      if (stomping || this.isSuper) {
        this.addScore(25, bug.x + 1, bug.y + BUG_COLLISION_H);
        sfx.playGameEffect('squashBug', this.isSuper);
        if (stomping) {
          bug.sprite.squish();
          this.mona.bounce(bug.y + BUG_COLLISION_H, 0.6 * this.mona.JUMP_SPEED);
        } else {
          bug.knockOut(0.45 * this.mona.JUMP_SPEED, bug.x >= this.mona.x ? 1 : -1);
        }
        continue;
      }

      if (this.mona.takeDamage()) {
        this.lives -= 1;
        if (this.lives === 0) {
          sfx.playGameEffect('gameOver', false);
          this.gameOver = true;
          this.startGameOverTransition();
        } else {
          sfx.playGameEffect('damage', this.isSuper);
        }
      }
    }
  }

  /** 死亡后：世界闪 6 次，然后切到结算板 */
  startGameOverTransition() {
    this.removeInputListeners();
    let visible = true;
    this.gameOverTimeline = gsap
      .timeline({
        onStart: () => {
          this.mona.mesh.visible = true;
          this.worldGroup.visible = true;
        },
        onComplete: () => {
          const offset = ((this.scrollX % 1) + 1) % 1;
          this.gameOverScoreBoardOffsetX = this.gameOverScoreBoard.show(offset);
          this.gameOverType.show(offset);
          this.gameOverScreenVisible = true;
          this.emitState();
          this.gameOverTimeline = null;
        },
      })
      .to(
        {},
        {
          duration: 0.2,
          repeat: 6,
          onRepeat: () => {
            visible = !visible;
            this.worldGroup.visible = visible;
          },
        },
      )
      .call(() => {
        this.worldGroup.visible = false;
      })
      .to({}, { duration: 0.45 });
  }

  /** 顶碎方块时把站在上面的虫子震飞 */
  squashBugsOnBlock(block) {
    for (const bug of this.bugs) {
      if (!bug.isStandingOn(block)) continue;
      this.addScore(25, bug.x + 1, bug.y + BUG_COLLISION_H);
      sfx.playGameEffect('squashBug', this.isSuper);
      bug.knockOut(
        0.45 * this.mona.JUMP_SPEED,
        bug.x + 1 >= block.x + 0.5 ? 1 : -1,
      );
    }
  }

  removeBug(index) {
    const [bug] = this.bugs.splice(index, 1);
    bug?.sprite.dispose();
  }

  removeWorldMesh(mesh) {
    this.worldGroup.remove(mesh);
    mesh.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((m) => m.dispose());
    });
  }

  /** Super 状态下分数翻倍 */
  addScore(value, x, y) {
    const doubled = value * (this.isSuper ? 2 : 1);
    this.score += doubled;
    const popup = this.scorePopups.create(doubled, x, y, this.isSuper, this.elapsed);
    this.worldGroup.add(popup.mesh);
    popup.runAnimation(() => this.removeWorldMesh(popup.mesh));
  }

  unregisterPlatformBlock(block) {
    const occupied = this.platformYsByX.get(block.x);
    if (!occupied) return;
    occupied.delete(block.y);
    if (occupied.size === 0) this.platformYsByX.delete(block.x);
  }

  emitState() {
    const state = {
      lives: this.lives,
      score: this.score,
      superSeconds: this.isSuper ? Math.max(1, Math.ceil(this.superSeconds)) : 0,
      movement: this.mona.movement,
      gameOver: this.gameOver,
      gameOverScreenVisible: this.gameOverScreenVisible,
      gameOverScoreBoardOffsetX: this.gameOverScoreBoardOffsetX,
    };
    const serialized = JSON.stringify(state);
    if (serialized === this.lastState) return;
    this.lastState = serialized;
    this.onStateChange(state);
  }

  resize(width) {
    this.group.scale.set(width, width, 1);
  }

  removeInputListeners() {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    this.keys.clear();
  }

  dispose() {
    this.disposed = true;
    this.gameOverTimeline?.kill();
    this.gameOverTimeline = null;
    this.removeInputListeners();
    this.mona.dispose();
    this.ducky.dispose();
    this.worldGroup.remove(this.blockField.mesh, this.bugSheet.mesh);
    this.blockField.dispose();
    this.bugSheet.dispose();
    this.group.remove(this.gameOverScoreBoard.group);
    this.gameOverScoreBoard.dispose();
    this.group.remove(this.gameOverType.mesh);
    this.gameOverType.dispose();
    this.grid.dispose();
    this.group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.geometry.dispose();
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
      materials.forEach((m) => {
        if (!this.mona.ownsMaterial(m)) m.dispose();
      });
    });
  }
}

/** 与原 `J.getSpeed` 一致，放在这里避免循环依赖 */
function BugSpeed(scrollBonus) {
  return 2.5 + 0.25 * scrollBonus;
}
