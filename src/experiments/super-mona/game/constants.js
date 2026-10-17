/**
 * 全部数值取自原站 minified chunk 反解，注释标注了原始变量名。
 */

/**
 * 残影调色板（原 `l`）。
 * ⚠️ 不要往这里加色。`Mona.js` 的残影数量是 `PALETTE.length`（原站 6 条），
 *    扩它等于改掉原站行为。拾取物的配色就取自这里。
 */
export const PALETTE = ['#5fed83', '#bba00a', '#ae85ff', '#f73678', '#c05200', '#583af7'];


/** 转场彩条颜色（原 `eK`） */
export const TRANSITION_COLORS = [0xbba00a, 6286723, 5782263, 0xc05200, 0xf73678, 0xae85ff];

/** 布局（原 `u` / `c`） */
export const LAYOUT_DESKTOP = { gridX: 94, mona: { x: 0.5, y: -0.11, scale: 0.075 } };
export const LAYOUT_NARROW = {
  gridX: 67,
  mona: { x: 0.2, y: -0.05, scale: 1.7 * LAYOUT_DESKTOP.mona.scale },
};
export const GRID_X = LAYOUT_DESKTOP.gridX;
export const GRID_Y = 26;
export const NARROW_BREAKPOINT = 1011;
export const pickLayout = (w) => (w <= NARROW_BREAKPOINT ? LAYOUT_NARROW : LAYOUT_DESKTOP);

/** 一个格子的世界坐标宽度（原 `y` = 1/d） */
export const CELL = 1 / GRID_X;
/** 网格在世界坐标里的高度（原代码里到处出现的 26/gridX） */
export const gridHeight = (gridX) => 26 / gridX;

/** 关卡生成参数（原 `eN`） */
export const LEVEL = {
  LOWER_ROW: { START_X: 16, MIN_Y: 4, RANGE_Y: 9 },
  UPPER_ROW: { START_X: 24, MIN_Y: 17, RANGE_Y: 3 },
  LENGTH: {
    SHORT: { MIN: 4, MAX: 6 },
    LONG: { MIN: 9, MAX: 14 },
  },
  LENGTH_PER_SCROLL_SPEED: 0.5,
  GAP: {
    SHORT: { MIN: 3, MAX: 5 },
    MEDIUM: { MIN: 6, MAX: 9 },
    LONG: { MIN: 10, MAX: 13 },
  },
  STEP_WIDTH: 4,
  STEP_HEIGHT: 2,
  STAIR_MAX_STEPS: 3,
  RAISE_DELTA: { MIN: 2, MAX: 3 },
  BRIDGE_CHANCE: 1 / 8,
  MIN_VERTICAL_GAP: 3,
};

/** 生成边界（原 `eU`） */
export const SPAWN = {
  MIN_X: GRID_X,
  FORCE_X: GRID_X + 45,
  SPAWN_INTERVAL_SECONDS: 20,
};

/**
 * 地面虫子的巡逻半径（原 `Bug.groundPatrolBounds` 里的那个 8）。
 * 挪到常量里是因为服务端重放也要用它 —— 而 `Bug.js` 依赖 three，进不了 Workers。
 */
export const BUG_PATROL_RADIUS = 8;

/** 输入（原 `eW` / `e6`） */
/** 会拦下默认行为、并且游戏真的会响应的键。`KeyW` 和空格等价（跳跃）——
    不少人习惯 WASD，原站只认箭头键和空格。 */
export const GAME_KEYS = new Set([
  'ArrowLeft',
  'ArrowRight',
  'KeyA',
  'KeyD',
  'KeyW',
  'Space',
]);
export const DIRECTION_KEYS = ['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'];

/** 物理 */
export const GRAVITY = 64; // 原 update 里的 64*e
export const SCROLL_SPEED_MIN = 2;
export const SCROLL_SPEED_MAX = 20;
export const SCROLL_ACCEL_PER_SEC = 0.2; // 原 getForcedScrollSpeed
export const POWERUP_SPEED_SPAN = 18; // 原 getPowerupDurationMultiplier 里的 18
export const POWERUP_DURATION_PENALTY = 0.25;

/** 存储键（原 `eS` / `e0`） */
export const STORAGE_KEYS = {
  muted: 'universe26:sound-muted',
  highScore: 'universe26:super-mona-high-score',
};

