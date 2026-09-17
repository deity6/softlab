import type { MsgKey } from '../lib/i18n';
import { durationLabel, type DurationToken, type EasingName } from '../motion/tokens';

/**
 * The button shelf.
 *
 * Every entry here is a real, working effect from the motion system in
 * `src/motion/` — the same 20 effects the whole site draws its buttons from.
 * These 16 are the ones worth putting on show.
 *
 * Copy rule (same as the experiments): `do` says what the visitor does,
 * `how` says how it works in one plain sentence. No cubic-beziers, no
 * class names on the card — those live on the detail page, where someone has
 * actually asked for them.
 */

export type ButtonGroupId = 'paint' | 'motion' | 'click' | 'state';

export interface ButtonEntry {
  /** motion-system effect name — also the route slug */
  id: string;
  no: string;
  en: string;
  cn: string;
  group: ButtonGroupId;
  /** what the visitor does */
  do: string;
  /** one plain sentence on how it works */
  how: string;
  /** duration token used — the label is derived from it, never hand-written */
  token: DurationToken;
  /** easing token used */
  ease: EasingName;
  /** needs the behaviour layer (pointer / state machine) */
  js?: boolean;
  /** demo label */
  label: string;
  /** demo label after the effect fires (if any) */
  next?: string;
  /** how the effect is triggered — shown on the card so nobody has to guess */
  trigger: 'hover' | 'click' | 'state';
  /** extra demo attributes */
  click?: 'cycle' | 'flip' | 'morph' | 'burst' | 'load';
  /** i18n keys; the Chinese stays on the object as the source of truth. */
  doKey: MsgKey;
  howKey: MsgKey;
  /** The button's own name. A key, not a template string — a computed
      `btn.${id}.cn` would widen to `string` and defeat the MsgKey union that
      catches typos at compile time. */
  cnKey: MsgKey;
}

/**
 * Group copy is bilingual: `en` is the headline (it was always English), `cn`
 * the Chinese one, and `howKey` resolves through i18n so the "triggered on
 * hover" line follows the language switch too.
 */
export const BUTTON_GROUPS: {
  id: ButtonGroupId;
  en: string;
  cn: string;
  cnKey: MsgKey;
  howKey: MsgKey;
}[] = [
  { id: 'paint', en: 'Colour & Fill', cn: '颜色与填充', cnKey: 'btn.grp.paint', howKey: 'btn.group.hover' },
  { id: 'motion', en: 'Shift & Shape', cn: '位移与形变', cnKey: 'btn.grp.motion', howKey: 'btn.group.hover' },
  { id: 'click', en: 'Press & Sparks', cn: '按压与粒子', cnKey: 'btn.grp.click', howKey: 'btn.group.click' },
  { id: 'state', en: 'Load & Done', cn: '加载与完成', cnKey: 'btn.grp.state', howKey: 'btn.group.click' },
];

