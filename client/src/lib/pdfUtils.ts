import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Book } from "@shared/schema";

/**
 * Creates a properly formatted PDF export for a book in the ekz-Informationsdienst format
 * with two columns per page layout as shown in the example.
 */
export function exportBookToPDF(book: Partial<Book>, language: string = 'de'): void {
  // Create a new PDF document with A4 size
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4'
  });
  
  // Set up document constants
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const gap = 15;
  
  // Calculate column dimensions
  const colWidth = (pageWidth - 2 * margin - gap) / 2;
  const boxHeight = pageHeight - 2 * margin;
  
  // Box coordinates for first column
  const leftBoxX = margin;
  const leftBoxY = margin;
  
  // Box coordinates for second column
  const rightBoxX = margin + colWidth + gap;
  const rightBoxY = margin;
  
  // Draw borders around both boxes
  doc.rect(leftBoxX, leftBoxY, colWidth, boxHeight).stroke();
  doc.rect(rightBoxX, rightBoxY, colWidth, boxHeight).stroke();
  
  // Footer text
  const footerText = "ekz-Informationsdienst";
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  
  // Add footer text to both columns
  const footerY = pageHeight - margin - 5;
  doc.text(footerText, leftBoxX + (colWidth / 2), footerY, { align: 'center' });
  doc.text(footerText, rightBoxX + (colWidth / 2), footerY, { align: 'center' });
  
  // Start rendering book data in first column
  renderBookData(doc, book, leftBoxX, leftBoxY, colWidth);
  
  // Save the PDF
  const fileName = `${book.title ? book.title.slice(0, 30).replace(/[/\\?%*:|"<>]/g, '-') : 'book'}_${book.isbn || 'unknown'}.pdf`;
  doc.save(fileName);
}

/**
 * Renders book data within the specified box area
 */
function renderBookData(doc: jsPDF, book: Partial<Book>, boxX: number, boxY: number, boxWidth: number): void {
  // Text margin inside the box
  const textMargin = 10;
  const maxTextWidth = boxWidth - (textMargin * 2);
  
  // Current Y position for content
  let currentY = boxY + textMargin;
  const startX = boxX + textMargin;
  
  // 1. ASB classification (if available)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  currentY = renderText(doc, `ASB:`, startX, currentY, {
    font: "helvetica",
    style: "bold"
  });
  
  if (book.classificationNumber) {
    currentY = renderText(doc, book.classificationNumber, startX + 30, currentY - 5, {
      font: "helvetica",
      style: "normal"
    });
  }
  
  currentY += 10; // Add space after ASB
  
  // 2. Author name in bold 
  const author = book.author || book.mainAuthor || '';
  if (author) {
    doc.setFont("times", "bold");
    doc.setFontSize(9);
    currentY = renderText(doc, `${author}:`, startX, currentY, {
      style: "bold",
      lineHeight: 5
    });
    currentY += 5; // Add space after author
  }
  
  // 3. Title with proper spacing
  if (book.title) {
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    
    // Format title line according to example
    let titleLine = book.title;
    
    // Add author with proper spacing
    if (author) {
      titleLine += ` / ${author}`;
    }
    
    // Render title with proper spacing
    currentY = renderText(doc, titleLine, startX, currentY, {
      maxWidth: maxTextWidth,
      lineHeight: 5
    });
    currentY += 5; // Add space after title
  }
  
  // 4. Publication info on one line
  let pubInfo = "";
  
  // Format according to example in image
  if (book.edition) {
    pubInfo += book.edition;
  }
  
  // Add publication place with dash
  if (book.publicationPlace) {
    pubInfo += pubInfo ? ` – ${book.publicationPlace}` : book.publicationPlace;
  }
  
  // Add publisher with colon
  if (book.publisher) {
    pubInfo += pubInfo ? `: ${book.publisher}` : book.publisher;
  }
  
  // Add year with comma
  if (book.publicationYear) {
    pubInfo += pubInfo ? `, ${book.publicationYear}` : book.publicationYear;
  }
  
  // Add page count with dash
  if (book.pageCount) {
    pubInfo += pubInfo ? ` – ${book.pageCount} S.` : `${book.pageCount} S.`;
  }
  
  // Add page dimensions and format
  if (book.dimensions) {
    pubInfo += pubInfo ? ` ; ${book.dimensions}` : book.dimensions;
  }
  
  // Render publication info
  if (pubInfo) {
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    currentY = renderText(doc, pubInfo, startX, currentY, {
      maxWidth: maxTextWidth,
      lineHeight: 5
    });
    currentY += 5; // Add space
  }
  
  // 5. ISBN and price
  if (book.isbn) {
    let isbnInfo = `ISBN ${book.isbn}`;
    
    // Add price with colon
    if (book.price) {
      isbnInfo += ` : ${book.price}`;
    }
    
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    currentY = renderText(doc, isbnInfo, startX, currentY, {
      maxWidth: maxTextWidth,
      lineHeight: 5
    });
    currentY += 8; // Add more space before summary
  }
  
  // 6. Summary (main content)
  if (book.summary) {
    // Clean up and normalize summary text
    const cleanSummary = book.summary.trim().replace(/\s+/g, ' ');
    
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    currentY = renderText(doc, cleanSummary, startX, currentY, {
      maxWidth: maxTextWidth,
      lineHeight: 5
    });
    currentY += 8; // Add space after summary
  }
  
  // 7. Review (if available)
  if (book.review) {
    // Format review with bullet point if needed
    let reviewText = book.review.trim().replace(/\s+/g, ' ');
    
    // Ensure review starts with bullet point
    if (!reviewText.startsWith('•')) {
      reviewText = '• ' + reviewText;
    }
    
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    currentY = renderText(doc, reviewText, startX, currentY, {
      maxWidth: maxTextWidth,
      lineHeight: 5
    });
    currentY += 5;
  }
  
  // 8. IK classification (if available)
  if (book.interestCategory) {
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    renderText(doc, `IK: ${book.interestCategory}`, startX, currentY, {
      maxWidth: maxTextWidth,
      lineHeight: 5
    });
  }
}

