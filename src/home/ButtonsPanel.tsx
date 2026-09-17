import { BUTTONS, BUTTON_GROUPS, buttonsInGroup, durOf } from '../buttons/registry';
import MotionButton from '../buttons/MotionButton';
import { navigate } from '../lib/useHashRoute';
import { findSection } from '../lib/sections';
import { useLang } from '../lib/i18n';
import { useSpotlightDelegated } from '../lib/useReveal';

/**
 * The button wall.
 *
 * Grouped rather than dumped in one row: 16 effects on one line was a smear —
 * you could not tell what any single one did, and the ones that need a second
 * look (the state machines) were invisible. Each group is a shelf with its own
 * heading; each button is a card you can open.
 */
export default function ButtonsPanel() {
  // One listener for the whole wall: a per-card ref would only ever light up
  // the first card (and previously only the first group had one at all).
  const wallRef = useSpotlightDelegated<HTMLElement>('.btn-card');
  const { t } = useLang();
  const no = findSection('buttons')?.no ?? '02';

  return (
    <section className="tabpanel" aria-labelledby="btn-h" ref={wallRef}>
      <div className="tabpanel-head reveal">
        <span className="tabpanel-head__no mono">{no}</span>
        <h2 id="btn-h">Buttons</h2>
        <hr className="rule" />
        <span className="mono-sm">{t('btn.head.meta', { n: BUTTONS.length })}</span>
      </div>

      <p className="tabpanel-lede reveal">{t('btn.lede')}</p>

      {BUTTON_GROUPS.map((group) => {
        const items = buttonsInGroup(group.id);
        if (!items.length) return null;
        return (
          <section className="btn-group reveal" key={group.id} aria-label={group.en}>
            <div className="btn-group__head">
              <h3>{group.en}</h3>
              <span className="mono-sm">{t(group.cnKey)}</span>
              <span className="btn-group__how">{t(group.howKey)}</span>
              <hr className="rule" />
              <span className="mono-sm">{String(items.length).padStart(2, '0')}</span>
            </div>

            <div className="btn-grid">
              {items.map((entry) => (
                <article className="btn-card" key={entry.id}>
                  {/* Nothing on the card navigates except the strip at the
                      bottom: the stage is for playing, and the text has to
                      stay selectable. Clicking anywhere else used to open the
                      detail page, which made copying a label impossible. */}
                  <div className="btn-card__stage">
                    <MotionButton entry={entry} />
                  </div>

                  <div className="btn-card__meta">
                    <h4>
                      {entry.en}
                      <span>{t(entry.cnKey)}</span>
                    </h4>
                    <p>{t(entry.doKey)}</p>
                  </div>

                  <div className="btn-card__tokens">
                    <span className="tag">{durOf(entry)}</span>
                    <span className="tag">{entry.ease}</span>
                    {entry.js && <span className="tag tag--js">{t('btn.needsJs')}</span>}
                  </div>

                  {/* The one click target. A soft gradient rises into it so the
                      strip reads as pressable without adding a button. */}
                  <a
                    className="btn-card__go"
                    href={`#/buttons/${entry.id}`}
                    aria-label={`${entry.en} · {t('btn.more')}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigate(`buttons/${entry.id}`);
                    }}
                  >
                    <span className="btn-card__go-no mono-sm">{entry.no}</span>
                    <span className="btn-card__go-label">
                      {t('btn.more')}
                      <span aria-hidden>→</span>
                    </span>
                  </a>
                </article>
              ))}
            </div>
          </section>
        );
      })}
    </section>
  );
}
