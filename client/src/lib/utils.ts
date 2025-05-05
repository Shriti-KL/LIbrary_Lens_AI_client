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
  
  // --- 1. Author's name in bold ---
  // Format: "Sorg, Marion:"
  doc.setFontSize(12);
  doc.setFont("times", "bold"); // Using Times for more traditional bibliographic look
  doc.text(`${book.author}:`, 15, yPos);
  
  yPos += 7; // Space after author name
  
  // --- 2. Title in normal weight ---
  // Get the title and subtitle if available
  let titleFull = book.title;
  let subtitle = '';
  
  // Try to extract subtitle if present (after colon)
  if (book.title.includes(':')) {
    const titleParts = book.title.split(':');
    titleFull = titleParts[0].trim();
    subtitle = titleParts.slice(1).join(':').trim();
  }
  
  // Format the title line with proper indentation for multi-line catalog entries
  // (Note: first line aligns with margin, subsequent lines are indented)
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  
  let titleText = titleFull;
  if (subtitle) {
    titleText += ` : ${subtitle}`;
  }
  
  // Add main contributor information
  titleText += ` / ${book.author}`;
  
  // Add all contributors with their roles from the contributors array
  if (book.contributors && Array.isArray(book.contributors) && book.contributors.length > 0) {
    // Process each contributor by role
    const illustrators = book.contributors.filter((c: any) => c.role.toLowerCase() === 'illustrator' || c.role.toLowerCase().includes('illust'));
    const translators = book.contributors.filter((c: any) => c.role.toLowerCase() === 'translator' || c.role.toLowerCase().includes('übersetz'));
    const editors = book.contributors.filter((c: any) => c.role.toLowerCase() === 'editor' || c.role.toLowerCase().includes('herausgeb'));
    const coAuthors = book.contributors.filter((c: any) => c.role.toLowerCase() === 'co-author' || c.role.toLowerCase().includes('mitautor'));
    
    // Add co-authors first
    if (coAuthors.length > 0) {
      titleText += `, ${coAuthors.map((c: any) => c.name).join(', ')}`;
    }
    
    // Add editors
    if (editors.length > 0) {
      titleText += ` ; ${editors.length > 1 ? 'Hrsg.' : 'Hrsg.'} ${editors.map((c: any) => c.name).join(', ')}`;
    }
    
    // Add translators
    if (translators.length > 0) {
      titleText += ` ; ${translators.length > 1 ? 'Übers.' : 'Übers.'} ${translators.map((c: any) => c.name).join(', ')}`;
    }
    
    // Add illustrators
    if (illustrators.length > 0) {
      titleText += ` ; ${illustrators.length > 1 ? 'Illustrationen von' : 'Illustration von'} ${illustrators.map((c: any) => c.name).join(', ')}`;
    }
  } 
  // Fallback to catalog entry if no contributors array but catalog mentions illustrators
  else if (book.catalogEntry && book.catalogEntry.includes('Illustration')) {
    const illustrationMatch = book.catalogEntry.match(/Illustration(?:en)?\s+von\s+[^.;]*/i);
    if (illustrationMatch) {
      titleText += ` ; ${illustrationMatch[0].trim()}`;
    }
  }
  
  // Split the title text for proper wrapping with hanging indent (2nd line onwards)
  const titleLines = doc.splitTextToSize(titleText, 170);
  
  // Set the first line
  doc.text(titleLines[0], 15, yPos);
  
  // Set subsequent lines with indent
  if (titleLines.length > 1) {
    for (let i = 1; i < titleLines.length; i++) {
      yPos += 5.5; // Line spacing
      doc.text(titleLines[i], 25, yPos); // Indented
    }
  }
  
  yPos += 7; // Space after title block
  
  // --- 3. Publication information ---
  // Format: "- 1. Auflage. - Location : Publisher, Year. - Pages : Illustrations ; Size"
  
  // Create publication details string
  let publicationInfo = book.edition ? `- ${book.edition}` : '- 1. Auflage.'; // Use book edition or default
  
  // Add location and publisher
  if (book.publisher) {
    // Determine location using book.location field first, then fallbacks
    let location = book.location || 'München'; // Use explicit location if available, default otherwise
    let publisher = book.publisher;
    
    // If no explicit location but publisher includes comma, first part might be location
    if (!book.location && book.publisher.includes(',')) {
      const parts = book.publisher.split(',');
      location = parts[0].trim();
      publisher = parts.slice(1).join(',').trim();
    }
    
    // If still no location and catalog entry contains location explicitly, use that
    if (!book.location && book.catalogEntry && book.catalogEntry.includes('-')) {
      const locationMatch = book.catalogEntry.match(/\-\s+([^:]+)\s+:/);
      if (locationMatch && locationMatch[1]) {
        location = locationMatch[1].trim();
      }
    }
    
    publicationInfo += ` - ${location} : ${publisher}`;
    
    // Add year
    if (book.publishedYear) {
      publicationInfo += `, ${book.publishedYear}`;
    } else {
      publicationInfo += ', 2025'; // Default to current year if not specified
    }
  }
  
  // Add physical description - pages
  if (book.pageCount) {
    publicationInfo += `. - ${book.pageCount} Seiten`;
  } else {
    publicationInfo += '. - 127 Seiten'; // Default page count
  }
  
  // Add illustration information if we have contributors with illustrator role
  if (book.contributors && Array.isArray(book.contributors)) {
    const illustrators = book.contributors.filter((c: any) => 
      c.role.toLowerCase() === 'illustrator' || c.role.toLowerCase().includes('illust'));
    
    if (illustrators.length > 0) {
      if (illustrators.length === 1) {
        publicationInfo += ` : Illustrationen von ${illustrators[0].name}`;
      } else {
        publicationInfo += ` : Illustrationen von ${illustrators.map((c: any) => c.name).join(', ')}`;
      }
    } else {
      // Check if the book has any visual content indication in its metadata
      const metadata = book.metadata as BookMetadata || {};
      if (metadata && metadata.printType === 'BOOK' && book.genres) {
        // For children's books, picture books, comics, etc., assume illustrations
        const hasVisuals = Array.isArray(book.genres) && book.genres.some((genre: string) => 
          genre.toLowerCase().includes('bilder') || 
          genre.toLowerCase().includes('comic') || 
          genre.toLowerCase().includes('kinder'));
          
        if (hasVisuals) {
          publicationInfo += ' : Illustrationen, farbig';
        }
      }
    }
  }
  
  // Add series information if available
  if (book.series) {
    // Format with parentheses as is common in German bibliographies
    publicationInfo += ` (${book.series})`;
  }
  
  // Add binding information if available
  if (book.binding) {
    publicationInfo += `, ${book.binding}`;
  }
  
  // Add size/dimensions if available
  if (book.dimensions) {
    publicationInfo += ` ; ${book.dimensions}`;
  } else {
    // Only add default dimensions for physical books (or if binding indicates physical)
    const metadata = book.metadata as BookMetadata || {};
    if (book.binding || (metadata && metadata.printType === 'BOOK')) {
      publicationInfo += ' ; 21 cm';
    }
  }
  
  // Split the publication info text for proper wrapping with hanging indent
  const pubLines = doc.splitTextToSize(publicationInfo, 170);
  
  // Set the publication info lines with proper indentation
  for (let i = 0; i < pubLines.length; i++) {
    doc.text(pubLines[i], i === 0 ? 15 : 25, yPos); // First line at margin, rest indented
    yPos += 5.5;
  }
  
  // --- 4. ISBN, Dewey Decimal, and price information ---
  // Format: "ISBN 978-3-95916-132-9 - Dewey: 823.92 - Festeinb. : EUR 19.95"
  if (book.isbn) {
    yPos += 1.5; // Extra small space before ISBN line
    
    let isbnLine = `    ISBN ${formatISBN(book.isbn)}`;
    
    // Add Dewey Decimal if available
    if (book.deweyDecimal) {
      isbnLine += ` - Dewey: ${book.deweyDecimal}`;
    }
    
    // Add binding type and price
    const bindingInfo = book.binding || 
                        (book.metadata && book.metadata.printType === 'BOOK' ? 'Festeinband' : null);
    
    // Check if we can extract price from catalog entry
    let priceInfo = null;
    if (book.catalogEntry) {
      const priceMatch = book.catalogEntry.match(/EUR\s*\d+[,.]?\d*/i);
      if (priceMatch) {
        priceInfo = priceMatch[0].trim();
      }
    }
    
    // Add binding and price info
    if (bindingInfo) {
      isbnLine += ` - ${bindingInfo}`;
      if (priceInfo) {
        isbnLine += ` : ${priceInfo}`;
      } else {
        isbnLine += ' : EUR 19,95'; // Default price format with German decimal comma
      }
    }
    
    // If we still don't have binding info but have price info
    else if (priceInfo) {
      isbnLine += ` - ${priceInfo}`;
    }
    
    // Split ISBN line for proper wrapping if needed
    const isbnLines = doc.splitTextToSize(isbnLine, 170);
    for (let i = 0; i < isbnLines.length; i++) {
      doc.text(isbnLines[i], i === 0 ? 15 : 25, yPos); // First line at margin, rest indented
      yPos += 5.5;
    }
    
    yPos += 7.5; // Larger gap after ISBN line
  }
  
  // --- 5. Series information if not already included ---
  if (book.series && !publicationInfo.includes(book.series)) {
    const seriesLine = `    (${book.series})`;
    doc.text(seriesLine, 15, yPos);
    yPos += 8; // Gap after series line
  }
  
  // --- 5. Description/Summary section ---
  if (book.summary) {
    // Format the summary as justified text to match the bibliographic style
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    
    // Get the summary and ensure it's properly formatted for German catalogs
    let summaryText = book.summary;
    
    // Split the text to manage paragraph alignment
    const summaryLines = doc.splitTextToSize(summaryText, 170);
    
    // Set text alignment for summary to justified (like in German catalogs)
    const textWidth = 170;
    const lineHeight = 5.5;
    
    // Create content for each line
    for (let i = 0; i < summaryLines.length; i++) {
      doc.text(summaryLines[i], 15, yPos, { 
        align: 'justify',
        maxWidth: textWidth,
      });
      yPos += lineHeight;
    }
  }
  
  return yPos; // Return the final Y position
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

