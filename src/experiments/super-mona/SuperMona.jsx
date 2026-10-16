import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ANALYTICS,
  ASSETS,
  BOARD,
  BOARD_TEXT,
  GAME_KEYS,
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
import { PixelWord } from './PixelWord.jsx';
import { ScoreBoard } from './ScoreBoard.jsx';
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

/**
 * `topBar` —— 把分数 / 按键指引 / 音效开关搬到画布**上方**那条空带里。
 *
 * 实验室里「画布 + 下方栏」是垂直居中的，上方本来就空着一条（见 `mona.css`），
 * 白白浪费；独立站没有这条空带（画布上方紧挨着导航），所以那边不开。
 */
export function SuperMona({ eyebrow = TEXT.eyebrow.left, portraitHint, topBar = false, board = false }) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const savedRef = useRef(false);

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
   * 键盘上正按着的键。只服务于顶部那条按键指引 —— 让画面里的键帽跟着手上的
   * 动作一起亮。触屏设备直接跳过：那里没有键盘，指引本身也不显示。
   * 用 `Set` 而不是布尔，是因为方向键有两个可能（`ArrowLeft` / `KeyA`）。
   */
  const [pressedKeys, setPressedKeys] = useState(() => new Set());

  /**
   * 排行榜弹层。`boardOpen` 只在玩家点了那枚金色的 `SUBMIT` 之后才为真 ——
   * 不点就什么都不发生（见 `ScoreBoard` 顶部的说明）。
   */
  const [boardOpen, setBoardOpen] = useState(false);
  const [boardRun, setBoardRun] = useState(null);
  /** 弹层打开时停在哪个页签 —— 从左上角 TOP 进来直接看榜，从结算的 SUBMIT 进来先填名字 */
  const [boardTab, setBoardTab] = useState('submit');
  useEffect(() => {
    if (!topBar || touchInput) return undefined;
    const down = (e) => {
      if (!GAME_KEYS.has(e.code)) return;
      setPressedKeys((prev) => (prev.has(e.code) ? prev : new Set(prev).add(e.code)));
    };
    const up = (e) =>
      setPressedKeys((prev) => {
        if (!prev.has(e.code)) return prev;
        const next = new Set(prev);
        next.delete(e.code);
        return next;
      });
    // 切走标签页时收不到 keyup，回来键帽会一直亮着
    const clear = () => setPressedKeys((prev) => (prev.size ? new Set() : prev));
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
    };
  }, [topBar, touchInput]);

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
      engine = new Engine({
        wrapper,
        canvas,
        onStateChange,
        // `logRun` 记整局的得分事件流 —— 只有服务端走「重放验分」那套严格校验
        // 时才需要（`BOARD.includeRun`）。默认的极简校验只看分数和时长，不记。
        gameOptions: { logRun: board && BOARD.includeRun },
      });
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
  }, [onStateChange, supported, reducedMotion, board]);

  // 按键指引：待机时就在场，玩家**按过**（松开）任意一个游戏键之后退场。
  //
  // ⚠️ 退场要延迟到**松手之后** —— 太早淡出的话，「按下去键帽沉、松开弹回来」
  //    这段动画根本来不及看（用户反馈过：一按就没了，等于白做）。
  //    按住不放时一直不消失，松手 500ms 才走。
  useEffect(() => {
    if (!showControls) return undefined;
    let timer = 0;
    const onDown = (event) => {
      if (!GAME_KEYS.has(event.code)) return;
      window.clearTimeout(timer);
    };
    const onUp = (event) => {
      if (!GAME_KEYS.has(event.code)) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setShowControls(false), 500);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [showControls]);

  const launch = (restart = false) => {
    const engine = engineRef.current;
    if (!engine) return;
    const done = () => {
      setShowScoreBoard(true);
      setShowActions(false);
    };
    const started = restart ? engine.restartGame(done) : engine.startGame(done);
    if (!started) return;
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

  /**
   * 点开排行榜弹层。
   *
   * 记录**在这一刻**才从游戏里取 —— 结算动画走完、事件流已经定型。不点的话，
   * `getRun()` 永远不会被调用，也就没有任何东西会离开这台机器。
   */
  const openBoard = (tab = 'submit') => {
    setBoardRun(engineRef.current?.game?.getRun() ?? null);
    setBoardTab(tab);
    setBoardOpen(true);
    sfx.play('uiClick');
  };

  const handleActionClick = () => {
    // 方块刚散完，补一下「散开」的声音
    sfx.play('uiBloom');
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
  /* `EXIT` 的方块再小一半 —— 它只是个出口，不该和 `PLAY` 争注意力 */
  const actionButton = (
    <PixelAction
      text={ACTION_TEXT[action]}
      blockPx={action === 'exitGame' ? blockPx * 0.5 : blockPx}
      disabled={buttonDisabled}
      analytics={ANALYTICS[action]}
      className={
        action === 'exitGame'
          ? styles.pixelExit
          : action === 'playAgain'
            ? styles.pixelPlayAgain
            : styles.pixelPlay
      }
      onPress={() => sfx.play('uiClick')}
      onActivate={handleActionClick}
    />
  );

  const leftPressed = pressedKeys.has('ArrowLeft') || pressedKeys.has('KeyA');
  const rightPressed = pressedKeys.has('ArrowRight') || pressedKeys.has('KeyD');
  const jumpPressed = pressedKeys.has('Space') || pressedKeys.has('KeyW');

  /** 分数。两种版式共用：顶部条里居中，或（独立站）留在画布内 HUD 的第二栏。 */
  const scoreEl = <span className={styles.score}>Your score: {state.score}</span>;

  /** 音效开关。原站把它塞在 HUD 第三格里，而那个 HUD 只在游戏进行中存在 ——
      于是没开局的时候整页找不到声音开关。提到最外层，待机、游戏中、结算都在。 */
  const soundEl = (
    <button
      className={styles.soundToggle}
      type="button"
      aria-label={muted ? TEXT.sound.turnOn : TEXT.sound.turnOff}
      aria-pressed={muted}
      onClick={() => setMuted(sfx.toggleMuted())}
    >
      <SoundIcon muted={muted} />
    </button>
  );

  /**
   * 按键指引。每个键帽会在**键盘真正按下 / 松开**时下沉变色 —— 手指的动作和
   * 画面里的提示是一件事，而不是各说各的。
   *
   * 文案走简写：等效的键合进同一个键帽（`←A` / `→D`），而不是并排列一串 ——
   * WASD 和方向键本来就该被当成一回事看。跳跃两个键（`W` / `Space`）合不了，
   * 单独各占一个。
   * 触屏设备不显示（那里根本没有键盘，界面下方本来就有虚拟按键）。
   */
  const keyCap = (label, down) => (
    <kbd className={down ? `${styles.controlKey} ${styles.controlKeyDown}` : styles.controlKey}>
      {label}
    </kbd>
  );

  const controlsEl = (
    <p
      className={showControls ? styles.controls : `${styles.controls} ${styles.controlsHidden}`}
      aria-hidden={!showControls}
    >
      <span className={styles.controlAction}>
        {keyCap('←A', leftPressed)}
        {keyCap('→D', rightPressed)}
        <span>move</span>
      </span>
      <span aria-hidden="true">·</span>
      <span className={styles.controlAction}>
        {keyCap('W', jumpPressed)}
        {keyCap('Space', jumpPressed)}
        <span>jump</span>
      </span>
    </p>
  );

  return (
    <>
      {/* 顶部信息条：分数（居中）/ 按键指引（右半区中央）/ 音效开关（最右）。
          ⚠️ 它必须在 wrapper **外面** —— wrapper 带 `overflow: hidden`（要裁画布
          的圆角与缩放误差），放里面会被整个裁掉，`bottom: 100%` 也救不回来。
          负 margin 让它不占位：画布位置一点不动，它自己浮在上方那段留白里。 */}
      {topBar && !blocked && (
        <div className={styles.topBar}>
          {/* 左上角：看榜入口。**不进游戏也能点** —— 结算时那枚金色 SUBMIT 要先玩完
              一局才出现，而排行榜本身是所有访问者都能看的。 */}
          {board && (
            <button
              type="button"
              className={styles.topBarRank}
              onClick={() => openBoard('top')}
              aria-label={BOARD_TEXT.topTitle}
            >
              <PixelWord text={BOARD_TEXT.top} blockPx={blockPx * 0.5} tone="gold" />
            </button>
          )}
          {scoreEl}
          {!touchInput && <div className={styles.topBarKeys}>{controlsEl}</div>}
          {soundEl}
        </div>
      )}

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

        {/* 音效开关。原站把它塞在 HUD 第三格里，而那个 HUD 只在游戏进行中
            存在 —— 于是没开局的时候整页找不到声音开关。 */}
        {!blocked && !topBar && soundEl}

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
                {/* 分数占中间那一栏。`topBar` 版式下它搬去了画布外那条顶部条，
                    这里就不重复渲染。 */}
                {!topBar && <div className={styles.scoreControls}>{scoreEl}</div>}
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

          {/* 结算时那枚金色的 `SUBMIT`。它站在 `EXIT` 平时的位置上（结算时 EXIT
              本来就不出现），所以栏里不会挤。**点它之前什么都不发** —— 不想上传的
              玩家，服务端一个字节都收不到。 */}
          {board && state.gameOverScreenVisible && (
            <button
              type="button"
              className={styles.submitBadge}
              onClick={openBoard}
              aria-label={BOARD_TEXT.submitTitle}
            >
              <PixelWord text={BOARD_TEXT.submit} blockPx={blockPx * 0.42} tone="gold" />
            </button>
          )}

          {/* 控制提示。`topBar` 版式下它搬去了画布外那条顶部条（而且**待机时也
              在**）；这里只在独立站那种版式下渲染 —— 那条栏平时被 PLAY 占着中间。 */}
          {!topBar && showScoreBoard && !state.gameOver && controlsEl}
        </div>
      )}

      {/* 排行榜弹层。用 fixed 覆盖整个视口（见 `ScoreBoard.module.css`）——
          画布只有 94:26 那么扁，输入框和榜单塞不进去。 */}
      {board && boardOpen && (
        <ScoreBoard
          run={boardRun}
          blockPx={blockPx}
          initialTab={boardTab}
          onClose={() => setBoardOpen(false)}
        />
      )}
    </>
  );
}
