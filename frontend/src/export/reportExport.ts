import { t } from '../i18n';
import { downloadBlob, safeName } from './flowExport';

const SCALE = 2;
/** Browsers refuse canvases much larger than this on a side. */
const MAX_CANVAS_SIDE = 16000;

export interface RenderedReport {
  canvas: HTMLCanvasElement;
  /** Report size in CSS pixels. */
  width: number;
  height: number;
  /** Canvas pixels per CSS pixel (SCALE, lowered for very long reports). */
  scale: number;
}

/** Download the visible report as a full-page PNG, preserving its current theme. */
export async function downloadReportPng(title: string): Promise<void> {
  const { canvas } = await renderReportCanvas();
  const blob = await canvasToBlob(canvas, 'image/png');
  downloadBlob(blob, `${safeName(title)}-report.png`);
}

export function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error(t('export.failed')))), type, quality);
  });
}

/** Render the whole report, not just the visible part, onto a canvas. */
export async function renderReportCanvas(): Promise<RenderedReport> {
  const report = document.querySelector<HTMLElement>('.report-screen');
  if (!report) throw new Error(t('export.unavailable'));

  const width = report.scrollWidth;
  const clone = report.cloneNode(true) as HTMLElement;
  inlineStyles(report, clone);
  clone.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  clone.style.setProperty('position', 'absolute');
  clone.style.setProperty('left', '-100000px');
  clone.style.setProperty('top', '0');
  clone.style.setProperty('visibility', 'hidden');
  clone.style.setProperty('width', `${width}px`);
  clone.style.setProperty('height', 'auto');
  clone.style.setProperty('min-height', '0');
  clone.style.setProperty('max-height', 'none');
  clone.style.setProperty('flex', 'none');
  clone.style.setProperty('overflow', 'visible');
  clone.querySelectorAll<HTMLElement>('.table-scroll, .table-scroll-tall').forEach((table) => {
    table.style.setProperty('max-height', 'none');
    table.style.setProperty('height', 'auto');
    table.style.setProperty('overflow', 'visible');
  });
  clone.querySelectorAll<HTMLElement>('.data-table thead th').forEach((cell) => {
    cell.style.setProperty('position', 'static');
  });

  document.body.appendChild(clone);
  const height = clone.scrollHeight;
  clone.style.setProperty('height', `${height}px`);
  clone.remove();
  clone.style.setProperty('position', 'static');
  clone.style.setProperty('left', 'auto');
  clone.style.setProperty('top', 'auto');
  clone.style.setProperty('visibility', 'visible');

  clone.style.setProperty('background-color', pageBackground());
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<foreignObject width="100%" height="100%">',
    new XMLSerializer().serializeToString(clone),
    '</foreignObject></svg>',
  ].join('');

  // A data URL, not a blob URL: Chromium taints the canvas when an SVG with a
  // foreignObject comes from a blob URL, and toBlob then throws.
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const scale = Math.min(SCALE, MAX_CANVAS_SIDE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error(t('export.unavailable'));
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, width, height);
  return { canvas, width, height, scale };
}