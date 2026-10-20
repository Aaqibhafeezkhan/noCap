import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { PlayRange } from '../flow/playbackRanges';

export interface PlayerApi {
  toggle: () => void;
  seek: (seconds: number) => void;
}

/** Audio element state: source switching, one-shot ranges (bar / word), looping a
 *  selection, and the sync-offset time that the canvas reads through `audioTimeRef`. */
export function useAudioPlayer({ enabled, source, audioPath, playRange, loopRange, syncOffset, audioTimeRef, apiRef }: {
  enabled: boolean;
  source: 'mix' | 'vocals';
  audioPath: string | null;
  playRange: PlayRange | null;
  loopRange: PlayRange | null;
  syncOffset: number;
  audioTimeRef: MutableRefObject<number>;
  apiRef?: MutableRefObject<PlayerApi | null>;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const segmentEndRef = useRef<number | null>(null);
  const loopRef = useRef<PlayRange | null>(loopRange);
  const syncRef = useRef(syncOffset);
  const prevPathRef = useRef<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);

  loopRef.current = loopRange;

  const publish = (seconds: number) => {
    audioTimeRef.current = Math.max(0, seconds + syncRef.current);
    setTime(seconds);
  };

  useEffect(() => {
    syncRef.current = syncOffset;
    const audio = audioRef.current;
    if (audio) audioTimeRef.current = Math.max(0, audio.currentTime + syncOffset);
  }, [syncOffset, audioTimeRef]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!enabled) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      segmentEndRef.current = null;
      prevPathRef.current = null;
      setPlaying(false);
      setDuration(0);
      publish(0);
      return;
    }
    const trackChanged = audioPath !== prevPathRef.current;
    prevPathRef.current = audioPath;
    // The path is part of the URL so the browser never serves another track from cache.
    const base = source === 'vocals' ? '/api/audio/vocals' : '/api/audio';
    const src = audioPath ? `${base}?t=${encodeURIComponent(audioPath)}` : base;
    if (trackChanged) {
      audio.pause();
      setPlaying(false);
      segmentEndRef.current = null;
      audio.src = src;
      audio.load();
      publish(0);
      return;
    }
    const saved = audio.currentTime;
    const wasPlaying = !audio.paused;
    audio.src = src;
    audio.load();
    const restore = () => {
      audio.currentTime = Math.min(saved, audio.duration || saved);
      if (wasPlaying) void audio.play();
    };
    audio.addEventListener('loadedmetadata', restore, { once: true });
    return () => audio.removeEventListener('loadedmetadata', restore);
  }, [enabled, source, audioPath]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (!audio) return;
      const loop = loopRef.current;
      if (loop && audio.currentTime >= loop.end) audio.currentTime = loop.start;
      if (!loop && segmentEndRef.current !== null && audio.currentTime >= segmentEndRef.current) {
        audio.pause();
        segmentEndRef.current = null;
        setPlaying(false);
        publish(audio.currentTime);
        return;
      }
      publish(audio.currentTime);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !enabled || !playRange) return;
    segmentEndRef.current = playRange.end;
    audio.currentTime = playRange.start;
    publish(playRange.start);
    void audio.play().then(() => setPlaying(true)).catch(() => { segmentEndRef.current = null; });
  }, [enabled, playRange]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !enabled || !loopRange) return;
    if (audio.currentTime < loopRange.start || audio.currentTime > loopRange.end) audio.currentTime = loopRange.start;
    segmentEndRef.current = null;
    void audio.play().then(() => setPlaying(true)).catch(() => {});
  }, [enabled, loopRange?.start, loopRange?.end]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggle() {
    const audio = audioRef.current;
    if (!audio || !enabled) return;
    segmentEndRef.current = null;
    if (audio.paused) void audio.play().then(() => setPlaying(true)).catch(() => {});
    else {
      audio.pause();
      setPlaying(false);
    }
  }

  function seek(seconds: number) {
    const audio = audioRef.current;
    if (!audio || !enabled) return;
    const next = Math.max(0, Math.min(duration || seconds, seconds));
    audio.currentTime = next;
    segmentEndRef.current = null;
    publish(next);
  }

  if (apiRef) apiRef.current = { toggle, seek };

  return {
    audioRef,
    playing,
    duration,
    time,
    toggle,
    seek,
    onLoadedMetadata: (event: React.SyntheticEvent<HTMLAudioElement>) => setDuration(event.currentTarget.duration || 0),
    onEnded: () => setPlaying(false),
  };
}
