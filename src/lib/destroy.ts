/**
 * Project 03's two doors.
 *
 * The game reads `?url=<address>` — that is its own share format, and it starts
 * fetching the address immediately (its `j8()` handler). `?from=badge` is a
 * different, weaker thing: it infers the target from `document.referrer`, which
 * a `rel="noreferrer"` link wipes out. So we never rely on it — a link from
 * this site always names its target explicitly.
 */
export const GAME_ORIGIN = 'https://destroy.spritefusion.com';

/**
 * This site, as the game will see it.
 *
 * Resolved from `location` at call time rather than hard-coded: a fork, a
 * preview deployment or a self-hosted copy then points at *itself* instead of
 * sending its visitors to somebody else's instance.
 */
export function siteUrl(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

/** Straight in, with this site already loaded as the level. */
export function destroySelfUrl(): string {
  return `${GAME_ORIGIN}/?url=${encodeURIComponent(siteUrl())}`;
}

/** The plain front door — for smashing somebody else's site. */
export const DESTROY_ANY_URL = `${GAME_ORIGIN}/`;

/* The game is by Hugo Duprez (Sprite Fusion) — https://www.spritefusion.com.
   That credit lives here and in the changelog rather than on the panel: a name
   sitting next to our own page reads as *our* author, which is the wrong idea. */
