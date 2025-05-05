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

export function exportBookToPDF(book: Book): void {
  const doc = new jsPDF();
  
  // Define colors
  const textColor = [0, 0, 0]; // Black
  
  // Start position
  let yPos = 20;
  
  // Create the German catalog-style entry - following the exact format from the example
  
  // ---- 1. Author: Title line ----
  // Format: Sorg, Marion:
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(textColor[0], textColor[1], textColor[2]);
  doc.text(`${book.author}:`, 14, yPos);
  
  yPos += 6;
  
  // ---- 2. Full bibliographic citation ----
  // Format: Title / Author ; Illustrations. - Edition. - Location : Publisher, Year. - Pages : Details ; Size
  
  // Build the citation components
  let citation = '';
  
  // Title component
  citation += book.title;
  
  // Contributor information (using the full author name again)
  citation += ` / ${book.author}`;
  
  // Add illustrator if available (extract from catalog entry)
  if (book.catalogEntry && book.catalogEntry.includes('Illustration')) {
    const illustrationMatch = book.catalogEntry.match(/Illustration[^.;]*(von|by)[^.;]*/i);
    if (illustrationMatch) {
      citation += ` ; ${illustrationMatch[0].trim()}`;
    }
  }
  
  // Edition information
  citation += ' - 1. Auflage.';
  
  // Publisher location and name
  if (book.publisher) {
    const publisherParts = book.publisher.split(',');
    let location = '';
    let publisher = book.publisher;
    
    // Try to extract location from publisher string if it contains a comma
    if (publisherParts.length > 1) {
      location = publisherParts[0].trim();
      publisher = publisherParts.slice(1).join(',').trim();
    }
    
    if (location) {
      citation += ` - ${location} : ${publisher}`;
    } else {
      // If no location found, try to extract from catalog entry or just use publisher
      if (book.catalogEntry && book.catalogEntry.includes(':')) {
        const locationMatch = book.catalogEntry.match(/\s-\s([^:]+)\s:/);
        if (locationMatch) {
          citation += ` - ${locationMatch[1].trim()} : ${publisher}`;
        } else {
          citation += ` - : ${publisher}`;
        }
      } else {
        citation += ` - : ${publisher}`;
      }
    }
  }
  
  // Year
  if (book.publishedYear) {
    citation += `, ${book.publishedYear}`;
  }
  
  // Physical description
  if (book.pageCount) {
    citation += `. - ${book.pageCount} Seiten`;
  } else {
    citation += '. - Seiten';
  }
  
  // Add details like illustrations if available (from catalog entry)
  if (book.catalogEntry && book.catalogEntry.includes('Illustration')) {
    citation += ' : Illustrationen, farbig';
  }
  
  // Add size if available (from catalog entry) or use default
  if (book.catalogEntry && book.catalogEntry.includes('cm')) {
    const sizeMatch = book.catalogEntry.match(/(\d+)\s*cm/);
    if (sizeMatch) {
      citation += ` ; ${sizeMatch[1]} cm`;
    } else {
      citation += ' ; 22 cm';
    }
  } else {
    citation += ' ; 22 cm';
  }
  
  // Add series information if available (from catalog entry)
  if (book.catalogEntry && book.catalogEntry.includes('(')) {
    const seriesMatch = book.catalogEntry.match(/\(([^)]+)\)/);
    if (seriesMatch) {
      citation += ` (${seriesMatch[1]})`;
    }
  }
  
  // Format and display the citation
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const citationLines = doc.splitTextToSize(citation, 180);
  doc.text(citationLines, 14, yPos);
  
  yPos += (citationLines.length * 5) + 8;
  
  // ---- 3. ISBN line with price ----
  // Format: ISBN 978-3-95916-132-9 Festeinb. : EUR 19.95
  if (book.isbn) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    // Format the ISBN line
    let isbnLine = `ISBN ${formatISBN(book.isbn)}`;
    
    // Add binding type and price if available
    if (book.catalogEntry && book.catalogEntry.includes('EUR')) {
      const priceMatch = book.catalogEntry.match(/(Festeinb|Kart|Pb|Hardcover|Paperback)[.:]?\s*:?\s*EUR\s*\d+[,.]?\d*/i);
      if (priceMatch) {
        isbnLine += ` ${priceMatch[0].trim()}`;
      } else {
        isbnLine += ' Hardcover'; // Default to hardcover if not specified
      }
    }
    
    doc.text(isbnLine, 14, yPos);
    yPos += 10;
  }
  
  // Add a horizontal line to separate the citation from the summary
  doc.setDrawColor(200, 200, 200);
  doc.line(14, yPos, 196, yPos);
  yPos += 10;
  
  // ---- 4. Summary section - this is critical content ----
  if (book.summary) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    
    const summaryLines = doc.splitTextToSize(book.summary, 180);
    doc.text(summaryLines, 14, yPos);
    
    yPos += (summaryLines.length * 5) + 15;
  }
  
  // Check if we need a new page for additional information
  if (yPos > 240) {
    doc.addPage();
    yPos = 20;
  }
  
  // ---- 5. Additional metadata (only if there's enough space) ----
  if (yPos < 220) {
    // Only show if there are genres or additional metadata worth displaying
    if (Array.isArray(book.genres) && book.genres.length > 0) {
      // Add a light horizontal line to separate from summary
      doc.setDrawColor(220, 220, 220);
      doc.line(14, yPos-5, 196, yPos-5);
      
      // Add genres as comma-separated list
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Genres:", 14, yPos+2);
      
      doc.setFont("helvetica", "normal");
      const genresText = book.genres.join(', ');
      const genresLines = doc.splitTextToSize(genresText, 160);
      doc.text(genresLines, 50, yPos+2);
      
      yPos += (genresLines.length * 5) + 8;
    }
    
    // Add reading level if available
    if (book.readingLevel && yPos < 240) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text("Reading Level:", 14, yPos);
      
      doc.setFont("helvetica", "normal");
      if (typeof book.readingLevel === 'object') {
        const readingLevel = book.readingLevel as any;
        let readingLevelText = '';
        
        if (readingLevel.ageRange) readingLevelText += `Age: ${readingLevel.ageRange}`;
        if (readingLevel.gradeLevel) {
          if (readingLevelText) readingLevelText += ', ';
          readingLevelText += `Grade: ${readingLevel.gradeLevel}`;
        }
        
        doc.text(readingLevelText, 50, yPos);
      } else {
        doc.text(String(book.readingLevel), 50, yPos);
      }
      
      yPos += 8;
    }
  }
  
  // ---- Add Footer with Catalog ID or Document Information ----
  const totalPages = doc.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    
    // Add page numbers
    doc.text(`${i}/${totalPages}`, 14, doc.internal.pageSize.height - 10);
    
    // If this is a catalog from a library system, add catalog ID
    const catalogDate = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    doc.text(`LibraryLens • Catalog Entry • ${catalogDate}`, 196, doc.internal.pageSize.height - 10, { align: 'right' });
  }
  
  // Save the PDF with the book title as filename
  doc.save(`${book.title || 'book'}.pdf`);
}
