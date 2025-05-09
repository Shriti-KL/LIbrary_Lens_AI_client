import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { Book } from '@shared/schema';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format date to readable string
export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Convert file to base64 string
export async function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Extract the base64 part without the data URL prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = error => reject(error);
  });
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Generate a random ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// Parse error message from API response
export function parseErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  return 'An unknown error occurred';
}

// Extract file extension from filename
export function getFileExtension(filename: string): string {
  return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
}

// Check if file is an image
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

// Format bytes to readable string (KB, MB)
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// Format ISBN with proper hyphens
export function formatISBN(isbn: string | null): string {
  if (!isbn) return '';
  
  // Remove all non-digit and non-X characters (ISBN-10 can end with X)
  const cleanISBN = isbn.replace(/[^\dX]/gi, '');
  
  // If it's not a valid length for ISBN-10 or ISBN-13, return as is
  if (cleanISBN.length !== 10 && cleanISBN.length !== 13) {
    return isbn;
  }
  
  // Format ISBN-10: e.g., 1-234-56789-X
  if (cleanISBN.length === 10) {
    return `${cleanISBN.substring(0, 1)}-${cleanISBN.substring(1, 4)}-${cleanISBN.substring(4, 9)}-${cleanISBN.substring(9, 10)}`;
  }
  
  // Format ISBN-13: e.g., 978-3-16-148410-0
  // Common prefixes for ISBN-13 (978 or 979)
  const prefix = cleanISBN.substring(0, 3);
  // Next section is typically the language/country group (1-5 digits)
  // For standard formatting, let's use common group lengths
  
  // Examples of group lengths for major languages:
  // English (0, 1): 978-0-... or 978-1-...
  // German (3): 978-3-...
  // French (2): 978-2-...
  
  // Use a simplified approach that works for most common ISBNs
  let formattedISBN: string;
  
  if (cleanISBN.startsWith('978') || cleanISBN.startsWith('979')) {
    // Check for common language groups
    if (cleanISBN.startsWith('9780') || cleanISBN.startsWith('9781')) {
      // English language books (usually 978-0 or 978-1)
      formattedISBN = `${cleanISBN.substring(0, 3)}-${cleanISBN.substring(3, 4)}-${cleanISBN.substring(4, 8)}-${cleanISBN.substring(8, 12)}-${cleanISBN.substring(12, 13)}`;
    } else if (cleanISBN.startsWith('9783')) {
      // German language books (usually 978-3)
      formattedISBN = `${cleanISBN.substring(0, 3)}-${cleanISBN.substring(3, 4)}-${cleanISBN.substring(4, 10)}-${cleanISBN.substring(10, 12)}-${cleanISBN.substring(12, 13)}`;
    } else {
      // Default pattern for other language groups
      formattedISBN = `${cleanISBN.substring(0, 3)}-${cleanISBN.substring(3, 5)}-${cleanISBN.substring(5, 11)}-${cleanISBN.substring(11, 12)}-${cleanISBN.substring(12, 13)}`;
    }
  } else {
    // Fall back to a generic chunking if the ISBN-13 doesn't start with 978 or 979
    formattedISBN = `${cleanISBN.substring(0, 3)}-${cleanISBN.substring(3, 6)}-${cleanISBN.substring(6, 9)}-${cleanISBN.substring(9, 12)}-${cleanISBN.substring(12, 13)}`;
  }
  
  return formattedISBN;
}

// Remove hyphens and other non-alphanumeric characters from ISBN for searching
export function cleanISBNForSearch(isbn: string | null): string {
  if (!isbn) return '';
  return isbn.replace(/[^\dX]/gi, '');
}

