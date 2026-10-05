import { findSection } from '../lib/sections';
import { useLang } from '../lib/i18n';
import { DESTROY_ANY_URL, DESTROY_SELF_URL } from '../lib/destroy';

/**
 * Project 03 — the demolition toy.
 *
 * We did not build this one. It belongs to Hugo Duprez / Sprite Fusion and it
 * plays on its own origin, so this panel is an honest front door rather than an
 * experiment: what it is, what it does (and does not do) to a page, and the two
 * ways in — one that loads *this* site as the level, one plain door for
 * anything else.
 */

export default function DestroyPanel() {
  const { t } = useLang();
  const no = findSection('destroy')?.no ?? '03';

  const STEPS = [
    { n: 'I', t: t('destroy.step1.t'), d: t('destroy.step1.d') },
    { n: 'II', t: t('destroy.step2.t'), d: t('destroy.step2.d') },
    { n: 'III', t: t('destroy.step3.t'), d: t('destroy.step3.d') },
  ];

  return (
    <section className="tabpanel" aria-labelledby="destroy-h">
      <div className="tabpanel-head reveal">
        <span className="tabpanel-head__no mono">{no}</span>
        <h2 id="destroy-h">Destroy</h2>
        <hr className="rule" />
        <span className="mono-sm">{t('destroy.head.meta')}</span>
      </div>

      <p className="tabpanel-lede reveal">{t('destroy.lede')}</p>

      <div className="intake reveal">
        {STEPS.map((s) => (
          <article className="intake__step" key={s.n}>
            <span className="mono" style={{ color: 'var(--accent)' }}>
              {s.n}
            </span>
            <h3>{s.t}</h3>
            <p>{s.d}</p>
          </article>
        ))}
      </div>

      {/* The way out. A hairline above keeps it from looking pasted onto the
          grid. The game's author is credited in the changelog and in
          `lib/destroy.ts` rather than here — a name next to our own page reads
          as *our* author, which is exactly the wrong idea. */}
      <div className="destroy-foot reveal">
        <div className="destroy-cta">
          {/* The one real button, and it names this site as the level. */}
          <a className="destroy-go" href={DESTROY_SELF_URL} target="_blank" rel="noreferrer">
            <span>{t('destroy.start')}</span>
            <span aria-hidden>↗</span>
          </a>

          {/* The quiet way out, for anyone who would rather take apart something
              else. Plain text on purpose: a second capsule next to the real
              button reads as two buttons of mismatched size. */}
          <a className="destroy-alt" href={DESTROY_ANY_URL} target="_blank" rel="noreferrer">
            {t('destroy.other')} <span aria-hidden>↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}
