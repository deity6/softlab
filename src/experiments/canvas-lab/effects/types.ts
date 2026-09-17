export interface EffectContext {
  /** the effect surface; extra layers get appended here */
  stage: HTMLElement;
  /** the live DOM text layer sitting on top of the effect */
  prose: HTMLElement;
  /** every glyph span inside `prose` */
  chars: HTMLElement[];
  accent: string;
}

export interface EffectInstance {
  destroy(): void;
}

export type EffectFactory = (ctx: EffectContext) => EffectInstance;

/** Cached glyph boxes, in stage-local coordinates. */
export function measureChars(
  stage: HTMLElement,
  chars: HTMLElement[],
): { x: number; y: number; w: number }[] {
  const sr = stage.getBoundingClientRect();
  const saved = chars.map((el) => el.style.transform);
  const savedW = chars.map((el) => el.style.width);
  for (const el of chars) {
    el.style.transform = '';
    el.style.width = '';
  }
  const out = chars.map((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2 - sr.left, y: r.top + r.height / 2 - sr.top, w: r.width };
  });
  chars.forEach((el, i) => {
    el.style.transform = saved[i];
    el.style.width = savedW[i];
  });
  return out;
}

/** A pseudo-random glyph pool for cipher-style effects. */
export const CIPHER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@*<>/\\|+=~^';

export function randomCipher(): string {
  return CIPHER[(Math.random() * CIPHER.length) | 0];
}