// Format book data for PDF export
export function formatBookEntryForPDF(doc: any, book: Book, startY: number = 20): number {
  let yPos = startY;
  
  // --- 1. ASB Classification in top-right and top-left corner ---
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  
  // Top-left ASB label
  doc.text("ASB:", 22, yPos);
  
  // Top-right catalog number
  const asbNumber = book.catalogNumber || "";
  doc.text(asbNumber, 190, yPos, { align: 'right' });
  
  // Second line - secondary classification under ASB
  yPos += 7;
  const secondaryCode = book.secondaryClassification || "";
  doc.text(secondaryCode, 22, yPos);
  
  yPos += 15; // Space after classifications
  
  // --- 2. Author's name in bold ---
  // Format author's name to "LastName, FirstName:" as shown in the sample
  let authorFormatted = book.author;
  if (book.author.includes(" ") && !book.author.includes(",")) {
    const nameParts = book.author.split(" ");
    const lastName = nameParts.pop();
    const firstName = nameParts.join(" ");
    authorFormatted = `${lastName}, ${firstName}`;
  }
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold"); 
  doc.text(authorFormatted + ":", 22, yPos);
  
  yPos += 6; // Space after author name
  
  // --- 3. Book title and publication info ---
  doc.setFont("helvetica", "normal");
  
  // Get the title and subtitle if available
  let titleFull = book.title;
  let subtitle = '';
  
  // Extract subtitle if present (after dash or colon)
  if (book.title.includes(" - ")) {
    const titleParts = book.title.split(" - ");
    titleFull = titleParts[0].trim();
    subtitle = titleParts.slice(1).join(" - ").trim();
  } else if (book.title.includes(":")) {
    const titleParts = book.title.split(":");
    titleFull = titleParts[0].trim();
    subtitle = titleParts.slice(1).join(":").trim();
  }
  
  // Format the title line with subtitle if present
  let titleText = titleFull;
  if (subtitle) {
    titleText = `${titleFull} : ${subtitle}`;
  }
  
  // Use statement of responsibility if available, otherwise construct from available data
  if (book.statementOfResponsibility) {
    titleText += ` / ${book.statementOfResponsibility}`;
  } else {
    let hasEditors = false;
    if (book.contributors && Array.isArray(book.contributors) && book.contributors.length > 0) {
      // Find editors/publishers
      const editors = book.contributors.filter((c: any) => 
        c.role?.toLowerCase() === 'herausgeber' || c.role?.toLowerCase() === 'editor');
      
      if (editors.length > 0) {
        titleText += ` / ${editors.map((e: any) => e.name).join(", ")} (Herausgeber)`;
        hasEditors = true;
      }
    }
    
    // If no editors found, add the author in the correct format
    if (!hasEditors) {
      // If we have illustrator information, include it with the author
      if (book.illustrator) {
        titleText += ` / ${book.author} ; Illustrationen von ${book.illustrator}`;
      } else {
        titleText += ` / ${book.author}`;
      }
    }
  }
  
  // Split the title text for proper wrapping
  const titleLines = doc.splitTextToSize(titleText, 155);
  
  // Set the title lines
  for (let i = 0; i < titleLines.length; i++) {
    doc.text(titleLines[i], 22, yPos);
    yPos += 5;
  }
  
  // --- 4. Publication Information ---
  yPos += 2; // Extra space before publication info
  
  // Build full publication string following the exact format in the sample image
  let publicationInfo = '';
  
  // Start with edition information
  publicationInfo += book.edition || '';
  
  // Add location and publisher 
  const location = book.location || '';
  const publisher = book.publisher || '';
  publicationInfo += `. - ${location} : ${publisher}`;
  
  // Add year
  publicationInfo += book.publishedYear ? `, ${book.publishedYear}` : ``;
  
  // Add physical description - pages
  publicationInfo += `. - ${book.pageCount || ''} Seiten`;
  
  // Add illustration information if appropriate - using format from sample image
  if (book.illustrator || (book.contributors && Array.isArray(book.contributors))) {
    // Check direct illustrator field first
    if (book.illustrator) {
      publicationInfo += ` : Illustrationen`;
      // Default to color illustrations
      publicationInfo += `, farbig`;
    } 
    // Then check contributors array
    else if (book.contributors && Array.isArray(book.contributors)) {
      const illustrators = book.contributors.filter((c: any) => 
        c.role?.toLowerCase() === 'illustrator' || c.role?.toLowerCase().includes('illust'));
      
      if (illustrators.length > 0) {
        publicationInfo += ` : Illustrationen`;
        // Default to color illustrations
        publicationInfo += `, farbig`;
      }
    }
  }
  
  // Add dimensions if available
  publicationInfo += book.dimensions ? ` ; ${book.dimensions}` : ``;
  
  // Add series information or publisher info if available
  if (book.series) {
    publicationInfo += ` (${book.series})`;
  }
  
  // Split the publication info text for proper wrapping - match exact width from sample
  const pubLines = doc.splitTextToSize(publicationInfo, 165);
  
  // Set the publication info lines with helvetica font matching the sample
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < pubLines.length; i++) {
    doc.text(pubLines[i], 22, yPos);
    yPos += 5;
  }
  
  // --- 5. ISBN and Price information ---
  if (book.isbn) {
    yPos += 2; // Extra small space before ISBN line
    
    let isbnLine = `ISBN ${formatISBN(book.isbn)}`;
    
    // Add binding type if available
    if (book.binding) {
      isbnLine += ` - ${book.binding}`;
    }
    
    // Add price if available (with comma, not period, for decimal values in German format)
    if (book.price) {
      isbnLine += ` : EUR ${book.price.toString().replace('.', ',')}`;
    }
    
    doc.setFont("helvetica", "normal");
    doc.text(isbnLine, 22, yPos);
    yPos += 7;
  }
  
  // --- 6. Book summary/description ---
  if (book.summary) {
    yPos += 2;
    
    // Set text style for summary text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    // Clean up the summary to remove redundant metadata
    let summaryText = book.summary;
    
    // Remove metadata-like patterns that might be in the summary
    const metadataPatterns = [
      /\*\*Titel:\*\*.*\n?/i,
      /\*\*Autor(?:in)?:\*\*.*\n?/i,
      /\*\*Erscheinungsjahr:\*\*.*\n?/i,
      /\*\*Verlag:\*\*.*\n?/i,
      /\*\*ISBN:\*\*.*\n?/i,
      /\*\*Seiten:\*\*.*\n?/i,
    ];
    
    metadataPatterns.forEach(pattern => {
      summaryText = summaryText.replace(pattern, '');
    });
    
    summaryText = summaryText.trim();
    
    // Split the summary text for proper wrapping with appropriate line width
    const summaryLines = doc.splitTextToSize(summaryText, 160);
    
    // Set the summary lines with a slightly smaller font size
    for (let i = 0; i < summaryLines.length; i++) {
      doc.text(summaryLines[i], 22, yPos);
      yPos += 4.5; // Slightly less line spacing for summary text
    }
  }
  
  yPos += 5; // Extra space after summary
  
  // --- 7. Interest category and tags ---
  if (book.interestCategory || book.readingLevel || 
      (Array.isArray(book.genres) && book.genres.length > 0) || 
      (Array.isArray(book.themes) && book.themes.length > 0)) {
    
    let tagsLine = '';
    
    // Add interest category if available
    if (book.interestCategory) {
      tagsLine += book.interestCategory;
    }
    
    // Add reading level if available and different from interest category
    if (book.readingLevel && !tagsLine.includes(book.readingLevel)) {
      if (tagsLine) tagsLine += ' | ';
      tagsLine += book.readingLevel;
    }
    
    // Add reviewer if available
    if (book.reviewerName) {
      if (tagsLine) tagsLine += ' | ';
      tagsLine += `Rezensent: ${book.reviewerName}`;
    }
    
    // Split the tags line if it's getting too long
    if (tagsLine) {
      const tagsLines = doc.splitTextToSize(tagsLine, 165);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      
      for (let i = 0; i < tagsLines.length; i++) {
        doc.text(tagsLines[i], 22, yPos);
        yPos += 4;
      }
    }
  }
  
  // Add a separator line
  yPos += 4;
  doc.setDrawColor(200, 200, 200);
  doc.line(22, yPos, 190, yPos);
  yPos += 8;
  
  return yPos;
}

