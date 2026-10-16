/**
 * 全部数值取自原站 minified chunk 反解，注释标注了原始变量名。
 *
 * 移植进 SOFT LAB 只改了一件事：资源路径从写死的 'assets/...' 换成 Vite 的
 * import。本站是 base:'./' 的相对路径部署，写死的绝对路径在子目录下会 404；
 * `.glb` 显式带 `?url`，因为它不在 Vite 内置的资源类型表里。
 */
import monaSheetUrl from '../assets/UniverseGameSet_01.png';
import mona3dUrl from '../assets/mona2.glb?url';
import bugSheetUrl from '../assets/UniverseBug_02.png';
import duckyUrl from '../assets/DuckGame_02.png';
import heartUrl from '../assets/HeartGame.png';
import fallbackUrl from '../assets/super-mona-fallback.webp';
import contribution1 from '../assets/ContributionIcon_1.png';
import contribution2 from '../assets/ContributionIcon_2.png';
import contribution3 from '../assets/ContributionIcon_3.png';
import contribution4 from '../assets/ContributionIcon_4.png';
import contribution5 from '../assets/ContributionIcon_5.png';

/** 方块 / 拾取物 / 残影调色板（原 `l`） */
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

/** 输入（原 `eW` / `e6`） */
export const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space']);
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

/** 资源路径 */
export const ASSETS = {
  monaSheet: monaSheetUrl,
  mona3d: mona3dUrl,
  bugSheet: bugSheetUrl,
  ducky: duckyUrl,
  heart: heartUrl,
  fallback: fallbackUrl,
  contribution: [contribution1, contribution2, contribution3, contribution4, contribution5],
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
