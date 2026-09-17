import { EXPERIMENTS } from '../experiments/registry';
import { BUTTONS } from '../buttons/registry';
import { findSection } from '../lib/sections';
import { useLang, type MsgKey } from '../lib/i18n';

const STEPS: { n: string; tKey: MsgKey; dKey: MsgKey }[] = [
  {
    n: 'I',
    tKey: 'grow.step1.t',
    dKey: 'grow.step1.d',
  },
  {
    n: 'II',
    tKey: 'grow.step2.t',
    dKey: 'grow.step2.d',
  },
  {
    n: 'III',
    tKey: 'grow.step3.t',
    dKey: 'grow.step3.d',
  },
];

/** How the collection grows — the three steps, plus what is in the box now. */
export default function GrowthPanel() {
  const { t } = useLang();
  // A meta column, not a project: it carries a dash where the numbers go.
  const no = findSection('growth')?.no ?? '—';

  return (
    <section className="tabpanel" aria-labelledby="grow-h">
      <div className="tabpanel-head reveal">
        <span className="tabpanel-head__no mono" data-kind="meta">
          {no}
        </span>
        <h2 id="grow-h">How it grows</h2>
        <hr className="rule" />
        <span className="mono-sm">{t('grow.head.meta')}</span>
      </div>

      <div className="intake reveal">
        {STEPS.map((s) => (
          <article className="intake__step" key={s.n}>
            <span className="mono" style={{ color: 'var(--accent)' }}>
              {s.n}
            </span>
            <h3>{t(s.tKey)}</h3>
            <p>{t(s.dKey)}</p>
          </article>
        ))}
      </div>

      <div className="grow-stats reveal">
        <div className="grow-stat">
          <span className="grow-stat__n">{String(EXPERIMENTS.length).padStart(2, '0')}</span>
          <span className="mono-sm">{t('grow.stat.exp')}</span>
        </div>
        <div className="grow-stat">
          <span className="grow-stat__n">{BUTTONS.length}</span>
          <span className="mono-sm">{t('grow.stat.btn')}</span>
        </div>
        <div className="grow-stat">
          <span className="grow-stat__n">0</span>
          <span className="mono-sm">{t('grow.stat.img')}</span>
        </div>
      </div>

      <p className="grow-note reveal">{t('grow.note')}</p>
    </section>
  );
}