// Generate a realistic barcode according to the image sample
function drawFauxBarcode(doc: any, x: number, y: number, width: number, height: number, isbn: string) {
  const barWidth = 0.5;
  let xPos = x;

  doc.setFillColor(0, 0, 0);

  // Draw random bars to simulate a barcode
  for (let i = 0; i < width; i += barWidth * 2) {
    // Skip some positions to create white spaces
    if (Math.random() > 0.7) continue;
    
    const barHeight = height * (0.8 + Math.random() * 0.2);
    doc.rect(xPos, y, barWidth, barHeight, 'F');
    xPos += barWidth * 2;
  }

  // Draw ISBN text under barcode
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(isbn ? isbn : "Sample Barcode", x + width / 2, y + height + 5, { align: 'center' });
}

// Export a single book to PDF
export function exportBookToPDF(book: Book): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  formatBookEntryForPDF(doc, book);
  
  // Add a barcode at the bottom
  if (book.isbn) {
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    drawFauxBarcode(doc, (pageWidth - 80) / 2, pageHeight - 25, 80, 12, book.isbn);
  }
  
  // Generate a timestamped filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const safeTitle = book.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50);
  doc.save(`${safeTitle}_${timestamp}.pdf`);
}

// Export multiple books to a single PDF
export function exportMultipleBooksToSinglePDF(books: Book[]): void {
  if (!books || books.length === 0) return;
  
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });
  
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 22; // Match the left margin used in formatBookEntryForPDF
  
  // Title page
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("Bücherkatalog", pageWidth / 2, 40, { align: 'center' });
  
  // Subtitle with date
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  const today = new Date().toLocaleDateString('de-DE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  doc.text(`Erstellt am ${today}`, pageWidth / 2, 50, { align: 'center' });
  
  // Add book count
  doc.setFontSize(14);
  doc.text(`${books.length} ${books.length === 1 ? 'Buch' : 'Bücher'}`, pageWidth / 2, 60, { align: 'center' });
  
  // Add separator line
  doc.setDrawColor(100, 100, 100);
  doc.line(margin, 70, pageWidth - margin, 70);
  
  // Table of contents
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Inhaltsverzeichnis", margin, 85);
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  
  let tocY = 95;
  books.forEach((book, index) => {
    const listNumber = (index + 1).toString().padStart(2, '0');
    const entry = `${listNumber}. ${book.author}: ${book.title}`;
    
    const lines = doc.splitTextToSize(entry, pageWidth - (margin * 2) - 15);
    for (let i = 0; i < lines.length; i++) {
      doc.text(lines[i], margin + 5, tocY);
      tocY += 6;
    }
    
    // Add page reference
    doc.text((index + 2).toString(), pageWidth - margin, tocY - 6, { align: 'right' });
    
    // Check if we need to start a new page for TOC
    if (tocY > pageHeight - 30) {
      doc.addPage();
      tocY = 30;
    }
  });
  
  // Add book details on separate pages
  books.forEach((book, index) => {
    doc.addPage();
    formatBookEntryForPDF(doc, book, 30);
    
    // Add page number indicator in the footer
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Buch ${index + 1} von ${books.length}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    
    // Add a barcode if there's an ISBN
    if (book.isbn) {
      drawFauxBarcode(doc, (pageWidth - 80) / 2, pageHeight - 30, 80, 12, book.isbn);
    }
  });
  
  // Format two books per page in a grid layout
  function formatBookEntryForGrid(doc: any, book: Book, x: number, y: number, width: number, height: number) {
    const originalFontSize = doc.getFontSize();
    const scaleFactor = 0.7; // Reduce size for grid layout
    
    doc.setFontSize(originalFontSize * scaleFactor);
    
    // Draw a border
    doc.setDrawColor(200, 200, 200);
    doc.rect(x, y, width, height);
    
    // Title and author
    doc.setFont("helvetica", "bold");
    doc.text(book.title, x + 5, y + 8);
    doc.setFont("helvetica", "normal");
    doc.text(book.author, x + 5, y + 14);
    
    // ISBN and genres
    if (book.isbn) {
      doc.text(`ISBN: ${formatISBN(book.isbn)}`, x + 5, y + 20);
    }
    
    if (Array.isArray(book.genres) && book.genres.length > 0) {
      doc.text(`Genres: ${book.genres.join(', ')}`, x + 5, y + 26);
    }
    
    // Restore original font size
    doc.setFontSize(originalFontSize);
  }
  
  // Add grid layout with all books for overview
  if (books.length > 1) {
    doc.addPage();
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Bücherübersicht", pageWidth / 2, 20, { align: 'center' });
    
    const gridX = margin;
    const gridY = 30;
    const cellWidth = (pageWidth - (margin * 2)) / 2;
    const cellHeight = 35;
    const colCount = 2;
    const rowCount = Math.ceil(books.length / colCount);
    
    let currentBook = 0;
    for (let row = 0; row < rowCount; row++) {
      for (let col = 0; col < colCount; col++) {
        if (currentBook >= books.length) break;
        
        const x = gridX + (col * cellWidth);
        const y = gridY + (row * cellHeight);
        
        formatBookEntryForGrid(doc, books[currentBook], x, y, cellWidth, cellHeight);
        currentBook++;
      }
    }
  }
  
  // Add page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`Seite ${i} von ${pageCount}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
  }
  
  // Generate a timestamped filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  doc.save(`Buchkatalog_${timestamp}.pdf`);
}