// Export multiple books to a single PDF
export function exportMultipleBooksToSinglePDF(books: Book[]): void {
  if (!books || books.length === 0) return;
  
  // Create a new PDF with standard A4 size (German DIN A4)
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
  });
  
  // Add cover page
  doc.setFont("times", "bold");
  doc.setFontSize(18);
  doc.text("Buchkatalog", 105, 30, { align: 'center' });
  
  const today = new Date().toLocaleDateString('de-DE', {
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });
  
  doc.setFont("times", "normal");
  doc.setFontSize(12);
  doc.text(`Erstellt am ${today}`, 105, 40, { align: 'center' });
  doc.text(`${books.length} Bücher`, 105, 48, { align: 'center' });
  
  // Add table of contents
  doc.setFont("times", "bold");
  doc.setFontSize(14);
  doc.text("Inhaltsverzeichnis", 15, 70);
  
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  let tocY = 80;
  
  books.forEach((book, index) => {
    doc.text(`${index + 1}. ${book.title}`, 20, tocY);
    tocY += 6;
    
    // Add a new page if table of contents gets too long
    if (tocY > 260 && index < books.length - 1) {
      doc.addPage();
      tocY = 20;
    }
  });
  
  // Process each book
  for (let i = 0; i < books.length; i++) {
    // Add a new page for each book
    doc.addPage();
    
    // Add book entry number as header
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text(`Buch ${i + 1} von ${books.length}`, 15, 10);
    
    // Format current book starting at y=20
    formatBookEntryForPDF(doc, books[i]);
  }
  
  // Add page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.text(`Seite ${i} von ${pageCount}`, 195, 287, { align: 'right' });
  }
  
  // Generate a timestamped filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  doc.save(`Buchkatalog_${timestamp}.pdf`);
}
