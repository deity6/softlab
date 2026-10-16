import { GRID_X, GRID_Y, LEVEL, SPAWN } from './constants.js';
import { clamp } from './utils.js';
import { shuffle } from './rng.js';
import { Bug } from './Bug.js';
import { createPickup } from './Pickup.js';
import { DEMO_BUGS, DEMO_FLOATS, DEMO_GROUND, DEMO_PICKUPS, demoCell } from './demoLevel.js';

/**
 * 原 `class eq` 里的关卡生成部分。
 * 两行平台（下排可出 mega、可架桥，上排只出平段/抬升），
 * 用 bag shuffle 保证 pattern 分布均匀，全程由 Lehmer PRNG 驱动，同种子必得同关卡。
 */
export class LevelGenerator {
  constructor(game) {
    this.game = game;
  }

  createLevel() {
    const game = this.game;
    game.platformRows = [
      this.createPlatformRow(
        LEVEL.LOWER_ROW.START_X,
        LEVEL.LOWER_ROW.MIN_Y,
        LEVEL.LOWER_ROW.RANGE_Y,
        true,
        true,
      ),
      this.createPlatformRow(
        LEVEL.UPPER_ROW.START_X,
        LEVEL.UPPER_ROW.MIN_Y,
        LEVEL.UPPER_ROW.RANGE_Y,
        false,
        false,
      ),
    ];
    this.generateSceneUntil(GRID_X + 80);
  }

  createPlatformRow(startX, minY, rangeY, allowMega, isLower) {
    return {
      nextX: startX + Math.floor(8 * this.game.random()),
      y: minY + Math.floor(this.game.random() * rangeY),
      minY,
      maxY: minY + rangeY - 1,
      allowMega,
      nextMegaAt: allowMega ? 0 : Infinity,
      isLower,
      bag: [],
      forcedPattern: null,
    };
  }

  /** 边生成地形边补拾取物；地面虫子按固定间距铺 */
  generateSceneUntil(untilX) {
    // 封面演示走预制关卡：内容来自定值表，按 DEMO_SPAN 周期重复
    if (this.game.demo) {
      this.generateDemoSceneUntil(untilX);
      return;
    }

    for (const row of this.game.platformRows) this.generatePlatformRowUntil(row, untilX);

    for (const { row, segment } of this.game.pendingPickupSegments) {
      this.spawnPickupOnSegment(row, segment);
    }
    this.game.pendingPickupSegments = [];

    while (this.game.nextGroundBugX < untilX) {
      const x = this.game.nextGroundBugX;
      if (this.game.random() < 0.5) {
        const bounds = Bug.groundPatrolBounds(x);
        this.addBug(x, 0, this.game.random() < 0.5 ? -1 : 1, bounds.minX, bounds.maxX);
      }
      this.game.nextGroundBugX += 20 + Math.floor(9 * this.game.random());
    }
  }

  generatePlatformRowUntil(row, untilX) {
    let x = row.nextX;
    while (x < untilX) {
      const pattern = this.pickPattern(row);
      const built = this.buildPattern(row, x, pattern);

      if (built.mainSegment) {
        this.game.pendingPickupSegments.push({ row, segment: built.mainSegment });
        this.spawnBugOnSegment(built.mainSegment);
      }

      // 架桥会抬高上排的落脚点，避免两排撞在一起
      if (built.bridgeLandingY !== undefined) {
        const upper = this.game.platformRows[1];
        if (upper && upper.nextX < built.endX) {
          upper.nextX = built.endX;
          upper.y = clamp(built.bridgeLandingY, upper.minY, upper.maxY);
        }
      }

      x = built.endX + built.gapAfter;
      row.nextX = x;
    }
  }

  pickPattern(row) {
    if (row.forcedPattern) {
      const forced = row.forcedPattern;
      row.forcedPattern = null;
      return forced;
    }
    if (row.isLower && this.game.random() < LEVEL.BRIDGE_CHANCE) return 'bridge';
    if (row.bag.length === 0) {
      const names = row.isLower
        ? ['flatLong', 'flatLong', 'flatShort', 'flatShort', 'raised', 'stairsUp', 'stairsDown']
        : ['flatLong', 'flatLong', 'flatShort', 'flatShort', 'raised'];
      row.bag = shuffle(names, this.game.random);
    }
    return row.bag.pop();
  }

  buildPattern(row, x, name) {
    switch (name) {
      case 'flatShort':
      case 'flatLong':
        return this.buildFlatPattern(row, x, name);
      case 'raised':
        return this.buildRaisedPattern(row, x);
      case 'stairsUp':
        return this.buildStairsPattern(row, x, 1);
      case 'stairsDown':
        return this.buildStairsPattern(row, x, -1);
      case 'bridge':
        return this.buildBridgePattern(row, x);
      default:
        return this.buildFlatPattern(row, x, 'flatShort');
    }
  }

