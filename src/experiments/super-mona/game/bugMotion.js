/**
 * 虫子的运动学 —— 纯数值，不碰 three。
 *
 * 为什么单独抽出来：排行榜的校验要判断「这一局真的踩死了那只虫子吗」。虫子是会
 * 走路的，它当时在哪取决于地形和时间 —— 而这两样**服务端都有**（地形由种子决定、
 * 时间就是帧数），所以它的位置是**可以精确重放**的。
 *
 * 反过来，如果只拿「生成时记下的巡逻区间」去比对，一定会误判：虫子掉下平台之后
 * 会把巡逻区间重置成「当前位置 ± 8」（见 `updatePlatform` 里那个 fallback），
 * 于是它会走出当初那个区间 —— 实测就是这么翻车的。
 *
 * 所以这里把 `Bug.js` 里那段物理原样搬过来，两边共用同一份。`Bug.js` 只剩
 * 「调用它 + 把结果画出来」。
 */

import { BUG_PATROL_RADIUS } from './constants.js';

/** 虫子的碰撞宽度（原 `Bug.js` 的 `BUG_W`） */
export const BUG_COLLISION_W = 2;
/** 原 `N = 27 / 26 * BUG_W` */
export const BUG_H = (27 / 26) * BUG_COLLISION_W;
/** 原 `K = 20 * N / 27` */
export const BUG_COLLISION_H = (20 * BUG_H) / 27;

/** 原 `Bug.groundPatrolBounds` */
export function groundPatrolBounds(x) {
  return {
    minX: Math.max(1, x - BUG_PATROL_RADIUS),
    maxX: x + BUG_PATROL_RADIUS,
  };
}

/** 原 `Game.js` 里的 `J.getSpeed` */
export function bugSpeed(scrollBonus) {
  return 2.5 + 0.25 * scrollBonus;
}

/**
 * 找出当前所站连续方块段的可行走区间，避免走到边缘掉下去。
 * 原 `Bug.getPlatformBounds` —— 逐字搬过来。
 */
export function platformBounds(bug, blocks) {
  const aligned = blocks
    .filter((b) => Math.abs(b.y + 1 - bug.y) < 0.001)
    .sort((a, b) => a.x - b.x);
  let i = 0;
  while (i < aligned.length) {
    let end = i + 1;
    while (end < aligned.length && aligned[end].x === aligned[end - 1].x + 1) end += 1;
    const startX = aligned[i].x;
    const endX = aligned[end - 1].x + 1;
    const length = endX - startX;
    if (length <= BUG_COLLISION_W && bug.x < endX && bug.x + BUG_COLLISION_W > startX) {
      const center = startX + (length - BUG_COLLISION_W) / 2;
      return { minX: center, maxX: center };
    }
    const limit = endX - BUG_COLLISION_W;
    if (limit >= startX && bug.x >= startX && bug.x <= limit) {
      return { minX: startX, maxX: limit };
    }
    i = end;
  }
  return null;
}

/** 原 `Bug.updatePlatform`：只在 `canFall` 的虫子上跑 */
export function updatePlatform(bug, dt, gravity, blocks) {
  if (!bug.canFall) return;
  if (bug.velocityY === 0) {
    const bounds = platformBounds(bug, blocks);
    if (bounds) {
      bug.minX = bounds.minX;
      bug.maxX = bounds.maxX;
      bug.x = Math.max(bug.minX, Math.min(bug.maxX, bug.x));
      if (bug.maxX <= bug.minX) bug.direction = 0;
      return;
    }
    bug.direction = bug.patrolDirection;
    const fallback = groundPatrolBounds(bug.x);
    bug.minX = fallback.minX;
    bug.maxX = fallback.maxX;
  }
  const prevY = bug.y;
  bug.velocityY -= gravity * dt;
  bug.y += bug.velocityY * dt;
  let landing = 0;
  for (const block of blocks) {
    const top = block.y + 1;
    if (
      prevY >= top &&
      bug.y <= top &&
      bug.x < block.x + 1 &&
      bug.x + BUG_COLLISION_W > block.x
    ) {
      landing = Math.max(landing, top);
    }
  }
  if (landing > 0) {
    bug.y = landing;
    bug.velocityY = 0;
  } else if (bug.y <= 0) {
    bug.y = 0;
    bug.velocityY = 0;
    bug.canFall = false;
    const bounds = groundPatrolBounds(bug.x);
    bug.minX = bounds.minX;
    bug.maxX = bounds.maxX;
  }
}

/** 原 `Bug.updateMovement` 的位移部分（`positionMesh()` 留在渲染层） */
export function updateBugMovement(bug, dt, gravity, blocks, speed) {
  updatePlatform(bug, dt, gravity, blocks);
  if (bug.maxX <= bug.minX) {
    bug.x = bug.minX;
    bug.direction = 0;
  } else {
    bug.x += bug.direction * speed * dt;
    if (bug.x <= bug.minX) {
      bug.x = bug.minX;
      bug.direction = 1;
      bug.patrolDirection = 1;
    } else if (bug.x >= bug.maxX) {
      bug.x = bug.maxX;
      bug.direction = -1;
      bug.patrolDirection = -1;
    }
  }
}