/**
 * Helper function to render text with proper spacing and line wrapping
 */
function renderText(
  doc: jsPDF, 
  text: string, 
  x: number, 
  y: number, 
  options: any = {}
): number {
  // Set default options
  const fontSize = options.fontSize || 9;
  const font = options.font || "times";
  const style = options.style || "normal";
  const maxWidth = options.maxWidth || 80;
  const lineHeight = options.lineHeight || 5;
  
  // Set font properties
  doc.setFont(font, style);
  doc.setFontSize(fontSize);
  
  // Clean up and normalize text
  const cleanText = text.replace(/\s+/g, ' ').trim();
  
  // Split text into lines that fit within maxWidth
  const lines = doc.splitTextToSize(cleanText, maxWidth);
  
  // Render each line
  for (let i = 0; i < lines.length; i++) {
    doc.text(lines[i], x, y + (i * lineHeight), { align: 'left' });
  }
  
  // Return the new Y position
  return y + (lines.length * lineHeight);
}

/**
 * Export multiple books to a single PDF in the two-column layout
 */
export function exportMultipleBooksToSinglePDF(books: Partial<Book>[], language: string = 'de'): void {
  if (!books || books.length === 0) return;
  
  // Create a new PDF document
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4'
  });
  
  // Set up document constants
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const gap = 15;
  
  // Calculate column dimensions
  const colWidth = (pageWidth - 2 * margin - gap) / 2;
  const boxHeight = pageHeight - 2 * margin;
  
  // Two books per page (2 columns × 1 row)
  const booksPerPage = 2;
  
  // Process each book
  books.forEach((book, index) => {
    // Add a new page if needed (but not for the first page)
    if (index > 0 && index % booksPerPage === 0) {
      doc.addPage();
    }
    
    // Determine position based on index
    const column = index % booksPerPage;
    const boxX = column === 0 
      ? margin 
      : margin + colWidth + gap;
    const boxY = margin;
    
    // Draw box border
    doc.rect(boxX, boxY, colWidth, boxHeight).stroke();
    
    // Add footer
    const footerY = pageHeight - margin - 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("ekz-Informationsdienst", boxX + (colWidth / 2), footerY, { align: 'center' });
    
    // Render book data inside the box
    renderBookData(doc, book, boxX, boxY, colWidth);
  });
  
  // Save the PDF
  const fileName = `exported_books_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}