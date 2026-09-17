import { EXPERIMENTS } from '../experiments/registry';
import { navigate } from '../lib/useHashRoute';
import { findSection } from '../lib/sections';
import { useLang } from '../lib/i18n';
import ThumbCanvas from '../home/ThumbCanvas';
import { useSpotlightDelegated } from '../lib/useReveal';

/**
 * The experiment index. Same cards as before, but each one now carries a
 * cursor-following light. The light is written by one delegated listener on
 * the grid — a per-card ref could only ever point at a single card, so only
 * that one would have lit up.
 */
export default function ExperimentsPanel() {
  const gridRef = useSpotlightDelegated<HTMLDivElement>('.ex-card');
  const { lang, t } = useLang();
  const no = findSection('experiments')?.no ?? '01';

  return (
    <section className="tabpanel" aria-labelledby="exp-h">
      <div className="tabpanel-head reveal">
        <span className="tabpanel-head__no mono">{no}</span>
        <h2 id="exp-h">Experiments</h2>
        <hr className="rule" />
        <span className="mono-sm">
          {t('exp.head.meta', { n: String(EXPERIMENTS.length).padStart(2, '0') })}
        </span>
      </div>

      <div className="index-grid reveal" ref={gridRef}>
        {EXPERIMENTS.map((exp) => {
          const wip = exp.status === 'wip';
          return (
            <a
              key={exp.id}
              className="ex-card"
              href={`#/experiments/${exp.id}`}
              data-wip={wip}
              aria-label={wip ? `${exp.title} · ${t('exp.notOpen')}` : `${exp.title} · ${t('exp.openAria')}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(`experiments/${exp.id}`);
              }}
            >
              <span className="ex-card__glow" aria-hidden />

              <div className="ex-card__top">
                <span className="ex-card__no">NO. {exp.no}</span>
                <span className="mono-sm">{exp.collected[lang]}</span>
              </div>

              <div className="ex-card__thumb">
                <ThumbCanvas kind={exp.thumb} />
                {wip && <span className="ex-card__flag">{t('exp.wipFlag')}</span>}
              </div>

              <h3 className="ex-card__title">
                {exp.title}
                <br />
                <span className="ex-card__sub">{exp.sub[lang]}</span>
              </h3>

              <p className="ex-card__lede">{exp.lede[lang]}</p>

              <div className="ex-card__tags">
                {exp.tags[lang].map((tag) => (
                  <span className="tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>

              <span className="ex-card__go">{t(wip ? 'exp.wipGo' : 'exp.openGo')}</span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
