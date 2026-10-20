import type { MutableRefObject } from 'react';
import { Mic2, Music2, Pause, Play, Repeat, RotateCcw } from 'lucide-react';
import type { PlayRange } from '../../flow/playbackRanges';
import { useAudioPlayer, type PlayerApi } from '../../hooks/useAudioPlayer';
import { t } from '../../i18n';
import type { FlowMap } from '../../types';
import { formatOffset, formatTime } from './format';
import { Timeline } from './Timeline';

export function PlayerBar({ flowmap, enabled, hasVocals, source, onSourceChange, playRange, loopRange, loopAvailable, loop, onLoopChange, syncOffset, onSyncNudge, onSyncReset, audioTimeRef, apiRef }: {
  flowmap: FlowMap;
  enabled: boolean;
  hasVocals: boolean;
  source: 'mix' | 'vocals';
  onSourceChange: (source: 'mix' | 'vocals') => void;
  playRange: PlayRange | null;
  loopRange: PlayRange | null;
  loopAvailable: boolean;
  loop: boolean;
  onLoopChange: (loop: boolean) => void;
  syncOffset: number;
  onSyncNudge: (delta: number) => void;
  onSyncReset: () => void;
  audioTimeRef: MutableRefObject<number>;
  apiRef: MutableRefObject<PlayerApi | null>;
}) {
  const player = useAudioPlayer({ enabled, source, audioPath: flowmap.metadata.audio_path ?? null, playRange, loopRange, syncOffset, audioTimeRef, apiRef });

  return (
    <footer className="player-bar" aria-label={t('player.aria')}>
      <button
        className="play-btn"
        disabled={!enabled}
        onClick={player.toggle}
        aria-label={player.playing ? t('player.pause') : t('player.play')}
        title={`${player.playing ? t('player.pause') : t('player.play')} (Space)`}
      >
        {player.playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
      </button>
      <span className="time-display">{formatTime(player.time)}</span>
      <Timeline flowmap={flowmap} time={player.time} duration={player.duration} enabled={enabled} loopRange={loopRange} onSeek={player.seek} />
      <span className="time-display time-total">{formatTime(player.duration || flowmap.metadata.duration)}</span>

      <button
        className={`icon-btn ${loop ? 'is-on' : ''}`}
        disabled={!enabled || !loopAvailable}
        onClick={() => onLoopChange(!loop)}
        aria-pressed={loop}
        aria-label={t('player.loop')}
        title={loopAvailable ? `${t('player.loop')} (L)` : t('player.loopHint')}
      >
        <Repeat size={15} />
      </button>

      <div className="segmented segmented-sm" role="group" aria-label={t('player.sourceAria')}>
        <button className={source === 'mix' ? 'is-active' : ''} onClick={() => onSourceChange('mix')} aria-pressed={source === 'mix'} disabled={!enabled}>
          <Music2 size={13} /> {t('player.mix')}
        </button>
        <button
          className={source === 'vocals' ? 'is-active' : ''}
          onClick={() => onSourceChange('vocals')}
          aria-pressed={source === 'vocals'}
          disabled={!enabled || !hasVocals}
          title={hasVocals ? undefined : t('player.vocalsUnavailable')}
        >
          <Mic2 size={13} /> {t('player.vocals')}
        </button>
      </div>

      <div className="sync-controls" role="group" aria-label={t('player.syncAria')}>
        <span className="sync-label">{t('player.sync')}</span>
        <button className="icon-btn icon-btn-sm" onClick={() => onSyncNudge(-0.05)} disabled={!enabled} aria-label={t('player.syncEarlier')} title={t('player.syncEarlier')}>−</button>
        <span className={`sync-value ${syncOffset ? 'is-changed' : ''}`}>{formatOffset(syncOffset)}</span>
        <button className="icon-btn icon-btn-sm" onClick={() => onSyncNudge(0.05)} disabled={!enabled} aria-label={t('player.syncLater')} title={t('player.syncLater')}>+</button>
        <button className="icon-btn icon-btn-sm" onClick={onSyncReset} disabled={!enabled || !syncOffset} aria-label={t('player.syncReset')} title={t('player.syncReset')}>
          <RotateCcw size={12} />
        </button>
      </div>

      {!enabled && <span className="player-note">{t('player.noAudio')}</span>}
      <audio ref={player.audioRef} preload="metadata" onLoadedMetadata={player.onLoadedMetadata} onEnded={player.onEnded} />
    </footer>
  );
}
