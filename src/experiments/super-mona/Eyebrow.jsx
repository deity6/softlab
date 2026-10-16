import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import styles from './Eyebrow.module.css';

/**
 * 原站 `module 2003` 的 `function u` —— 眉标组件。
 *
 * 行为：左侧文案与（可选的）右侧文案各自用「乱码解码」逐个字符揭示，
 * 每格在揭示前先被染成 accent 色、随机 2–3 次乱码、再落定真实字符、最后恢复目标色。
 * 末尾跟随一个 10×10 的 accent 色方块光标。
 * 动画由 IntersectionObserver 触发，进入视口才播放。
 */

/** 原 `j` */
const DECODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.!@#$%^&*()_+-=[]{}|/;<>?';
/** 原 `w` 的判定阈值 —— Primer 的中断点 */
const NARROW_BREAKPOINT = 1011;
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** 原 `s.lWr` —— Primer Brand 的 useWindowWidth */
function useWindowWidth() {
  const [size, setSize] = useState(() => ({
    width: typeof window === 'undefined' ? 0 : window.innerWidth,
  }));
  useEffect(() => {
    const onResize = () => setSize((prev) => (prev.width === window.innerWidth ? prev : { width: window.innerWidth }));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return size;
}

export function Eyebrow({
  className,
  labelL,
  labelR,
  labelLMobile,
  labelRMobile,
  disableAnimation = false,
  hideRightCursor = false,
  accentLabelR = false,
  animateOnViewportEnter = false,
}) {
  const containerRef = useRef(null);
  const leftTextRef = useRef(null);
  const rightTextRef = useRef(null);
  const leftCursorRef = useRef(null);
  const rightCursorRef = useRef(null);

  // 原 `L` / `w`
  const { width } = useWindowWidth();
  const isNarrow = useMemo(() => !!width && width <= NARROW_BREAKPOINT, [width]);

  // 原 `C`
  const leftLabel = useMemo(() => {
    if (!labelL) return undefined;
    return isNarrow && labelLMobile ? labelLMobile : labelL;
  }, [labelL, labelLMobile, isNarrow]);

  // 原 `v`
  const rightLabel = useMemo(
    () => (isNarrow && labelRMobile ? labelRMobile : labelR || undefined),
    [labelR, labelRMobile, isNarrow],
  );

  // 原 `j` / `H`
  const decodeChars = useMemo(() => DECODE_CHARS, []);
  const randomChar = useCallback(
    () => decodeChars.charAt(Math.floor(Math.random() * decodeChars.length)),
    [decodeChars],
  );

  // 原 `N` —— 为某个字符挂上「染色 → 乱码 → 落定 → 复色」四步
  const decodeChar = useCallback(
    (timeline, text, textRef, index, finalColor = 'var(--brand-color-text-default)') => {
      const start = 0.075 * Math.floor(index / 2) + (index % 2) * 0.0375;

      timeline.add(() => {
        if (textRef.current) textRef.current.style.color = 'var(--brand-color-text-accent)';
      }, start);

      const scrambleCount = 2 + Math.floor(2 * Math.random());
      for (let i = 0; i < scrambleCount; i += 1) {
        timeline.add(() => {
          if (!textRef.current) return;
          const current = textRef.current.textContent || '';
          const scramble = randomChar();
          textRef.current.textContent =
            current.substring(0, index) +
            scramble +
            (index < current.length - 1 ? current.substring(index + 1) : '');
        }, `${start + 0.075 * i}`);
      }

      timeline.add(() => {
        if (!textRef.current) return;
        const current = textRef.current.textContent || '';
        textRef.current.textContent =
          current.substring(0, index) +
          text.charAt(index) +
          (index < current.length - 1 ? current.substring(index + 1) : '');
      }, `${start + 0.075 * scrambleCount}`);

      timeline.add(() => {
        if (textRef.current) textRef.current.style.color = finalColor;
      }, `${start + 0.075 * scrambleCount + 0.1}`);
    },
    [randomChar],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !leftTextRef.current || !leftCursorRef.current) return undefined;

    // 降级路径：直接落到终态
    if (window.matchMedia(REDUCED_MOTION).matches || disableAnimation) {
      if (leftLabel) leftTextRef.current.textContent = leftLabel;
      if (rightTextRef.current && rightLabel) rightTextRef.current.textContent = rightLabel;
      leftCursorRef.current.style.opacity = '1';
      leftCursorRef.current.style.transform = 'translateX(1ch)';
      // 与原站一致：CursorBlink 在 CSS module 里并不存在，这里等价于挂一个空类名
      if (!rightLabel) leftCursorRef.current.classList.add(styles.CursorBlink);
      if (rightLabel && rightCursorRef.current) {
        rightCursorRef.current.style.opacity = '1';
        rightCursorRef.current.style.transform = 'translateX(1ch)';
        rightCursorRef.current.classList.add(styles.CursorBlink);
      }
      return undefined;
    }

    leftTextRef.current.textContent = '';
    if (rightTextRef.current) rightTextRef.current.textContent = '';

    const timeline = gsap.timeline({ paused: true });
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            timeline.play();
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: animateOnViewportEnter ? '0px' : '0px 0px -20% 0px', threshold: 0 },
    );
    observer.observe(container);

    const cursors = [leftCursorRef.current, rightCursorRef.current].filter(Boolean);
    timeline.set(cursors, { opacity: 0, x: 0 });
    timeline.to(leftCursorRef.current, {
      opacity: 1,
      duration: 0.1,
      repeat: 2,
      yoyo: true,
      ease: 'power4.inOut',
    });
    if (rightLabel && rightCursorRef.current) {
      timeline.to(rightCursorRef.current, {
        opacity: 1,
        duration: 0.1,
        repeat: 2,
        yoyo: true,
        ease: 'power4.inOut',
      });
    }

    if (leftLabel) {
      leftTextRef.current.textContent = ' '.repeat(leftLabel.length);
      for (let i = 0; i < leftLabel.length; i += 1) decodeChar(timeline, leftLabel, leftTextRef, i);
    }

    if (rightLabel && rightTextRef.current) {
      timeline.set(leftCursorRef.current, { opacity: 0, x: 0 });
    } else {
      timeline.to(leftCursorRef.current, { x: '+=1ch', duration: 0.1, ease: 'power4.inOut' });
      timeline.to(leftCursorRef.current, {
        opacity: 0,
        duration: 0.1,
        repeat: 3,
        yoyo: true,
        ease: 'power4.inOut',
      });
    }

    if (rightLabel && rightTextRef.current) {
      rightTextRef.current.textContent = ' '.repeat(rightLabel.length);
      for (let i = 0; i < rightLabel.length; i += 1) {
        decodeChar(
          timeline,
          rightLabel,
          rightTextRef,
          i,
          accentLabelR ? 'var(--brand-color-text-accent)' : undefined,
        );
      }
      timeline.to(rightCursorRef.current, { x: '+=1ch', duration: 0.1, ease: 'power4.inOut' });
      timeline.to(rightCursorRef.current, {
        opacity: 0,
        duration: 0.1,
        repeat: 3,
        yoyo: true,
        ease: 'power4.inOut',
      });
    }

    return () => {
      observer.disconnect();
      timeline.kill();
    };
  }, [leftLabel, rightLabel, decodeChar, disableAnimation, accentLabelR, animateOnViewportEnter]);

  const rootClass = [className, styles.eyebrow, hideRightCursor && styles.hideRightCursor]
    .filter(Boolean)
    .join(' ');
  const rightClass = [styles.labelRight, accentLabelR && styles.accentLabelRight]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={rootClass} ref={containerRef}>
      <span className="sr-only">{`${leftLabel || ''} ${rightLabel || ''}`}</span>
      <div className={styles.labels} aria-hidden="true">
        <div className={styles.labelLeft}>
          <span ref={leftTextRef} className={styles.text} />
          <span ref={leftCursorRef} className={styles.cursor} style={{ opacity: 0 }} />
        </div>
        {rightLabel && (
          <div className={rightClass}>
            <div className={styles.labelPlaceholder}>
              <span className={styles.text}>{rightLabel}</span>
              <span className={styles.cursor} style={{ marginLeft: '1ch' }} />
            </div>
            <div className={styles.labelWrapper}>
              <span ref={rightTextRef} className={styles.text} />
              <span ref={rightCursorRef} className={styles.cursor} style={{ opacity: 0 }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
