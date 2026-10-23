import type { FlowMap } from '../types';
import { buildRhymeStyles, colorToCss, rhymeColor } from '../flow/colors';
import { FLOW_DIMS, buildSyllableRows, computeLayout, rowHeight, rowTop } from '../flow/layout';
import { fitLabel } from '../flow/pixi/blocks';
import { CANVAS } from '../flow/theme';
import { t } from '../i18n';

const TITLE_H = 58;
const FONT = 'Inter, Helvetica, Arial, sans-serif';
const MONO = 'JetBrains Mono, Menlo, monospace';

export function downloadFlowmapSvg(flowmap: FlowMap): void {
  downloadBlob(new Blob([buildFlowmapSvg(flowmap)], { type: 'image/svg+xml;charset=utf-8' }), `${safeName(flowmap.metadata.title)}.svg`);
}

export async function downloadFlowmapPng(flowmap: FlowMap): Promise<void> {
  const url = URL.createObjectURL(new Blob([buildFlowmapSvg(flowmap)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await loadImage(url);
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth * scale;
    canvas.height = image.naturalHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error(t('export.unavailable'));
    ctx.scale(scale, scale);
    ctx.drawImage(image, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error(t('export.failed'));
    downloadBlob(blob, `${safeName(flowmap.metadata.title)}.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** The whole track as one tall flow chart, in the same visual language as the canvas. */
export function buildFlowmapSvg(flowmap: FlowMap): string {
  const layout = computeLayout(flowmap, 1200, 1);
  const rows = buildSyllableRows(flowmap, layout);
  const styles = buildRhymeStyles(flowmap);
  const maxDensity = Math.max(0.01, ...flowmap.bars.map((bar) => bar.density));
  const width = layout.width;
  const height = layout.height + TITLE_H;
  const meta = t('header.meta', { bpm: flowmap.metadata.bpm.toFixed(0), bars: flowmap.bars.length, duration: `${Math.round(flowmap.metadata.duration)}s` });
  const out: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="${hex(CANVAS.bg)}"/>`,
    `<text x="20" y="28" fill="${hex(CANVAS.text)}" font-family="${FONT}" font-size="17" font-weight="700">${esc(flowmap.metadata.title || 'noCap')}</text>`,
    `<text x="20" y="46" fill="${hex(CANVAS.label)}" font-family="${MONO}" font-size="11">${esc(meta)} · noCap</text>`,
    `<g transform="translate(0 ${TITLE_H})">`,
  ];
  for (let beat = 0; beat < layout.signature; beat += 1) {
    out.push(`<text x="${FLOW_DIMS.labelW + beat * layout.beatW + 8}" y="19" fill="${hex(CANVAS.label)}" font-family="${MONO}" font-size="11">${beat + 1}</text>`);
  }
  flowmap.bars.forEach((bar, index) => {
    const top = rowTop(layout, index);
    const height = rowHeight(layout, index);
    const fill = bar.empty ? CANVAS.emptyRow : index % 2 ? CANVAS.rowB : CANVAS.rowA;
    out.push(`<rect x="${FLOW_DIMS.labelW}" y="${top}" width="${layout.gridW}" height="${height}" fill="${hex(fill)}"/>`);
    for (let beat = 0; beat <= layout.signature; beat += 1) {
      const x = FLOW_DIMS.labelW + beat * layout.beatW;
      out.push(line(x, top, x, top + height, CANVAS.beatLine));
    }
    if (bar.empty && height < 14 && bar.bar_no % 4 !== 1) return;
    const size = height < 26 ? 9 : 11;
    out.push(`<text x="${FLOW_DIMS.labelW - 8}" y="${top + height / 2 + size / 3}" fill="${hex(bar.empty ? CANVAS.otherRhyme : CANVAS.label)}" text-anchor="end" font-family="${MONO}" font-size="${size}">${bar.bar_no}</text>`);
    if (bar.empty) return;
    const densityW = (FLOW_DIMS.densW - 14) * (bar.density / maxDensity);
    out.push(`<rect x="${FLOW_DIMS.labelW + layout.gridW + 8}" y="${top + height / 2 - 3}" width="${Math.max(2, densityW)}" height="6" rx="3" fill="${hex(CANVAS.textMuted)}" opacity="0.7"/>`);
    for (const rect of rows[index]) {
      const color = hex(rhymeColor(styles, rect.syllable.rhyme_group));
      const stressed = rect.syllable.stress;
      out.push(stressed
        ? `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" rx="4" fill="${color}"/>`
        : `<rect x="${rect.x + 0.5}" y="${rect.y + 0.5}" width="${rect.width - 1}" height="${rect.height - 1}" rx="4" fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="1.25"/>`);
      const label = fitLabel(rect.label, rect.width - 6, 13);
      if (!label) continue;
      const fill = stressed ? (rect.syllable.rhyme_group ? hex(CANVAS.textOnFill) : hex(CANVAS.text)) : rect.syllable.rhyme_group ? color : hex(CANVAS.textMuted);
      out.push(`<text x="${rect.x + rect.width / 2}" y="${rect.y + rect.height / 2 + 4.5}" fill="${fill}" text-anchor="middle" font-family="${FONT}" font-size="13" font-weight="${stressed ? 700 : 500}">${esc(label)}</text>`);
    }
  });
  out.push('</g></svg>');
  return out.join('');
}

function hex(color: number) {
  return colorToCss(color);
}

function line(x1: number, y1: number, x2: number, y2: number, color: number): string {
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${hex(color)}" stroke-width="1"/>`;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(t('export.failed')));
    image.src = src;
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function safeName(value: string): string {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'nocap-flowmap';
}

function esc(value: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };
  return value.replace(/[&<>"']/g, (char) => map[char]);
}
