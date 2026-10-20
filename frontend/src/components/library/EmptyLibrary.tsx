import { AudioLines, MousePointerClick, Play, Upload } from 'lucide-react';
import { t } from '../../i18n';

/** First run: one big drop target, the demo, and three short tips. */
export function EmptyLibrary({ onPick, onDemo }: { onPick: () => void; onDemo: () => void }) {
  return (
    <section className="empty-library">
      <button className="dropzone" onClick={onPick}>
        <span className="dropzone-icon"><Upload size={26} /></span>
        <b>{t('empty.dropTitle')}</b>
        <span>{t('empty.dropBody')}</span>
        <small>{t('empty.formats')}</small>
      </button>
      <div className="empty-side">
        <h2>{t('empty.newHere')}</h2>
        <p>{t('empty.demoBody')}</p>
        <button className="btn btn-primary" onClick={onDemo}><Play size={14} fill="currentColor" /> {t('empty.demo')}</button>
        <ul className="tips">
          <li><AudioLines size={16} /><span><b>{t('empty.tip1Title')}</b>{t('empty.tip1Body')}</span></li>
          <li><MousePointerClick size={16} /><span><b>{t('empty.tip2Title')}</b>{t('empty.tip2Body')}</span></li>
          <li><kbd>?</kbd><span><b>{t('empty.tip3Title')}</b>{t('empty.tip3Body')}</span></li>
        </ul>
      </div>
    </section>
  );
}
