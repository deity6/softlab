import { useCallback, useEffect, useMemo, useState } from 'react';
import { BOARD, BOARD_TEXT } from './game/constants.js';
import { sfx } from './game/Sfx.js';
import { PixelWord } from './PixelWord.jsx';
import styles from './ScoreBoard.module.css';

/**
 * 结算时那枚「上传成绩」的金色指示 + 点开之后的提交/榜单弹层。
 *
 * 两条纪律写在这儿：
 *
 * ① **不点就什么都不发生。** 这是玩家自己选的：不想上传就什么都不发，服务端
 *    一个字节都收不到，也就没有鉴权、没有记录、没有资源消耗。
 * ② **只发该发的。** 默认只上报「名字 / 分数 / 时长」三个字段，服务端据此做
 *    极简校验（时长是否合理、分数有没有超出这段时间的上限）。整局的事件流是
 *    「重放验分」那套严格校验的输入，默认不传（见 `BOARD.includeRun`）。
 */

const errText = (key) => BOARD_TEXT.errors[key] ?? BOARD_TEXT.errors.default;

const readSavedName = () => {
  try {
    return localStorage.getItem(BOARD.nameStorageKey) ?? '';
  } catch {
    return '';
  }
};

const rememberName = (name) => {
  try {
    localStorage.setItem(BOARD.nameStorageKey, name);
  } catch {
    /* 隐私模式下写不进去，无所谓 */
  }
};

/** 名字输入：只留像素字模画得出来的那些字符，顺手转大写 */
const cleanName = (raw) =>
  raw
    .toUpperCase()
    .replace(/[^A-Z0-9 _-]/g, '')
    .slice(0, BOARD.maxNameLength);

