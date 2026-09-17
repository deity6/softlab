import { EXPERIMENTS } from '../experiments/registry';
import { BUTTONS } from '../buttons/registry';
import type { SectionId } from '../lib/sections';
import { useReveal } from '../lib/useReveal';
import { useLang } from '../lib/i18n';
import HeroField from '../shell/HeroField';
import HeroOrb from '../shell/HeroOrb';
import ElasticText from '../shell/ElasticText';
import TabDeck from './TabDeck';
import ExperimentsPanel from './ExperimentsPanel';
import ButtonsPanel from './ButtonsPanel';
import DestroyPanel from './DestroyPanel';
import GrowthPanel from './GrowthPanel';
import DevLogPanel from './DevLogPanel';

interface Props {
  active: SectionId;
  onChange: (id: SectionId) => void;
}

/**
 * The index. A hero, then the cards, then whichever panel the cards point at.
 * Switching cards remounts the panel (the `key`) so the entrance animation
 * replays and nothing stale is left on screen.
 *
 * The reveal observer lives here rather than in each panel so that it re-binds
 * to the freshly mounted nodes every time the tab changes — a panel that swaps
 * in below the fold would otherwise stay at opacity 0 forever.
 */
export default function Home({ active, onChange }: Props) {
  const rootRef = useReveal<HTMLElement>([active]);
  const { t } = useLang();

  return (
    <main ref={rootRef}>
      <section className="hero">
        <HeroField />
        <HeroOrb />
        <div className="hero__inner">
          <div className="hero__kicker">
            <span className="mono">{t('hero.kicker.est')}</span>
            <hr className="rule" />
            <span className="mono-sm">{t('hero.kicker.note')}</span>
          </div>

          <h1 className="display hero__title">
            <ElasticText text="SOFT LAB." accentFrom={5} push={56} radius={360} />
          </h1>

          <div className="hero__lower">
            <p className="hero__lede">
              {t('hero.lede.a')}
              <b>{t('hero.lede.hi')}</b>
              {t('hero.lede.b')}
            </p>

            <dl className="hero__meta">
              <dt className="mono-sm">{t('hero.meta.since')}</dt>
              <dd>2026 / 09</dd>
              <dt className="mono-sm">{t('hero.meta.experiments')}</dt>
              <dd>{t('hero.meta.count', { n: EXPERIMENTS.length })}</dd>
              <dt className="mono-sm">{t('hero.meta.buttons')}</dt>
              <dd>{t('hero.meta.count', { n: BUTTONS.length })}</dd>
              <dt className="mono-sm">{t('hero.meta.status')}</dt>
              <dd style={{ color: 'var(--accent)' }}>{t('hero.meta.statusValue')}</dd>
            </dl>
          </div>
        </div>
      </section>

      <TabDeck active={active} onChange={onChange} />

      <div className="panel-swap" key={active} data-panel={active}>
        {active === 'experiments' && <ExperimentsPanel />}
        {active === 'buttons' && <ButtonsPanel />}
        {active === 'destroy' && <DestroyPanel />}
        {active === 'growth' && <GrowthPanel />}
        {active === 'log' && <DevLogPanel />}
      </div>
    </main>
  );
}
