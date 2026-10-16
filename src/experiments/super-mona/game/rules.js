/**
 * 纯逻辑层 —— 不 import three、不碰 DOM。
 *
 * 为什么单独一层：排行榜要「从根本上禁止」伪造分数，做法是**服务端把这一局重放一遍**，
 * 自己算出分数，客户端报上来的分数只当成一个自检提示。重放要在 CF Workers 里跑，
 * 那边没有画布也没有 WebGL，所以被重放的那部分代码必须能脱离渲染运行。
 *
 * 于是约束是：`rules.js` / `rng.js` / `constants.js` / `demoLevel.js` / `LevelGenerator.js`
 * 这五个文件里**一个 three 都不许出现**（LevelGenerator 的实体创建改由 `game` 注入）。
 * 两边跑的是同一份源码 —— 不是复制一份「服务端版」，那样迟早和游戏本体走样。
 */

import { GRAVITY, SCROLL_ACCEL_PER_SEC, SCROLL_SPEED_MAX, SCROLL_SPEED_MIN } from './constants.js';

/**
 * 模拟步长（秒）。
 *
 * ⚠️ 必须是**固定值**，不能是 rAF 给的可变 dt。重放的前提是「同样的种子 + 同样的
 *    时间 → 同样的地形」，而地形是边滚动边生成的（`generateSceneUntil`），
 *    调用时机差半帧，随机数的消费顺序就错开，之后整条地形线全不一样。
 */
export const FIXED_DT = 1 / 60;

/** 原 `eY` */
export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * 原 `getForcedScrollSpeed`：从 2 格/秒线性加速到 20。
 * 抽出来是为了让服务端能独立算出「第 t 秒时世界推进到哪一格」—— 这是校验
 * 事件位置（角色够不够得着）的依据。
 */
export function forcedScrollSpeed(elapsed, demo = null) {
  // 封面演示走恒定速度（见 Game.getForcedScrollSpeed 的注释）
  if (demo) return demo.speed;
  return Math.min(SCROLL_SPEED_MAX, SCROLL_SPEED_MIN + SCROLL_ACCEL_PER_SEC * elapsed);
}

/**
 * 计分表。客户端与服务端**共用这一张** —— 服务端拿它自己算分，
 * 客户端拿它做本地自检，对不上就不发请求（省一次往返）。
 */
export const SCORE_RULES = {
  /** 顶碎一块地形 */
  breakBlock: 10,
  /** 吃到普通拾取物 */
  pickup: 50,
  /** 吃到 mega 拾取物（并开启 Super） */
  mega: 100,
  /** 踩死 / 震飞一只虫子 */
  bug: 25,
};

/** 服务端校验事件时用的物理常量 —— 与 Mona.js 保持同源 */
export const PHYSICS = {
  gravity: GRAVITY,
  /** 原 `Mona.MOVE_SPEED` */
  moveSpeed: 21,
  /** 原 `Mona.JUMP_SPEED` */
  jumpSpeed: 30,
  /** 单段跳的最大上升高度（格）：v²/2g */
  get singleJumpRise() {
    return (this.jumpSpeed * this.jumpSpeed) / (2 * this.gravity);
  },
  /** 二段跳的实际上限，取一个宽松值当校验门槛 */
  maxJumpRise: 15,
  /** 角色的碰撞宽度（格） */
  collisionWidth: 2.6,
  /** 视野宽度（格） */
  viewWidth: 94,
};

/**
 * 一局的上限。超出直接拒收 —— 不是为了防作弊，是防「把服务端当计算器用」：
 * 重放要跑满整局，必须有个封顶。
 */
export const RUN_LIMITS = {
  /** 单局最长时长（秒） */
  maxSeconds: 60 * 30,
  /** 单局最多上报多少个计分事件（按每秒最多 4 个的宽量估） */
  maxEvents: 8000,
  /** 同一帧（1/60 秒）最多认几个事件 */
  maxEventsPerFrame: 3,
  /** 名字长度（字符） */
  nameMin: 1,
  nameMax: 12,
};
