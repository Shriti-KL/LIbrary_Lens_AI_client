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
  // First, handle the ASB classification and secondary identifier in the top right
  doc.setFontSize(11);
  doc.setFont("times", "bold");
  
  // Use custom ASB classification if available, or generate a catalog-style identifier
  // ASB section - Top right
  const asbCategory = Array.isArray(book.categories) && book.categories.length > 0 ? 
    book.categories[0] : "ASB:";
  
  // Format ASB number like 103.485.0 or similar from sample
  const catalogOptions = ["103.485.0", "103.992.7", "103.612.3", "102.861.1"];
  const asbNumber = book.catalogNumber || catalogOptions[Math.floor(Math.random() * catalogOptions.length)];
  
  // Print ASB text
  doc.text("ASB:", 22, yPos);
  doc.text(asbNumber, 170, yPos, { align: 'right' });
  
  yPos += 5;
  
  // Secondary classification (like 4.3/Y, 6.1/Aax)
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
  doc.setFont("times", "bold"); 
  doc.text(authorFormatted + ":", 22, yPos);
  
  yPos += 6; // Space after author name
  
  // --- 3. Book title and publication info ---
  doc.setFont("times", "normal");
  
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
  const titleLines = doc.splitTextToSize(titleText, 150);
  
  // Set the title lines
  for (let i = 0; i < titleLines.length; i++) {
    doc.text(titleLines[i], 22, yPos);
    yPos += 5;
  }
  
  // --- 4. Publication Information ---
  yPos += 2; // Extra space before publication info
  
  // Build full publication string similar to the sample
  let publicationInfo = '';
  
  // Start with edition information
  publicationInfo += book.edition || '1. Auflage';
  
  // Add location and publisher
  const location = book.location || 'München';
  const publisher = book.publisher || 'C.H.Beck';
  publicationInfo += `. - ${location} : ${publisher}`;
  
  // Add year
  publicationInfo += `, ${book.publishedYear || '2025'}`;
  
  // Add physical description - pages
  publicationInfo += `. - ${book.pageCount || '250'} Seiten`;
  
  // Add illustration information if appropriate
  if (book.contributors && Array.isArray(book.contributors)) {
    const illustrators = book.contributors.filter((c: any) => 
      c.role.toLowerCase() === 'illustrator' || c.role.toLowerCase().includes('illust'));
    
    if (illustrators.length > 0) {
      publicationInfo += ` : Illustrationen`;
      // Add color info if available
      publicationInfo += `, farbig`;
    }
  }
  
  // Add dimensions
  publicationInfo += ` ; ${book.dimensions || '21 cm'}`;
  
  // Add series information in parentheses if available
  if (book.series) {
    publicationInfo += ` (${book.series})`;
  }
  
  // Split the publication info text for proper wrapping
  const pubLines = doc.splitTextToSize(publicationInfo, 150);
  
  // Set the publication info lines
  for (let i = 0; i < pubLines.length; i++) {
    doc.text(pubLines[i], 22, yPos);
    yPos += 5;
  }
  
  // --- 5. ISBN and Price information ---
  if (book.isbn) {
    yPos += 2; // Extra small space before ISBN line
    
    let isbnLine = `ISBN ${formatISBN(book.isbn)}`;
    
    // Add binding type and price
    const bindingInfo = book.binding || 'Festeinband';
    
    // Format as "ISBN XXX-X-XXX-XXXX-X - Binding - EUR XX.XX"
    isbnLine += ` - ${bindingInfo}`;
    
    // Add price if available
    if (book.price) {
      isbnLine += ` : EUR ${book.price}`;
    } else {
      // Add a generic default price formatted with German decimal comma
      isbnLine += ` : EUR 28,00`;
    }
    
    doc.text(isbnLine, 22, yPos);
    yPos += 7;
  }
  
  // --- 6. Book summary/description ---
  if (book.summary) {
    yPos += 2;
    
    // Set text style for summary
    doc.setFont("times", "normal");
    doc.setFontSize(10);
    
    let summaryText = book.summary;
    
    // Split the text for proper wrapping
    const summaryLines = doc.splitTextToSize(summaryText, 150);
    
    // Create content for each line with justified text
    for (let i = 0; i < summaryLines.length; i++) {
      doc.text(summaryLines[i], 22, yPos, { 
        align: 'justify',
        maxWidth: 150,
      });
      yPos += 5;
    }
  }
  
  // --- 7. Reviewer name in bottom right ---
  yPos += 5;
  doc.setFont("times", "normal");
  doc.setFontSize(10);
  
  // Use reviewer name if available or default ones from the sample
  const reviewerOptions = ["Dagmar List", "Rouven Haus", "Tobias Herger", "Larissa Dämmig"];
  const reviewerName = book.reviewerName || reviewerOptions[Math.floor(Math.random() * reviewerOptions.length)];
  
  doc.text(reviewerName, 150, yPos, { align: 'right' });
  
  // --- 8. Interest category (IK) and ID-B number on bottom left ---
  yPos += 10;
  
  // Interest category from sample
  const ikOptions = ["IK: Basteln; ab 4", "IK: Wissen von A-Z; ab 14", "IK: Geschichte"];
  const interestCategory = book.interestCategory || ikOptions[Math.floor(Math.random() * ikOptions.length)];
  doc.text(interestCategory, 22, yPos);
  
  yPos += 5;
  
  // ID-B number from sample
  const idBNumber = book.idBNumber || `ID-B 19/${Math.floor(Math.random() * 30) + 1}`;
  doc.text(idBNumber, 22, yPos);
  
  // --- 9. Add Barcode and footer ---
  yPos += 10;
  
  // Draw a barcode-like rectangle (placeholder for actual barcode)
  const barcodeHeight = 10;
  doc.setDrawColor(0);
  doc.setFillColor(0, 0, 0); // Use RGB format to avoid type error
  
  // Draw a simple line instead of barcode to avoid type issues
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  const barcodeWidth = 60;
  const startX = (doc.internal.pageSize.width - barcodeWidth) / 2;
  doc.line(startX, yPos, startX + barcodeWidth, yPos);
  doc.line(startX, yPos + barcodeHeight, startX + barcodeWidth, yPos + barcodeHeight);
  
  // Add ekz-Informationsdienst text below barcode
  yPos += barcodeHeight + 5;
  doc.setFontSize(9);
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

// Export multiple books to a single PDF with clean library catalog format
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
    // Format as "ASB code - Author: Title"
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
    doc.setFont("times", "italic");
    doc.setFontSize(9);
    doc.text(`Seite ${i} von ${pageCount}`, 195, 287, { align: 'right' });
  }
  
  // Generate a timestamped filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  doc.save(`Buchkatalog_${timestamp}.pdf`);
}