export const BUTTONS: ButtonEntry[] = [
  {
    id: 'fill-sweep',
    cnKey: 'btn.fill-sweep.cn',
    doKey: 'btn.fill-sweep.do',
    howKey: 'btn.fill-sweep.how',
    no: 'B-01',
    en: 'Fill Sweep',
    cn: '颜色扫入',
    group: 'paint',
    trigger: 'hover',
    do: '悬停，颜色从左铺满整个按钮。',
    how: '一个铺满按钮的色块，平时被横向压扁成 0 宽，悬停时再展开。',
    token: 'fast',
    ease: 'standard',
    label: 'Fill Sweep',
  },
  {
    id: 'border-draw',
    cnKey: 'btn.border-draw.cn',
    doKey: 'btn.border-draw.do',
    howKey: 'btn.border-draw.how',
    no: 'B-02',
    en: 'Border Draw',
    cn: '描边绘制',
    group: 'paint',
    trigger: 'hover',
    do: '悬停，边框从左上角开始，一圈画回来。',
    how: '四条边各是一段渐变，按顺序依次展开，看起来像有人拿笔描了一圈。',
    token: 'glacial',
    ease: 'draw',
    label: 'Border Draw',
  },
  {
    id: 'liquid-fill',
    cnKey: 'btn.liquid-fill.cn',
    doKey: 'btn.liquid-fill.do',
    howKey: 'btn.liquid-fill.how',
    no: 'B-03',
    en: 'Liquid Fill',
    cn: '液体填充',
    group: 'paint',
    trigger: 'hover',
    do: '悬停，像水位上涨一样漫上来，液面还在晃。',
    how: '一层色块从底部升起，顶上跟一个超宽椭圆露出波峰，再横向来回滑动。',
    token: 'lazy',
    ease: 'standard',
    label: 'Liquid Fill',
  },
  {
    id: 'glow-pulse',
    cnKey: 'btn.glow-pulse.cn',
    doKey: 'btn.glow-pulse.do',
    howKey: 'btn.glow-pulse.how',
    no: 'B-04',
    en: 'Glow Pulse',
    cn: '光晕脉冲',
    group: 'paint',
    trigger: 'hover',
    do: '悬停，按钮亮起来，还有一圈光持续向外扩。',
    how: '底色和阴影一起变亮，同时一个透明圆环反复向外扩散、淡出。',
    token: 'glacial',
    ease: 'standard',
    label: 'Glow Pulse',
  },
  {
    id: 'magnetic',
    cnKey: 'btn.magnetic.cn',
    doKey: 'btn.magnetic.do',
    howKey: 'btn.magnetic.how',
    no: 'B-05',
    en: 'Magnetic',
    cn: '磁吸跟随',
    group: 'motion',
    trigger: 'hover',
    do: '鼠标在按钮上移动，它跟着倾斜、挪动，像被磁铁吸住。',
    how: '光标偏移写进变量，驱动位移 + 旋转 + 放大三件事；内层文字反向微移做视差。',
    token: 'fast',
    ease: 'elastic',
    js: true,
    label: 'Magnetic',
  },
  {
    id: 'arrow-slide',
    cnKey: 'btn.arrow-slide.cn',
    doKey: 'btn.arrow-slide.do',
    howKey: 'btn.arrow-slide.how',
    no: 'B-06',
    en: 'Arrow Slide',
    cn: '箭头滑入',
    group: 'motion',
    trigger: 'hover',
    do: '悬停，文字左移，一个箭头从右边弹进来。',
    how: '箭头静止时停在按钮右外侧，悬停时用回弹曲线滑入，同时文字左移让位。',
    token: 'fast',
    ease: 'standard',
    label: 'Explore',
  },
  {
    id: 'press-scale',
    cnKey: 'btn.press-scale.cn',
    doKey: 'btn.press-scale.do',
    howKey: 'btn.press-scale.how',
    no: 'B-07',
    en: 'Press Scale',
    cn: '按压缩放',
    group: 'click',
    trigger: 'click',
    do: '按下去会缩，松手弹回来还多弹一下。',
    how: '悬停轻微放大，按下缩小，松开时用一条会过冲的曲线慢慢弹回原位。',
    token: 'base',
    ease: 'spring',
    label: 'Press Scale',
  },
  {
    id: 'elastic-stretch',
    cnKey: 'btn.elastic-stretch.cn',
    doKey: 'btn.elastic-stretch.do',
    howKey: 'btn.elastic-stretch.how',
    no: 'B-08',
    en: 'Elastic Stretch',
    cn: '弹性拉伸',
    group: 'motion',
    trigger: 'click',
    do: '按住蓄力，松手弹出去；按得越久弹得越大，蓄满会自动释放。',
    how: '按住时横向压缩、纵向鼓起（蓄力）；释放时弹射并做衰减振荡，幅度由蓄力深度决定。',
    token: 'base',
    ease: 'spring',
    label: 'Elastic Stretch',
  },
  {
    id: 'ripple',
    cnKey: 'btn.ripple.cn',
    doKey: 'btn.ripple.do',
    howKey: 'btn.ripple.how',
    no: 'B-09',
    en: 'Ripple',
    cn: '涟漪点击',
    group: 'click',
    trigger: 'click',
    do: '在按钮上随便点，水波从点击的位置一圈圈荡开。',
    how: '在按下坐标叠放四道同心圆环，错峰出发；半径铺满按钮即止，环在扩散中变薄淡出。',
    token: 'tide',
    ease: 'settle',
    js: true,
    label: 'Ripple',
  },
  {
    id: 'particle-burst',
    cnKey: 'btn.particle-burst.cn',
    doKey: 'btn.particle-burst.do',
    howKey: 'btn.particle-burst.how',
    no: 'B-10',
    en: 'Particle Burst',
    cn: '粒子爆发',
    group: 'click',
    trigger: 'click',
    do: '点在哪儿，哪儿就炸开一圈小颗粒。',
    how: '预先埋好 24 个小圆点，点击时按落点分配角度和距离，让它们飞出去、减速、消散。',
    token: 'lazy',
    ease: 'settle',
    js: true,
    label: 'Burst',
  },
  {
    id: 'cursor-spot',
    cnKey: 'btn.cursor-spot.cn',
    doKey: 'btn.cursor-spot.do',
    howKey: 'btn.cursor-spot.how',
    no: 'B-11',
    en: 'Cursor Spot',
    cn: '光标光斑',
    group: 'motion',
    trigger: 'hover',
    do: '鼠标在按钮里划动，一团光跟着你走，文字上还有一道扫光。',
    how: '光标位置写进变量：柔光晕 + 锐利高光 + 文字镜面扫光，三层不同视差。',
    token: 'fast',
    ease: 'standard',
    js: true,
    label: 'Cursor Spot',
  },
  {
    id: 'split-reveal',
    cnKey: 'btn.split-reveal.cn',
    doKey: 'btn.split-reveal.do',
    howKey: 'btn.split-reveal.how',
    no: 'B-12',
    en: 'Split Reveal',
    cn: '分裂展开',
    group: 'motion',
    trigger: 'hover',
    do: '悬停，原来的字左右裂开，新字从中间长出来。',
    how: '同一行字复制成左右两半，各裁掉一半，悬停时向两侧推开，新的文案在中间放大淡入。',
    token: 'slow',
    ease: 'standard',
    js: true,
    label: 'Split',
    next: 'Revealed',
  },
  {
    id: 'loading-morph',
    cnKey: 'btn.loading-morph.cn',
    doKey: 'btn.loading-morph.do',
    howKey: 'btn.loading-morph.how',
    no: 'B-13',
    en: 'Loading Morph',
    cn: '加载形变',
    group: 'state',
    trigger: 'state',
    do: '点一下，按钮收成一个圆转起圈来；转完自己撑回长条，写着已保存。',
    how: '先量出按钮的宽与高，宽度收到等于高度、圆角拉满；转完再按原路撑回去，同时换成已保存的样子。',
    token: 'glacial',
    ease: 'settle',
    js: true,
    label: 'Save',
    next: 'Saved',
    click: 'load',
  },
  {
    id: 'success-morph',
    cnKey: 'btn.success-morph.cn',
    doKey: 'btn.success-morph.do',
    howKey: 'btn.success-morph.how',
    no: 'B-14',
    en: 'Success Morph',
    cn: '成功状态',
    group: 'state',
    trigger: 'state',
    do: '点一下，处理中有一道光扫过；处理完变成绿底的对勾。',
    how: '形状不变，一道柔光在按钮里反复扫过表示处理中；完成后整块转绿，对勾靠描边画出来，外面再散一圈光。',
    token: 'slow',
    ease: 'settle',
    js: true,
    label: 'Submit',
    click: 'cycle',
  },
  {
    id: 'progress',
    cnKey: 'btn.progress.cn',
    doKey: 'btn.progress.do',
    howKey: 'btn.progress.how',
    no: 'B-15',
    en: 'Progress',
    cn: '进度按钮',
    group: 'state',
    trigger: 'state',
    do: '点一下，按钮里的进度条自己走到 100%。',
    how: '一层半透明的色块按百分比改宽度，右边同步数字；越接近 100% 走得越慢，到 100% 整体转成完成色。',
    token: 'lazy',
    ease: 'settle',
    js: true,
    label: 'Upload',
  },
  {
    id: 'flip-3d',
    cnKey: 'btn.flip-3d.cn',
    doKey: 'btn.flip-3d.do',
    howKey: 'btn.flip-3d.how',
    no: 'B-16',
    en: '3D Flip',
    cn: '3D 翻转',
    group: 'click',
    trigger: 'click',
    do: '点一下，整块翻个面，颜色跟着翻过来；再来一下翻回去。',
    how: '正反两面背靠背贴着绕 Y 轴转 180°，同时一层颜色从底/顶铺满；翻转与填充共用同一条时长与缓动。',
    token: 'roll',
    ease: 'settle',
    js: true,
    label: 'Flip',
    next: 'Flipped',
    click: 'flip',
  },
];

/** The label shown on a card, derived from the token so it cannot drift. */
export function durOf(entry: ButtonEntry): string {
  return durationLabel(entry.token);
}

export function findButton(id: string): ButtonEntry | undefined {
  return BUTTONS.find((b) => b.id === id);
}

export function buttonsInGroup(group: ButtonGroupId): ButtonEntry[] {
  return BUTTONS.filter((b) => b.group === group);
}
