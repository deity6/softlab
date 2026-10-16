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
/** 静音占位：演示模式不出声，也不去动模块级 `sfx`（它有 localStorage 状态） */
const SILENT_SFX = { playGameEffect() {} };

export class Game {
  /**
   * @param {(state: object) => void} onStateChange
   * @param {{ autoPlay?: boolean, silent?: boolean }} [options]
   *   `autoPlay` 打开演示模式 —— 脚本替玩家操作，见 `autoPilot()`。
   */
  constructor(onStateChange, options = {}) {
    this.onStateChange = onStateChange;
    this.autoPlay = Boolean(options.autoPlay);
    /**
     * 封面演示：换成预制关卡 + 恒定速度 + 周期循环。
     * 见 `demoLevel.js` —— 原站那套程序化关卡是「每局不同 + 2→20 格/秒加速 +
     * 无限不循环」，三样都不适合当封面。
     */
    this.demo = options.demo ?? null;
    // 首页封面会把游戏真跑起来，但那一份不该发出声音：`sfx` 是模块级单例，
    // 改它的 muted 会写进 localStorage，连用户真正在玩的那一份也一起静掉。
    this.sfx = options.silent ? SILENT_SFX : sfx;

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
          this.sfx.playGameEffect('jump', this.isSuper, isDoubleJump ? 1.4 : 1, isDoubleJump ? 2 : 1);
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
    if (this.demo) this.level.createDemoLevel();
    else this.level.createLevel();
    this.worldGroup.add(this.mona.mesh);
    this.worldGroup.add(this.ducky.group);
    // 封面演示不放残影：卡片只有一百多像素，六条彩色残影糊在角色身上，看起来
    // 就是她在闪。原站这个是给全尺寸画面用的。
    if (!this.demo) this.mona.createTrails(this.worldGroup);
    this.mona.update(0, 0);

    // 演示模式不接键盘 —— 它可能同时在首页挂好几份，每份都往 window 上挂一对
    // keydown/keyup 监听，用户在别处敲空格会挨个触发。
    if (!this.autoPlay) {
      window.addEventListener('keydown', this.handleKeyDown);
      window.addEventListener('keyup', this.handleKeyUp);
      window.addEventListener('blur', this.handleBlur);
    } else {
      this.scrollingStarted = true;
    }

    this.emitState();
  }

  /** 原 getForcedScrollSpeed：从 2 格/秒线性加速到 20 */
  getForcedScrollSpeed() {
    // 演示用恒定速度：加速曲线放在一百多像素高的封面里，前半段像卡帧、后半段看不清
    if (this.demo) return this.demo.speed;
    return Math.min(SCROLL_SPEED_MAX, SCROLL_SPEED_MIN + SCROLL_ACCEL_PER_SEC * this.elapsed);
  }

  /**
   * 预制关卡跑完一圈：把世界回卷到起点。
   *
   * 不是简单地把 `scrollX` 减一个周期 —— 地形按 `DEMO_SPAN` 重复，直接减会让
   * 新的 [0, span) 和旧的 [0, span) 两份方块叠在一起。所以整片清空重铺：
   * 因为铺法是定值表、不带随机，重铺出来的和刚才那一圈完全一致，画面不跳。
   *
   * 角色也跟着挪回一个周期，相对位置（她在画面里的站位）保持不变。
   */
  loopDemo() {
    const span = this.scrollX; // 直接回到 0：地形按 span 周期重复，0 和 N 个周期处长得一样

    for (const block of this.blocks) {
      this.unregisterPlatformBlock(block);
      block.remove();
    }
    this.blocks.length = 0;
    for (const pickup of this.pickups) this.removeWorldMesh(pickup.mesh);
    this.pickups.length = 0;
    for (let i = this.bugs.length - 1; i >= 0; i -= 1) this.removeBug(i);

    this.platformRows = [];
    this.pendingPickupSegments = [];
    this.scrollX -= span;
    this.elapsed = 0;
    this.mona.x -= span;
    this.level.createDemoLevel();
  }

  /** 某一格上方最高的可站立面（顶面 y），这列没有方块就返回 null */
  groundTopAt(gridX) {
    const occupied = this.platformYsByX.get(Math.floor(gridX));
    if (!occupied) return null;
    let top = null;
    for (const y of occupied) {
      const surface = y + 1;
      if (top === null || surface > top) top = surface;
    }
    return top;
  }

