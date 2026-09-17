import { SECTIONS, type SectionId } from '../lib/sections';
import { useLang } from '../lib/i18n';

interface Props {
  active: SectionId;
  onChange: (id: SectionId) => void;
}

/**
 * The cards.
 *
 * A row of plain text tabs would have been the safe choice, but these things
 * are not equals — and they are not even all the same *kind*. Projects (01–03)
 * are work that was actually made; the two meta columns are about this site
 * itself. So projects carry a number and the accent, meta columns carry a dash
 * and stay a shade quieter. The one you are standing in is unmistakably the one
 * that has been lifted off the page.
 */
export default function TabDeck({ active, onChange }: Props) {
  const { lang, t } = useLang();

  return (
    <div className="tab-deck" role="tablist" aria-label={t('nav.aria')}>
      {SECTIONS.map((s) => {
        const on = s.id === active;
        const isProject = s.kind === 'project';
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={on}
            className="tab-card"
            data-on={on}
            data-kind={s.kind}
            aria-label={
              isProject ? t('card.aria', { name: s.nav }) : t('card.ariaMeta', { name: s.nav })
            }
            onClick={() => onChange(s.id)}
          >
            <span className="tab-card__top">
              <span className="tab-card__no mono">{isProject ? s.no : '—'}</span>
              <span className="tab-card__dot" aria-hidden />
            </span>

            <span className="tab-card__name">
              {s.nav}
              <span className="tab-card__cn">{s.sub[lang]}</span>
            </span>

            <span className="tab-card__lede">{s.lede[lang]}</span>

            <span className="tab-card__meta mono-sm">{s.meta[lang]}</span>
          </button>
        );
      })}
    </div>
  );
}
