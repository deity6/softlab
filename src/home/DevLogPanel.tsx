import { ENTRIES, VERSION } from '../lib/changelog';
import { findSection } from '../lib/sections';
import { useLang } from '../lib/i18n';

/**
 * The dev log. Every change, newest first, each with its version number.
 *
 * Version rule: patch bumps on every change, minor only when the user asks for
 * one, major at the official release. See `src/lib/changelog.ts`.
 */
export default function DevLogPanel() {
  const { t } = useLang();
  // A meta column, not a project: it carries a dash where the numbers go.
  const no = findSection('log')?.no ?? '—';

  return (
    <section className="tabpanel" aria-labelledby="log-h">
      <div className="tabpanel-head reveal">
        <span className="tabpanel-head__no mono" data-kind="meta">
          {no}
        </span>
        <h2 id="log-h">Dev log</h2>
        <hr className="rule" />
        <span className="mono-sm">{t('log.head.meta', { v: VERSION, n: ENTRIES.length })}</span>
      </div>

      <p className="tabpanel-lede reveal">{t('log.lede')}</p>

      <ol className="log-list">
        {ENTRIES.map((entry, i) => (
          <li className="log-entry reveal" key={entry.version} data-latest={i === 0}>
            <div className="log-entry__side">
              <span className="log-entry__ver">{entry.version}</span>
              <span className="mono-sm">{entry.date}</span>
              {i === 0 && <span className="log-entry__now mono-sm">最新</span>}
            </div>

            <div className="log-entry__body">
              <h3>{entry.title}</h3>
              <ul>
                {entry.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