  /** 在候选高度里挑一个与已放置方块垂直间距足够、且尽量贴近期望值的 y */
  pickSpacedRunY(startX, desiredY, length, minY, maxY, dir, prevY) {
    return Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i)
      .filter((y) => dir === undefined || prevY === undefined || (dir > 0 ? y > prevY : y < prevY))
      .sort((a, b) => Math.abs(a - desiredY) - Math.abs(b - desiredY))
      .find((y) => {
        for (let x = startX; x < startX + length; x += 1) {
          const occupied = this.game.platformYsByX.get(x);
          if (!occupied) continue;
          for (const oy of occupied) {
            if (Math.abs(oy - y) <= LEVEL.MIN_VERTICAL_GAP) return false;
          }
        }
        return true;
      });
  }

  placeRun(startX, desiredY, length, minY, maxY, dir, prevY) {
    const y = this.pickSpacedRunY(startX, desiredY, length, minY, maxY, dir, prevY);
    if (y === undefined) return undefined;
    for (let i = 0; i < length; i += 1) this.placeBlock(startX + i, y);
    return { x: startX, y, length };
  }

  pickLength(range) {
    return range.MIN + Math.floor(this.game.random() * (range.MAX - range.MIN + 1));
  }

  /** 平段：随着滚动速度提升会越来越长 */
  buildFlatPattern(row, x, name) {
    const bonus = this.game.getForcedScrollSpeed() - 2;
    const extra = name === 'flatLong' ? Math.floor(bonus * LEVEL.LENGTH_PER_SCROLL_SPEED) : 0;
    const length =
      this.pickLength(name === 'flatLong' ? LEVEL.LENGTH.LONG : LEVEL.LENGTH.SHORT) + extra;
    const segment = this.placeRun(x, row.y, length, row.minY, row.maxY);
    if (segment) row.y = segment.y;
    return {
      endX: segment ? x + length : x,
      gapAfter:
        name === 'flatLong'
          ? this.pickLength(this.game.random() < 0.5 ? LEVEL.GAP.MEDIUM : LEVEL.GAP.LONG)
          : this.pickLength(this.game.random() < 0.5 ? LEVEL.GAP.SHORT : LEVEL.GAP.MEDIUM),
      mainSegment: segment,
    };
  }

  /** 抬升段：先试往上抬，抬不动就往下压 */
  buildRaisedPattern(row, x) {
    const delta = this.pickLength(LEVEL.RAISE_DELTA);
    let y = clamp(row.y + delta, row.minY, row.maxY);
    if (y === row.y) y = clamp(row.y - delta, row.minY, row.maxY);
    const length = this.pickLength(LEVEL.LENGTH.SHORT);
    const segment = this.placeRun(x, y, length, row.minY, row.maxY);
    if (segment) row.y = segment.y;
    return {
      endX: segment ? x + length : x,
      gapAfter: this.pickLength(LEVEL.GAP.SHORT),
      mainSegment: segment,
    };
  }

  buildStairsPattern(row, x, dir) {
    const steps = 1 + Math.floor(this.game.random() * LEVEL.STAIR_MAX_STEPS);
    let cursor = x;
    let y = row.y;
    let placed = false;
    for (let i = 0; i < steps; i += 1) {
      const prevY = y;
      y = clamp(y + dir * LEVEL.STEP_HEIGHT, row.minY, row.maxY);
      const segment = this.placeRun(cursor, y, LEVEL.STEP_WIDTH, row.minY, row.maxY, dir, prevY);
      if (!segment) {
        y = prevY;
        break;
      }
      placed = true;
      y = segment.y;
      cursor += LEVEL.STEP_WIDTH;
    }
    const length = this.pickLength(LEVEL.LENGTH.SHORT);
    const segment = placed ? this.placeRun(cursor, y, length, row.minY, row.maxY) : undefined;
    if (placed) row.y = segment ? segment.y : y;
    return {
      endX: segment ? cursor + length : cursor,
      gapAfter: this.pickLength(LEVEL.GAP.SHORT),
      mainSegment: segment,
    };
  }

  /** 架桥：从下排爬升到上排高度，之后强制接一段下楼梯 */
  buildBridgePattern(row, x) {
    const upper = this.game.platformRows[1];
    const climb = Math.max(
      1,
      (upper
        ? upper.minY + Math.floor(this.game.random() * (upper.maxY - upper.minY + 1))
        : row.maxY) - row.y,
    );
    const count = Math.min(LEVEL.STAIR_MAX_STEPS, Math.ceil(climb / LEVEL.STEP_HEIGHT));
    const ceiling = upper ? upper.maxY : row.maxY;
    let cursor = x;
    let y = row.y;
    let placed = false;
    for (let i = 0; i < count; i += 1) {
      const prevY = y;
      y = clamp(y + LEVEL.STEP_HEIGHT, row.minY, ceiling);
      const segment = this.placeRun(cursor, y, LEVEL.STEP_WIDTH, row.minY, ceiling, 1, prevY);
      if (!segment) {
        y = prevY;
        break;
      }
      placed = true;
      y = segment.y;
      cursor += LEVEL.STEP_WIDTH;
    }
    const length = this.pickLength(LEVEL.LENGTH.SHORT);
    const segment = placed
      ? this.placeRun(cursor, y, length, row.minY, ceiling)
      : undefined;
    if (placed) {
      row.y = segment ? segment.y : y;
      row.forcedPattern = 'stairsDown';
    }
    return {
      endX: segment ? cursor + length : cursor,
      gapAfter: placed ? 0 : this.pickLength(LEVEL.GAP.SHORT),
      mainSegment: segment,
      bridgeLandingY: segment?.y,
    };
  }

  /** 55% 概率在平台段中间放一个拾取物；满足条件时换成 mega */
  spawnPickupOnSegment(row, segment) {
    const { x, y, length } = segment;
    const regular = this.game.random() < 0.55;
    const mega = row.allowMega && this.game.elapsed >= row.nextMegaAt && x > SPAWN.MIN_X;
    if (!regular && !(mega && x > SPAWN.FORCE_X)) return;

    const size = mega ? 2 : 1;
    const px = x + Math.floor((length - size) / 2);
    const clearance = this.verticalClearanceAbove(px, size, y);
    if (clearance < 4) return;

    const maxY = Math.min(
      mega ? LEVEL.UPPER_ROW.MIN_Y - size : GRID_Y - size,
      y + 1 + clearance - size,
    );
    if (maxY < y + 1) return;

    const pickup = createPickup(px, Math.min(y + 4, maxY), size, mega);
    this.game.worldGroup.add(pickup.mesh);
    this.game.pickups.push(pickup);
    if (mega) row.nextMegaAt = this.game.elapsed + SPAWN.SPAWN_INTERVAL_SECONDS;
  }

  /** 上方到最近方块之间的净空高度 */
  verticalClearanceAbove(x, width, y) {
    let limit = GRID_Y;
    for (const block of this.game.blocks) {
      if (block.y > y && block.x + 1 > x && block.x < x + width) {
        limit = Math.min(limit, block.y);
      }
    }
    return limit - (y + 1);
  }

  spawnBugOnSegment(segment) {
    const { x, y, length } = segment;
    if (length > 2 && this.game.random() < 0.25) {
      const maxX = x + length - 2;
      this.addBug(
        x + this.game.random() * (maxX - x),
        y + 1,
        this.game.random() < 0.5 ? -1 : 1,
        x,
        maxX,
        true,
      );
    }
  }

  /** 铺一块地形并登记到 `platformYsByX` —— `placeRun` 与预制关卡共用的单格版 */
  placeBlock(x, y) {
    const block = this.game.blockField.create(x, y);
    this.game.blocks.push(block);
    const occupied = this.game.platformYsByX.get(x) ?? new Set();
    occupied.add(y);
    this.game.platformYsByX.set(x, occupied);
    return block;
  }

  /* ---------------------------------------------------------------------- *
   * 封面演示：预制关卡
   * ---------------------------------------------------------------------- */

  /**
   * 和 `createLevel()` 结构相同（只填下排、上排留空），内容换成
   * `demoLevel.js` 里的定值表。没有 PRNG 参与，所以每一轮铺出来的一模一样。
   */
  createDemoLevel() {
    this.game.platformRows = [];
    this.game.pendingPickupSegments = [];
    this.game.demoBuiltX = 0;
    // 铺到「当前 scrollX 之后一屏再多」而不是从 0 铺固定长度 —— 回卷之后
    // scrollX 已经不是 0 了，只铺 GRID_X + 80 会让画面右侧凭空少一截地形。
    this.generateDemoSceneUntil(this.game.scrollX + GRID_X + 80);
  }

  generateDemoSceneUntil(untilX) {
    const game = this.game;
    while (game.demoBuiltX < untilX) {
      const x = game.demoBuiltX;
      const cell = demoCell(x);

      const ground = DEMO_GROUND[cell];
      if (ground !== null) this.placeBlock(x, ground);

      const float = DEMO_FLOATS[cell];
      if (float !== null) this.placeBlock(x, float);

      const pickupY = DEMO_PICKUPS[cell];
      if (pickupY !== null) {
        // size 与原站程序化关卡一致：普通 1 格。写 3 会变成 9 块拼成的大方块。
        const pickup = createPickup(x, pickupY, 1, false);
        game.worldGroup.add(pickup.mesh);
        game.pickups.push(pickup);
      }

      const bug = DEMO_BUGS[cell];
      if (bug !== null) {
        // 站在地面方块上方一格；巡逻界来自关卡表，保证它一直在同一段平地上
        this.addBug(x, bug.y + 1, x % 2 === 0 ? 1 : -1, bug.minX, bug.maxX);
      }

      game.demoBuiltX = x + 1;
    }
  }

  addBug(x, y, direction, minX, maxX, canFall = false) {
    this.game.bugs.push(
      new Bug(this.game.bugSheet.createSprite(), x, y, direction, minX, maxX, canFall),
    );
  }
}