  /**
   * 演示模式的「操作手」。
   *
   * 首页那张卡片的封面不画了 —— 手绘一份迟早会跟游戏本体走样（改配色、换方块
   * 渲染、调手感，画那个都不会跟着动）。这里改成真把游戏跑起来，脚本替玩家按键，
   * 就是马里奥开机那段自动演示：一路往右，遇台阶和沟就跳，见虫子从上面踩过去。
   *
   * 关卡是 Lehmer 种子生成的，所以每一段演示的地形都不一样。
   *
   * 只做三件事：
   *   ① 按住右（不然会被强制滚动甩到屏幕左边缘贴住）
   *   ② 探碰撞箱正前方那一列 —— 抬高就跳，空掉（沟）也跳
   *   ③ 前方三格内有虫子也跳（从上方落下去算踩，侧面撞上要掉命）
   */
  autoPilot() {
    const mona = this.mona;
    if (!mona || this.gameOver) return;

    // 追到关卡前方约 16 格就不再往前冲。封面（见 DemoRunner）的取景框只有 47 格宽
    // 并且钉在 scrollX 上，她要是贴着可跑范围的最右边，就跑到画外去了。
    if (mona.x < this.scrollX + 16) this.keys.add('ArrowRight');
    else this.keys.delete('ArrowRight');

    const footX = mona.collisionX;
    const footY = mona.y;
    // 探到碰撞箱前沿再往外一点，正好是撞上之前的那一格
    const ahead = this.groundTopAt(footX + mona.COLLISION_WIDTH + 0.4);

    let jump = ahead === null || ahead > footY + 0.55;

    if (!jump) {
      for (const bug of this.bugs) {
        const dx = bug.x - footX;
        if (dx > 0.4 && dx < 3.2 && Math.abs(bug.y - footY) < 1.6) {
          jump = true;
          break;
        }
      }
    }

    // 只在落地或下落时起跳：上升途中再按会把二段跳浪费掉
    if (jump && mona.jumpsRemaining > 0 && mona.velocityY <= 0.01 && mona.jump()) {
      this.sfx.playGameEffect('jump', this.isSuper);
    }
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
      // 预制关卡跑完一圈就回卷（见 loopDemo）
      // 每 12 圈才回卷一次：次数太少会看到「整片地形闪一下」，太频繁又没必要 ——
      // 地形本来就是周期重复的，不回卷也能一直跑下去。
      if (this.demo && this.scrollX >= this.demo.span * 12) this.loopDemo();
    }

    if (this.autoPlay) this.autoPilot();

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
        this.sfx.playGameEffect('breakBlock', this.isSuper);
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
      this.sfx.playGameEffect('megaEnd', true);
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

      this.sfx.playGameEffect(pickup.mega ? 'collectMega' : 'collect', this.isSuper);
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
      this.sfx.playGameEffect('duckyLeave', this.isSuper);
    }

    if (
      this.ducky.isWaiting &&
      intersects(this.mona.getBounds(), this.ducky.getBounds())
    ) {
      this.ducky.activate(this.getPowerupDurationMultiplier());
      this.sfx.playGameEffect('catchDucky', false);
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
        this.sfx.playGameEffect('squashBug', this.isSuper);
        if (stomping) {
          bug.sprite.squish();
          this.mona.bounce(bug.y + BUG_COLLISION_H, 0.6 * this.mona.JUMP_SPEED);
        } else {
          bug.knockOut(0.45 * this.mona.JUMP_SPEED, bug.x >= this.mona.x ? 1 : -1);
        }
        continue;
      }

      if (this.mona.takeDamage()) {
        // 演示模式不掉命：死一次整段会重建，画面上就是「全部方块散开一下」
        this.lives -= this.demo ? 0 : 1;
        if (this.lives === 0) {
          this.sfx.playGameEffect('gameOver', false);
          this.gameOver = true;
          this.startGameOverTransition();
        } else {
          this.sfx.playGameEffect('damage', this.isSuper);
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
      this.sfx.playGameEffect('squashBug', this.isSuper);
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
