/**
 * 首页封面那段演示用的**预制关卡**。
 *
 * 为什么不用 `createLevel()` 那套程序化生成 —— 封面要三件它给不了的东西：
 *
 *   ① **位置固定**。程序化关卡每局都不一样，封面每次刷新都变样。
 *   ② **速度恒定**。原站是 2 → 20 格/秒的加速曲线；封面只有一百多像素高，
 *      前几秒慢得像卡帧，后几秒又快得看不清。
 *   ③ **首尾接得上**。程序化关卡是无限且非周期的，滚到哪都不会回到起点 ——
 *      而封面必须无缝循环。
 *
 * 所以这里手写一遍（`SPAN` 格），地形、拾取物、虫子都按这个周期重复铺。
 * 相机只要在 `scrollX >= SPAN` 时把世界回卷一次，看到的就是同一段画面。
 *
 * 数字都是格坐标：`y` 是方块所在的那一格，角色站在 `y + 1`。
 */

/** 一遍的长度。0 与 SPAN-1 必须落在同一高度上，否则接缝处会有一级台阶 */
export const DEMO_SPAN = 56;

/** 恒定滚动速度（格/秒）。原站起步是 2，太慢；封面取一个看着舒服的中速 */
export const DEMO_SPEED = 9;

/**
 * 地面段：`[起始格, 高度, 长度]`。空出来的地方就是沟。
 * 首段从 0 起、末段收到 55，两端都是 y=5 —— 接缝处是连续的地面。
 */
const GROUND_RUNS = [
  [0, 5, 12],
  [14, 5, 8],
  [24, 6, 6],
  [32, 7, 4],
  [38, 5, 7],
  [47, 6, 4],
  [53, 5, 3],
];

/** 悬浮块：`[起始格, 高度, 长度]`，跳上去吃上面的道具 */
const FLOAT_RUNS = [
  [18, 9, 3],
  [28, 10, 2],
  [41, 9, 3],
  [50, 11, 2],
];

/**
 * 普通拾取物：`[格, 底边]`。
 *
 * 第二项是**底边**不是中心 —— `placeGroup(obj, col, row, w, h)` 的 `row` 是方块
 * 底边所在的格。原站普通拾取物是 1 格、MEGA 是 2 格（`const size = mega ? 2 : 1`），
 * 这里跟着走 1 格；写 3 会变成一个 3 格的九宫格，比 MEGA 还大。
 */
const PICKUP_AT = [
  [7, 7],
  [19, 11],
  [42, 11],
  [54, 7],
];

/**
 * 虫子：`[格, 站在哪一格, 巡逻左界, 巡逻右界]`。
 *
 * 巡逻界必须手写、而且要落在同一段地面上 —— 原站那套 `Bug.groundPatrolBounds()`
 * 给的是一条固定 16 格宽的带子，碰到沟或台阶它会笔直穿过去（看着像在飘）。
 * 这里两只分别站在 [14,21] 和 [38,44] 两段平地上。
 */
const BUG_AT = [
  [17, 5, 14, 21],
  [41, 5, 38, 44],
];

/** 展开成「按格索引」的表，生成时直接查，不用每次去遍历段 */
function expandRuns(runs, span) {
  const cells = new Array(span).fill(null);
  for (const [start, y, length] of runs) {
    for (let i = 0; i < length; i += 1) cells[(start + i) % span] = y;
  }
  return cells;
}

function expandSingle(list, span) {
  const cells = new Array(span).fill(null);
  for (const [x, y] of list) cells[x % span] = y;
  return cells;
}

/** 虫子多两列：巡逻界也一起存下来 */
export function expandBugs(list, span) {
  const cells = new Array(span).fill(null);
  for (const [x, y, minX, maxX] of list) cells[x % span] = { y, minX, maxX };
  return cells;
}

export const DEMO_GROUND = expandRuns(GROUND_RUNS, DEMO_SPAN);
export const DEMO_FLOATS = expandRuns(FLOAT_RUNS, DEMO_SPAN);
export const DEMO_PICKUPS = expandSingle(PICKUP_AT, DEMO_SPAN);
export const DEMO_BUGS = expandBugs(BUG_AT, DEMO_SPAN);

/** 某一个绝对格坐标，对应到周期里的第几格 */
export const demoCell = (x) => ((Math.floor(x) % DEMO_SPAN) + DEMO_SPAN) % DEMO_SPAN;
