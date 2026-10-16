import { useLang } from '../../lib/i18n';
import { findExperiment } from '../registry';
import { SuperMona } from './SuperMona.jsx';
import './mona.css';

/**
 * 独立项目的线上地址。
 * 跨站链接没法像站内那样运行时取 origin，只能写死 —— 但集中在这一处，
 * 换域名或换 Pages 项目只改这一行。
 */
const PROJECT_URL = 'https://super-mona.pages.dev';

/**
 * SuperMona —— githubuniverse.com 首屏方阵里藏的那台跑酷机。
 *
 * 页面本身由原站组件的 1:1 复刻驱动（`SuperMona.jsx` + `game/` 下 19 个模块，
 * 素材是原站原始文件）。这里只补两层：
 *
 *   ① 本站的实验外壳（`.exp-page` / `.exp-bar`），和别的实验保持一致；
 *   ② `.mona-scope` —— 把原站的 design token 与自托管字体圈在这一层里，不往
 *      `:root` 上写，免得和本站自己的变量打架（见 mona.css）。
 *
 * 待机时移动鼠标，网格里的 Mona 会转头看你；点 Play 之后才切到跑酷。
 * 两个场景共用同一块 canvas，所以这里不需要额外的高度约束 —— Wrapper 自带
 * `aspect-ratio: 94/26`，高度是算出来的。
 */
export default function SuperMonaLab() {
  const { lang, t } = useLang();

  /* 复刻组件默认用的是原站的英文文案（`Play` / `Exit game` / `Play again`），
     中文站点下按当前语言覆盖。埋点串不跟着翻。 */
  const labels =
    lang === 'zh'
      ? {
          playGame: t('mona.btn.play'),
          exitGame: t('mona.btn.exit'),
          playAgain: t('mona.btn.again'),
        }
      : undefined;

  return (
    <div className="exp-page mona-scope">
      <div className="exp-bar">
        <span className="mono-sm">NO. {findExperiment('super-mona')?.no ?? '04'}</span>
        <span className="exp-bar__title">{t('mona.title')}</span>
        <span className="mono-sm" style={{ color: 'var(--accent)' }}>
          {t('mona.bar.note')}
        </span>
        <span className="exp-bar__spacer" />
        <a className="mo-btn mo-btn--sm mo-btn--ghost mo-arrow-slide" href="#/" data-mo="arrow-slide">
          <span className="mo-label">{t('mona.back')}</span>
        </a>
      </div>

      {/* 竖屏提示由组件自己盖在画布上（`.rotateHint`）—— 放在这里会连整块实验区
          一起盖住，而实验页在竖屏下有很多空白，一进来就是一大片白。 */}
      <div className="lab lab--mona">
        <SuperMona labels={labels} portraitHint={t('mona.rotate')} />
      </div>

      {/* 项目联动：这里只是「能玩」的一小块，完整的那个项目单开了一站 ——
          里面有官网拆解、精灵图逐帧解剖、鼠标拖尾复刻三页。 */}
      <p className="mona-more">
        <a className="mona-more__link" href={PROJECT_URL} target="_blank" rel="noreferrer noopener">
          {t('mona.more')}
          <span aria-hidden="true"> →</span>
        </a>
        <span className="mona-more__note">{t('mona.moreNote')}</span>
      </p>
    </div>
  );
}