/**
 * 组件文案表（原 `module 2283`，导出名 `s`）。
 * 页面层会按活动阶段切换 `eyebrow.left` / `eyebrow.leftShort`。
 */
export const TEXT = {
  eyebrow: {
    left: 'play_super-mona_while_you_wait/',
    leftShort: 'play_super-mona/',
    highScore: 'super-mona / your high score:',
  },
  button: {
    label: {
      playGame: 'Play',
      exitGame: 'Exit game',
      playAgain: 'Play again',
    },
    variant: 'secondary',
  },
  sound: {
    turnOn: 'Turn sound on',
    turnOff: 'Turn sound off',
  },
};

/** 埋点串（原 `e7`）——与按钮可见文案分开 */
export const ANALYTICS = {
  playGame: 'Content, Play game, ref_loc: SuperMona;',
  exitGame: 'Content, Exit game, ref_loc: SuperMona;',
  playAgain: 'Content, Play again, ref_loc: SuperMona;',
};

/** 音效 */
export const REVERB_EFFECTS = new Set(['collect', 'collectMega', 'breakBlock', 'squashBug']);
export const UNLOCK_EVENTS = ['pointerdown', 'keydown', 'touchstart'];

/** 音效预设（原 `ek` `eO` `eC` `e_` `eI` `eE` `eG` `eL` `eP` `eT`） */
export const SFX = {
  jump: { frequency: 440, endFrequency: 880, type: 'triangle', duration: 0.16, gain: 0.15 },
  collect: [
    { frequency: 520, type: 'triangle', duration: 0.1, gain: 0.14, delay: 0 },
    { frequency: 780, type: 'triangle', duration: 0.12, gain: 0.15, delay: 0.05 },
    { frequency: 1040, type: 'triangle', duration: 0.16, gain: 0.16, delay: 0.1 },
  ],
  collectMega: [
    { frequency: 520, type: 'triangle', duration: 0.12, gain: 0.2, delay: 0 },
    { frequency: 780, type: 'triangle', duration: 0.14, gain: 0.2, delay: 0.07 },
    { frequency: 1040, type: 'triangle', duration: 0.2, gain: 0.22, delay: 0.14 },
    { frequency: 1568, type: 'triangle', duration: 0.18, gain: 0.22, delay: 0.21 },
    { frequency: 2093, type: 'triangle', duration: 0.2, gain: 0.24, delay: 0.28 },
  ],
  catchDucky: [
    { frequency: 660, endFrequency: 880, type: 'sine', duration: 0.1, gain: 0.16, delay: 0 },
    { frequency: 880, endFrequency: 1100, type: 'sine', duration: 0.12, gain: 0.16, delay: 0.09 },
    { frequency: 1100, endFrequency: 1760, type: 'sine', duration: 0.18, gain: 0.13, delay: 0.2 },
    { frequency: 1760, endFrequency: 2640, type: 'sine', duration: 0.22, gain: 0.08, delay: 0.36 },
  ],
  duckyLeave: [
    { frequency: 1100, endFrequency: 880, type: 'sine', duration: 0.14, gain: 0.1, delay: 0 },
    { frequency: 880, endFrequency: 660, type: 'sine', duration: 0.18, gain: 0.08, delay: 0.11 },
  ],
  megaEnd: [
    { frequency: 1040, type: 'triangle', duration: 0.12, gain: 0.13, delay: 0 },
    { frequency: 780, type: 'triangle', duration: 0.14, gain: 0.12, delay: 0.08 },
    { frequency: 520, type: 'triangle', duration: 0.22, gain: 0.12, delay: 0.16 },
  ],
  gameOver: [
    { frequency: 392, type: 'square', duration: 0.2, gain: 0.11, delay: 0 },
    { frequency: 329.63, type: 'square', duration: 0.2, gain: 0.11, delay: 0.16 },
    { frequency: 261.63, type: 'square', duration: 0.2, gain: 0.11, delay: 0.32 },
    { frequency: 196, type: 'square', duration: 0.32, gain: 0.12, delay: 0.48 },
  ],
  /**
   * 动作字（PLAY / PLAY AGAIN）的按下音。
   * 短、亮、不拖尾 —— 它只是个「收到了」的回执，不该盖过后面绽开的那一下。
   */
  uiClick: { frequency: 880, endFrequency: 1420, type: 'triangle', duration: 0.075, gain: 0.1 },
  /**
   * 动作字绽开时那一下。和方块向外飞散同步：两道上行的扫频（较低的先在，
   * 较高的后叠进来）做出「散开」的厚度。
   */
  uiBloom: [
    { frequency: 620, endFrequency: 1860, type: 'sine', duration: 0.26, gain: 0.11, delay: 0 },
    { frequency: 930, endFrequency: 2480, type: 'sine', duration: 0.3, gain: 0.06, delay: 0.05 },
  ],
  /** 再补一层细细的高频噪声，方块碎开时才有「沙」的一下质感 */
  uiBloomNoise: { duration: 0.22, gain: 0.045, filterFrequency: 2600, filterType: 'highpass' },
  squashBug: [
    { frequency: 880, endFrequency: 440, type: 'triangle', duration: 0.07, gain: 0.13, delay: 0 },
    { frequency: 160, endFrequency: 820, type: 'sine', duration: 0.11, gain: 0.12, delay: 0.06 },
  ],
  squashBugNoise: { duration: 0.05, gain: 0.05, filterFrequency: 380, filterType: 'lowpass' },
  breakBlock: [
    { frequency: 196, type: 'sine', duration: 0.1, gain: 0.1, delay: 0 },
    { frequency: 262, type: 'sine', duration: 0.1, gain: 0.08, delay: 0.05 },
    { frequency: 392, type: 'sine', duration: 0.1, gain: 0.06, delay: 0.1 },
  ],
  damage: {
    tone: { frequency: 180, endFrequency: 90, type: 'square', duration: 0.25, gain: 0.22 },
    noise: { duration: 0.22, gain: 0.15, filterFrequency: 500 },
  },
};

