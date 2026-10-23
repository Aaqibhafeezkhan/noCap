import { ArrowLeft, ArrowRight, Play, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useDialog } from '../../hooks/useDialog';
import { AUDIO_ACCEPT } from '../../hooks/useFileDrop';
import { t, type I18nKey } from '../../i18n';
import { OnboardingArt, type ArtKind } from './OnboardingArt';

const STEPS: Array<{ art: ArtKind; title: I18nKey; body: I18nKey; note?: I18nKey }> = [
  { art: 'welcome', title: 'intro.welcomeTitle', body: 'intro.welcomeBody', note: 'intro.welcomeNote' },
  { art: 'grid', title: 'intro.gridTitle', body: 'intro.gridBody' },
  { art: 'rhyme', title: 'intro.rhymeTitle', body: 'intro.rhymeBody' },
  { art: 'screens', title: 'intro.screensTitle', body: 'intro.screensBody', note: 'intro.screensKeys' },
  { art: 'ready', title: 'intro.readyTitle', body: 'intro.readyBody' },
];

/** A short welcome for first-time users: what noCap does and how to read it, ending
 *  with the demo or the user's own track. */
export function OnboardingDialog({ onClose, onDemo, onAnalyze }: {
  onClose: () => void;
  onDemo: () => void;
  onAnalyze: (file: File) => void;
}) {
  const ref = useDialog(onClose);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const last = index === STEPS.length - 1;

  // The Next button disappears on the last step; keep focus inside so arrow keys still work.
  useEffect(() => {
    if (!ref.current?.contains(document.activeElement)) ref.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus();
  }, [index, ref]);

  function go(next: number) {
    setIndex(Math.max(0, Math.min(STEPS.length - 1, next)));
  }

  function onKey(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement) return;
    if (event.key === 'ArrowRight') go(index + 1);
    else if (event.key === 'ArrowLeft') go(index - 1);
    else return;
    event.preventDefault();
  }

  function pick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    onClose();
    onAnalyze(file);
  }

  return (
    <div className="modal-backdrop" role="presentation" onPointerDown={(event) => event.target === event.currentTarget && onClose()}>
      <section ref={ref} className="modal intro" role="dialog" aria-modal="true" aria-labelledby="intro-title" aria-describedby="intro-body" onKeyDown={onKey}>
        <button className="icon-btn intro-close" onClick={onClose} aria-label={t('intro.close')}><X size={16} /></button>
        <div className="intro-stage" key={index}>
          <OnboardingArt kind={step.art} />
          <p className="intro-count">{t('intro.step', { step: index + 1, total: STEPS.length })}</p>
          <h2 id="intro-title">{t(step.title)}</h2>
          <p id="intro-body" className="intro-body">{t(step.body)}</p>
          {step.note && <p className="intro-note">{t(step.note)}</p>}
          {last && (
            <div className="intro-cta">
              <button className="btn btn-primary" onClick={() => { onClose(); onDemo(); }} data-autofocus>
                <Play size={14} fill="currentColor" /> {t('intro.demo')}
              </button>
              <button className="btn btn-ghost" onClick={() => inputRef.current?.click()}>
                <Upload size={14} /> {t('intro.analyze')}
              </button>
              <input ref={inputRef} type="file" accept={AUDIO_ACCEPT} hidden onChange={(event) => pick(event.currentTarget.files)} />
            </div>
          )}
        </div>
        <footer className="intro-foot">
          <button className="btn btn-ghost" onClick={index === 0 ? onClose : () => go(index - 1)}>
            {index === 0 ? t('intro.skip') : <><ArrowLeft size={14} /> {t('intro.back')}</>}
          </button>
          <div className="intro-dots" role="tablist" aria-label={t('intro.label')}>
            {STEPS.map((item, i) => (
              <button key={item.art} role="tab" aria-selected={i === index} aria-label={t('intro.step', { step: i + 1, total: STEPS.length })}
                className={i === index ? 'is-active' : ''} onClick={() => go(i)} tabIndex={i === index ? 0 : -1} />
            ))}
          </div>
          {last
            ? <button key="close" className="btn btn-ghost" onClick={onClose}>{t('intro.close')}</button>
            : <button key="next" className="btn btn-primary" onClick={() => go(index + 1)} data-autofocus>{t('intro.next')} <ArrowRight size={14} /></button>}
        </footer>
      </section>
    </div>
  );
}
