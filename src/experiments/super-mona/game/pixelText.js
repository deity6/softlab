import { ACTION_GLYPHS } from './constants.js';

/**
 * 把一句话排成方块坐标。
 *
 * 排布规则刻意沿用原站 `GameOverType.buildTypeLayout` —— **字间距 1 格、词间距 3 格**、
 * 字形不等宽。理由不是省事：动作按钮会和 `GAME OVER` 那行字出现在同一屏（结算时），
 * 两行字要是各排各的，字距和重心会明显不是一套东西。
 *
 * 返回的 `y` 是**从上往下**的行号（DOM 的 `top` 直接可用）；原站那套是从下往上的
 * 世界坐标，方向正好相反，所以这里不能照抄它的 y。
 */
export function buildPixelLayout(text) {
  const blocks = [];
  let cursor = 0;

  // 词间距要按「词」来加，所以先按空格切开，不能当成普通字符拼
  const words = String(text).toUpperCase().split(' ').filter(Boolean);

  for (const word of words) {
    for (const char of word) {
      const glyph = ACTION_GLYPHS[char];
      if (!glyph) continue;
      for (let row = 0; row < glyph.length; row += 1) {
        const line = glyph[row];
        for (let col = 0; col < line.length; col += 1) {
          if (line[col] === '#') blocks.push({ x: cursor + col, y: row });
        }
      }
      cursor += glyph[0].length + 1; // 字宽度 + 1 格字间距
    }
    cursor += 2; // 字间距已含 1，再补 2 凑成 3 格的词间距
  }

  return blocks;
}

/** 一行像素字占几格（宽 × 高），给容器定尺寸用 */
export function measurePixelLayout(blocks) {
  let cols = 0;
  let rows = 0;
  for (const b of blocks) {
    if (b.x + 1 > cols) cols = b.x + 1;
    if (b.y + 1 > rows) rows = b.y + 1;
  }
  return { cols, rows };
}
