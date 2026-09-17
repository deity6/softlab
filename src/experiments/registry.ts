import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type ExperimentComponent = ComponentType | LazyExoticComponent<ComponentType>;

export interface Experiment {
  /** route slug, e.g. "soft-matter" */
  id: string;
  /** two-digit catalogue number shown in the index */
  no: string;
  /**
   * All copy is bilingual, mirroring `Section` in lib/sections.ts. The user's
   * rule (2026-10-05): a visitor reads these to decide whether to open the
   * thing, so leaving them Chinese makes the EN switch a lie. `note` (the
   * provenance credit) stays single-language on purpose — it is a record of
   * where the work came from, and translating a citation is not a setting.
   */
  title: string;
  sub: { zh: string; en: string };
  lede: { zh: string; en: string };
  tags: { zh: string[]; en: string[] };
  /** where the idea came from — honesty about provenance */
  source?: { label: string; href: string };
  /**
   * The collected material it was built from — a provenance credit. Bilingual
   * because the project name is a name (kept verbatim) but the gloss after the
   * `·` is a description and reads oddly in the wrong language.
   */
  collected: { zh: string; en: string };
  /**
   * `live` — the card opens the experiment.
   * `wip`  — the card still lists what it will be, but opening it shows the
   *          placeholder instead. Nothing half-finished is ever put on show.
   */
  status: 'live' | 'wip';
  /** what is still missing — only used while `status` is `wip` */
  wipNote?: { zh: string; en: string };
  /** what the visitor will be able to do once it opens */
  wipMissing?: { zh: string[]; en: string[] };
  /** cheap animated thumbnail drawn on the index card */
  thumb: 'jelly' | 'field' | 'cat' | 'train';
  Component: ExperimentComponent;
}

// Experiments are code-split. The index page should never pay for three.js —
// it is 546 kB, and most visits never open the jelly.
const SoftMatter = lazy(() => import('./soft-matter/SoftMatter'));
const CanvasLab = lazy(() => import('./canvas-lab/CanvasLab'));
const CloudTrain = lazy(() => import('./cloud-train/CloudTrain'));
const CatLab = lazy(() => import('./soft-cat/CatLab'));

/**
 * Catalogue numbers are assigned by hand and the order here is the order on
 * the page. One rule, agreed with the user: **the cat is always last** — it is
 * not ready yet, and a half-finished thing sitting between finished ones
 * makes both look worse. New experiments go in above it and the numbers
 * after it move down.
 */
export const EXPERIMENTS: Experiment[] = [
  {
    id: 'soft-matter',
    no: '01',
    title: 'Soft Matter',
    sub: { zh: '软体物质 · 可拖拽的三维果冻', en: 'Soft matter · a jelly you can pull' },
    lede: {
      zh: '抓住它、拉长它、松手 —— 它会一边回弹一边把形状找回来。按住表面会陷下去，抓住边缘能整个掀起来。',
      en:
        'Grab it, stretch it, let go — it springs back while it remembers its shape. Press the surface and it dents; take hold of an edge and you can lift the whole thing.',
    },
    tags: {
      zh: ['拖拽', '捏压', '回弹', '换色'],
      en: ['Drag', 'Squash', 'Rebound', 'Recolour'],
    },
    source: { label: 'Luffyzhang2016 / soft-matter', href: 'https://github.com/Luffyzhang2016/soft-matter' },
    collected: { zh: 'soft-matter · 软体实验室', en: 'soft-matter · soft matter lab' },
    status: 'live',
    thumb: 'jelly',
    Component: SoftMatter,
  },
  {
    id: 'canvas-lab',
    no: '02',
    title: 'Canvas Lab',
    sub: {
      zh: '画布实验 · 作用在真实 DOM 上的效果',
      en: 'Canvas lab · effects on real DOM',
    },
    lede: {
      zh: '文字仍然是可选中、可点击的真 HTML，特效只是叠在上面的一层。同一段字，四种物质状态 —— 扫过去、按下去，或者干脆停着不动。',
      en:
        'The text stays real, selectable, clickable HTML — the effect is only a layer on top of it. The same paragraph in four states of matter: swept, pressed, or simply left alone.',
    },
    tags: {
      zh: ['ASCII 化', '解密', '涟漪', '撕帧'],
      en: ['Asciify', 'Decrypt', 'Ripple', 'Tear'],
    },
    source: { label: 'DavidHDev / canvas-ui', href: 'https://github.com/DavidHDev/canvas-ui' },
    collected: { zh: 'Canvas UI 创意组件库', en: 'Canvas UI component library' },
    status: 'live',
    thumb: 'field',
    Component: CanvasLab,
  },
  {
    id: 'cloud-train',
    no: '03',
    title: 'Cloud Train',
    sub: {
      zh: '落日云间列车 · 会开走的画面',
      en: 'Cloud train · a picture that drives away',
    },
    lede: {
      zh: '十四层云海按不同速度往后淌，一列火车从悬索桥上过去，车头冒着蒸汽。速度、视角、起伏、噪声都能调；顶上有二十套光色，换一种等于同一天换了个时辰。',
      en:
        'Fourteen layers of cloud drift past at their own speeds while a train crosses a suspension bridge, steam trailing from the stack. Speed, framing, swell and noise are all adjustable — and there are twenty lights to choose from, so switching one is like watching the same day happen at a different hour.',
    },
    tags: {
      zh: ['云海', '视差', '光色分级', '可调参数'],
      en: ['Cloud sea', 'Parallax', 'Colour grade', 'Adjustable'],
    },
    source: {
      label: 'mdb《Up in the CloudSea》· 经 code-codex 流传',
      href: 'https://github.com/incarnation-gem/sunset-cloud-train',
    },
    collected: { zh: 'Sunset Cloud Train · 云间列车', en: 'Sunset Cloud Train' },
    status: 'live',
    thumb: 'train',
    Component: CloudTrain,
  },
  {
    id: 'soft-cat',
    no: '04',
    title: 'Soft Cat',
    sub: { zh: '软体猫 · 一只身子很长的猫', en: 'Soft cat · a very long cat' },
    lede: {
      zh: '把手放上去，被摸到的地方会顺着你的手陷下去，松开就弹回来。耳朵会抖，尾巴会甩，爪爪会缩 —— 摸哪儿是哪儿。',
      en:
        'Put a hand on it and the part you touch sinks in to follow you, then springs back when you let go. The ears twitch, the tail swings, the paws curl — wherever you touch is where it reacts.',
    },
    tags: {
      zh: ['抚摸', '凹陷', '回弹', '换色'],
      en: ['Pet', 'Dents', 'Rebound', 'Recolour'],
    },
    collected: { zh: '手与长条猫 · 逐帧参考', en: 'Hand & long cat · frame references' },
    status: 'wip',
    wipNote: {
      zh: '这只长条猫的形体已经捏出来了，但它现在的反应还不够像一只活的猫 —— 摸上去的手感、被摸时的表情都还在调。它愿意配合了再放出来。',
      en:
        'The shape of this long cat is finished, but it does not react like a living one yet — the feel under the hand and its expression while being touched are both still being tuned. It comes out when it is willing.',
    },
    wipMissing: {
      zh: ['拖起来能像麻薯一样拉长', '摸头和摸背给两种不同的反应', '被摸的时候要看得出来它舒服'],
      en: [
        'Dragging stretches it like mochi',
        'The head and the back react differently',
        'You can tell it is enjoying it',
      ],
    },
    thumb: 'cat',
    Component: CatLab,
  },
];

export function findExperiment(id: string): Experiment | undefined {
  return EXPERIMENTS.find((e) => e.id === id);
}
