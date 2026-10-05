import { useCallback, useEffect, useRef, useState } from 'react';
import { useLang, type MsgKey } from '../../lib/i18n';
import {
  DEFAULT_SETTINGS,
  startCloudTrain,
  type CloudTrainSettings,
  type EngineHandle,
} from './engine';
import { FAMILY_ORDER, byFamily, findPalette, pickPalette } from './palettes';
import { downloadHtml } from './exportHtml';
import { findExperiment } from '../registry';

/** localStorage key — kept out of the way of the reference's own key. */
const STORE_KEY = 'softlab:cloud-train:v1';

type NumberKey = {
  [K in keyof CloudTrainSettings]: CloudTrainSettings[K] extends number ? K : never;
}[keyof CloudTrainSettings];

type TintKey = 'skyTint' | 'smokeTint' | 'trainTint' | 'gradeShadow' | 'gradeMid' | 'gradeHigh';

interface Slider {
  key: NumberKey;
  /** i18n key; the label is resolved at render time so a language switch
      updates the panel without remounting anything. */
  labelKey: MsgKey;
  min: number;
  max: number;
  step: number;
  /** how the value is written into the number badge */
  fmt?: (v: number) => string;
  group: '画面' | '光' | '收尾';
}

const SLIDERS: Slider[] = [
  { key: 'speed', labelKey: 'ct.sl.speed', min: 0, max: 5, step: 0.01, group: '画面' },
  { key: 'zoom', labelKey: 'ct.sl.zoom', min: 0.5, max: 2, step: 0.01, group: '画面' },
  { key: 'offset', labelKey: 'ct.sl.offset', min: -0.5, max: 0.5, step: 0.01, group: '画面' },
  { key: 'amplitude', labelKey: 'ct.sl.amplitude', min: 0, max: 2, step: 0.01, group: '画面' },
  { key: 'detail', labelKey: 'ct.sl.detail', min: 1, max: 8, step: 1, group: '画面' },
  { key: 'feedback', labelKey: 'ct.sl.feedback', min: 0, max: 0.85, step: 0.01, group: '画面' },

  { key: 'gradeAmount', labelKey: 'ct.sl.grade', min: 0, max: 1, step: 0.01, group: '光' },
  { key: 'temperature', labelKey: 'ct.sl.temperature', min: -1, max: 1, step: 0.01, group: '光' },
  { key: 'exposure', labelKey: 'ct.sl.exposure', min: 0.2, max: 2, step: 0.01, group: '光' },
  { key: 'saturation', labelKey: 'ct.sl.saturation', min: 0, max: 2, step: 0.01, group: '光' },
  { key: 'hue', labelKey: 'ct.sl.hue', min: -180, max: 180, step: 1, fmt: (v) => `${v}°`, group: '光' },

  { key: 'vignette', labelKey: 'ct.sl.vignette', min: 0, max: 1, step: 0.01, group: '收尾' },
  { key: 'grain', labelKey: 'ct.sl.grain', min: 0, max: 1, step: 0.01, group: '收尾' },
  { key: 'resolution', labelKey: 'ct.sl.resolution', min: 0.25, max: 1, step: 0.05, group: '收尾' },
  {
    key: 'introDuration',
    labelKey: 'ct.sl.introDuration',
    min: 0.5,
    max: 10,
    step: 0.1,
    fmt: (v) => `${v}s`,
    group: '收尾',
  },
  {
    key: 'introFeather',
    labelKey: 'ct.sl.introFeather',
    min: 0.02,
    max: 0.6,
    step: 0.01,
    group: '收尾',
  },
];

/**
 * 颜色项分两类，界面上要分开说：
 *   光 —— 三段色阶，决定整幅画的调子，改它等于换一次光
 *   物 —— 天空/列车/蒸汽的直选色，只染那一个部件，不动别的
 * 混在一起列会让人以为改一个色块能改整张画。
 */
