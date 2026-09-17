import { useEffect } from 'react';

interface MotionApi {
  init(root?: ParentNode): unknown;
  effects: string[];
}

declare global {
  interface Window {
    MotionButtons?: MotionApi;
  }
}

/**
 * Bridges the drop-in motion system (a plain IIFE that scans the DOM once on
 * load) to React, which renders nodes long after that initial scan. New nodes
 * are picked up through a MutationObserver, but only when the added subtree
 * actually contains something the system cares about — the system injects its
 * own helper nodes, and reacting to those would loop.
 */
export function useMotionButtons(): void {
  useEffect(() => {
    const api = window.MotionButtons;
    if (!api) return;

    let queued = 0;
    const run = () => {
      queued = 0;
      api.init(document);
    };
    const schedule = () => {
      if (queued) return;
      queued = requestAnimationFrame(run);
    };

    schedule();

    const observer = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of Array.from(record.addedNodes)) {
          if (node.nodeType !== 1) continue;
          const el = node as Element;
          if (el.matches('[data-mo], .mo-btn')) return schedule();
          if (el.querySelector?.('[data-mo], .mo-btn')) return schedule();
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      if (queued) cancelAnimationFrame(queued);
    };
  }, []);
}
