import { useEffect, useRef, useState } from 'react';
import SplitChars from './SplitChars';
import { createAsciify } from './effects/asciify';
import { createRipple } from './effects/ripple';
import { createDecrypt } from './effects/decrypt';
import { createGlitch } from './effects/glitch';
import { findExperiment } from '../registry';
import { useLang, type MsgKey } from '../../lib/i18n';
import type { EffectFactory, EffectInstance } from './effects/types';

interface LabEffect {
  id: string;
  nameKey: MsgKey;
  descKey: MsgKey;
  hintKey: MsgKey;
  create: EffectFactory;
}

const EFFECTS: LabEffect[] = [
  {
    id: 'asciify',
    nameKey: 'cl.fx.asciify.name',
    descKey: 'cl.fx.asciify.desc',
    hintKey: 'cl.fx.asciify.hint',
    create: createAsciify,
  },
  {
    id: 'decrypt',
    nameKey: 'cl.fx.decrypt.name',
    descKey: 'cl.fx.decrypt.desc',
    hintKey: 'cl.fx.decrypt.hint',
    create: createDecrypt,
  },
  {
    id: 'ripple',
    nameKey: 'cl.fx.ripple.name',
    descKey: 'cl.fx.ripple.desc',
    hintKey: 'cl.fx.ripple.hint',
    create: createRipple,
  },
  {
    id: 'glitch',
    nameKey: 'cl.fx.glitch.name',
    descKey: 'cl.fx.glitch.desc',
    hintKey: 'cl.fx.glitch.hint',
    create: createGlitch,
  },
];

const HEADLINE = 'SOFT MATTER';

export default function CanvasLab() {
  const { t } = useLang();
  const stageRef = useRef<HTMLDivElement>(null);
  const proseRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState(EFFECTS[0].id);

  const active = EFFECTS.find((e) => e.id === activeId) ?? EFFECTS[0];
  const body = t('cl.body');
  const body2 = t('cl.body2');

  useEffect(() => {
    const stage = stageRef.current;
    const prose = proseRef.current;
    if (!stage || !prose) return;

    // Reset anything the previous effect may have left behind.
    stage.querySelectorAll('.fx-layer').forEach((node) => node.remove());
    delete prose.dataset.glitch;
    delete prose.dataset.masked;
    delete prose.dataset.pinned;
    const chars = Array.from(prose.querySelectorAll<HTMLElement>('[data-ch]'));
    for (const el of chars) {
      if (el.dataset.orig === undefined) el.dataset.orig = el.textContent ?? '';
      else el.textContent = el.dataset.orig;
      el.style.transform = '';
      el.style.color = '';
      el.style.textShadow = '';
      el.style.width = '';
    }

    let instance: EffectInstance | undefined;
    try {
      instance = active.create({ stage, prose, chars, accent: '#3b82f6' });
    } catch (err) {
      console.error('[softlab] effect failed to mount', err);
    }
    return () => instance?.destroy();
    // `body`/`body2` are in the deps on purpose: the effects cache the split
    // character nodes, so a language change has to remount them.
  }, [active, body, body2]);

  return (
    <div className="exp-page">
      <div className="exp-bar">
        <span className="mono-sm">NO. {findExperiment('canvas-lab')?.no ?? '02'}</span>
        <span className="exp-bar__title">Canvas Lab</span>
        <span className="mono-sm" style={{ color: 'var(--accent)' }}>
          {t('cl.bar.note')}
        </span>
        <span className="exp-bar__spacer" />
        <a className="mo-btn mo-btn--sm mo-btn--ghost mo-arrow-slide" href="#/" data-mo="arrow-slide">
          <span className="mo-label">{t('ui.back')}</span>
        </a>
      </div>

      <div className="lab-wall">
        <div className="effect-list">
          <h2>Effects</h2>
          {EFFECTS.map((fx, i) => (
            <button
              key={fx.id}
              className="effect-item"
              data-on={fx.id === activeId}
              onClick={() => setActiveId(fx.id)}
            >
              <span className="effect-item__name">
                {String(i + 1).padStart(2, '0')} · {t(fx.nameKey)}
              </span>
              <span className="effect-item__desc">{t(fx.descKey)}</span>
            </button>
          ))}
        </div>

        <div className="effect-canvas" ref={stageRef}>
          <div className="effect-prose" ref={proseRef}>
            <span className="effect-prose__tag">{t('cl.eyebrow')}</span>
            <h3 aria-label={HEADLINE}>
              <SplitChars text={HEADLINE} />
            </h3>
            <p aria-label={body}>
              <SplitChars text={body} />
            </p>
            <p aria-label={body2}>
              <SplitChars text={body2} />
            </p>
          </div>
        </div>
      </div>

      <div className="effect-foot">
        <span className="mono">
          {t('cl.foot.now')} · {t(active.nameKey)}
        </span>
        <span className="mono-sm">{t(active.hintKey)}</span>
        <span className="spacer" />
        <span className="mono-sm">{t('cl.foot.dom')}</span>
      </div>
    </div>
  );
}
