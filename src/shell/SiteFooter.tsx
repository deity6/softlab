import { EXPERIMENTS } from '../experiments/registry';
import { VERSION } from '../lib/changelog';
import { navigate } from '../lib/useHashRoute';
import { useLang } from '../lib/i18n';

export default function SiteFooter() {
  const { t } = useLang();

  return (
    <footer className="site-foot">
      <span className="mono">Soft Lab</span>
      <span className="mono-sm">{t('foot.experiments', { n: EXPERIMENTS.length })}</span>
      <span className="mono-sm">{t('foot.log', { v: VERSION })}</span>
      <span className="spacer" />

      <a
        className="site-foot__log mono-sm"
        href="#/log"
        onClick={(e) => {
          e.preventDefault();
          navigate('log');
        }}
      >
        {t('foot.changelog')}
      </a>

      <a
        className="site-foot__star mono-sm"
        href="https://github.com/deity6/softlab"
        target="_blank"
        rel="noreferrer"
      >
        {t('foot.star')}
      </a>

      <span className="mono-sm">{t('foot.credit')}</span>
    </footer>
  );
}