const TINT_FIELDS: {
  key: TintKey;
  labelKey: MsgKey;
  hintKey: MsgKey;
  kind: '光' | '物';
}[] = [
  { key: 'gradeShadow', labelKey: 'ct.tint.shadow', hintKey: 'ct.tint.shadow.hint', kind: '光' },
  { key: 'gradeMid', labelKey: 'ct.tint.mid', hintKey: 'ct.tint.mid.hint', kind: '光' },
  { key: 'gradeHigh', labelKey: 'ct.tint.high', hintKey: 'ct.tint.high.hint', kind: '光' },
  { key: 'skyTint', labelKey: 'ct.tint.sky', hintKey: 'ct.tint.sky.hint', kind: '物' },
  { key: 'trainTint', labelKey: 'ct.tint.train', hintKey: 'ct.tint.train.hint', kind: '物' },
  { key: 'smokeTint', labelKey: 'ct.tint.smoke', hintKey: 'ct.tint.smoke.hint', kind: '物' },
];

/** `id` is the internal key used by SLIDERS; `key` is what gets shown. */
const GROUP_ORDER: { id: string; key: MsgKey }[] = [
  { id: '画面', key: 'ct.group.frame' },
  { id: '光', key: 'ct.group.light' },
  { id: '收尾', key: 'ct.group.tail' },
];

/* 染色 is NOT a slider group and deliberately absent from GROUP_ORDER: the
   loop below skips any group with no sliders, so a colour-only group would
   have been dropped on the floor. It is rendered as its own block, right
   after 画面/光, because editing a colour is the thing people actually come
   back for once a preset is close but not right. */
const COLLAPSED_AFTER: Record<string, number> = {
  画面: 3,
  光: 3,
  收尾: 2,
};

function loadStored(): CloudTrainSettings | null {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CloudTrainSettings>;
    // Only take keys we know: a stale entry from an older build must not be
    // able to inject anything, and `introEnabled` etc. must stay boolean.
    const out = { ...DEFAULT_SETTINGS };
    for (const k of Object.keys(DEFAULT_SETTINGS) as (keyof CloudTrainSettings)[]) {
      const v = parsed[k];
      if (typeof v === typeof DEFAULT_SETTINGS[k]) {
        (out as Record<string, unknown>)[k] = v;
      }
    }
    return out;
  } catch {
    return null;
  }
}

