import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ANALYTICS,
  ASSETS,
  DIRECTION_KEYS,
  GRID_X,
  GRID_Y,
  LAYOUT_NARROW,
  STORAGE_KEYS,
  TEXT,
} from './game/constants.js';
import { Engine } from './game/Engine.js';
import { sfx } from './game/Sfx.js';
import { Eyebrow } from './Eyebrow.jsx';
import styles from './SuperMona.module.css';

const INITIAL_STATE = {
  lives: 3,
  score: 0,
  superSeconds: 0,
  movement: 'resting',
  gameOver: false,
  gameOverScreenVisible: false,
  gameOverScoreBoardOffsetX: 0,
};

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** 原 `te` */
function detectWebgl() {
  const canvas = document.createElement('canvas');
  return !!(
    window.WebGLRenderingContext &&
    (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
  );
}

/** 原 `e3` / `e2` */
function readHighScore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEYS.highScore);
    if (raw === null) return null;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < 0) {
      report('Ignoring an invalid stored Super Mona high score.');
      return null;
    }
    return value;
  } catch (error) {
    report('Unable to read the Super Mona high score from local storage.', error);
    return null;
  }
}

function preserveHighScore(score) {
  if (!Number.isSafeInteger(score) || score < 0) {
    report('Unable to preserve an invalid Super Mona high score.');
    return null;
  }
  try {
    const stored = readHighScore();
    if (stored === null || score > stored) {
      window.localStorage.setItem(STORAGE_KEYS.highScore, String(score));
      return score;
    }
    return stored;
  } catch (error) {
    report('Unable to preserve the Super Mona high score in local storage.', error);
    return null;
  }
}

function report(message, cause) {
  const error = new Error(message, cause === undefined ? undefined : { cause });
  if (typeof window.reportError === 'function') {
    window.reportError(error);
  } else {
    window.dispatchEvent(new ErrorEvent('error', { error, message }));
  }
}

/** 原 `e4` —— 16×16 像素风喇叭图标 */
function SoundIcon({ muted }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" shapeRendering="crispEdges">
      <path fill="currentColor" d="M1 6h3V5h2V3h2v10H6v-2H4v-1H1V6Z" />
      {muted ? (
        <>
          <rect x="10" y="4" width="2" height="2" fill="currentColor" />
          <rect x="14" y="4" width="2" height="2" fill="currentColor" />
          <rect x="12" y="6" width="2" height="2" fill="currentColor" />
          <rect x="10" y="8" width="2" height="2" fill="currentColor" />
          <rect x="14" y="8" width="2" height="2" fill="currentColor" />
        </>
      ) : (
        <>
          <rect x="10" y="6" width="2" height="4" fill="currentColor" />
          <rect x="14" y="4" width="2" height="8" fill="currentColor" />
        </>
      )}
    </svg>
  );
}

/**
 * 原 `function ti` —— 顶层 React 组件。
 * 负责：WebGL 能力检测与降级、引擎挂载/卸载、可见性(IntersectionObserver)与
 * 尺寸(ResizeObserver)节流、HUD、控制提示的渐进隐藏、音效开关、本地高分。
 */
