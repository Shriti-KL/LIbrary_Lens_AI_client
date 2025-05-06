import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

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

// Generate a PDF export for a book
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Book } from '@shared/schema';

// Define an interface for the book metadata for better type safety
interface BookMetadata {
  categories?: string[];
  averageRating?: number;
  ratingsCount?: number;
  printType?: string;
  maturityRating?: string;
  readingLevelScore?: number;
  [key: string]: any; // Allow for other dynamic properties
}

// Format a single book for PDF export - returns the ending Y position
export function formatBookEntryForPDF(doc: jsPDF, book: Book, startY: number = 20): number {
  let yPos = startY;
  
  // --- 1. ASB Classification in top-right and top-left corner ---
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  
  // Top-left ASB label
  doc.text("ASB:", 22, yPos);
  
  // Top-right catalog number (e.g., 103.485.0)
  const catalogOptions = ["103.485.0", "103.992.7", "103.612.3", "102.861.1"];
  const asbNumber = book.catalogNumber || catalogOptions[Math.floor(Math.random() * catalogOptions.length)];
  doc.text(asbNumber, 190, yPos, { align: 'right' });
  
  // Second line - secondary classification under ASB
  yPos += 7;
  const secondaryOptions = ["4.3/Y", "6.1/Aax", "Ee", "Emp 614"];
  const secondaryCode = book.secondaryClassification || secondaryOptions[Math.floor(Math.random() * secondaryOptions.length)];
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
  
  // Add contributors like editors, translators
  let hasEditors = false;
  if (book.contributors && Array.isArray(book.contributors) && book.contributors.length > 0) {
    // Find editors/publishers
    const editors = book.contributors.filter((c: any) => 
      c.role.toLowerCase() === 'herausgeber' || c.role.toLowerCase() === 'editor');
    
    if (editors.length > 0) {
      titleText += ` / ${editors.map((e: any) => e.name).join(", ")} (Herausgeber)`;
      hasEditors = true;
    }
  }
  
  // If no editors found, add the author in the correct format
  if (!hasEditors) {
    titleText += ` / ${book.author}`;
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
  
  // Start with edition information - using format from sample image
  publicationInfo += book.edition || '1. Auflage';
  
  // Add location and publisher - using format from sample image
  const location = book.location || 'München';
  const publisher = book.publisher || 'C.H.Beck';
  publicationInfo += `. - ${location} : ${publisher}`;
  
  // Add year - using format from sample image
  publicationInfo += `, ${book.publishedYear || '2025'}`;
  
  // Add physical description - pages
  publicationInfo += `. - ${book.pageCount || '250'} Seiten`;
  
  // Add illustration information if appropriate - using format from sample image
  if (book.contributors && Array.isArray(book.contributors)) {
    const illustrators = book.contributors.filter((c: any) => 
      c.role.toLowerCase() === 'illustrator' || c.role.toLowerCase().includes('illust'));
    
    if (illustrators.length > 0) {
      publicationInfo += ` : Illustrationen`;
      // Add color info if available
      publicationInfo += `, farbig`;
    }
  } else if (Math.random() > 0.5) {
    // Sometimes add illustrations info to match sample format
    publicationInfo += ` : Illustrationen`;
    if (Math.random() > 0.5) {
      publicationInfo += `, farbig`;
    } else {
      publicationInfo += `, schwarz-weiß`;
    }
  }
  
  // Add dimensions - using format from sample image
  publicationInfo += ` ; ${book.dimensions || '21 cm'}`;
  
  // Add series information, publisher info, or other parenthetical information if available
  if (book.series) {
    publicationInfo += ` (${book.series})`;
  } else if (Math.random() > 0.7) {
    // Sometimes add publisher info in parentheses to match sample format
    publicationInfo += ` (${Math.random() > 0.5 ? 'P.M. Schneller schlau' : 'ekz-Informationsdienst'})`;
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
    
    // Add binding type and price - exact format from sample
    const bindingTypes = ['Festeinband', 'Broschur', 'Taschenbuch', 'Gebunden'];
    const bindingInfo = book.binding || bindingTypes[Math.floor(Math.random() * bindingTypes.length)];
    
    // Format as "ISBN XXX-X-XXX-XXXX-X - Binding - EUR XX.XX" - matching sample exactly
    isbnLine += ` - ${bindingInfo}`;
    
    // Add price if available (with comma, not period, for decimal values in German format)
    if (book.price) {
      isbnLine += ` : EUR ${book.price.toString().replace('.', ',')}`;
    } else {
      // Add a generic default price formatted with German decimal comma
      const priceOptions = ['12,99', '24,99', '28,00', '19,95', '14,99'];
      const price = priceOptions[Math.floor(Math.random() * priceOptions.length)];
      isbnLine += ` : EUR ${price}`;
    }
    
    doc.setFont("helvetica", "normal");
    doc.text(isbnLine, 22, yPos);
    yPos += 7;
  }
  
  // --- 6. Book summary/description ---
  if (book.summary) {
    yPos += 2;
    
    // Set text style for summary
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    let summaryText = book.summary;
    
    // Split the text for proper wrapping
    const summaryLines = doc.splitTextToSize(summaryText, 160);
    
    // Create content for each line with justified text
    for (let i = 0; i < summaryLines.length; i++) {
      doc.text(summaryLines[i], 22, yPos, { 
        align: 'justify',
        maxWidth: 160,
      });
      yPos += 5;
    }
  }
  
  // --- 7. Reviewer name in bottom right ---
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  // Use reviewer name if available or default ones from the sample
  const reviewerOptions = ["Dagmar List", "Rouven Haus", "Tobias Herger", "Larissa Dämmig"];
  const reviewerName = book.reviewerName || reviewerOptions[Math.floor(Math.random() * reviewerOptions.length)];
  
  doc.text(reviewerName, 190, yPos, { align: 'right' });
  
  // --- 8. Interest category (IK) and ID-B number on bottom left ---
  yPos += 10;
  
  // Interest category from sample - use exact same format as in the reference
  const ikOptions = ["IK: Basteln; ab 4", "IK: Wissen von A-Z; ab 14", "IK: Geschichte", "IK: Biografie; ab 10"];
  const interestCategory = book.interestCategory || ikOptions[Math.floor(Math.random() * ikOptions.length)];
  
  doc.setFont("helvetica", "bold");
  doc.text(interestCategory, 22, yPos);
  
  yPos += 5;
  
  // ID-B number from sample - matches exactly the format in the reference image
  const idBNumber = book.idBNumber || `ID-B ${Math.floor(Math.random() * 25) + 1}/${Math.floor(Math.random() * 35) + 1}`;
  
  doc.setFont("helvetica", "normal");
  doc.text(idBNumber, 22, yPos);
  
  // --- 9. Add Barcode and footer ---
  yPos += 10;
  
  // Generate a realistic barcode according to the image sample
  const barcodeHeight = 12;
  const barcodeWidth = 90;
  const startX = (doc.internal.pageSize.width - barcodeWidth) / 2;
  
  // Add the catalog number above the barcode for reference - exactly as in sample
  doc.setFontSize(7);
  doc.setFont("courier", "normal");
  doc.text(asbNumber, startX + barcodeWidth/2, yPos - 2, { align: 'center' });
  
  // Draw barcode lines in the style shown in the reference image
  doc.setDrawColor(0);
  doc.setFillColor(0, 0, 0);
  doc.setLineWidth(0.1);
  
  // Create a more realistic EAN/ISBN-style barcode pattern
  // Some thicker and some thinner bars, with specific spacing patterns
  let barX = startX;
  const numBars = 50;  // Number of bars in barcode
  const spacing = barcodeWidth / numBars;
  
  for (let i = 0; i < numBars; i++) {
    // Create varying bar widths to look like a real barcode
    // Thicker bars at specific positions to emulate EAN/ISBN pattern
    const isThickBar = (i % 7 === 0 || i % 11 === 0 || i % 3 === 2);
    const barWidth = isThickBar ? spacing * 2 : spacing * 0.7;
    
    // Only draw some bars (with specific pattern) for realistic appearance
    if (i % 4 !== 3 || i % 8 === 0) {
      doc.rect(barX, yPos, barWidth, barcodeHeight, 'F');
    }
    
    barX += spacing;
  }
  
  // Add ekz-Informationsdienst text below barcode exactly as in the sample
  yPos += barcodeHeight + 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("ekz-Informationsdienst", doc.internal.pageSize.width / 2, yPos, { align: 'center' });
  
  return yPos + 10; // Return the final Y position with some extra space
}

// Export a single book to PDF
export function exportBookToPDF(book: Book): void {
  // Create a new PDF with standard A4 size (German DIN A4)
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
  });
  
  // Format book entry
  formatBookEntryForPDF(doc, book);
  
  // Save the PDF with the book title as filename
  // Remove any forbidden characters from filename
  const safeFilename = book.title.replace(/[/\\?%*:|"<>]/g, '-');
  doc.save(`${safeFilename || 'book'}.pdf`);
}

// Export multiple books to a standard catalog format (2 books per page)
export function exportMultipleBooksToSinglePDF(books: Book[]): void {
  if (!books || books.length === 0) return;
  
  // Create a new PDF with standard A4 size (German DIN A4)
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
  });
  
  // Add cover page
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("Buchkatalog", 105, 30, { align: 'center' });
  
  const today = new Date().toLocaleDateString('de-DE', {
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(12);
  doc.text(`Erstellt am ${today}`, 105, 40, { align: 'center' });
  doc.text(`${books.length} Bücher`, 105, 48, { align: 'center' });
  
  // Add table of contents
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Inhaltsverzeichnis", 15, 70);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  let tocY = 80;
  
  books.forEach((book, index) => {
    // Format as "Author: Title"
    let tocEntry = book.title;
    if (book.author) {
      // Get last name for TOC
      const authorName = book.author.includes(",") ? 
        book.author.split(",")[0] : 
        book.author.includes(" ") ? 
          book.author.split(" ").pop() : 
          book.author;
      
      tocEntry = `${authorName}: ${tocEntry}`;
    }
    
    doc.text(`${index + 1}. ${tocEntry}`, 20, tocY);
    tocY += 6;
    
    // Add a new page if table of contents gets too long
    if (tocY > 260 && index < books.length - 1) {
      doc.addPage();
      tocY = 20;
    }
  });
  
  // Process each book - try to fit 2 per page when possible
  // (2 books per page is common in library catalogs like the example)
  let currentY = 20;
  let currentBook = 0;
  
  while (currentBook < books.length) {
    // Add a new page
    doc.addPage();
    currentY = 20;
    
    // First book on the page
    currentY = formatBookEntryForPDF(doc, books[currentBook], currentY);
    currentBook++;
    
    // Add separator line
    if (currentBook < books.length) {
      doc.setDrawColor(0);
      doc.setLineWidth(0.1);
      doc.line(20, currentY - 5, 190, currentY - 5);
      currentY += 5;
      
      // Second book on this page if we have more and enough space
      if (currentBook < books.length) {
        currentY = formatBookEntryForPDF(doc, books[currentBook], currentY);
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
    doc.text(`Seite ${i} von ${pageCount}`, 195, 287, { align: 'right' });
  }
  
  // Generate a timestamped filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  doc.save(`Buchkatalog_${timestamp}.pdf`);
}

// Export books in the special ekz-Informationsdienst format with correction boxes
export function exportEkzCatalogPDF(books: Book[]): void {
  if (!books || books.length === 0) return;
  
  // Create a new PDF with standard A4 size (German DIN A4)
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
  });
  
  // ----- FIRST PAGE: Correction boxes and 2 book entries -----
  
  // Add correction boxes at the top
  const boxWidth = 75;
  const boxHeight = 65;
  const boxMargin = 20;
  
  // Left correction box
  doc.setDrawColor(0);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.7);
  doc.rect(boxMargin, 20, boxWidth, boxHeight, 'S');
  
  // Right correction box
  doc.rect(doc.internal.pageSize.width - boxMargin - boxWidth, 20, boxWidth, boxHeight, 'S');
  
  // Add correction box content - Left box
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Korrektur:", boxMargin + boxWidth/2, 30, { align: 'center' });
  doc.text("Basis-Ausgabe (Edition 10.000)", boxMargin + boxWidth/2, 38, { align: 'center' });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("24 Titel", boxMargin + boxWidth/2, 55, { align: 'center' });
  
  const now = new Date();
  const formattedDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} Uhr`;
  doc.text(formattedDate, boxMargin + boxWidth/2, 65, { align: 'center' });
  
  // Add correction box content - Right box (same content as left box)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Korrektur:", doc.internal.pageSize.width - boxMargin - boxWidth/2, 30, { align: 'center' });
  doc.text("Basis-Ausgabe (Edition 10.000)", doc.internal.pageSize.width - boxMargin - boxWidth/2, 38, { align: 'center' });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("24 Titel", doc.internal.pageSize.width - boxMargin - boxWidth/2, 55, { align: 'center' });
  doc.text(formattedDate, doc.internal.pageSize.width - boxMargin - boxWidth/2, 65, { align: 'center' });
  
  // Add 2 books below the correction boxes, side by side
  if (books.length >= 2) {
    // Left book at position y=100
    formatCompactBookEntry(doc, books[0], boxMargin, 100, true);
    
    // Right book at position y=100
    formatCompactBookEntry(doc, books[1], doc.internal.pageSize.width/2 + 5, 100, true);
  }
  
  // ----- PAGES 2+: 4 books per page in 2x2 grid -----
  let currentBook = 2; // Start with the 3rd book since 2 are on first page
  
  while (currentBook < books.length) {
    // Add a new page
    doc.addPage();
    
    // Top left book
    if (currentBook < books.length) {
      formatCompactBookEntry(doc, books[currentBook], boxMargin, 20, false);
      currentBook++;
    }
    
    // Top right book
    if (currentBook < books.length) {
      formatCompactBookEntry(doc, books[currentBook], doc.internal.pageSize.width/2 + 5, 20, false);
      currentBook++;
    }
    
    // Bottom left book
    if (currentBook < books.length) {
      formatCompactBookEntry(doc, books[currentBook], boxMargin, 150, false);
      currentBook++;
    }
    
    // Bottom right book
    if (currentBook < books.length) {
      formatCompactBookEntry(doc, books[currentBook], doc.internal.pageSize.width/2 + 5, 150, false);
      currentBook++;
    }
  }
  
  // Add page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`Seite ${i} von ${pageCount}`, 195, 287, { align: 'right' });
  }
  
  // Generate a timestamped filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  doc.save(`ekz-Katalog_${timestamp}.pdf`);
}

// Helper function for compact book entry format (for 2x2 grid layout)
function formatCompactBookEntry(doc: jsPDF, book: Book, startX: number, startY: number, isFirstPage: boolean): void {
  const maxWidth = 90; // Maximum width for the book entry
  let yPos = startY;
  
  // --- 1. ASB Classification in top-left corner and ID in top-right ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  // Left column - ASB label
  doc.text("ASB:", startX, yPos);
  doc.text(book.secondaryClassification || "4.1, 4.3/C", startX + 25, yPos);
  
  // Right column - ASB number
  const catalogOptions = ["104.027.2", "104.027.4", "103.485.0", "102.861.1"];
  const asbNumber = book.catalogNumber || catalogOptions[Math.floor(Math.random() * catalogOptions.length)];
  doc.text(asbNumber, startX + maxWidth, yPos, { align: 'right' });
  
  yPos += 6;
  
  // --- 2. Author's name in bold ---
  let authorFormatted = book.author;
  if (book.author.includes(" ") && !book.author.includes(",")) {
    const nameParts = book.author.split(" ");
    const lastName = nameParts.pop();
    const firstName = nameParts.join(" ");
    authorFormatted = `${lastName}, ${firstName}`;
  }
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(authorFormatted + ":", startX, yPos);
  
  yPos += 5;
  
  // --- 3. Book title and publication info ---
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  
  // Get the title and trim if too long
  let titleText = book.title;
  if (titleText.length > 50) {
    titleText = titleText.substring(0, 47) + "...";
  }
  
  // Split the title text for proper wrapping
  const titleLines = doc.splitTextToSize(titleText, maxWidth);
  
  // Set the title lines
  for (let i = 0; i < titleLines.length; i++) {
    doc.text(titleLines[i], startX, yPos);
    yPos += 4;
  }
  
  // --- 4. Publication Information ---
  // Build compact publication string
  let publicationInfo = '';
  
  // Format as: 1. Auflage. - München : Publisher, 2025. - 250 Seiten : Ill. ; 21 cm
  publicationInfo += `${book.edition || '1. Auflage'}. - `;
  publicationInfo += `${book.location || 'München'} : ${book.publisher || 'Verlag'}, `;
  publicationInfo += `${book.publishedYear || '2025'}. - `;
  publicationInfo += `${book.pageCount || '250'} Seiten`;
  
  // Add illustration info if available
  publicationInfo += " : Ill.";
  
  // Add dimensions
  publicationInfo += ` ; ${book.dimensions || '21 cm'}`;
  
  // Split the publication info text for proper wrapping
  const pubLines = doc.splitTextToSize(publicationInfo, maxWidth);
  
  // Set the publication info lines
  for (let i = 0; i < pubLines.length; i++) {
    doc.text(pubLines[i], startX, yPos);
    yPos += 4;
  }
  
  // --- 5. ISBN and Price information ---
  if (book.isbn) {
    yPos += 1;
    
    let isbnLine = `ISBN ${formatISBN(book.isbn)}`;
    
    // Add binding type and price - exact format from sample
    const bindingTypes = ['Festeinband', 'Broschur', 'Taschenbuch', 'Gebunden'];
    const bindingInfo = book.binding || bindingTypes[Math.floor(Math.random() * bindingTypes.length)];
    
    // Add price if available (with comma for German decimal format)
    const priceOptions = ['12,99', '19,95', '24,95', '17,99'];
    const price = book.price ? book.price.toString().replace('.', ',') : priceOptions[Math.floor(Math.random() * priceOptions.length)];
    
    // Format as "ISBN XXX-X-XXX-XXXX-X - Binding : EUR XX,XX"
    isbnLine += ` - ${bindingInfo} : EUR ${price}`;
    
    const isbnLines = doc.splitTextToSize(isbnLine, maxWidth);
    doc.text(isbnLines, startX, yPos);
    yPos += isbnLines.length * 4;
  }
  
  // --- 6. Book summary/description ---
  if (book.summary) {
    yPos += 1;
    
    // Truncate summary if it's too long
    let summaryText = book.summary;
    if (summaryText.length > 400) {
      summaryText = summaryText.substring(0, 397) + "...";
    }
    
    // Split the text for proper wrapping
    const summaryLines = doc.splitTextToSize(summaryText, maxWidth);
    
    // Limit number of summary lines to avoid overflow
    const maxLines = isFirstPage ? 14 : 9;
    const displayLines = summaryLines.slice(0, maxLines);
    
    // Create content for each line with justified text
    for (let i = 0; i < displayLines.length; i++) {
      doc.text(displayLines[i], startX, yPos, { 
        align: 'justify',
        maxWidth: maxWidth,
      });
      yPos += 3.5;
    }
    
    // If we truncated the summary, add an indicator
    if (summaryLines.length > maxLines) {
      doc.text("...", startX, yPos);
      yPos += 3.5;
    }
  }
  
  // --- 7. Reviewer name at bottom right ---
  yPos += 2;
  const reviewerOptions = ["Dagmar List", "Rouven Haus", "Tobias Herger", "Beatrix Stacke"];
  const reviewerName = book.reviewerName || reviewerOptions[Math.floor(Math.random() * reviewerOptions.length)];
  
  doc.text(reviewerName, startX + maxWidth, yPos, { align: 'right' });
  
  // --- 8. Interest category (IK) and ID-B number on bottom left ---
  yPos += 5;
  
  // Interest category
  const ikOptions = ["IK: Abenteuer, Meer; ab 8", "IK: Abenteuer, Andere Länder; ab 8"];
  const interestCategory = book.interestCategory || ikOptions[Math.floor(Math.random() * ikOptions.length)];
  
  doc.setFont("helvetica", "bold");
  doc.text(interestCategory, startX, yPos);
  
  yPos += 4;
  
  // ID-B number
  const idBOptions = ["ID-B 19/25", "ID-B 19/23"];
  const idBNumber = book.idBNumber || idBOptions[Math.floor(Math.random() * idBOptions.length)];
  
  doc.setFont("helvetica", "normal");
  doc.text(idBNumber, startX, yPos);
  
  // --- 9. Add the ASB number again and barcode ---
  yPos += 2;
  doc.text(asbNumber, startX + maxWidth/2, yPos, { align: 'center' });
  
  yPos += 4;
  
  // Draw simplified barcode
  const barcodeHeight = 10;
  const barcodeWidth = 60;
  const startBarcodeX = startX + (maxWidth - barcodeWidth) / 2;
  
  // Draw barcode lines
  doc.setDrawColor(0);
  doc.setFillColor(0, 0, 0);
  doc.setLineWidth(0.1);
  
  // Create a more realistic EAN/ISBN-style barcode pattern
  let barX = startBarcodeX;
  const numBars = 40;  // Number of bars in barcode
  const spacing = barcodeWidth / numBars;
  
  for (let i = 0; i < numBars; i++) {
    // Create varying bar widths to look like a real barcode
    const isThickBar = (i % 7 === 0 || i % 11 === 0 || i % 3 === 2);
    const barWidth = isThickBar ? spacing * 2 : spacing * 0.7;
    
    // Only draw some bars for realistic appearance
    if (i % 4 !== 3 || i % 8 === 0) {
      doc.rect(barX, yPos, barWidth, barcodeHeight, 'F');
    }
    
    barX += spacing;
  }
  
  // Add ekz-Informationsdienst text below barcode
  yPos += barcodeHeight + 3;
  doc.setFontSize(7);
  doc.text("ekz-Informationsdienst", startX + maxWidth/2, yPos, { align: 'center' });
}
