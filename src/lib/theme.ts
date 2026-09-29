/**
 * The theme store — light / dark, and nothing else.
 *
 * Deliberately shaped like `i18n.ts`: a module-level current value, a
 * subscriber set, and a hook. That symmetry is the point. A theme switch that
 * lives somewhere else (`useState` in the header, a `data-theme` attribute
 * poked from three components) drifts out of sync with the language switch
 * within a week, and then the site has two half-working settings.
 *
 * The three states, and why there are three:
 *   light / dark — the user picked.
 *   system       — follow the OS. This is the *default* on a first visit,
 *                  because a phone that is in night mode at 23:00 should not
 *                  be shown a white page just because it never saved a choice.
 */
import { useCallback, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'softlab:theme';

/* What `system` currently resolves to. The switch shows this, because a label
   reading "系统" tells you nothing about what you are actually looking at. */
export type Resolved = 'light' | 'dark';

function read(): Theme {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
  } catch {
    /* storage disabled — fall through to the default */
  }
  return 'system';
}

let current: Theme = read();
const listeners = new Set<() => void>();

const systemDark = typeof window !== 'undefined'
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

function resolve(t: Theme): Resolved {
  if (t !== 'system') return t;
  return systemDark?.matches ? 'dark' : 'light';
}

function apply(t: Theme): void {
  if (typeof document === 'undefined') return;
  const r = resolve(t);
  const root = document.documentElement;
  /* `system` writes `data-scheme` only. The dark rules are
     `[data-theme='dark']` plus, separately, `[data-scheme='dark']` — so a
     visitor in "system" still gets the dark palette, while an explicit
     `data-theme="light"` on a night-mode phone does not. Two attributes
     rather than one because "which one did I pick" and "what is showing" are
     different questions, and the CSS needs the second one. */
  if (t === 'system') {
    root.dataset.scheme = r;
    delete root.dataset.theme;
  } else {
    root.dataset.theme = t;
    root.dataset.scheme = r;
  }
  // The attribute is what the CSS keys off. The media query alone is not
  // enough: it cannot express "the user chose light on a dark-mode phone",
  // which is the whole reason a switch exists.
  root.style.colorScheme = r;
  // Keeps the iOS / Chrome address bar in step with the page. The meta tags
  // cover the first paint; this covers every change after it.
  for (const m of document.querySelectorAll('meta[name="theme-color"]')) {
    m.setAttribute('content', r === 'dark' ? '#0b0e14' : '#f5f7fa');
  }
  // After the attributes are set, so a listener that reads
  // `documentElement.dataset` sees the new value, not the old one.
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: { theme: t, resolved: r } }));
}

apply(current);

/**
 * A DOM event for things CSS cannot reach — chiefly the WebGL / three.js
 * scenes, which paint the page background from a shader and have to be told
 * when the effective theme changed.
 *
 * A `CustomEvent` rather than a React subscription on purpose: those canvases
 * live outside React's tree (one is a raw WebGL loop, one is an engine
 * handle) and re-rendering the app to repaint a canvas would be absurd.
 * Fired for *any* change including the OS flipping in system mode.
 */
export const THEME_EVENT = 'softlab:theme';

export function onThemeChange(fn: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener(THEME_EVENT, fn);
  return () => window.removeEventListener(THEME_EVENT, fn);
}

export function getTheme(): Theme {
  return current;
}

export function getResolved(): Resolved {
  return resolve(current);
}

export function setTheme(t: Theme): void {
  if (t === current) return;
  current = t;
  try {
    if (t === 'system') window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* in-memory only; still works for this session */
  }
  apply(t);
  for (const fn of listeners) fn();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  // Only meaningful while the choice is "system", but registering always is
  // simpler and the handler is a no-op otherwise.
  const onSystem = () => {
    if (current === 'system') {
      apply(current);
      for (const f of listeners) f();
    }
  };
  systemDark?.addEventListener('change', onSystem);
  return () => {
    listeners.delete(fn);
    systemDark?.removeEventListener('change', onSystem);
  };
}

export function useTheme(): {
  theme: Theme;
  resolved: Resolved;
  setTheme: (t: Theme) => void;
} {
  const theme = useSyncExternalStore(subscribe, getTheme, getTheme);
  const resolved = useSyncExternalStore(subscribe, getResolved, getResolved);
  const set = useCallback((t: Theme) => setTheme(t), []);
  return { theme, resolved, setTheme: set };
}
