import { SECTIONS, type SectionId } from '../lib/sections';
import { navigate } from '../lib/useHashRoute';
import { useLang } from '../lib/i18n';
import { useTheme, type Theme } from '../lib/theme';

interface Props {
  /** which section the current route belongs to, "" when none */
  activeId: SectionId | '';
  /** the experiment or button currently open, if any */
  activeSub?: string;
}

/**
 * Header. The nav is plain text labels, not pills — the reference site uses
 * quiet type in the bar and lets the cards do the shouting. An active label
 * gets a dot and full ink; nothing else moves.
 *
 * The language switch sits after the nav and is deliberately the smallest thing
 * in the bar: it is a setting, not a destination.
 */
/**
 * Three glyphs, drawn rather than typed. `system` is a half-filled circle:
 * the left half is the light palette, the right the dark, which is literally
 * what "follow the OS" means. `aria-hidden` because the button's `title` and
 * `aria-label` already carry the name — a screen reader should hear "深色",
 * not "a picture of a moon".
 */
function ThemeGlyph({ kind }: { kind: Theme }) {
  if (kind === 'light') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden focusable="false">
        <circle cx="8" cy="8" r="3.1" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
          <path d="M8 1.4v1.9M8 12.7v1.9M1.4 8h1.9M12.7 8h1.9" />
          <path d="M3.3 3.3l1.35 1.35M11.35 11.35l1.35 1.35M12.7 3.3l-1.35 1.35M4.65 11.35L3.3 12.7" />
        </g>
      </svg>
    );
  }
  if (kind === 'dark') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden focusable="false">
        {/* A crescent, cut with a second circle rather than a path, so the
            lit edge stays a clean arc at any size. */}
        <path
          d="M13 9.6A5.6 5.6 0 0 1 6.4 3 5.6 5.6 0 1 0 13 9.6Z"
          fill="currentColor"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden focusable="false">
      <circle cx="8" cy="8" r="5.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      {/* The filled half is the "system" idea: whichever side the OS is on. */}
      <path d="M8 2.6a5.4 5.4 0 0 0 0 10.8Z" fill="currentColor" />
    </svg>
  );
}

export default function SiteHeader({ activeId, activeSub }: Props) {
  const { lang, setLang, t } = useLang();
  const { theme, setTheme } = useTheme();

  return (
    <header className="site-head">
      <div className="site-head__row">
        <a
          className="brand"
          href="#/"
          onClick={(e) => {
            e.preventDefault();
            navigate('');
          }}
        >
          <span className="brand__mark">Soft Lab</span>
          <span className="brand__dot" aria-hidden />
          <span className="mono-sm brand__tag">{t('brand.tag')}</span>
        </a>

        <nav className="site-nav" aria-label={t('nav.aria')}>
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              className="nav-tab"
              href={`#/${s.path}`}
              data-active={activeId === s.id}
              data-kind={s.kind}
              onClick={(e) => {
                e.preventDefault();
                navigate(s.path);
              }}
            >
              <span className="nav-tab__dot" aria-hidden />
              <span className="nav-tab__en">{s.nav}</span>
              <span className="nav-tab__short" aria-hidden>
                {s.short}
              </span>
              <span className="nav-tab__cn">{s.sub[lang]}</span>
              {activeId === s.id && activeSub && (
                <span className="nav-tab__sub mono-sm">{activeSub}</span>
              )}
            </a>
          ))}
        </nav>

        {/* Theme sits next to language and is built exactly like it: a
            module-level store in `lib/theme.ts`, a three-way group, and the
            same "a setting, not a destination" scale. Sharing the component
            with the language switch is not laziness — a visitor who learns
            where one setting lives should not have to look for the other.
            Glyphs, not words: 中/EN are language *names*, but a theme is a
            picture of the thing itself, and a sun/moon is readable in both
            languages without a label. */}
        <div className="theme-switch" role="group" aria-label={t('theme.switch')}>
          <button
            type="button"
            className="theme-switch__opt"
            data-on={theme === 'light'}
            aria-pressed={theme === 'light'}
            title={t('theme.light')}
            onClick={() => setTheme('light')}
          >
            <ThemeGlyph kind="light" />
          </button>
          <button
            type="button"
            className="theme-switch__opt"
            data-on={theme === 'system'}
            aria-pressed={theme === 'system'}
            title={t('theme.system')}
            onClick={() => setTheme('system')}
          >
            <ThemeGlyph kind="system" />
          </button>
          <button
            type="button"
            className="theme-switch__opt"
            data-on={theme === 'dark'}
            aria-pressed={theme === 'dark'}
            title={t('theme.dark')}
            onClick={() => setTheme('dark')}
          >
            <ThemeGlyph kind="dark" />
          </button>
        </div>

        <div className="lang-switch" role="group" aria-label={t('lang.switch')}>
          <button
            type="button"
            className="lang-switch__opt"
            data-on={lang === 'zh'}
            aria-pressed={lang === 'zh'}
            title={t('lang.zh')}
            onClick={() => setLang('zh')}
          >
            中
          </button>
          <span className="lang-switch__sep" aria-hidden>
            /
          </span>
          <button
            type="button"
            className="lang-switch__opt"
            data-on={lang === 'en'}
            aria-pressed={lang === 'en'}
            title={t('lang.en')}
            onClick={() => setLang('en')}
          >
            EN
          </button>
        </div>
      </div>
    </header>
  );
}
