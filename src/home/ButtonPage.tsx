import { useEffect, useRef } from 'react';
import { BUTTONS, findButton, durOf } from '../buttons/registry';
import MotionButton from '../buttons/MotionButton';
import { navigate } from '../lib/useHashRoute';
import { useLang } from '../lib/i18n';

/** The snippet someone would paste to get this button. */
function snippet(id: string, label: string, next?: string, click?: string): string {
  const attrs = [`class="mo-btn mo-btn--sm mo-${id}"`, `data-mo="${id}"`];
  if (next) attrs.push(`data-mo-next="${next}"`);
  if (click) attrs.push(`data-mo-click="${click}"`);
  return `<button\n  ${attrs.join('\n  ')}\n>\n  ${label}\n</button>`;
}

interface Props {
  id: string;
}

/**
 * One button, up close: a big stage you can play with, what it does, how it
 * works, which timing tokens it spends, and the markup to reproduce it.
 */
export default function ButtonPage({ id }: Props) {
  const { t } = useLang();
  const entry = findButton(id);
  if (!entry) return null;

  const index = BUTTONS.findIndex((b) => b.id === id);
  const prev = BUTTONS[(index - 1 + BUTTONS.length) % BUTTONS.length];
  const next = BUTTONS[(index + 1) % BUTTONS.length];

  // Which way the card should slide: hopping "next" enters from the right,
  // "prev" from the left, so flipping through the shelf reads as a carousel.
  const lastIndex = useRef(index);
  const dir = index >= lastIndex.current ? 'next' : 'prev';
  useEffect(() => {
    lastIndex.current = index;
  }, [index]);

  return (
    <div className="exp-page btn-page">
      <div className="exp-bar">
        <span className="mono-sm">{entry.no}</span>
        <span className="exp-bar__title">Buttons</span>
        <span className="mono-sm" style={{ color: 'var(--accent)' }}>
          {t(entry.cnKey)}
        </span>
        <span className="exp-bar__spacer" />
        <a
          className="back-link"
          href="#/buttons"
          onClick={(e) => {
            e.preventDefault();
            navigate('buttons');
          }}
        >
          ← {t('bp.back')}
        </a>
      </div>

      {/* key={id} replays the entrance on every hop, so switching reads as a
          swap rather than a content patch. Only the CONTENT animates — the nav
          below never moves, otherwise a quick second click lands on a button
          that is still sliding and does nothing. */}
      <div className="btn-detail" key={id} data-dir={dir}>
        <div className="btn-detail__stage">
          <span className="btn-detail__hint mono-sm">{t('bp.hint')}</span>
          <MotionButton entry={entry} size="lg" />
        </div>

        <div className="btn-detail__side">
          <h1 className="btn-detail__title">
            {t(entry.cnKey)}
            <span>{entry.en}</span>
          </h1>

          <dl className="btn-detail__facts">
            <div>
              <dt className="mono-sm">{t('bp.play')}</dt>
              <dd>{t(entry.doKey)}</dd>
            </div>
            <div>
              <dt className="mono-sm">{t('bp.how')}</dt>
              <dd>{t(entry.howKey)}</dd>
            </div>
          </dl>

          <div className="btn-detail__tokens">
            <span className="tag">{durOf(entry)}</span>
            <span className="tag">{entry.ease}</span>
            {entry.js && <span className="tag tag--js">需 JS 行为层</span>}
          </div>

          <pre className="btn-detail__code">
            <code>{snippet(entry.id, entry.label, entry.next, entry.click)}</code>
          </pre>
        </div>
      </div>

      {/* No key here on purpose: the nav must stay put and stay clickable, so
          you can step through several buttons quickly without the target
          sliding out from under the cursor. */}
      <nav className="btn-detail__nav" aria-label="其他按钮">
        <a
          className="btn-detail__step"
          href={`#/buttons/${prev.id}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`buttons/${prev.id}`);
          }}
        >
          <span className="mono-sm">← {t('bp.prev')}</span>
          <b>{prev.en}</b>
        </a>
        <a
          className="btn-detail__step btn-detail__step--next"
          href={`#/buttons/${next.id}`}
          onClick={(e) => {
            e.preventDefault();
            navigate(`buttons/${next.id}`);
          }}
        >
          <span className="mono-sm">{t('bp.next')} →</span>
          <b>{next.en}</b>
        </a>
      </nav>
    </div>
  );
}