const formatDuration = (seconds) => {
  const total = Math.max(0, Math.round(seconds ?? 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

export function ScoreBoard({ run, blockPx, onClose, initialTab = 'submit' }) {
  const [tab, setTab] = useState(initialTab);
  const [name, setName] = useState(readSavedName);
  const [phase, setPhase] = useState('idle');
  const [errorKey, setErrorKey] = useState(null);
  const [board, setBoard] = useState(null);
  /**
   * 榜单取数状态：`loading` / `ready` / `down`。
   *
   * 光看 `board === null` 不够 ——「还没开始拉」「拉到了但一条都没有」和「压根没
   * 拉到」对玩家是三件完全不同的事。混成同一个空列表，后端一掉线就会被读成
   * 「我的成绩被清空了」。下面 `top` 面板据此分三路渲染。
   */
  const [boardState, setBoardState] = useState('loading');
  const [rank, setRank] = useState(null);
  const [verifiedScore, setVerifiedScore] = useState(null);

  const trimmed = name.trim();
  const nameOk = BOARD.namePattern.test(trimmed) && trimmed.length <= BOARD.maxNameLength;
  // 0 分不上传 —— 没什么可记的，服务端也不该为此写一行
  const hasRun = Boolean(run && run.elapsed > 0 && run.score > 0);
  const canSubmit = hasRun && nameOk && phase !== 'sending';

  const loadBoard = useCallback(async () => {
    setBoardState('loading');
    try {
      const res = await fetch(BOARD.endpoint, { headers: { accept: 'application/json' } });
      /* 接口不在时 Pages 的 SPA fallback 会把 index.html 顶上来（200 + text/html），
         `res.json()` 在这一行抛 —— 和断网、和 `ok:false` 走同一个出口，都对。 */
      const data = await res.json();
      if (!data?.ok) throw new Error(data?.error ?? 'bad-response');
      setBoard(data.board ?? []);
      setBoardState('ready');
    } catch {
      setBoardState('down');
    }
  }, []);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  // ESC 关闭。挂在 window 上而不是面板上 —— 焦点这会儿可能还在输入框里
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setPhase('sending');
    setErrorKey(null);
    sfx.play('uiClick');
    try {
      // 默认只发这三个字段。`seed` / `events` 是严格校验（服务端重放）才需要的，
      // 由 `BOARD.includeRun` 决定要不要带上 —— 平时没必要让那几 KB 白跑一趟。
      const payload = { name: trimmed, score: run.score, elapsed: run.elapsed };
      if (BOARD.includeRun) {
        payload.seed = run.seed;
        payload.events = run.events;
      }
      const res = await fetch(BOARD.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data?.ok) {
        setErrorKey(data?.error ?? 'default');
        setPhase('idle');
        return;
      }
      rememberName(trimmed);
      setVerifiedScore(data.score);
      setRank(data.rank);
      setBoard(data.board ?? []);
      setPhase('done');
      sfx.play('uiBloom');
    } catch {
      /**
       * 拿不到 JSON —— 最典型的情况是「这个构建没有后端」：本地用
       * `vite preview` 起的纯静态预览就是这样，`/api/scores` 会被 SPA fallback
       * 顶成 index.html，`res.json()` 直接抛。这时候回一句「TRY AGAIN」是误导，
       * 重试一百次也没用。说清楚是排行榜服务不在。
       */
      setErrorKey('offline');
      setPhase('idle');
    }
  }, [canSubmit, run, trimmed]);

  const boardRows = useMemo(() => board ?? [], [board]);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Score board">
      <div className={styles.panel}>
        <header className={styles.head}>
          <PixelWord
            text={tab === 'submit' ? BOARD_TEXT.submitTitle : BOARD_TEXT.topTitle}
            blockPx={blockPx * 0.5}
            tone="gold"
          />
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <nav className={styles.tabs}>
          <button
            type="button"
            className={styles.tab}
            data-active={tab === 'submit' ? 'true' : undefined}
            onClick={() => setTab('submit')}
          >
            {BOARD_TEXT.submit}
          </button>
          <button
            type="button"
            className={styles.tab}
            data-active={tab === 'top' ? 'true' : undefined}
            onClick={() => {
              setTab('top');
              loadBoard();
            }}
          >
            TOP
          </button>
        </nav>

        {tab === 'submit' && (
          <div className={styles.body}>
            <p className={styles.mine}>
              <span>{BOARD_TEXT.yourScore}</span>
              <b data-gold={phase === 'done' ? 'true' : undefined}>
                {phase === 'done' ? verifiedScore : (run?.score ?? 0)}
              </b>
            </p>

            {phase === 'done' ? (
              <p className={styles.saved}>
                {rank ? `SAVED · RANK #${rank}` : 'SAVED'}
                <button type="button" className={styles.inline} onClick={() => setTab('top')}>
                  VIEW TOP
                </button>
              </p>
            ) : (
              <>
                <label className={styles.field}>
                  <span className={styles.fieldLabel}>NAME</span>
                  <input
                    className={styles.input}
                    value={name}
                    placeholder="MONA"
                    maxLength={BOARD.maxNameLength}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(e) => setName(cleanName(e.target.value))}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSubmit();
                    }}
                  />
                </label>
                <p className={styles.hint}>{BOARD_TEXT.nameHint}</p>

                <div className={styles.actions}>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={!canSubmit}
                    onClick={handleSubmit}
                  >
                    {phase === 'sending' ? BOARD_TEXT.sending : BOARD_TEXT.save}
                  </button>
                  <button type="button" className={styles.ghost} onClick={onClose}>
                    {BOARD_TEXT.cancel}
                  </button>
                </div>

                {!hasRun && <p className={styles.error}>{errText('no-events')}</p>}
                {hasRun && errorKey && <p className={styles.error}>{errText(errorKey)}</p>}
              </>
            )}
          </div>
        )}

        {tab === 'top' && (
          <div className={styles.body}>
            {boardState === 'down' ? (
              <div className={styles.down}>
                <p className={styles.error}>{BOARD_TEXT.boardDown}</p>
                <button type="button" className={styles.retry} onClick={loadBoard}>
                  {BOARD_TEXT.retry}
                </button>
              </div>
            ) : boardState === 'loading' ? (
              <p className={styles.empty}>{BOARD_TEXT.loading}</p>
            ) : boardRows.length === 0 ? (
              <p className={styles.empty}>{BOARD_TEXT.empty}</p>
            ) : (
              <ol className={styles.list}>
                {boardRows.map((row) => (
                  <li
                    key={`${row.rank}-${row.name}`}
                    className={styles.row}
                    data-me={row.name === trimmed && trimmed ? 'true' : undefined}
                    data-top={row.rank <= 3 ? 'true' : undefined}
                  >
                    <span className={styles.rank}>{String(row.rank).padStart(2, '0')}</span>
                    <span className={styles.rowName}>{row.name}</span>
                    <span className={styles.time}>{formatDuration(row.duration)}</span>
                    <span className={styles.points}>{row.score}</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
