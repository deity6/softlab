/**
 * 配色方案 —— 一个方案就是一次「换光」
 *
 * scene.frag 里的云层颜色是原作写死的（14 层 × 4 个色，共 40 多个常量），
 * 天空只有 skyTint 一个可调入口。想加配色有两条路：
 *   1. 把那 40 多个常量改成 uniform 数组 → 每切一次配色都要重编译 shader，
 *      面板滑动时会卡，而且字符串拼接出来的 GLSL 没法读；
 *   2. 在后处理里做分级（grade）—— 本文件走这条。
 *
 * 分级用三段色阶（暗部 / 中间调 / 高光）乘在成片上。乘而不是替换，画面里
 * 原本的明暗关系、列车和桥的层次全留着，只是光被换成了另一种。原作的落日
 * 是 40 多个手挑的暖色常数，硬换会丢；乘上去就变成了「同一片云海站在另一次
 * 日出下面」，这恰好是配色该有的关系。
 *
 * 因此下面的配色**只描述光，不描述物**：skyTint 之外的三段是光色，
 * 而列车、烟雾仍然是各自的直选色。
 */


export const PALETTES: Palette[] = [
  {
    id: 'sunset',
    name: '落日',
    note: '原作的暖橙，低角度的太阳，云顶还烫着',
    sky: '#8fb4ff',
    shadow: '#241a2e',
    mid: '#c85a2e',
    high: '#ffd98f',
    train: '#7a3033',
    smoke: '#ffffff',
    temperature: 0.16,
    exposure: 1,
    saturation: 1.3,
    chips: ['#2b2140', '#c2603a', '#ffd9a0'],
    family: 'warm',
    lum: 0.62,
    sat: 0.72,
    nameKey: 'pal.sunset.name',
    noteKey: 'pal.sunset.note',
  },
  {
    id: 'ink',
    name: '水墨',
    note: '把饱和度抽掉，只剩浓淡——云像宣纸上洇开的一笔',
    sky: '#cfd8e3',
    shadow: '#14181f',
    mid: '#6f7883',
    high: '#f2f5f8',
    train: '#2b3138',
    smoke: '#f4f6f8',
    temperature: -0.08,
    exposure: 1.04,
    saturation: 0.34,
    chips: ['#14181f', '#7c848d', '#f2f5f8'],
    family: 'neutral',
    lum: 0.78,
    sat: 0.08,
    nameKey: 'pal.ink.name',
    noteKey: 'pal.ink.note',
  },
  {
    id: 'aurora',
    name: '极光',
    note: '冷绿打在云背上，高光是薄荷色的，边上发紫',
    sky: '#1f7fb8',
    shadow: '#05201c',
    mid: '#45d6a4',
    high: '#c2fff0',
    train: '#1f4a4a',
    smoke: '#e6fff8',
    temperature: -0.34,
    exposure: 1.04,
    saturation: 1.34,
    chips: ['#05201c', '#45d6a4', '#c2fff0'],
    family: 'cool',
    lum: 0.44,
    sat: 0.88,
    nameKey: 'pal.aurora.name',
    noteKey: 'pal.aurora.note',
  },
  {
    id: 'dusk',
    name: '蓝调',
    note: '太阳已经走了，云只剩剪影，天空压得很低',
    sky: '#3f5688',
    shadow: '#070c1c',
    mid: '#2c3d68',
    high: '#8fa8d2',
    train: '#1a2138',
    smoke: '#c8d4ea',
    temperature: -0.24,
    exposure: 0.86,
    saturation: 0.7,
    chips: ['#070c1c', '#2c3d68', '#8fa8d2'],
    family: 'cool',
    lum: 0.24,
    sat: 0.46,
    nameKey: 'pal.dusk.name',
    noteKey: 'pal.dusk.note',
  },
  {
    id: 'sakura',
    name: '樱',
    note: '把暖橙整个换掉，云顶变成粉白，光是软的',
    sky: '#c9b0e8',
    shadow: '#2a1c48',
    mid: '#c47ab0',
    high: '#ffc0e2',
    train: '#6d3550',
    smoke: '#ffeef2',
    temperature: -0.2,
    exposure: 0.9,
    saturation: 1.32,
    chips: ['#2a1c48', '#c47ab0', '#ffc0e2'],
    family: 'warm',
    lum: 0.66,
    sat: 0.66,
    nameKey: 'pal.sakura.name',
    noteKey: 'pal.sakura.note',
  },
  {
    id: 'solar',
    name: '正午',
    note: '光从顶上压下来，几乎没有阴影——平，得有点硬',
    sky: '#5c9dec',
    shadow: '#3c4a5c',
    mid: '#9cb2b8',
    high: '#dceaff',
    train: '#8a4a2c',
    smoke: '#ffffff',
    temperature: -0.04,
    exposure: 0.92,
    saturation: 0.5,
    chips: ['#3c4a5c', '#9cb2b8', '#dceaff'],
    family: 'neutral',
    lum: 0.86,
    sat: 0.18,
    nameKey: 'pal.solar.name',
    noteKey: 'pal.solar.note',
  },
  {
    id: 'ember',
    name: '余烬',
    note: '只留暗红和黑，像烧完以后还亮着的那块炭',
    sky: '#6b4a3a',
    shadow: '#100a0a',
    mid: '#7a2f22',
    high: '#ffb066',
    train: '#4a1616',
    smoke: '#e8d0c0',
    temperature: 0.34,
    exposure: 0.94,
    saturation: 1.16,
    chips: ['#0c0707', '#8a3320', '#ffb066'],
    family: 'warm',
    lum: 0.34,
    sat: 0.94,
    nameKey: 'pal.ember.name',
    noteKey: 'pal.ember.note',
  },
  {
    id: 'neon',
    name: '霓虹',
    note: '青洋红，高光过曝——把画面推成一块糖纸',
    sky: '#3d1a6b',
    shadow: '#0d0722',
    mid: '#6b2fa0',
    high: '#ff7ad5',
    train: '#2b1050',
    smoke: '#ffd9f4',
    temperature: -0.1,
    exposure: 1.08,
    saturation: 1.24,
    chips: ['#0b0620', '#7b45b4', '#ff9ad5'],
    family: 'vivid',
    lum: 0.58,
    sat: 0.96,
    nameKey: 'pal.neon.name',
    noteKey: 'pal.neon.note',
  },

  /* ======================================================================
     新增的高冲击配色。选它们的规则不是「好看」，是**色相差**：
     `mid`（云海主色）与 `high`（云顶/太阳）是画面最显眼的两块，这两块
     的色相间隔决定冲击力。实测规则：
       >= 150°  撞色，画面会在暗部与亮部之间撕开
       100-150° 分裂互补，稳一点但依然有对立
       < 60°    邻近色，同时出现会互相干扰、显浑浊 —— 弃用
     原作的「樱」（粉 330°）与「霓虹」（洋红 320°）就是这一类，
     用户原话：「紫红的这两种配色配一起冲击力比较弱」。
     下面每套的色相差都在注释里标了实测值。
     ====================================================================== */
  {
    id: 'acid-rose',
    name: '酸玫',
    note: '荧光黄绿撞上玫红 —— 暗部发酸、亮部发甜，中间是整片不稳定的绿',
    sky: '#2a0f1e',
    shadow: '#1a2b0a',
    mid: '#7fb800',   // 酸黄绿
    high: '#ff2d78',  // 玫红  间隔 93°
    train: '#2b0d1c',
    smoke: '#ffd6e6',
    temperature: -0.14,
    exposure: 1.04,
    saturation: 1.42,
    chips: ['#1a2b0a', '#7fb800', '#ff2d78'],
    family: 'acid',
    lum: 0.6,
    sat: 0.92,
    nameKey: 'pal.acid-rose.name',
    noteKey: 'pal.acid-rose.note',
  },
  {
    id: 'acid-violet',
    name: '酸紫',
    note: '毒绿对深紫，171° 正互补。这套是全部里最不客气的一套',
    sky: '#180a2e',
    shadow: '#0d1a06',
    mid: '#8fd400',   // 酸绿
    high: '#9b3cff',  // 紫    间隔 171°
    train: '#1a0a2b',
    smoke: '#e0d4ff',
    temperature: -0.22,
    exposure: 1.02,
    saturation: 1.46,
    chips: ['#0d1a06', '#8fd400', '#9b3cff'],
    family: 'clash',
    lum: 0.55,
    sat: 0.9,
    nameKey: 'pal.acid-violet.name',
    noteKey: 'pal.acid-violet.note',
  },
  {
    id: 'ultramarine',
    name: '群青',
    note: '群青压金黄，179° 正互补。蓝到发紫，金亮到发白',
    sky: '#0a1030',
    shadow: '#050818',
    mid: '#1a3cff',   // 群青
    high: '#ffd400',  // 金    间隔 179°
    train: '#0d1330',
    smoke: '#e8e4ff',
    temperature: -0.1,
    exposure: 1.0,
    saturation: 1.34,
    chips: ['#050818', '#1a3cff', '#ffd400'],
    family: 'clash',
    lum: 0.52,
    sat: 0.88,
    nameKey: 'pal.ultramarine.name',
    noteKey: 'pal.ultramarine.note',
  },
  {
    id: 'red-cyan',
    name: '红青',
    note: '正红对青，174°。最老牌的撞色，稳到不会出错',
    sky: '#06141a',
    shadow: '#0a0508',
    mid: '#e02b2b',   // 正红
    high: '#00e5ff',  // 青    间隔 174°
    train: '#2b0808',
    smoke: '#d4f4ff',
    temperature: -0.06,
    exposure: 1.0,
    saturation: 1.3,
    chips: ['#0a0508', '#e02b2b', '#00e5ff'],
    family: 'clash',
    lum: 0.54,
    sat: 0.86,
    nameKey: 'pal.red-cyan.name',
    noteKey: 'pal.red-cyan.note',
  },
  {
    id: 'pumpkin',
    name: '南瓜',
    note: '南瓜橙对松石绿，146°。暖与冷的正面交锋，不刺眼但很响',
    sky: '#1a0f06',
    shadow: '#0f0a04',
    mid: '#ff6b00',   // 南瓜橙
    high: '#00d4b4',  // 松石  间隔 146°
    train: '#2b1405',
    smoke: '#fff0d4',
    temperature: 0.04,
    exposure: 1.02,
    saturation: 1.26,
    chips: ['#0f0a04', '#ff6b00', '#00d4b4'],
    family: 'clash',
    lum: 0.58,
    sat: 0.84,
    nameKey: 'pal.pumpkin.name',
    noteKey: 'pal.pumpkin.note',
  },
  {
    id: 'blue-lime',
    name: '蓝柠',
    note: '深蓝撞柠黄，155°。冷面暖芯，像夜色里一盏荧光灯',
    sky: '#060a1a',
    shadow: '#04060f',
    mid: '#1e4dff',   // 深蓝
    high: '#c8ff00',  // 柠黄  间隔 155°
    train: '#0a122b',
    smoke: '#e4ffd0',
    temperature: -0.18,
    exposure: 1.03,
    saturation: 1.38,
    chips: ['#04060f', '#1e4dff', '#c8ff00'],
    family: 'acid',
    lum: 0.56,
    sat: 0.9,
    nameKey: 'pal.blue-lime.name',
    noteKey: 'pal.blue-lime.note',
  },
  {
    id: 'violet-yellow',
    name: '紫柠',
    note: '紫对柠黄，152°。比「蓝柠」更暖一点，糖果味更重',
    sky: '#140a1e',
    shadow: '#0a0610',
    mid: '#7a2cff',   // 紫
    high: '#ffe600',  // 柠黄  间隔 152°
    train: '#1a0b2b',
    smoke: '#f0e4ff',
    temperature: -0.12,
    exposure: 1.04,
    saturation: 1.36,
    chips: ['#0a0610', '#7a2cff', '#ffe600'],
    family: 'clash',
    lum: 0.6,
    sat: 0.88,
    nameKey: 'pal.violet-yellow.name',
    noteKey: 'pal.violet-yellow.note',
  },
  {
    id: 'mint-coral',
    name: '薄荷',
    note: '薄荷绿对珊瑚，161°。两支都甜，靠明度差撑开',
    sky: '#061a14',
    shadow: '#04100c',
    mid: '#00ffc8',   // 薄荷
    high: '#ff5e4d',  // 珊瑚  间隔 161°
    train: '#0a2b22',
    smoke: '#e0fff4',
    temperature: 0.02,
    exposure: 1.0,
    saturation: 1.24,
    chips: ['#04100c', '#00ffc8', '#ff5e4d'],
    family: 'duotone',
    lum: 0.64,
    sat: 0.78,
    nameKey: 'pal.mint-coral.name',
    noteKey: 'pal.mint-coral.note',
  },
  {
    id: 'teal-coral',
    name: '墨玫',
    note: '深青对玫瑰，177°。暗部压得极低，靠高光那一抹粉撑起整幅',
    sky: '#0d1a1a',
    shadow: '#050c0c',
    mid: '#0d9488',   // 墨青
    high: '#fb7185',  // 玫瑰  间隔 177°
    train: '#12282b',
    smoke: '#ffe0e4',
    temperature: 0.0,
    exposure: 1.06,
    saturation: 1.28,
    chips: ['#050c0c', '#0d9488', '#fb7185'],
    family: 'duotone',
    lum: 0.44,
    sat: 0.8,
    nameKey: 'pal.teal-coral.name',
    noteKey: 'pal.teal-coral.note',
  },
  {
    id: 'electric',
    name: '电光',
    note: '青对洋红，125°。赛博但克制 —— 中间调压暗才不会俗',
    sky: '#0d0a1a',
    shadow: '#050410',
    mid: '#00a8c8',   // 青
    high: '#ff2bd6',  // 洋红  间隔 125°
    train: '#100820',
    smoke: '#dff8ff',
    temperature: -0.08,
    exposure: 1.02,
    saturation: 1.44,
    chips: ['#050410', '#00a8c8', '#ff2bd6'],
    family: 'vivid',
    lum: 0.5,
    sat: 0.94,
    nameKey: 'pal.electric.name',
    noteKey: 'pal.electric.note',
  },
  {
    id: 'fuchsia-lime',
    name: '洋红',
    note: '品红对黄绿，129°。多巴胺配色里最吵的一套',
    sky: '#1a0618',
    shadow: '#100410',
    mid: '#e600c8',   // 品红
    high: '#b8ff00',  // 黄绿  间隔 129°
    train: '#2b0a26',
    smoke: '#ffe0f8',
    temperature: -0.04,
    exposure: 1.02,
    saturation: 1.48,
    chips: ['#100410', '#e600c8', '#b8ff00'],
    family: 'acid',
    lum: 0.58,
    sat: 0.96,
    nameKey: 'pal.fuchsia-lime.name',
    noteKey: 'pal.fuchsia-lime.note',
  },
  {
    id: 'sherbet',
    name: '冰沙',
    note: '青柠对桃粉，153°。三支都亮，接近渐变 —— 唯一例外是暗部压深了',
    sky: '#0a1418',
    shadow: '#060c0e',
    mid: '#38bdf8',   // 青柠
    high: '#fb7185',  // 桃粉  间隔 153°
    train: '#0d2830',
    smoke: '#e4f6ff',
    temperature: 0.06,
    exposure: 1.1,
    saturation: 1.18,
    chips: ['#060c0e', '#38bdf8', '#fb7185'],
    family: 'duotone',
    lum: 0.72,
    sat: 0.66,
    nameKey: 'pal.sherbet.name',
    noteKey: 'pal.sherbet.note',
  },
  /**
   * 云海 —— 同一色相家族，靠明度拉开。
   *
   * 前面那些撞色配色靠「色相隔 100°~180°」撕开画面，这套恰好相反：实测
   * 五段的色相只差 3°~36°（266° / 295° / 258° / 254°），是标准的邻近色，
   * 照前面的标准该被弃用。但它好看，靠的是**明度跨度**——亮度从 0.56 到
   * 1.0，七段值把云海一层层拉开；而不是色相对撞。
   *
   * 所以它单成一族 `sea`。同族的还有另外两套（雪岭 / 夜潮），三套都是
   * 低色相差 + 高明度差，凑在一起构成一组专门做「云」的选择。
   *
   * 色值全部从实际截图采样，不是手调的。
   */
  {
    id: 'violet-sea',
    name: '藕荷',
    note: '天顶藕紫、云顶粉白、云海重紫 —— 同一色相家族靠明度拉开，色相只差三十度',
    sky: '#4a2b7a',
    shadow: '#1a0f38',
    mid: '#533d94',   // 云海体
    high: '#cd9cff',  // 云顶受光，彩度只 0.29 —— 接近白才能当亮部
    train: '#160e2c',
    smoke: '#f6ecff',
    // Cool, not warm. A positive temperature pushes 270° violet toward
    // magenta, which is how the first attempt came out pink instead of
    // violet — the screenshot's purple does not survive a warm grade.
    temperature: -0.08,
    exposure: 1.0,
    saturation: 1.1,
    chips: ['#1a0f38', '#6b45ad', '#cd9cff'],
    family: 'sea',
    lum: 0.58,
    sat: 0.5,
    nameKey: 'pal.violetSea.name',
    noteKey: 'pal.violetSea.note',
  },
  {
    id: 'snow-ridge',
    name: '雪岭',
    note: '青灰的峰、白得发亮的脊线、深到发黑的谷 —— 最亮的一段刺眼',
    sky: '#93b4cc',
    shadow: '#101c28',
    mid: '#4d6f8c',
    high: '#f4fbff',
    train: '#0d1a24',
    smoke: '#ffffff',
    temperature: -0.2,
    exposure: 1.02,
    saturation: 1.06,
    chips: ['#1c2a38', '#5a7a94', '#f4fbff'],
    family: 'sea',
    lum: 0.6,
    sat: 0.42,
    nameKey: 'pal.snowRidge.name',
    noteKey: 'pal.snowRidge.note',
  },
  {
    id: 'night-tide',
    name: '夜潮',
    note: '深蓝的夜、紫的浪、一点冷白打在浪脊上 —— 云海在夜里涨潮',
    sky: '#141f4c',
    shadow: '#070b1c',
    mid: '#22306c',   // 浪身
    high: '#9fb4e8',  // 浪脊，接近 220°
    train: '#080c1c',
    smoke: '#e6eeff',
    temperature: -0.2,
    exposure: 1.0,
    saturation: 1.08,
    chips: ['#0a0f24', '#26356e', '#8fa8e8'],
    family: 'sea',
    lum: 0.38,
    sat: 0.55,
    nameKey: 'pal.nightTide.name',
    noteKey: 'pal.nightTide.note',
  },
];

