import { useMemo } from 'react';
import { buildPixelLayout, measurePixelLayout } from './game/pixelText.js';
import styles from './PixelWord.module.css';

/**
 * 一行**静态**像素字 —— 和 `GAME OVER` 是同一套方块、同一套间距（见 `pixelText.js`），
 * 区别只在配色。`PixelAction` 是它的「能点的兄弟」：那个带悬浮与绽放，这个什么都不做。
 *
 * `tone`：
 *   · `plain` —— 和 `GAME OVER` 同一个灰，用在正文里
 *   · `gold`  —— 金色。做给结算时那枚「上传成绩」的指示，得一眼在灰字里跳出来
 */
export function PixelWord({ text, blockPx = 0, tone = 'plain', className = '' }) {
  const blocks = useMemo(() => buildPixelLayout(text), [text]);
  const { cols, rows } = useMemo(() => measurePixelLayout(blocks), [blocks]);

  if (!blockPx || !blocks.length) return null;

  // 方块只占格子的 95%（和 `GAME OVER` 的 `TYPE_CELL` 一致），居中要补半个缝
  const inset = blockPx * 0.025;

  return (
    <span
      className={`${styles.root} ${className}`}
      data-tone={tone}
      style={{
        '--blk': `${blockPx}px`,
        width: `${cols * blockPx}px`,
        height: `${rows * blockPx}px`,
      }}
    >
      {blocks.map((b, i) => (
        <i
          key={`${b.x}:${b.y}`}
          className={styles.blk}
          style={{
            left: `${b.x * blockPx + inset}px`,
            top: `${b.y * blockPx + inset}px`,
            '--i': i,
            // 金色那档用 `--t` 沿着横轴铺一条亮暗相间的带子：整行同一个黄会像贴纸，
            // 起伏才有金属感。取模 5 是照着一格宽的笔画试出来的节奏。
            '--t': (b.x % 5) / 4,
          }}
        />
      ))}
    </span>
  );
}
