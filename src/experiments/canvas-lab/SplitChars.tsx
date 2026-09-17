import type { ReactNode } from 'react';

const CJK = /[\u2e80-\u9fff\u3000-\u303f\uff00-\uffef]/;

/**
 * Wraps every glyph in its own inline-block span with `data-ch`, so effects can
 * address characters individually. Latin runs stay inside a nowrap wrapper so
 * words never break mid-way; CJK breaks per glyph, as it should.
 *
 * The DOM stays real text: still selectable, still searchable, still accessible
 * via the aria-label on the parent.
 */
export default function SplitChars({ text }: { text: string }) {
  const tokens = text.split(/(\s+)/);
  const out: ReactNode[] = [];

  tokens.forEach((token, ti) => {
    if (!token) return;

    if (/^\s+$/.test(token)) {
      out.push(
        <span key={`sp-${ti}`} style={{ whiteSpace: 'pre-wrap' }}>
          {token}
        </span>,
      );
      return;
    }

    if (CJK.test(token)) {
      Array.from(token).forEach((ch, ci) => {
        out.push(
          <span key={`cjk-${ti}-${ci}`} data-ch style={{ display: 'inline-block' }}>
            {ch}
          </span>,
        );
      });
      return;
    }

    out.push(
      <span key={`word-${ti}`} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
        {Array.from(token).map((ch, ci) => (
          <span key={ci} data-ch style={{ display: 'inline-block' }}>
            {ch}
          </span>
        ))}
      </span>,
    );
  });

  return <>{out}</>;
}
