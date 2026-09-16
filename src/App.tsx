import { Suspense, useEffect } from 'react';
import { useHashRoute, navigate } from './lib/useHashRoute';
import { findExperiment, type Experiment } from './experiments/registry';
import { findButton } from './buttons/registry';
import { SECTIONS, type SectionId } from './lib/sections';
import { useLang } from './lib/i18n';
import WorkInProgress from './experiments/WorkInProgress';
import { useMotionButtons } from './motion/useMotionButtons';
import SiteHeader from './shell/SiteHeader';
import SiteFooter from './shell/SiteFooter';
import Home from './home/Home';
import ButtonPage from './home/ButtonPage';

const SECTION_IDS = SECTIONS.map((s) => s.id) as string[];

/** Shown while an experiment's chunk (and three.js, for the jelly) downloads. */
function ExperimentLoading() {
  const { t } = useLang();
  return (
    <div className="exp-page">
      <div className="exp-bar">
        <span className="mono-sm" style={{ color: 'var(--accent)' }}>
          {t('loading.experiment')}
        </span>
      </div>
      <div className="lab" />
    </div>
  );
}

export default function App() {
  const route = useHashRoute();
  const { t } = useLang();
  // Wires the motion system to whatever React has just rendered.
  useMotionButtons();

  const [head, sub] = route.segs;

  // A detail page (experiment or single button) should open at the top; a tab
  // switch inside the index should not move the page at all.
  const isDetail = route.segs.length > 1;
  useEffect(() => {
    if (isDetail) window.scrollTo({ top: 0, behavior: 'auto' });
  }, [isDetail, route.slug]);

  // ----- a single button --------------------------------------------------
  if (head === 'buttons' && sub) {
    const entry = findButton(sub);
    if (entry) {
      return (
        <div className="shell" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
          <SiteHeader activeId="buttons" activeSub={entry.en} />
          <ButtonPage id={sub} />
          <SiteFooter />
        </div>
      );
    }
  }

  // ----- an experiment, under its section ---------------------------------
  if (head === 'experiments' && sub) {
    const found = findExperiment(sub);
    if (found) return <ExperimentRoute experiment={found} />;
  }

  // ----- index tabs (and the bare home) -----------------------------------
  if (!head || SECTION_IDS.includes(head)) {
    const active: SectionId = (SECTION_IDS.includes(head) ? head : 'experiments') as SectionId;
    return (
      <div className="shell">
        <SiteHeader activeId={active} />
        <Home
          active={active}
          onChange={(id) => navigate(id === 'experiments' ? '' : id)}
        />
        <SiteFooter />
      </div>
    );
  }

  // ----- old links: #/<experiment-id> -------------------------------------
  const legacy = route.segs.length === 1 ? findExperiment(head) : undefined;
  if (legacy) return <ExperimentRoute experiment={legacy} />;

  // ----- nothing matches --------------------------------------------------
  return (
    <div className="shell" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader activeId="" />
      <main style={{ flex: 1, paddingTop: '18vh' }}>
        <p className="mono" style={{ color: 'var(--accent)' }}>
          {t('nf.mono')}
        </p>
        <h1 className="display" style={{ fontSize: 'clamp(40px,9vw,120px)' }}>
          No such
          <br />
          page
        </h1>
        <p style={{ marginTop: 28 }}>
          <a
            className="back-link mo-btn mo-btn--sm mo-arrow-slide"
            href="#/"
            data-mo="arrow-slide"
            onClick={(e) => {
              e.preventDefault();
              navigate('');
            }}
          >
            <span className="mo-label">{t('nf.back')}</span>
          </a>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}

/** An experiment page: header, the experiment itself (or its WIP notice), footer. */
function ExperimentRoute({ experiment }: { experiment: Experiment }) {
  return (
    <div className="shell" style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader activeId="experiments" activeSub={experiment.title} />
      {experiment.status === 'wip' ? (
        // Never mount a half-finished experiment. The lazy import is not
        // touched here, so its chunk is not even downloaded.
        <WorkInProgress experiment={experiment} />
      ) : (
        <Suspense fallback={<ExperimentLoading />}>
          <experiment.Component />
        </Suspense>
      )}
      <SiteFooter />
    </div>
  );
}