/**
 * 资源路径。
 *
 * ⚠️ **这里的值是运行时的字符串，不要改成 `import`。**
 *
 * 两个站共用这一份代码，但素材的落地方式得统一：路径都写成 `assets/xxx`，
 * 靠各自的 `public/assets/` 目录把文件带进构建产物（vite 会把 `public/` 原样
 * 复制到 `dist/`）。
 *
 * 为什么不用 `import`：那要求素材在**源码目录**里，而两个站的源码结构不一样 ——
 * 实验室有 `src/experiments/super-mona/assets/`，独立站只有 `public/assets/`。
 * 写 `import x from '../assets/...'` 只能满足一边，同步过去另一边就 404。
 *
 * ⚠️ 反过来说：**改完这个文件、又同步到实验室时，务必确认 `public/assets/` 里有
 *    这批文件**。只同步源码不同步素材，构建产物里就没有素材 —— 贴图全部 404，
 *    角色 / 虫子 / 拾取物的中心图标集体消失，而地形是纯几何所以还在，
 *    看起来就是「页面正常但主角不见了」。2026-10-17 踩过这个坑。
 *
 * 代价：要求站点部署在**根路径**（两边都是自有域名的根，满足）。
 * 哪天要挪到子目录，就得改回 `import` 方案。
 */
export const ASSETS = {
  monaSheet: 'assets/UniverseGameSet_01.png',
  mona3d: 'assets/mona2.glb',
  bugSheet: 'assets/UniverseBug_02.png',
  ducky: 'assets/DuckGame_02.png',
  heart: 'assets/HeartGame.png',
  fallback: 'assets/super-mona-fallback.webp',
  contribution: [
    'assets/ContributionIcon_1.png',
    'assets/ContributionIcon_2.png',
    'assets/ContributionIcon_3.png',
    'assets/ContributionIcon_4.png',
    'assets/ContributionIcon_5.png',
  ],
};

/** Mona 精灵表：5×5 网格，每帧 26×27（原 `ee` / `Q`） */
export const MONA_SHEET = {
  frameW: 26,
  frameH: 27,
  sheetW: 130,
  sheetH: 135,
  frameMs: 1000 / 15,
};

const frames = (y, count, durationMs) =>
  Array.from({ length: count }, (_, i) => ({ x: 26 * i, y, durationMs }));

