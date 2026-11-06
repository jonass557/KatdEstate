import PDFDocument from 'pdfkit';

export interface PdfSection {
  heading?: string;
  lines: readonly string[];
}

export interface PdfTable {
  columns: readonly string[];
  rows: readonly (readonly string[])[];
}

export interface PdfDocumentInput {
  title: string;
  subtitle?: string;
  organizationName: string;
  sections?: readonly PdfSection[];
  table?: PdfTable;
  footer?: string;
}

/**
 * PDF minimal et déterministe.
 *
 * Pas de HTML, pas de rendu navigateur : le document est construit
 * programmatiquement, donc testable et sans injection de contenu.
 */
export function renderPdf(input: PdfDocumentInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(10).fillColor('#64748b').text(input.organizationName);
    doc.moveDown(0.4);
    doc.fontSize(18).fillColor('#0f172a').text(input.title);
    if (input.subtitle) {
      doc.moveDown(0.3).fontSize(11).fillColor('#334155').text(input.subtitle);
    }
    doc.moveDown();

    for (const section of input.sections ?? []) {
      if (section.heading) {
        doc.fontSize(13).fillColor('#0f172a').text(section.heading);
        doc.moveDown(0.3);
      }
      for (const line of section.lines) {
        doc.fontSize(10).fillColor('#1e293b').text(line);
      }
      doc.moveDown();
    }

    if (input.table && input.table.rows.length > 0) {
      const width =
        (doc.page.width - doc.page.margins.left - doc.page.margins.right) /
        input.table.columns.length;
      doc.fontSize(9).fillColor('#0f172a');
      input.table.columns.forEach((column, index) => {
        doc.text(column, doc.page.margins.left + index * width, doc.y, { width, continued: false });
      });
      doc.moveDown(0.4);
      for (const row of input.table.rows) {
        const y = doc.y;
        row.forEach((cell, index) => {
          doc.fillColor('#334155').text(cell, doc.page.margins.left + index * width, y, { width });
        });
        doc.moveDown(0.3);
      }
    }

    if (input.footer) {
      doc.moveDown(2).fontSize(8).fillColor('#94a3b8').text(input.footer);
    }
    doc.end();
  });
}
