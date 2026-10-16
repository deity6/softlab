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
import { PixelAction } from './PixelAction.jsx';
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

/**
 * 动作按钮上的字。
 *
 * 刻意**不做 i18n** —— 用户明确说「开始游戏就不用翻译了，PLAY 反而好写」。
 * 字模里只有大写字母，所以这三个词也大写；`PLAY AGAIN` 中间那个空格是有意义的
 * （排版时按词间距 3 格处理，不是字间距 1 格）。
 */
const ACTION_TEXT = { playGame: 'PLAY', exitGame: 'EXIT', playAgain: 'PLAY AGAIN' };

/**
 * 像素方块相对一格的尺寸。
 *
 * `GAME OVER` 那行字用的是 `0.95` 格（原站 `TYPE_CELL`）。动作字比它小得多 —— 它们
 * 待在画布下面那条栏里，得整行放得下：`0.42` 格时 `PLAY AGAIN`（全表最长的词）
 * 约占画布宽的四分之一，高度约 40px，落在栏的可用高度里。
 */
const PIXEL_CELL_RATIO = 0.42;

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
/**
 * 竖屏 + 触屏。
 *
 * 判定里带 `pointer: coarse` 是为了不给桌面窄窗口误报 —— 桌面把窗口拖窄了不该
 * 看到「把手机横过来」。横版跑酷在竖屏里画布只剩中间一条窄缝，既按不着也看不清。
 */
const PORTRAIT_QUERY = '(orientation: portrait) and (pointer: coarse)';

function usePortrait() {
  const [portrait, setPortrait] = useState(() => window.matchMedia(PORTRAIT_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(PORTRAIT_QUERY);
    const onChange = () => setPortrait(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return portrait;
}

export function SuperMona({ eyebrow = TEXT.eyebrow.left, portraitHint }) {
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

  /**
   * 像素动作字的方块尺寸。
   *
   * 画布是按「一格 = 画布宽 / 94」渲染的（`group.scale` 让世界宽恒为 1 个单位，
   * 正交相机取 [-1, 1]），所以量一下画布宽度就能反推一格多少像素。必须跟着这个
   * 比例走 —— 否则像素字和背景网格对不上，一眼能看出是浮在上面的一层。
   */
  const [blockPx, setBlockPx] = useState(0);
  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return undefined;
    const measure = () => {
      const canvas = root.querySelector('canvas') || root;
      setBlockPx((canvas.getBoundingClientRect().width / GRID_X) * PIXEL_CELL_RATIO);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

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
  const portrait = usePortrait();
  const action = state.gameOverScreenVisible ? 'playAgain' : inGame ? 'exitGame' : 'playGame';
  // 竖屏下不让开局：开了也只能看见一条缝。按钮留着但点不动，提示层会说明为什么。
  const buttonDisabled = showActions || portrait || (state.gameOver && !state.gameOverScreenVisible);
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

  /**
   * 开始 / 退出 / 再来一局共用一行像素字，区别只在文案和位置：
   *   · 待机与结算时压在中下部（`pixelPlay` / `pixelPlayAgain`）—— 结算时特别让开
   *     `GAME OVER` 那行字，先前那颗白底按钮正好压在它上面；
   *   · 游戏进行中的「EXIT」挪到右下角，让开画面。
   *
   * 它不再是个按钮：没有底、没有边、没有圆角、没有阴影 —— 和 `GAME OVER` 一模一样
   * 是像素方块拼的，只是小一圈。唯一的线索是鼠标悬上去会变成彩虹。
   */
  const actionButton = (
    <PixelAction
      text={ACTION_TEXT[action]}
      blockPx={blockPx}
      disabled={buttonDisabled}
      analytics={ANALYTICS[action]}
      className={
        action === 'exitGame'
          ? styles.pixelExit
          : action === 'playAgain'
            ? styles.pixelPlayAgain
            : styles.pixelPlay
      }
      onActivate={handleActionClick}
    />
  );

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

        {/* 音效开关摆在右上角，**待机时也在** —— 原站把它塞在 HUD 的第三格里，
            而那个 HUD 只在游戏进行中存在，于是没开局的时候整页找不到声音开关。 */}
        {!blocked && (
          <button
            className={styles.soundToggle}
            type="button"
            aria-label={muted ? TEXT.sound.turnOn : TEXT.sound.turnOff}
            aria-pressed={muted}
            onClick={() => setMuted(sfx.toggleMuted())}
          >
            <SoundIcon muted={muted} />
          </button>
        )}

        {/* 竖屏挡住这一块 —— 只盖画布，不盖整页。一进来就全屏要求横屏，别人
            连这是个什么网站都还没看明白。 */}
        {!blocked && portrait && portraitHint && (
          <div className={styles.rotateHint}>
            <span className={styles.rotateHintPhone} aria-hidden="true" />
            <span className={styles.rotateHintText}>{portraitHint}</span>
          </div>
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
                {/* 分数占中间那一栏（用户要求「放在中间顶部」）。它原来在最右，
                    右边紧挨着音效开关，看着像那枚开关的附注而不是这一局的成绩。 */}
                <div className={styles.scoreControls}>
                  <span className={styles.score}>Your score: {state.score}</span>
                </div>
              </div>
            )}

            {/* 控制提示搬到了画布下面那条栏里（见 `actions`）—— 顶部中间那一栏
                让给分数了，而栏的中间在游戏中正好空着，且压在画面上会挡角色。 */}

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
          {/* 动作字放在这条栏里，不进画面：居中（PLAY / PLAY AGAIN）或靠右（EXIT）。
              它们绝对是定位的，不占 flex 位置，眉标该多宽还是多宽。 */}
          {actionButton}

          {/* 控制提示也在这条栏里，居中。它原来占着 HUD 的第二栏（顶部中间），
              而那一栏现在归分数了；挪到画面里试过，正好压在角色和地面上。 */}
          {showScoreBoard && !state.gameOver && (
            <p
              className={
                showControls ? styles.controls : `${styles.controls} ${styles.controlsHidden}`
              }
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
          )}
        </div>
      )}
    </>
  );
}