/** 面板里的分组顺序。前面是同色系（安静），后面是撞色（响）。 */
/**
 * Group order for the panel. `label`/`hint` are the Chinese fallbacks; the
 * `fam.*` i18n keys are what actually render, so switching to English
 * relabels all seven without touching this table.
 */
export const FAMILY_ORDER: {
  key: Family;
  label: string;
  hint: string;
  labelKey: MsgKey;
  hintKey: MsgKey;
}[] = [
  { key: 'warm', label: '同色', hint: '靠明度拉开，安静', labelKey: 'fam.warm', hintKey: 'fam.warm.hint' },
  { key: 'cool', label: '冷调', hint: '同上，冰的那一支', labelKey: 'fam.cool', hintKey: 'fam.cool.hint' },
  { key: 'neutral', label: '素色', hint: '近乎无彩，靠浓淡', labelKey: 'fam.neutral', hintKey: 'fam.neutral.hint' },
  { key: 'vivid', label: '浓艳', hint: '彩度很高但不撞色', labelKey: 'fam.vivid', hintKey: 'fam.vivid.hint' },
  { key: 'duotone', label: '双拼', hint: '两支甜色靠明度差撑', labelKey: 'fam.duotone', hintKey: 'fam.duotone.hint' },
  { key: 'clash', label: '撞色', hint: '色相隔 100° 以上，画面会撕开', labelKey: 'fam.clash', hintKey: 'fam.clash.hint' },
  { key: 'acid', label: '多巴胺', hint: '荧光对撞，最吵', labelKey: 'fam.acid', hintKey: 'fam.acid.hint' },
  { key: 'sea', label: '云海', hint: '同一色相，只换明暗', labelKey: 'fam.sea', hintKey: 'fam.sea.hint' },
];

