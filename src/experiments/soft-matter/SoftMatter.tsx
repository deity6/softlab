import { useEffect, useRef, useState } from 'react';
import { createEngine, type EngineHandle, type EngineParams, type EngineShape } from './engine';
import { findExperiment } from '../registry';
import { useLang, type MsgKey } from '../../lib/i18n';

/** Shape list and defaults mirror the reference project's own controls. */
const SHAPES: { id: EngineShape; labelKey: MsgKey }[] = [
  { id: 'ghost', labelKey: 'sm.shape.ghost' },
  { id: 'watermelon', labelKey: 'sm.shape.watermelon' },
  { id: 'bear', labelKey: 'sm.shape.bear' },
  { id: 'star', labelKey: 'sm.shape.star' },
  { id: 'orb', labelKey: 'sm.shape.orb' },
  { id: 'cube', labelKey: 'sm.shape.cube' },
];

interface Paint {
name: MsgKey;
  from: string;
  /** omit for a flat colour */
  to?: string;
}

/**
 * The first four are the reference project's own flat presets, kept as they are.
 * Everything after them comes from the frontend design vault's gradient library
 * (`frontend-design-vault/assets/gradients.css`) — a transmissive body reads a
 * gradient far better than it reads a flat tint, because the two stops separate
 * across the shell and give the volume a direction.
 */
const PALETTE: Paint[] = [
  { name: 'sm.paint.0', from: '#ff243e' },
  { name: 'sm.paint.1', from: '#00bc7d' },
  { name: 'sm.paint.2', from: '#f6ad00' },
  { name: 'sm.paint.3', from: '#627bef' },
  { name: 'sm.paint.4', from: '#2bc0e4', to: '#eaecc6' },
  { name: 'sm.paint.5', from: '#324263', to: '#b0e4ed' },
  { name: 'sm.paint.6', from: '#5e6bff', to: '#fffeda' },
  { name: 'sm.paint.7', from: '#6453a1', to: '#fddce4' },
  { name: 'sm.paint.8', from: '#d693a1', to: '#e2f5ff' },
  { name: 'sm.paint.9', from: '#ff76bd', to: '#e5fffd' },
  { name: 'sm.paint.10', from: '#e16668', to: '#fff4dd' },
  { name: 'sm.paint.11', from: '#f5600f', to: '#e2fffd' },
  { name: 'sm.paint.12', from: '#1899b6', to: '#fffcdd' },
  { name: 'sm.paint.13', from: '#18b670', to: '#ffd0d0' },
  { name: 'sm.paint.14', from: '#b61877', to: '#ddfeff' },
  { name: 'sm.paint.15', from: '#ff3730', to: '#d2ffd2' },
  { name: 'sm.paint.16', from: '#30a9ff', to: '#fff4e3' },
  { name: 'sm.paint.17', from: '#5d9ab4', to: '#f5d7c4' },
];

const DEFAULT_PARAMS: EngineParams = {
  elasticity: 50,
  damping: 35,
  glass: 100,
  angle: 42,
};

const SLOW_FACTOR = 0.22;