export function SuperMona({ eyebrow = TEXT.eyebrow.left }) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const savedRef = useRef(false);
  const progressRef = useRef({ hasMoved: false, hasJumped: false });

  const [supported, setSupported] = useState(detectWebgl);
  const [state, setState] = useState(INITIAL_STATE);
  const [inGame, setInGame] = useState(false);
  const [showScoreBoard, setShowScoreBoard] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [highScore, setHighScore] = useState(readHighScore);
  const [muted, setMuted] = useState(() => sfx.isMuted());
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia(REDUCED_MOTION).matches,
  );
  // 触屏设备才显示虚拟按键。`hover: none + pointer: coarse` 是移动端最稳的判定
  // —— 只看宽度会把「拉窄的桌面浏览器」也算进来，那些机器键盘好好的。
  const [touchInput] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(hover: none) and (pointer: coarse)').matches,
  );

  const resetToIdle = useCallback(() => {
    setState(INITIAL_STATE);
    setInGame(false);
    setShowScoreBoard(false);
    setShowActions(false);
  }, []);

  // prefers-reduced-motion 变化时直接退回待机
  useEffect(() => {
    const query = window.matchMedia(REDUCED_MOTION);
    const onChange = (event) => {
      setReducedMotion(event.matches);
      if (event.matches) resetToIdle();
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [resetToIdle]);

  const onStateChange = useCallback((next) => {
    setState(next);
    if (!next.gameOver) {
      savedRef.current = false;
      return;
    }
    if (savedRef.current) return;
    savedRef.current = true;
    const saved = preserveHighScore(next.score);
    setHighScore((prev) => Math.max(prev ?? next.score, saved ?? next.score));
  }, []);

  // 引擎生命周期
  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!supported || reducedMotion || !wrapper || !canvas) return undefined;

    let engine;
    try {
      engine = new Engine({ wrapper, canvas, onStateChange });
    } catch (error) {
      report(error?.message ?? 'Super Mona engine failed to start.', error);
      window.setTimeout(() => setSupported(false), 0);
      return undefined;
    }
    engineRef.current = engine;

    let intersecting = false;
    let sized = false;
    const handleResize = () => {
      engine.resize(window.innerWidth);
      const rect = wrapper.getBoundingClientRect();
      sized = rect.width > 0 && rect.height > 0;
    };
    handleResize();

    let raf = 0;
    const loop = () => {
      engine.update(intersecting, sized);
      raf = requestAnimationFrame(loop);
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) intersecting = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    const ro = new ResizeObserver(handleResize);
    io.observe(wrapper);
    ro.observe(wrapper);
    loop();

    return () => {
      io.disconnect();
      ro.disconnect();
      cancelAnimationFrame(raf);
      engine.dispose();
      engineRef.current = null;
    };
  }, [onStateChange, supported, reducedMotion]);

  // 玩家既移动过又跳过之后，收起控制提示
  useEffect(() => {
    if (!showScoreBoard || state.gameOver || !showControls) return undefined;
    const onKey = (event) => {
      if (DIRECTION_KEYS.includes(event.code)) {
        progressRef.current.hasMoved = true;
      } else if (event.code === 'Space') {
        progressRef.current.hasJumped = true;
      } else {
        return;
      }
      if (progressRef.current.hasMoved && progressRef.current.hasJumped) {
        setShowControls(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.gameOver, showScoreBoard, showControls]);

  const launch = (restart = false) => {
    const engine = engineRef.current;
    if (!engine) return;
    const done = () => {
      setShowScoreBoard(true);
      setShowActions(false);
    };
    const started = restart ? engine.restartGame(done) : engine.startGame(done);
    if (!started) return;
    progressRef.current = { hasMoved: false, hasJumped: false };
    setShowControls(true);
    setState(INITIAL_STATE);
    setInGame(true);
    setShowScoreBoard(false);
    setShowActions(true);
  };

  /**
   * 触屏虚拟按键：往 window 上派发键盘事件就够了 —— 引擎（`game/Game.js`）
   * 监听的就是 window 的 keydown / keyup，这样一行引擎代码都不用动。
   * `setPointerCapture` 是为了手指滑出按钮之后仍能收到 pointerup，
   * 否则方向键会一直卡在「按住」不放。
   */
  const holdKey = (code) => ({
    onPointerDown: (e) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    },
    onPointerUp: (e) => {
      e.preventDefault();
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    },
    onPointerCancel: () =>
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })),
    onLostPointerCapture: () =>
      window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })),
  });

  const blocked = !supported || reducedMotion;
  const action = state.gameOverScreenVisible ? 'playAgain' : inGame ? 'exitGame' : 'playGame';
  const buttonDisabled = showActions || (state.gameOver && !state.gameOverScreenVisible);
  const eyebrowLeft = highScore === null ? eyebrow : TEXT.eyebrow.highScore;
  const eyebrowRight = highScore === null ? undefined : String(highScore);

  const handleActionClick = () => {
    if (state.gameOverScreenVisible) {
      launch(true);
      return;
    }
    if (inGame) {
      const stopped = engineRef.current?.stopGame(() => resetToIdle());
      if (stopped) {
        setInGame(false);
        setShowScoreBoard(false);
      }
      return;
    }
    launch(false);
  };

  return (
    <>
      <div
        ref={wrapperRef}
        className={styles.wrapper}
        style={{
          '--grid-x': GRID_X,
          '--grid-x-narrow': LAYOUT_NARROW.gridX,
          '--grid-y': GRID_Y,
        }}
      >
        {!blocked && <canvas ref={canvasRef} />}
        {blocked && (
          <img className={styles.fallbackImage} src={ASSETS.fallback} alt="" aria-hidden draggable={false} />
        )}

        {showScoreBoard && (
          <>
            {!state.gameOver && (
              <div className={styles.hud} aria-live="polite">
                <span className={styles.lives} role="img" aria-label={`${state.lives} lives`}>
                  {Array.from({ length: state.lives }, (_, i) => (
                    <img key={i} className={styles.heart} src={ASSETS.heart} alt="" aria-hidden />
                  ))}
                </span>
                <p
                  className={showControls ? styles.controls : `${styles.controls} ${styles.controlsHidden}`}
                  aria-hidden={!showControls}
                >
                  <span className={styles.controlAction}>
                    <kbd className={styles.controlKey}>←</kbd>
                    <kbd className={styles.controlKey}>→</kbd>
                    <span>move</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className={styles.controlAction}>
                    <kbd className={styles.controlKey}>Space</kbd>
                    <span>jump</span>
                  </span>
                </p>
                <div className={styles.scoreControls}>
                  <span className={styles.score}>Your score: {state.score}</span>
                  <button
                    className={styles.soundButton}
                    type="button"
                    aria-label={muted ? TEXT.sound.turnOn : TEXT.sound.turnOff}
                    aria-pressed={muted}
                    onClick={() => setMuted(sfx.toggleMuted())}
                  >
                    <SoundIcon muted={muted} />
                  </button>
                </div>
              </div>
            )}

            {state.gameOverScreenVisible && (
              <div
                className={styles.gameOverScoreBoard}
                style={{ '--score-board-offset-x': state.gameOverScoreBoardOffsetX }}
                role="status"
              >
                <div className={styles.gameOverScoreContent}>
                  <span className={styles.gameOverScoreLabel}>YOUR SCORE</span>
                  <strong
                    className={styles.gameOverScore}
                    style={{ '--score-character-count': String(state.score).length }}
                  >
                    {state.score}
                  </strong>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 触屏操作：只在游戏进行中出现。放在画布**下面**而不是压在画布上 ——
          窄屏下 Wrapper 按 67:26 的比例算出来只有 140px 高，56px 的按键叠进去
          会吃掉小半屏。方向键在左、跳跃在右，按手游的习惯摆。 */}
      {!blocked && touchInput && inGame && !state.gameOver && (
        <div className={styles.touchPad}>
          <div className={styles.touchGroup}>
            <button
              className={styles.touchKey}
              type="button"
              aria-label="Move left"
              {...holdKey('ArrowLeft')}
            >
              ←
            </button>
            <button
              className={styles.touchKey}
              type="button"
              aria-label="Move right"
              {...holdKey('ArrowRight')}
            >
              →
            </button>
          </div>
          <button
            className={`${styles.touchKey} ${styles.touchJump}`}
            type="button"
            aria-label="Jump"
            {...holdKey('Space')}
          >
            ↑
          </button>
        </div>
      )}

      {!blocked && (
        <div className={styles.actions}>
          <Eyebrow
            className={styles.heroEyebrow}
            labelL={eyebrowLeft}
            labelR={eyebrowRight}
            accentLabelR
            animateOnViewportEnter
          />
          <button
            className={styles.playButton}
            type="button"
            data-button={TEXT.button.variant}
            disabled={buttonDisabled}
            data-analytics-click={ANALYTICS[action]}
            onClick={handleActionClick}
          >
            {TEXT.button.label[action]}
          </button>
        </div>
      )}
    </>
  );
}
