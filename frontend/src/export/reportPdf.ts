import { downloadBlob, safeName } from './flowExport';
import { buildPdf, type PdfPage } from './pdfWriter';
import { t } from '../i18n';
import { canvasToBlob, renderReportCanvas } from './reportExport';

/** PDF viewers (Acrobat) cap a page at 14,400 points per side. */
const MAX_PAGE_POINTS = 14400;
const JPEG_QUALITY = 0.92;

/**
 * Download the report as a PDF that looks like the screen. A normal report is one
 * page sized to the report, so nothing is cut off and the dark background has no
 * white margins. Only reports taller than the page cap are split into several pages.
 */
export async function downloadReportPdf(title: string): Promise<void> {
  const { canvas, width, height, scale } = await renderReportCanvas();
  const pageHeight = Math.min(height, MAX_PAGE_POINTS);
  const pages: PdfPage[] = [];

  for (let top = 0; top < height; top += pageHeight) {
    const sliceHeight = Math.min(pageHeight, height - top);
    const sourceTop = Math.round(top * scale);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = Math.min(Math.round(sliceHeight * scale), canvas.height - sourceTop);
    const context = slice.getContext('2d');
    if (!context) throw new Error(t('export.unavailable'));
    context.drawImage(canvas, 0, sourceTop, slice.width, slice.height, 0, 0, slice.width, slice.height);
    const jpeg = await (await canvasToBlob(slice, 'image/jpeg', JPEG_QUALITY)).arrayBuffer();
    pages.push({ jpeg, pxWidth: slice.width, pxHeight: slice.height, width, height: sliceHeight });
  }

  downloadBlob(buildPdf(pages), `${safeName(title)}-report.pdf`);
}