export default function SoftMatter() {
  const { t } = useLang();
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<EngineHandle | null>(null);
  const primedRef = useRef(false);

  const [shape, setShape] = useState<EngineShape>('ghost');
  const [paint, setPaint] = useState<Paint>(PALETTE[0]);
  const [params, setParams] = useState<EngineParams>(DEFAULT_PARAMS);
  // On a phone the canvas is the whole point — start with the panel folded away
  // and let the corner button bring it up.
  const [panelOpen, setPanelOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth > 720,
  );
  const [paused, setPaused] = useState(false);
  const [slow, setSlow] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let engine: EngineHandle | null = null;
    try {
      engine = createEngine(host, {
        shape,
        color: paint.from,
        colorTo: paint.to,
        params,
      });
      engineRef.current = engine;
    } catch (err) {
      console.error('[softlab] could not start soft matter lab', err);
    }
    return () => {
      engine?.dispose();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!primedRef.current) {
      primedRef.current = true;
      return;
    }
    engineRef.current?.setShape(shape);
  }, [shape]);

  useEffect(() => {
    if (!primedRef.current) return;
    engineRef.current?.setColor(paint.from, paint.to);
  }, [paint]);

  useEffect(() => {
    if (!primedRef.current) return;
    engineRef.current?.setParams(params);
  }, [params]);

  useEffect(() => {
    if (!primedRef.current) return;
    engineRef.current?.setPaused(paused);
  }, [paused]);

  useEffect(() => {
    if (!primedRef.current) return;
    engineRef.current?.setTimeScale(slow ? SLOW_FACTOR : 1);
  }, [slow]);

  const set = <K extends keyof EngineParams>(key: K, value: EngineParams[K]) =>
    setParams((prev) => ({ ...prev, [key]: value }));

  const randomize = () => {
    const next = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    const nextPaint = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    setShape(next.id);
    setPaint(nextPaint);
    setPaused(false);
  };

  const restore = () => {
    engineRef.current?.reset();
    setShape('ghost');
    setPaint(PALETTE[0]);
    setParams(DEFAULT_PARAMS);
    setPaused(false);
    setSlow(false);
  };

  return (
    <div className="exp-page">
      <div className="exp-bar">
        <span className="mono-sm">NO. {findExperiment('soft-matter')?.no ?? '01'}</span>
        <span className="exp-bar__title">Soft Matter</span>
        <span className="mono-sm" style={{ color: 'var(--accent)' }}>
          {t('sm.bar.note')}
        </span>
        <span className="exp-bar__spacer" />
        <a className="mo-btn mo-btn--sm mo-btn--ghost mo-arrow-slide" href="#/" data-mo="arrow-slide">
          <span className="mo-label">{t('ui.back')}</span>
        </a>
      </div>

      <div className="lab">
        <div
          className="lab__stage"
          ref={hostRef}
          onPointerDown={() => setTouched(true)}
          aria-label={t('sm.stage.aria')}
        />

        <div className="lab__hud">
          <div className="lab__title">
            <h1>
              Soft
              <br />
              <i>Matter.</i>
            </h1>
            <p>
              {t('sm.hud.sub')}
              <br />
              TOUCH · STRETCH · RELEASE
            </p>
          </div>

          <button
            className="mo-btn mo-btn--sm mo-press-scale panel-toggle"
            data-show={!panelOpen}
            onClick={() => setPanelOpen(true)}
          >
            {t('sm.panel.open')}
          </button>

          <div className="lab__dock">
            <span className="lab__hint" data-dim={touched}>
              {t('sm.hint')}
            </span>
            <div className="lab__controls">
              <button
                className="mo-btn mo-btn--sm mo-fill-sweep"
                data-mo="fill-sweep"
                onClick={() => engineRef.current?.drop()}
              >
                {t('sm.bounce')}
              </button>
              <button
                className="mo-btn mo-btn--sm mo-press-scale"
                data-on={paused}
                onClick={() => setPaused((p) => !p)}
              >
                {paused ? t('sm.resume') : t('sm.pause')}
              </button>
              <button
                className="mo-btn mo-btn--sm mo-press-scale"
                data-on={slow}
                onClick={() => setSlow((s) => !s)}
                title={t('sm.slow.title')}
              >
                {slow ? t('sm.normal') : t('sm.slow')}
              </button>
            </div>
          </div>
        </div>

        <aside className="panel" data-open={panelOpen} aria-label={t('sm.panel.aria')}>
          <div className="panel__head">
            <b>Material Lab</b>
            <span>{t('sm.panel.sub')}</span>
            <button
              className="panel__close"
              onClick={() => setPanelOpen(false)}
              aria-label={t('sm.panel.close')}
            >
              ×
            </button>
          </div>

          <label className="field">
            <span className="field__label">{t('sm.field.shape')}</span>
            <select value={shape} onChange={(e) => setShape(e.target.value as EngineShape)}>
              {SHAPES.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(s.labelKey)}
                </option>
              ))}
            </select>
          </label>

          <div className="field">
            <span className="field__label">
              {t('sm.field.colour')}
              <output>{t(paint.name)}</output>
            </span>
            <div className="swatches">
              {PALETTE.map((p) => (
                <button
                  key={p.name}
                  className="swatch"
                  aria-label={t(p.name)}
                  title={p.to ? `${t(p.name)} · ${p.from} → ${p.to}` : `${t(p.name)} · ${p.from}`}
                  data-on={paint === p}
                  style={{
                    ['--c' as string]: p.to
                      ? `linear-gradient(160deg, ${p.from}, ${p.to})`
                      : p.from,
                  }}
                  onClick={() => setPaint(p)}
                />
              ))}
              <span className="swatch swatch--custom" title={t('sm.custom.title')}>
                <input
                  type="color"
                  value={paint.from}
                  aria-label={t('sm.custom')}
                  onChange={(e) => setPaint({ name: 'sm.custom', from: e.target.value })}
                />
              </span>
            </div>
            {(shape === 'ghost' || shape === 'watermelon') && (
              <p className="field__note">{t('sm.field.shapeColour')}</p>
            )}
          </div>

          <label className="field">
            <span className="field__label">
              {t('sm.field.elasticity')}
              <output>{params.elasticity}</output>
            </span>
            <input
              type="range"
              min={10}
              max={100}
              value={params.elasticity}
              onChange={(e) => set('elasticity', Number(e.target.value))}
            />
          </label>

          <label className="field">
            <span className="field__label">
              {t('sm.field.damping')}
              <output>{params.damping}</output>
            </span>
            <input
              type="range"
              min={5}
              max={95}
              value={params.damping}
              onChange={(e) => set('damping', Number(e.target.value))}
            />
          </label>

          <label className="field">
            <span className="field__label">
              {t('sm.field.glass')}
              <output>{params.glass}</output>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={params.glass}
              onChange={(e) => set('glass', Number(e.target.value))}
            />
          </label>

          <label className="field">
            <span className="field__label">
              {t('sm.field.spin')}
              <output>{params.angle}°</output>
            </span>
            <input
              type="range"
              min={-180}
              max={180}
              value={params.angle}
              onChange={(e) => set('angle', Number(e.target.value))}
            />
          </label>

          <div className="panel__actions">
            <button className="mo-btn mo-btn--sm mo-fill-sweep" data-mo="fill-sweep" onClick={randomize}>
              {t('sm.random')}
            </button>
            <button className="mo-btn mo-btn--sm mo-press-scale" onClick={restore}>
              {t('sm.reset')}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