export function byFamily(f: Family): Palette[] {
  return PALETTES.filter((p) => p.family === f);
}

export function findPalette(id: string): Palette | undefined {
  return PALETTES.find((p) => p.id === id);
}

/**
 * 换一种光 —— 审美约束下的加权随机。
 *
 * 返回一套和 `fromId` 明显不同的光。规则只有三条，但足够：
 *   1. 绝不返回当前这套（否则按钮像是坏了）
 *   2. 同色系家族几乎不抽 —— 落日 → 樱看着就像没换
 *   3. 明度与彩度都尽量往相反方向走 —— 刚调亮就调暗、刚浓就淡，
 *      观感上才像真的「换了个时辰」而不是随机抖动
 *
 * 剩下的权重交给随机，所以仍然是随机的，只是**随机落在一个好看的集合里**。
 * 用 `Math.random` 而非 crypto：这是配色游戏，不需要可复现的随机源。
 */
export function pickPalette(fromId: string): Palette {
  const current = findPalette(fromId) ?? PALETTES[0];
  const weights = PALETTES.map((p) => {
    if (p.id === current.id) return 0;
    let w = 1;
    // 同家族降到 12%。不至于 0 —— 偶尔连着来两套相近的也是「随机」的一部分，
    // 但概率必须低。
    if (p.family === current.family) w *= 0.12;
    // 明度反向加成：|Δ| 越大越可能被抽到，最多 2.2 倍
    w *= 1 + Math.abs(p.lum - current.lum) * 2.2;
    // 彩度反向加成，同理
    w *= 1 + Math.abs(p.sat - current.sat) * 1.4;
    return w;
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < PALETTES.length; i++) {
    r -= weights[i];
    if (r <= 0) return PALETTES[i];
  }
  // 浮点误差兜底
  return PALETTES[PALETTES.length - 1];
}

import type { MsgKey } from '../../lib/i18n';

/* ==========================================================================
   换一种光 —— 审美约束下的随机
   ---------------------------------------------------------------------------
   原来的做法是 `PALETTES[Math.floor(Math.random() * len)]`：均匀随机，
   结果经常连着两次给出差不多的东西（实测「落日 → 樱」的整帧均值距离只有
   10.6/255，肉眼几乎分不出），也有时给出一套把画面糊掉的组合。

   随机本身没错 —— 「换一种光」这个按钮要的就是意外。但**意外不等于失控**：
   它应该在「一定好看」的集合里挑，而不是在 8! 种组合里赌。

   所以每套配色带三个元数据：
     family  同色系家族，用来避免连着两次落在同一个家族（视觉上≈没换）
     lum     画面明度倾向，用来避免刚调亮又调暗
     sat     彩度倾向，用来避免「水墨」连着来两次
   换光时按「和当前差得最远」加权抽样：同 family 的几乎不抽，明度/彩度
   反向的小权重抽。这样既有意外，又保证每一次换过去都是明显的改变。
   ========================================================================== */

/**
 * Colour families, and they are not decoration — `pickPalette` uses them to
 * avoid handing the visitor the same kind of light twice in a row.
 *
 * The first four describe a *temperature*; the last three describe a
 * *strategy*, which is what actually distinguishes the loud sets. A clash
 * palette can be warm (acid/rose) or cool (acid/violet); the interesting
 * property is the hue opposition, not whether it is hot.
 */
export type Family =
  | 'warm'
  | 'cool'
  | 'neutral'
  | 'vivid'
  | 'clash'
  | 'acid'
  | 'duotone'
  /** Low hue gap, high value gap — the cloud reads as *layers*, not as contrast. */
  | 'sea';

export interface Palette {
  id: string;
  name: string;
  /** 一句话说明这束光的样子 */
  note: string;
  sky: string;
  shadow: string;
  mid: string;
  high: string;
  /** 默认的染色（直选色，不是光） */
  train: string;
  smoke: string;
  /** 配套的后处理微调 —— 每种光自带色温与曝光倾向 */
  temperature: number;
  exposure: number;
  saturation: number;
  /** 渐变条上显示的三个代表色 */
  chips: [string, string, string];
  family: Family;
  /** 明度倾向 0=暗 1=亮；彩度倾向 0=灰 1=浓 */
  lum: number;
  sat: number;
  /**
   * i18n keys for the display strings. The Chinese `name`/`note` stay on the
   * object as the source of truth and as the fallback, so a missing key
   * degrades to Chinese rather than to a blank button.
   */
  nameKey: MsgKey;
  noteKey: MsgKey;
}
