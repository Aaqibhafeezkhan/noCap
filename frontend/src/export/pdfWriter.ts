/** A minimal PDF writer: one JPEG image per page, no dependencies. */
export interface PdfPage {
  jpeg: ArrayBuffer;
  /** Image size in pixels. */
  pxWidth: number;
  pxHeight: number;
  /** Page size in PDF points. */
  width: number;
  height: number;
}

export function buildPdf(pages: PdfPage[]): Blob {
  const parts: BlobPart[] = [];
  const offsets: number[] = [];
  let length = 0;
  // Everything but the JPEG data is ASCII, so string length equals byte length.
  const push = (part: string | ArrayBuffer) => {
    parts.push(part);
    length += typeof part === 'string' ? part.length : part.byteLength;
  };
  const object = (id: number, ...body: (string | ArrayBuffer)[]) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    body.forEach(push);
    push('\nendobj\n');
  };

  push('%PDF-1.4\n');
  const pageId = (index: number) => 3 + index * 3;
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] /Count ${pages.length} >>`);

  pages.forEach((page, index) => {
    const id = pageId(index);
    const content = `q ${page.width} 0 0 ${page.height} 0 0 cm /Im0 Do Q`;
    object(
      id,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${page.width} ${page.height}] ` +
        `/Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`,
    );
    object(id + 1, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
    object(
      id + 2,
      `<< /Type /XObject /Subtype /Image /Width ${page.pxWidth} /Height ${page.pxHeight} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.byteLength} >>\nstream\n`,
      page.jpeg,
      '\nendstream',
    );
  });

  const count = 2 + pages.length * 3;
  const xrefOffset = length;
  push(`xref\n0 ${count + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= count; id += 1) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}