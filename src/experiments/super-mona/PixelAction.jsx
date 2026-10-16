import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { buildPixelLayout, measurePixelLayout } from './game/pixelText.js';
import styles from './PixelAction.module.css';

/** 绽放动画的时长，必须和 CSS 里 `pixelBloom` 对齐 —— 放完才真正触发动作 */
const BLOOM_MS = 620;

/** 绽放的基础距离（格）。离中心越远的方块再多飞一点，让整团散得开而不散架 */
const BLOOM_BASE = 6;
const BLOOM_SPREAD = 0.22;

/**
 * 一个用像素方块拼成的动作字（`PLAY` / `EXIT` / `PLAY AGAIN`）。
 *
 * 视觉上和 `GAME OVER` 那行字是**同一种东西** —— 同样一格格的小方块、同样的深灰；
 * 区别只在尺寸小一圈。所以这里刻意什么都不给：没有底、没有边、没有圆角、没有阴影。
 * 存在的证明全靠交互：悬浮时整行由灰渐变成彩虹（逐块延迟，是一道扫过去的波而不是
 * 一起亮），点击后从中心炸开散掉。
 *
 * 方块尺寸由外面量好传进来（`blockPx`）—— 画布是按「一格 = 画布宽 / 94」渲染的，
 * 这里必须跟着同一个比例，否则它会和背景网格对不上。
 */
export function PixelAction({
  text,
  blockPx = 0,
  disabled = false,
  analytics,
  className = '',
  onActivate,
}) {
  const blocks = useMemo(() => buildPixelLayout(text), [text]);
  const { cols, rows } = useMemo(() => measurePixelLayout(blocks), [blocks]);
  const [blooming, setBlooming] = useState(false);
  const timer = useRef(0);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  // 换文案（PLAY → PLAY AGAIN）时把绽放状态清掉，否则新字一上来就是散开的
  useEffect(() => setBlooming(false), [text]);

  const handleClick = useCallback(() => {
    if (disabled || blooming) return;
    setBlooming(true);
    timer.current = window.setTimeout(() => {
      setBlooming(false);
      onActivate?.();
    }, BLOOM_MS);
  }, [disabled, blooming, onActivate]);

  if (!blockPx || !blocks.length) return null;

  const centerX = (cols - 1) / 2;
  const centerY = (rows - 1) / 2;

  return (
    <button
      type="button"
      className={`${styles.root} ${className}`}
      style={{
        '--blk': `${blockPx}px`,
        width: `${cols * blockPx}px`,
        height: `${rows * blockPx}px`,
      }}
      data-bloom={blooming ? 'true' : undefined}
      disabled={disabled}
      aria-label={text}
      data-analytics-click={analytics}
      onClick={handleClick}
    >
      {blocks.map((b, i) => {
        const dx = b.x - centerX;
        const dy = b.y - centerY;
        const angle = Math.atan2(dy, dx);
        const dist = BLOOM_BASE + Math.hypot(dx, dy) * BLOOM_SPREAD;
        return (
          <i
            key={`${b.x}:${b.y}`}
            className={styles.blk}
            style={{
              left: `${b.x * blockPx}px`,
              top: `${b.y * blockPx}px`,
              '--i': i,
              // 色相按位置铺开：横着走一圈彩虹，纵向上再偏一点，免得整行同色
              '--h': (b.x * 11 + b.y * 24) % 360,
              '--dx': Math.cos(angle) * dist,
              '--dy': Math.sin(angle) * dist,
            }}
          />
        );
      })}
    </button>
  );
}
