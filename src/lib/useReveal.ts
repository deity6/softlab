import { useEffect, useRef } from 'react';

/**
 * Reveal on scroll — lifted straight from the reference site's behaviour and
 * kept deliberately dumb: one observer, threshold 0.15, a 40px bottom margin so
 * things settle slightly *after* they are fully in view, and unobserve on fire.
 * Elements marked `.reveal` slide up 30px into place.
 */
export function useReveal<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      host.querySelectorAll('.reveal').forEach((el) => el.classList.add('active'));
      return;
    }

    const io = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('active');
            observer.unobserve(entry.target);
          }
        });
      },
      { root: null, threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
    );

    const targets = host.querySelectorAll('.reveal');
    targets.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return ref;
}

/**
 * Writes the pointer position into `--mx / --my` on the element, as pixels.
 * Pair with a `radial-gradient(... at var(--mx) var(--my))` overlay to get the
 * light that follows the cursor across a card.
 */
export function useSpotlight<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    el.addEventListener('pointermove', onMove, { passive: true });
    return () => el.removeEventListener('pointermove', onMove);
  }, []);

  return ref;
}

/**
 * Delegated version of `useSpotlight` for a container holding many cards.
 *
 * One listener on the container, and the variables are written to whichever
 * descendant the pointer is actually over. The per-card version cannot be used
 * on a grid of cards — a ref can only point at one node, so only the first card
 * (or the first group) would ever light up.
 */
export function useSpotlightDelegated<T extends HTMLElement>(selector: string) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host) return;

    const onMove = (e: PointerEvent) => {
      const target = e.target as Element | null;
      const card = target?.closest?.(selector) as HTMLElement | null;
      if (!card || !host.contains(card)) return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    host.addEventListener('pointermove', onMove, { passive: true });
    return () => host.removeEventListener('pointermove', onMove);
  }, [selector]);

  return ref;
}
