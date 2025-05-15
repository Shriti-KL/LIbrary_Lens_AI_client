// Fixed util.ts file with proper PDF generation layout
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';

interface BookData {
  asb: string | null;
  author: string | null;
  title_and_subtitle: string | null;
  responsibility: string | null;
  edition: string | null;
  place: string | null;
  publisher: string | null;
  year: string | null;
  physical: string | null;
  isbn: string | null;
  binding_and_price: string | null;
  summary: string | null;
  interest: string | null;
  reviewer: string | null;
}

export async function generatePDF(books: BookData[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 size

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontSize = 10;
  const lineHeight = 14;
  const margin = 40;
  const columnGap = 20;
  const columnWidth = (page.getWidth() - margin * 2 - columnGap) / 2;

  let x = margin;
  let y = page.getHeight() - margin;
  let column = 0;

  const drawText = (label: string, value: string | null) => {
    const text = value ? `${label}: ${value}` : `${label}: -`;
    const textHeight = font.heightAtSize(fontSize);
    const wrappedText = font.splitTextIntoLines(text, { size: fontSize, width: columnWidth });
    for (const line of wrappedText) {
      if (y < margin + lineHeight * 4) {
        // move to next column or page
        if (column === 0) {
          column = 1;
          x = margin + columnWidth + columnGap;
          y = page.getHeight() - margin;
        } else {
          column = 0;
          x = margin;
          y = page.getHeight() - margin;
          pdfDoc.addPage();
        }
      }
      page.drawText(line, { x, y, size: fontSize, font });
      y -= lineHeight;
    }
  };

  for (const book of books) {
    drawText('ASB', book.asb);
    drawText('Author', book.author);
    drawText('Title and Subtitle', book.title_and_subtitle);
    drawText('Statement of Responsibility', book.responsibility);
    drawText('Edition Statement', book.edition);
    drawText('Place of Publication', book.place);
    drawText('Publisher', book.publisher);
    drawText('Year of Publication', book.year);
    drawText('Physical Description', book.physical);
    drawText('ISBN', book.isbn);
    drawText('Binding and Price', book.binding_and_price);
    drawText('Descriptive Summary', book.summary);
    drawText('Interest Category', book.interest);
    drawText('Reviewer', book.reviewer);

    y -= lineHeight * 2; // extra space after each book block
  }

  return await pdfDoc.save();
}
