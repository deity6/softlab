import { EXPERIMENTS } from '../experiments/registry';
import { BUTTONS } from '../buttons/registry';
import { ENTRIES } from './changelog';

export type SectionId = 'experiments' | 'buttons' | 'destroy' | 'growth' | 'log';

/**
 * `project` — something that was actually made and can be opened. Carries a
 *             catalogue number.
 * `meta`    — a column about the site itself (how it grows, what changed).
 *             Deliberately **not numbered**: it is not a piece of work, and
 *             letting it take 03 / 04 made the numbers mean nothing.
 */
export type SectionKind = 'project' | 'meta';

export interface Section {
  id: SectionId;
  /** route path under the hash */
  path: string;
  kind: SectionKind;
  /** catalogue number — projects only */
  no?: string;
  /** label used in the nav (English skeleton, shared by both languages) */
  nav: string;
  /** the same label compressed for a 390px bar */
  short: string;
  /** one-line gloss under the label, per language */
  sub: { zh: string; en: string };
  /** one line on the tab card */
  lede: { zh: string; en: string };
  /** the count / status line on the tab card */
  meta: { zh: string; en: string };
}

export const SECTIONS: Section[] = [
  {
    id: 'experiments',
    path: 'experiments',
    kind: 'project',
    no: '01',
    nav: 'Experiments',
    short: 'Exp',
    sub: { zh: '实验', en: 'playable' },
    lede: {
      zh: '能上手玩的那些东西，每个都拆开看过原理。',
      en: 'Things you can play with, each one taken apart first.',
    },
    meta: {
      zh: `${String(EXPERIMENTS.length).padStart(2, '0')} 个实验`,
      en: `${String(EXPERIMENTS.length).padStart(2, '0')} experiments`,
    },
  },
  {
    id: 'buttons',
    path: 'buttons',
    kind: 'project',
    no: '02',
    nav: 'Buttons',
    short: 'Btn',
    sub: { zh: '按钮', en: 'micro-motion' },
    lede: {
      zh: '一整套按钮动效，悬停、点击、按下去再松手。',
      en: 'A full set of button effects: hover, click, press, release.',
    },
    meta: { zh: `${BUTTONS.length} 个动效`, en: `${BUTTONS.length} effects` },
  },
  {
    id: 'destroy',
    path: 'destroy',
    kind: 'project',
    no: '03',
    nav: 'Destroy',
    short: 'Dest',
    sub: { zh: '拆掉一个站', en: 'take it apart' },
    lede: {
      zh: '输入任意网址，把它变成一张可以拆掉的地图。',
      en: 'Type any address and turn it into a map you can take apart.',
    },
    meta: { zh: '外部游戏 · 要用电脑', en: 'external · desktop only' },
  },
  {
    id: 'growth',
    path: 'growth',
    kind: 'meta',
    nav: 'Grows',
    short: 'Grow',
    sub: { zh: '它怎么长起来', en: 'how it grows' },
    lede: {
      zh: '这个收集箱是怎么一点点变大的。',
      en: 'How this collection gets bigger, bit by bit.',
    },
    meta: { zh: '三步', en: 'three steps' },
  },
  {
    id: 'log',
    path: 'log',
    kind: 'meta',
    nav: 'Dev log',
    short: 'Log',
    sub: { zh: '更新记录', en: 'changelog' },
    lede: {
      zh: '每一次改动都记在这里，带版本号。',
      en: 'Every change is written down here, with a version number.',
    },
    meta: { zh: `${ENTRIES.length} 个版本`, en: `${ENTRIES.length} versions` },
  },
];

/** The numbered ones — used where only real work should be counted. */
export const PROJECTS = SECTIONS.filter((s) => s.kind === 'project');

export function findSection(id: string): Section | undefined {
  return SECTIONS.find((s) => s.id === id);
}

/** Hash path for a section. */
export function sectionPath(id: SectionId): string {
  return id;
}