export default function CloudTrain() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const stateRef = useRef<CloudTrainSettings>({ ...DEFAULT_SETTINGS });

  const { t } = useLang();
  const [s, setS] = useState<CloudTrainSettings>(() => loadStored() ?? { ...DEFAULT_SETTINGS });
  const [palette, setPalette] = useState<string>('sunset');
  const [panelOpen, setPanelOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth > 720,
  );
  const [paused, setPaused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [remembered, setRemembered] = useState(false);

  /* The loop reads settings through a ref: a new object every frame would
     otherwise mean the rAF closure is re-created on every slider tick.

     `paused` lives in its own state rather than in `s` on purpose. It was
     duplicated in both, and the two disagreed: the engine stops its rAF loop
     entirely when paused, so nothing re-reads the settings object after that
     — a paused value can only be undone by code outside the loop, and every
     path out of here has to remember to do it. */
  stateRef.current = { ...s, paused };
  useEffect(() => {
    stateRef.current = { ...s, paused };
  }, [s, paused]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      engineRef.current = startCloudTrain({
        canvas,
        settings: stateRef,
        onIntroStart: () => setRevealed(false),
        onIntroDone: () => setRevealed(true),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setRevealed(true);
    }
    return () => {
      engineRef.current?.dispose();
      engineRef.current = null;
    };
  }, []);

  /* The rAF loop stops itself when paused (engine.ts: `if (!s.paused ...) request()`),
     so `wake()` is the only thing that can restart it. Two cases need it and
     the difference matters:

       - while paused, so a slider drag still repaints — otherwise the control
         looks broken;
       - on the *unpause* transition, or resume does nothing. This was the
         actual bug: the guard read `if (paused || s.paused)`, which is false
         exactly when the user presses "继续", so the loop stayed dead and the
         button looked inert forever.

     `wake()` is idempotent (it cancels any pending frame first), so calling it
     on every settings change is safe and cheap. */
  useEffect(() => {
    engineRef.current?.wake();
  }, [s, paused]);

  const set = useCallback(<K extends keyof CloudTrainSettings>(key: K, value: CloudTrainSettings[K]) => {
    setS((prev) => ({ ...prev, [key]: value }));
    setRemembered(false);
  }, []);

  /** The display name of a palette in the current language, Chinese fallback. */
  const palName = useCallback(
    (id: string) => {
      const p = findPalette(id);
      if (!p) return t('ct.custom');
      return t(p.nameKey);
    },
    [t],
  );

  const setTint = useCallback(
    (key: TintKey, value: string) => {
      set(key, value as never);
      // Any hand adjustment means this is no longer *exactly* the preset, so
      // the preset grid must stop claiming it is. Without this the highlighted
      // swatch lies: it says "落日" while the colours on screen are not.
      setTinted(true);
      setRemembered(false);
    },
    [set],
  );

  const applyPalette = useCallback(
    (id: string) => {
      const p = findPalette(id);
      if (!p) return;
      setPalette(id);
      setBaseOf(id);
      setTinted(false);
      setS((prev) => ({
        ...prev,
        skyTint: p.sky,
        gradeShadow: p.shadow,
        gradeMid: p.mid,
        gradeHigh: p.high,
        trainTint: p.train,
        smokeTint: p.smoke,
        temperature: p.temperature,
        exposure: p.exposure,
        /* Grade strength and saturation move together for the `sea` family,
           and for a reason worth writing down. The grade is a *multiply*:
           it darkens and tints but cannot subtract the sunset orange that is
           already in the frame. Turning it up alone therefore made the picture
           warmer, not more violet — the opposite of the intent. Saturation is
           the lever that actually replaces one colour with another, because it
           works on the result of the grade rather than under it. */
        gradeAmount: p.family === 'sea' ? 0.75 : 0.62,
        saturation: p.family === 'sea' ? p.saturation * 1.34 : p.saturation,
      }));
      setRemembered(false);
    },
    [],
  );

  /**
   * 换束光 —— **只换颜色**。
   *
   * 上一版会连着随机速度、起伏、缩放、拖影、颗粒，理由是「形状没有品味」。
   * 那是错的：形状不是没有品味，是**不该由这个按钮来动**。用户按下「换束光」
   * 时想看的是颜色变了，附带把整台机器重新洗一遍，注意力就被带走了 ——
   * 而且速度被改动本身是**不可逆的观察破坏**：你没法再回到原来那台车。
   *
   * 抽签只跑在颜色上，且范围严格限定在预定义好的光里。
   */
  const shuffleLight = useCallback(() => {
    applyPalette(pickPalette(palette).id);
  }, [applyPalette, palette]);

  /**
   * 「基于哪一套改的」—— 手动碰过任何颜色项之后，这套光就不再等于任何预设，
   * 但它仍然是从某个预设出发的。记着起点，界面才能说清「这是从落日改的」
   * 而不是只显示一个没有来路的色值。
   */
  const [baseOf, setBaseOf] = useState('sunset');
  /** 颜色被手动改过 —— 预设按钮的高亮随之熄灭。 */
  const [tinted, setTinted] = useState(false);
  /**
   * 哪些预设分组展开了。默认只开「撞色」—— 20 个色块铺开是十行滚动，
   * 而这一轮做预设的起因就是「想要更有冲击力」，所以第一眼该给的是那组
   * 色相隔 100° 以上的，不是安静的同色系。
   */
  const [famOpen, setFamOpen] = useState<Record<string, boolean>>({ clash: true });

  /**
   * 全部复原 —— 一台车、一套光、一个进度条，全部回到刚打开的样子。
   * 放在 dock 而不是面板底部：它和「重播」是同一量级的操作，应该在同一个
   * 地方，且离画面只有一个拇指的距离。
   */
  const restore = useCallback(() => {
    engineRef.current?.replay();
    setPalette('sunset');
    setBaseOf('sunset');
    setTinted(false);
    setS({ ...DEFAULT_SETTINGS });
    setPaused(false);
    setRemembered(false);
  }, []);

  /**
   * 导出 —— 把当前这套光写成一个能双击打开的 HTML。
   * 名字取自当前配色：导出十几份之后，文件名就是索引。
   */
  const doExport = useCallback(() => {
    const name = palName(tinted ? baseOf : palette);
    downloadHtml(s, `${name}-${t('ct.title')}`);
  }, [s, palette, baseOf, tinted, t, palName]);

  const remember = useCallback(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
      setRemembered(true);
    } catch {
      setRemembered(false);
    }
  }, [s]);

  const replay = useCallback(() => {
    engineRef.current?.replay();
    setRevealed(false);
  }, []);

  const active = findPalette(palette);

  /* Whether the drawer layout is in play. Tracked in state rather than read
     from CSS because the dock's position has to *move* when the drawer opens
     — a media query can change an element's box but cannot tell React that it
     needs to re-render. */
  const [portrait, setPortrait] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.innerWidth <= 720 &&
      window.matchMedia('(orientation: portrait)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px) and (orientation: portrait)');
    const on = () => setPortrait(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  return (
    <div className="exp-page">
      <div className="exp-bar">
        <span className="mono-sm">NO. {findExperiment('cloud-train')?.no ?? '03'}</span>
        <span className="exp-bar__title">{t('ct.title')}</span>
        <span className="mono-sm" style={{ color: 'var(--accent)' }}>
          {t('ct.bar.note', { name: active ? palName(active.id) : t('ct.custom') })}
        </span>
        <span className="exp-bar__spacer" />
        <a className="mo-btn mo-btn--sm mo-btn--ghost mo-arrow-slide" href="#/" data-mo="arrow-slide">
          <span className="mo-label">{t('ct.back')}</span>
        </a>
      </div>

      <div className="lab lab--train">
        <div className="lab__stage lab__stage--flat">
          <canvas ref={canvasRef} className="ct-canvas" aria-label={t('ct.stage')} />
          {error && (
            <p className="ct-error" role="alert">
              {t('ct.err', { msg: error })}
            </p>
          )}
        </div>

        <div className="lab__hud">
          <div className="lab__title lab__title--train">
            <h1>
              {t('ct.hud.title.a')}
              <br />
              <i>{t('ct.hud.title.b')}</i>
            </h1>
            <p>
              {t('ct.hud.sub')}
              <br />
              {t('ct.hud.subEn')}
            </p>
          </div>

          <button
            className="mo-btn mo-btn--sm mo-press-scale panel-toggle panel-toggle--glass"
            data-show={!panelOpen}
            onClick={() => setPanelOpen(true)}
          >
            {t('ct.panel.open')}
          </button>

          <div className="lab__dock" data-above-drawer={panelOpen && portrait}>
            <div className="lab__controls">
              {/* Three triggers, one state.
                  The distinction is not cosmetic. A button that *does*
                  something (roll the light, replay the opening) must read as
                  momentary: it lights on press and goes straight back. A
                  button that *is* something (paused) is the only one allowed
                  to hold its lit state — otherwise the "on" reading is
                  ambiguous and you cannot tell a toggle from a trigger. */}
              <button
                className="mo-btn mo-btn--sm mo-roll"
                data-mo="roll"
                onClick={restore}
                title={t('ct.dock.restore.title')}
              >
                {t('ct.dock.restore')}
              </button>

              {/* The one primary action. It gets the filled treatment
                  because it is the thing a visitor came to do; everything else
                  on this bar is a state or a utility. `.mo-roll` still owns
                  the press feedback — this only sets the resting surface. */}
              <button
                className="mo-btn mo-btn--sm mo-roll mo-btn--lead"
                data-mo="roll"
                onClick={shuffleLight}
                title={t('ct.dock.shuffle.title')}
              >
                {t('ct.dock.shuffle')}
              </button>

              <button
                className="mo-btn mo-btn--sm mo-toggle"
                data-mo="toggle"
                data-on={paused}
                aria-pressed={paused}
                onClick={() => setPaused((p) => !p)}
              >
                {t(paused ? 'ct.dock.resume' : 'ct.dock.pause')}
              </button>

              <button
                className="mo-btn mo-btn--sm mo-roll"
                data-mo="roll"
                onClick={replay}
                title={t('ct.dock.replay.title')}
              >
                {t('ct.dock.replay')}
              </button>

              {/* 存下这套 → 「留在本机」. The old wording read like an
                  instruction to save a file; what it actually does is keep the
                  settings in this browser. 「留在本机」says where it went. */}
              <button
                className="mo-btn mo-btn--sm mo-toggle"
                data-mo="toggle"
                data-on={remembered}
                aria-pressed={remembered}
                onClick={remember}
                title={t('ct.dock.keep.title')}
              >
                {t(remembered ? 'ct.dock.kept' : 'ct.dock.keep')}
              </button>
            </div>

            {/* 导出 is not a fifth button on the same row. It produces a
                *file* — a different kind of act from the four above, all of
                which change something on this screen. Giving it its own line
                under the bar, in text rather than a pill, is what keeps the
                distinction readable instead of merely stated. */}
            <button
              className="ct-export"
              onClick={doExport}
              title={t('ct.export.title')}
            >
              <span className="ct-export__icon" aria-hidden>
                <svg viewBox="0 0 16 16" focusable="false">
                  <path
                    d="M8 1.8v8.4M4.8 7.4 8 10.6l3.2-3.2M2.4 12.1v1.4a.7.7 0 0 0 .7.7h9.8a.7.7 0 0 0 .7-.7v-1.4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              {t('ct.export')}
            </button>
          </div>
        </div>

        {/* ---------- the glass panel ----------
            A frosted slab, not a card with a shadow. Four things do the work:
            a real backdrop blur, a hairline of light on the top edge, a faint
            inner top highlight, and a bloom under the whole thing. The
            highlight has to be *inside* the element — a box-shadow that only
            sits outside reads as a glow, not as glass catching light. */}
        <aside
          className="ct-panel"
          data-open={panelOpen}
          data-revealed={revealed}
          aria-label="云间列车参数"
        >
          {/* The grab handle. On a phone this doubles as the only way to open
              the drawer — the close button used to sit underneath the sticky
              header and the open button was invisible, which meant a phone
              visitor had no way in or out at all. */}
          <button
            className="ct-panel__grip"
            onClick={() => setPanelOpen((o) => !o)}
            aria-label={t(panelOpen ? 'ct.panel.gripClose' : 'ct.panel.gripOpen')}
            aria-expanded={panelOpen}
          />

          <div className="ct-panel__head">
            <span className="ct-panel__title">{t('ct.panel.title')}</span>
            <span className="ct-panel__badge">
              {tinted
                ? t('ct.panel.changed', { name: palName(baseOf) })
                : (active ? palName(active.id) : t('ct.custom'))}
            </span>
            <button
              className="ct-panel__close"
              onClick={() => setPanelOpen(false)}
              aria-label={t('ct.panel.close')}
            >
              ×
            </button>
          </div>

          <div className="ct-panel__body">
            {/* ---------- presets, grouped by how they work ----------
                Twenty flat swatches is a wall of colour with no reading
                order. They are grouped by the *mechanism* instead, because
                that is what predicts whether a visitor will like a set:
                  - the first four are single-family (measured hue gap 3-47°),
                    so they read as one colour getting lighter — quiet, and
                    that is the point, not a failure;
                  - duotone pairs two sweet colours and lets value carry it;
                  - clash and acid put the two dominant stops 100-180° apart,
                    which is what actually tears the picture open.
                Each family is collapsed by default; there are 7 of them and
                an open list of 20 is ten rows of scroll. */}
            <div className="field">
              <span className="field__label">
                {t('ct.panel.preset')}
                <output>
                  {tinted ? t('ct.panel.edited') : (active ? palName(active.id) : t('ct.custom'))}
                </output>
              </span>

              {tinted && (
                <p className="field__note">
                  {t('ct.panel.tintedNote', { base: palName(baseOf) })}
                </p>
              )}

              {FAMILY_ORDER.map((g) => {
                const list = byFamily(g.key);
                if (!list.length) return null;
                const open = famOpen[g.key] ?? false;
                const on = !tinted && list.some((p) => p.id === palette);
                return (
                  <div className="ct-fam" key={g.key} data-open={open}>
                    <button
                      className="ct-fam__head"
                      onClick={() =>
                        setFamOpen((prev) => ({ ...prev, [g.key]: !open }))
                      }
                      aria-expanded={open}
                    >
                      <span className="ct-fam__label">{t(g.labelKey)}</span>
                      <span className="ct-fam__count">{list.length}</span>
                      <i className="rule" />
                      <span className="ct-fam__hint">{t(g.hintKey)}</span>
                      <span className="ct-fam__caret" aria-hidden>
                        {open ? '−' : '+'}
                      </span>
                    </button>

                    {open && (
                      <>
                        <div className="ct-palettes">
                          {list.map((p) => (
                            <button
                              key={p.id}
                              className="ct-palette"
                              data-on={palette === p.id && !tinted}
                              onClick={() => applyPalette(p.id)}
                              title={t(p.noteKey)}
                              aria-label={t(p.nameKey)}
                              aria-pressed={palette === p.id && !tinted}
                            >
                              <span
                                className="ct-palette__bar"
                                style={{
                                  background: `linear-gradient(100deg, ${p.chips[0]}, ${p.chips[1]} 52%, ${p.chips[2]})`,
                                }}
                              />
                              <span className="ct-palette__name">
                                {t(p.nameKey)}
                              </span>
                            </button>
                          ))}
                        </div>
                        {on && active && (
                          <p className="field__note">{t(active.noteKey)}</p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ---------- colour: the editable half of the palette ----------
                Every preset here is just six values, and all six are exposed
                below the swatches — a preset you cannot bend is a preset you
                can only accept or reject. Two tiers, because they do different
                jobs: 光 changes the whole picture's key, 物 stains one part. */}
            <div className="ct-group ct-group--tint">
              <div className="ct-group__head">
                <span>{t('ct.group.colour')}</span>
                <i className="rule" />
                {tinted && <span className="ct-group__badge">{t('ct.group.colour.badge')}</span>}
              </div>

              {(['光', '物'] as const).map((kind) => (
                <div className="ct-tint-set" key={kind}>
                  <span className="ct-tint-set__label">
                    {kind === '光' ? t('ct.tint.lightLabel') : t('ct.tint.objLabel')}
                  </span>
                  <div className="ct-tints">
                    {TINT_FIELDS.filter((f) => f.kind === kind).map((f) => (
                      <label className="ct-tint" key={f.key}>
                        <span className="ct-tint__chip" style={{ background: s[f.key] }} />
                        <span className="ct-tint__meta">
                          <b>{t(f.labelKey)}</b>
                          <i>{t(f.hintKey)}</i>
                        </span>
                        <input
                          type="color"
                          value={s[f.key]}
                          aria-label={t(f.labelKey)}
                          onChange={(e) => setTint(f.key, e.target.value)}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {GROUP_ORDER.map((group) => {
              const items = SLIDERS.filter((x) => x.group === group.id);
              if (!items.length) return null;
              const limit = COLLAPSED_AFTER[group.id];
              const isOpen = expanded[group.id] ?? false;
              const shown = isOpen ? items : items.slice(0, limit);
              const hidden = items.length - shown.length;
              return (
                <div className="ct-group" key={group.id}>
                  <div className="ct-group__head">
                    <span>{t(group.key)}</span>
                    <i className="rule" />
                  </div>

                  {shown.map((sl) => (
                      <label className="field" key={sl.key}>
                        <span className="field__label">
                          {t(sl.labelKey)}
                          <output>{sl.fmt ? sl.fmt(s[sl.key] as number) : s[sl.key]}</output>
                        </span>
                        <input
                          type="range"
                          min={sl.min}
                          max={sl.max}
                          step={sl.step}
                          value={s[sl.key] as number}
                          // The track is painted as a gradient up to the thumb,
                          // which the pseudo-element cannot know. Hand it the
                          // percentage as a custom property.
                          style={
                            {
                              '--fill': `${(((s[sl.key] as number) - sl.min) / (sl.max - sl.min)) * 100}%`,
                            } as React.CSSProperties
                          }
                          onChange={(e) => set(sl.key, Number(e.target.value) as never)}
                        />
                      </label>
                  ))}

                  {hidden > 0 && (
                    <button
                      className="ct-more"
                      onClick={() => setExpanded((p) => ({ ...p, [group.id]: true }))}
                    >
                      {t('ct.more', { n: hidden })} ↓
                    </button>
                  )}
                  {isOpen && items.length > limit && (
                    <button
                      className="ct-more"
                      onClick={() => setExpanded((p) => ({ ...p, [group.id]: false }))}
                    >
                      {t('ct.less')} ↑
                    </button>
                  )}
                </div>
              );
            })}

            {/* The panel edits; it does not roll. Both of those live in the
                dock where they are one tap from the picture — repeating them
                here meant the same action in two places with two different
                meanings, and a "reset all" buried at the bottom of a scrolling
                list is a control nobody finds. */}
            <div className="ct-panel__foot">
              {tinted && (
                <button className="ct-revert" onClick={() => applyPalette(baseOf)}>
                  {t('ct.panel.revert', { name: palName(baseOf) })}
                </button>
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
