import { normalizeFlowMap } from '../flow/normalize';
import { t } from '../i18n';
import type { FlowMap, LibraryTrack } from '../types';

type Updated = { flowmap: FlowMap; track: LibraryTrack };

/** Replace the text of some bars; the server re-analyses the track and returns it. */
export function saveLyrics(trackId: string, bars: Record<number, string>): Promise<Updated> {
  return post(`/api/library/${encodeURIComponent(trackId)}/lyrics`, { bars });
}

/** Back to the original transcription. */
export function restoreLyrics(trackId: string): Promise<Updated> {
  return post(`/api/library/${encodeURIComponent(trackId)}/lyrics/restore`);
}

async function post(url: string, body?: unknown): Promise<Updated> {
  const res = await fetch(url, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(t('lyrics.saveFailed', { status: res.status }));
  const data = await res.json() as Updated;
  return { ...data, flowmap: normalizeFlowMap(data.flowmap) };
}
