import type { Experiment } from './registry';
import { navigate } from '../lib/useHashRoute';
import { useLang } from '../lib/i18n';

interface Props {
  experiment: Experiment;
}

/**
 * Placeholder for an experiment whose `status` is `wip`.
 *
 * The card stays on the index so the idea is on the record, but the experiment
 * itself is never mounted — a half-working toy is worse than an honest "not
 * yet". This page therefore talks *about* the experiment; it does not try to
 * be a preview of it.
 */
export default function WorkInProgress({ experiment }: Props) {
  const { lang, t } = useLang();
  return (
    <div className="exp-page exp-page--wip">
      <div className="exp-bar">
        <span className="mono-sm">NO. {experiment.no}</span>
        <span className="exp-bar__title">{experiment.title}</span>
        <span className="mono-sm" style={{ color: 'var(--accent)' }}>
          {t('exp.notOpen')}
        </span>
        <span className="exp-bar__spacer" />
        <a
          className="mo-btn mo-btn--sm mo-btn--ghost mo-arrow-slide"
          href="#/"
          data-mo="arrow-slide"
          onClick={(e) => {
            e.preventDefault();
            navigate('');
          }}
        >
          <span className="mo-label">{t('ui.back')}</span>
        </a>
      </div>

      <div className="wip">
        <div className="wip__inner">
          <span className="wip__mark" aria-hidden>
            <span className="wip__blink" />
          </span>

          <p className="wip__kicker mono-sm">{t('wip.kicker')}</p>

          <h1 className="display wip__title">{experiment.title}</h1>
          <p className="wip__sub">{experiment.sub[lang]}</p>

          <p className="wip__lede">{experiment.lede[lang]}</p>

          {experiment.wipNote && <p className="wip__note">{experiment.wipNote[lang]}</p>}

          {experiment.wipMissing && experiment.wipMissing[lang].length > 0 && (
            <ul className="wip__todo">
              {experiment.wipMissing[lang].map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}

          <div className="wip__actions">
            <button
              className="mo-btn mo-btn--ghost mo-fill-sweep"
              type="button"
              data-mo="fill-sweep"
              onClick={() => navigate('')}
            >
              <span className="mo-label">{t('ui.elsewhere')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
