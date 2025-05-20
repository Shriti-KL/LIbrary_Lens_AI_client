import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Book } from "@shared/schema";

/**
 * Creates a properly formatted PDF export for a book in the ekz-Informationsdienst format
 * with two columns per page layout as shown in the example.
 * Implemented based on the fixed layout format from the Python code.
 */
export function exportBookToPDF(book: Partial<Book>, language: string = 'de'): void {
  // Create a new PDF document with A4 size
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4'
  });
  
  // Set up document constants based on Python implementation
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20; // 2cm margin
  const gap = 10;   // 1cm gap between columns
  
  // Calculate column dimensions
  const colWidth = (pageWidth - 2 * margin - gap) / 2;
  const rowHeight = (pageHeight - 2 * margin) / 2;
  const boxHeight = rowHeight - 10;
  
  // Box coordinates for first column (first box)
  const leftBoxX = margin;
  const leftBoxY = margin;
  
  // Box coordinates for second column (second box)
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
  const footerY = margin + boxHeight - 5;
  doc.text(footerText, leftBoxX + (colWidth / 2), footerY, { align: 'center' });
  doc.text(footerText, rightBoxX + (colWidth / 2), footerY, { align: 'center' });
  
  // Start rendering book data in first column
  renderBookData(doc, book, leftBoxX, leftBoxY, colWidth, boxHeight);
  
  // Save the PDF
  const fileName = `${book.title ? book.title.slice(0, 30).replace(/[/\\?%*:|"<>]/g, '-') : 'book'}_${book.isbn || 'unknown'}.pdf`;
  doc.save(fileName);
}

/**
 * Renders book data within the specified box area
 * Based on the Python implementation for fixed layout formatting
 */
function renderBookData(doc: jsPDF, book: Partial<Book>, boxX: number, boxY: number, boxWidth: number, boxHeight: number): void {
  // Text margins and positioning based on Python implementation
  const textMargin = 5; // 5mm margin inside the box
  const maxTextWidth = boxWidth - (textMargin * 2);
  
  // Start text content at top of box with margin
  const contentY = boxY + 10; // Start 10mm from top of box
  let textY = contentY;
  const startX = boxX + textMargin;
  
  // Create array of paragraphs to render (based on Python implementation)
  const paragraphs: {text: string, style?: string}[] = [];
  
  // 1. ASB classification (if available)
  paragraphs.push({ text: "ASB:", style: "bold" });
  
  // 2. Author with colon
  const author = book.author || book.mainAuthor || '';
  if (author) {
    paragraphs.push({ text: `${author}:`, style: "bold" });
  }
  
  // 3. Title with author
  let titleText = "";
  if (book.title) {
    titleText = `${book.title} / ${author}`;
    
    // Add illustrator if available (like in Python code)
    if (book.illustrator) {
      titleText += ` ; Illustrationen von ${book.illustrator}`;
    } else if (book.additionalAuthors && book.additionalAuthors.length > 0) {
      titleText += ` ; ${book.additionalAuthors.join(', ')}`;
    }
    
    titleText += ".";
    paragraphs.push({ text: titleText });
  }
  
  // 4. Edition, publisher, year info
  let pubInfo = "";
  if (book.edition) {
    pubInfo += `- ${book.edition}`;
  } else {
    pubInfo += "-";
  }
  
  // Publication place
  if (book.publicationPlace) {
    pubInfo += ` - ${book.publicationPlace}`;
  }
  
  // Publisher and year
  if (book.publisher) {
    pubInfo += `: ${book.publisher}`;
  }
  
  if (book.publicationYear) {
    pubInfo += `, ${book.publicationYear}`;
  }
  
  pubInfo += ".";
  paragraphs.push({ text: pubInfo });
  
  // 5. Physical description (pages, illustrations, dimensions)
  let physicalInfo = "";
  
  // Pages
  if (book.pageCount) {
    physicalInfo += `${book.pageCount} S.`;
  }
  
  // Illustrations (using the exact format from Python)
  if (book.illustrations) {
    physicalInfo += ` : ${book.illustrations}`;
  } else {
    physicalInfo += " : Illustrationen";
  }
  
  // Dimensions
  if (book.dimensions) {
    physicalInfo += ` ; ${book.dimensions}`;
  }
  
  paragraphs.push({ text: physicalInfo });
  
  // 6. ISBN and price
  if (book.isbn) {
    let isbnInfo = `ISBN ${book.isbn}`;
    
    if (book.binding) {
      isbnInfo += ` ${book.binding}`;
    } else {
      isbnInfo += ` Festeinb.`;
    }
    
    if (book.price) {
      isbnInfo += ` : ${book.price}`;
    }
    
    paragraphs.push({ text: isbnInfo });
  }
  
  // 7. Review (in italics as in Python)
  if (book.review) {
    paragraphs.push({ text: book.review, style: "italic" });
  }
  
  // 8. Reviewer name
  if (book.reviewerName) {
    paragraphs.push({ text: book.reviewerName });
  }
  
  // 9. Interest/IK category
  if (book.interestCategory) {
    paragraphs.push({ text: `IK: ${book.interestCategory}` });
  }
  
  // 10. Summary with header
  if (book.summary) {
    paragraphs.push({ 
      text: `Zusammenfassung: ${book.summary}`, 
      style: "bold" 
    });
  }
  
  // Render each paragraph
  for (const p of paragraphs) {
    // Check if we'd exceed the box boundary
    if (textY + 12 > boxY + boxHeight - 5) break;
    
    // Set style based on paragraph type
    if (p.style === "bold") {
      doc.setFont("times", "bold");
    } else if (p.style === "italic") {
      doc.setFont("times", "italic");
    } else {
      doc.setFont("times", "normal");
    }
    
    doc.setFontSize(9);
    
    // Render text with proper spacing
    const lines = doc.splitTextToSize(p.text, maxTextWidth);
    
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], startX, textY + (i * 4), { align: 'left' });
    }
    
    // Update Y position for next paragraph
    textY += (lines.length * 4) + 2; // Add a small gap between paragraphs
  }
}

/**
 * This function was used in the previous implementation but is no longer needed
 * since we're using a different rendering approach based on the Python code.
 * Keeping it as a reference for the changes needed.
 */
function renderText_OLD(
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
 * Based on the Python implementation's fixed layout format
 */
export function exportMultipleBooksToSinglePDF(books: Partial<Book>[], language: string = 'de'): void {
  if (!books || books.length === 0) return;
  
  // Create a new PDF document
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4'
  });
  
  // Set up document constants based on Python implementation
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20; // 2cm margin
  const gap = 10;   // 1cm gap
  
  // Calculate column dimensions
  const colWidth = (pageWidth - 2 * margin - gap) / 2;
  const rowHeight = (pageHeight - 2 * margin) / 2;
  const boxHeight = rowHeight - 10;
  
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
    const footerY = margin + boxHeight - 5;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("ekz-Informationsdienst", boxX + (colWidth / 2), footerY, { align: 'center' });
    
    // Render book data inside the box
    renderBookData(doc, book, boxX, boxY, colWidth, boxHeight);
  });
  
  // Save the PDF
  const fileName = `exported_books_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}