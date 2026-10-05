/**
 * Duration tokens — the single source of truth for button timings.
 *
 * These MUST stay in step with `src/motion/motion.tokens.css`. The card labels
 * are generated from this map rather than written by hand, so a label can never
 * drift away from what the effect actually does (the earlier version printed
 * "base · 400ms" while the demo was running 620ms).
 *
 * All values are whole hundreds of milliseconds on purpose.
 */
export const DURATIONS = {
  instant: 100,
  quick: 200,
  fast: 300,
  base: 400,
  slow: 500,
  lazy: 600,
  glacial: 800,
  /** 3D Flip：翻转与填充共用一档，两者必须同步 */
  roll: 900,
  /** Ripple：涟漪要有明显扩散过程，比 lazy 慢 ~1.7× */
  tide: 1000,
} as const;

export type DurationToken = keyof typeof DURATIONS;

/** Named easing curves, mirroring motion.tokens.css. */
export const EASINGS = ['standard', 'decel', 'spring', 'elastic', 'draw', 'settle'] as const;
export type EasingName = (typeof EASINGS)[number];

/** "base · 400ms" — the label shown on a card. */
export function durationLabel(token: DurationToken): string {
  return `${token} · ${DURATIONS[token]}ms`;
}

/** The raw millisecond value, for code that has to wait out an effect. */
export function durationMs(token: DurationToken): number {
  return DURATIONS[token];
}
