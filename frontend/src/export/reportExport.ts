import { t } from '../i18n';
import { downloadBlob, safeName } from './flowExport';

const SCALE = 2;

/** Download the visible report as a full-page PNG, preserving its current theme. */
export async function downloadReportPng(title: string): Promise<void> {
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

  const shell = document.querySelector<HTMLElement>('.app-shell');
  const background = shell ? getComputedStyle(shell).backgroundColor : '#171717';
  clone.style.setProperty('background-color', background);
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<foreignObject width="100%" height="100%">',
    new XMLSerializer().serializeToString(clone),
    '</foreignObject></svg>',
  ].join('');

  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const image = await loadImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = width * SCALE;
    canvas.height = height * SCALE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error(t('export.unavailable'));
    context.scale(SCALE, SCALE);
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error(t('export.failed'));
    downloadBlob(blob, `${safeName(title)}-report.png`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function inlineStyles(source: HTMLElement, clone: HTMLElement): void {
  const computed = getComputedStyle(source);
  for (const property of Array.from(computed)) {
    clone.style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
  }
  const sourceChildren = Array.from(source.children);
  const cloneChildren = Array.from(clone.children);
  sourceChildren.forEach((child, index) => {
    const copy = cloneChildren[index];
    if (child instanceof HTMLElement && copy instanceof HTMLElement) inlineStyles(child, copy);
    else if (child instanceof SVGElement && copy instanceof SVGElement) inlineSvgStyles(child, copy);
  });
}

function inlineSvgStyles(source: SVGElement, clone: SVGElement): void {
  const computed = getComputedStyle(source);
  for (const property of Array.from(computed)) {
    clone.style.setProperty(property, computed.getPropertyValue(property), computed.getPropertyPriority(property));
  }
  const sourceChildren = Array.from(source.children);
  const cloneChildren = Array.from(clone.children);
  sourceChildren.forEach((child, index) => {
    const copy = cloneChildren[index];
    if (child instanceof SVGElement && copy instanceof SVGElement) inlineSvgStyles(child, copy);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(t('export.failed')));
    image.src = src;
  });
}