export const MONA_CLIPS = {
  Idle: frames(0, 5, 200),
  Walk: frames(27, 5, 60),
  Jump_Up: frames(54, 4, 60),
  JumpDown: frames(81, 4, 60),
  Land: frames(108, 1, 60),
};

/** 虫子精灵表 Aseprite 元数据（原 `H`，内嵌在 chunk 里） */
export const BUG_SHEET = {
  imageW: 78,
  imageH: 81,
  frameW: 26,
  frameH: 27,
  durations: [200, 200, 200, 200, 150, 150, 150, 150, 1000],
  clips: {
    Idle: { from: 0, to: 3 },
    Walk: { from: 4, to: 7 },
    squish: { from: 8, to: 8 },
  },
};

/** 结算像素字模（原 `em`） */
export const GAME_OVER_GLYPHS = {
  G: ['.####.', '##..##', '##....', '##.###', '##..##', '##..##', '.####.'],
  A: ['..##..', '.####.', '##..##', '######', '##..##', '##..##', '##..##'],
  M: ['#.....#', '##...##', '###.###', '##.#.##', '##...##', '##...##', '##...##'],
  E: ['#####', '##...', '##...', '####.', '##...', '##...', '#####'],
  O: ['.####.', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  V: ['##..##', '##..##', '##..##', '##..##', '##..##', '.####.', '..##..'],
  R: ['#####.', '##..##', '##..##', '#####.', '##..##', '##..##', '##..##'],
};

/**
 * 像素字模（`PLAY` / `EXIT` / `PLAY AGAIN` / `SUBMIT SCORE` / `TOP SCORES`）。
 *
 * 原站那套只有拼 `GAME OVER` 和分数要用的字符（G A M E O V R + 数字）。
 * 补的这批（P L Y I N X T，后来又加了 S U B C 给排行榜用）按**同一套规格**画：
 * 7 行高、笔画 2px、字间距 1 格。画的时候对着 M / N / X / O / R 校准 ——
 * 尤其 S 是照着 G 去掉那根竖钩来的，混排时笔画粗细和重心才一致。
 */
export const ACTION_GLYPHS = {
  ...GAME_OVER_GLYPHS,
  P: ['#####.', '##..##', '##..##', '#####.', '##....', '##....', '##....'],
  L: ['##...', '##...', '##...', '##...', '##...', '##...', '#####'],
  Y: ['##..##', '##..##', '.####.', '..##..', '..##..', '..##..', '..##..'],
  I: ['####', '.##.', '.##.', '.##.', '.##.', '.##.', '####'],
  N: ['##...##', '###..##', '####.##', '##.####', '##..###', '##...##', '##...##'],
  X: ['##..##', '##..##', '.####.', '..##..', '.####.', '##..##', '##..##'],
  T: ['######', '..##..', '..##..', '..##..', '..##..', '..##..', '..##..'],
  S: ['.####.', '##..##', '##....', '.####.', '....##', '##..##', '.####.'],
  U: ['##..##', '##..##', '##..##', '##..##', '##..##', '##..##', '.####.'],
  B: ['#####.', '##..##', '##..##', '#####.', '##..##', '##..##', '#####.'],
  C: ['.####.', '##..##', '##....', '##....', '##....', '##..##', '.####.'],
};

/**
 * 排行榜。
 *
 * `endpoint` 是**相对路径** —— 后端只存在于 doit 站，独立站（`super-mona.pages.dev`）
 * 那一边不发请求、也没有这个功能。用相对路径而不是写死的域名，是因为仓库是公开的，
 * 代码里不留自有域名（见项目纪律）。
 */
export const BOARD = {
  endpoint: '/api/scores',
  /** 名字字符集：像素字模只有大写英文和数字，收别的也画不出来 */
  namePattern: /^[A-Z0-9][A-Z0-9 _-]*$/,
  maxNameLength: 12,
  /** localStorage 里记住上次用的名字，省得每局重打 */
  nameStorageKey: 'universe26:scoreboard-name',
  /**
   * 上报时是否附带整局的「种子 + 事件流」。
   *
   * `false`（当前）：只发名字 / 分数 / 时长 —— 服务端做**极简校验**：
   *   ① 时长必须在合理区间 ② 分数不能超过「这段时间理论上拿得到的上限」。
   *   小游戏，够用了；代价是「合理范围内的假分数」拦不住。
   *
   * `true`：连事件流一起发，服务端会拿种子把整局重放一遍、逐条核对每条得分
   *   事件是不是真落在当时存在的东西上，然后**自己算分**。挡得死得多，
   *   但要同时把服务端的 `SCORE_VERIFY=replay` 打开（见 `functions/_shared/replay.js`）。
   */
  includeRun: false,
};

export const BOARD_TEXT = {
  submit: 'SUBMIT',
  /** 左上角那枚看榜入口。用 `TOP` 而不是 `RANK` —— 字模里没有 K */
  top: 'TOP',
  submitTitle: 'SUBMIT SCORE',
  topTitle: 'TOP SCORES',
  nameHint: 'A–Z 0–9, UP TO 12',
  save: 'SAVE',
  cancel: 'CANCEL',
  sending: 'SENDING',
  yourScore: 'YOUR SCORE',
  empty: 'NO SCORES YET',
  /**
   * 榜单**没拉到**（接口不存在 / 后端没随部署上传 / 断网）。
   *
   * 以前这里什么都不说，直接显示 `NO SCORES YET` —— 于是「接口挂了」和「真的一条
   * 成绩都没有」在玩家眼里长得一模一样，就成了「一更新数据就没了」。两者必须分开说。
   */
  boardDown: 'CANNOT REACH THE BOARD — SCORES ARE STILL SAFE',
  retry: 'RETRY',
  /** 榜单首次取数。不用 `SENDING` —— 那是提交按钮的词 */
  loading: 'LOADING',
  /** 提交被拒时给玩家看的话。键名是服务端的 `error` 字段 */
  errors: {
    'bad-name': 'NAME MUST BE A–Z / 0–9, 1–12 CHARS',
    'bad-score': 'THIS SCORE LOOKS IMPOSSIBLE',
    'score-too-high': 'TOO MANY POINTS FOR THAT SHORT A RUN',
    'bad-seed': 'THIS RUN LOOKS BROKEN',
    'bad-duration': 'THIS RUN LOOKS BROKEN',
    'no-events': 'NO SCORE TO SUBMIT THIS RUN',
    'too-many-events': 'THIS RUN IS TOO LONG TO VERIFY',
    'score-mismatch': 'SCORE DID NOT MATCH THE REPLAY',
    'unbacked-super': 'SCORE DID NOT MATCH THE REPLAY',
    'no-block-there': 'SCORE DID NOT MATCH THE REPLAY',
    'no-pickup-there': 'SCORE DID NOT MATCH THE REPLAY',
    'no-bug-there': 'SCORE DID NOT MATCH THE REPLAY',
    'out-of-reach': 'SCORE DID NOT MATCH THE REPLAY',
    'block-twice': 'SCORE DID NOT MATCH THE REPLAY',
    'rate-limited': 'TOO MANY SUBMISSIONS — WAIT A MINUTE',
    'body-too-large': 'THIS RUN IS TOO LONG TO VERIFY',
    'no-database': 'LEADERBOARD IS OFFLINE',
    /** 连不上后端（本地纯静态预览就是这样：这条路径上根本没有 Functions） */
    offline: 'LEADERBOARD IS OFFLINE HERE',
    default: 'COULD NOT SUBMIT — TRY AGAIN',
  },
};

/** 分数飘字像素字模 3×5（原 `ey`） */
export const SCORE_GLYPHS = {
  '+': ['000', '010', '111', '010', '000'],
  0: ['111', '101', '101', '101', '111'],
  1: ['010', '110', '010', '010', '111'],
  2: ['111', '001', '111', '100', '111'],
  3: ['111', '001', '111', '001', '111'],
  4: ['101', '101', '111', '001', '001'],
  5: ['111', '100', '111', '001', '111'],
  6: ['111', '100', '111', '101', '111'],
  7: ['111', '001', '001', '001', '001'],
  8: ['111', '101', '111', '101', '111'],
  9: ['111', '101', '111', '001', '111'],
};

/** 结算板尺寸（原 `en`） */
export const GAME_OVER_BOARD = { width: 21, height: 8, boundarySize: 1, top: 3 };
