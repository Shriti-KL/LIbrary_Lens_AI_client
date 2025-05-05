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
  // Get current language from localStorage to ensure PDF uses correct language
  const savedLanguage = localStorage.getItem("preferredLanguage") || "de";
  const isGerman = savedLanguage === "de";
  
  // Create a new PDF with standard A4 size
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
  });
  
  // Start position
  let yPos = 20;
  
  // --- 1. Author's name in bold ---
  doc.setFontSize(12);
  doc.setFont("times", "bold");
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
  doc.setFont("times", "normal");
  doc.setFontSize(11);
  
  let titleText = titleFull;
  if (subtitle) {
    titleText += ` : ${subtitle}`;
  }
  
  // Add contributor information
  titleText += ` / ${book.author}`;
  
  // Add illustrator if available (extract from catalog entry)
  if (book.catalogEntry && book.catalogEntry.includes('Illustration')) {
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
  // Create publication details string with language-appropriate formatting
  
  // Edition information based on language
  let editionText = isGerman ? '1. Auflage' : '1st Edition';
  let publicationInfo = `- ${editionText}.`;
  
  // Add location and publisher
  if (book.publisher) {
    // Try to extract location from publisher string or use default
    let location = isGerman ? 'München' : 'Munich'; // Default location if none found
    let publisher = book.publisher;
    
    // If publisher includes comma, first part might be location
    if (book.publisher.includes(',')) {
      const parts = book.publisher.split(',');
      location = parts[0].trim();
      publisher = parts.slice(1).join(',').trim();
    }
    
    // If catalog entry contains location explicitly, use that
    if (book.catalogEntry && book.catalogEntry.includes('-')) {
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
      publicationInfo += ', 2025';
    }
  }
  
  // Add physical description - pages
  const pagesText = isGerman ? 'Seiten' : 'pages';
  if (book.pageCount) {
    publicationInfo += `. - ${book.pageCount} ${pagesText}`;
  } else {
    publicationInfo += `. - 127 ${pagesText}`;
  }
  
  // Add illustration information
  const illustrationsText = isGerman ? 'Illustrationen, farbig' : 'Illustrations, color';
  publicationInfo += ` : ${illustrationsText}`;
  
  // Add size
  publicationInfo += ' ; 22 cm';
  
  // Split the publication info text for proper wrapping with hanging indent
  const pubLines = doc.splitTextToSize(publicationInfo, 170);
  
  // Set the publication info lines with proper indentation
  for (let i = 0; i < pubLines.length; i++) {
    doc.text(pubLines[i], i === 0 ? 15 : 25, yPos); // First line at margin, rest indented
    yPos += 5.5;
  }
  
  // --- 4. ISBN and price information ---
  if (book.isbn) {
    yPos += 1.5; // Extra small space before ISBN line
    
    let isbnLine = `    ISBN ${formatISBN(book.isbn)}`;
    
    // Add binding type and price based on language
    if (book.catalogEntry && book.catalogEntry.includes('EUR')) {
      const priceMatch = book.catalogEntry.match(/(Festeinb|Kart|Pb|Hardcover|Paperback)[.:]?\s*:?\s*EUR\s*\d+[,.]?\d*/i);
      if (priceMatch) {
        isbnLine += ` ${priceMatch[0].trim()}`;
      } else {
        // Default price format based on language
        isbnLine += isGerman ? ' Festeinb. : EUR 19.95' : ' Hardcover : EUR 19.95';
      }
    } else {
      // Default price format based on language
      isbnLine += isGerman ? ' Festeinb. : EUR 19.95' : ' Hardcover : EUR 19.95';
    }
    
    doc.text(isbnLine, 15, yPos);
    yPos += 13; // Larger gap after ISBN line
  }
  
  // --- 5. Description/Summary section ---
  if (book.summary) {
    // Format the summary as justified text
    doc.setFont("times", "normal");
    doc.setFontSize(11);
    
    // Get the summary
    let summaryText = book.summary;
    
    // Split the text to manage paragraph alignment
    const summaryLines = doc.splitTextToSize(summaryText, 170);
    
    // Set text alignment for summary to justified
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
  
  // Add footer if we're not using German catalog style
  if (!isGerman) {
    // Add page numbers for non-German formats
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text(`Page ${i} of ${pageCount}`, 15, doc.internal.pageSize.height - 10);
      doc.text('LibraryLens AI', 190, doc.internal.pageSize.height - 10, { align: 'right' });
    }
  }
  
  // Save the PDF with the book title as filename
  // Remove any forbidden characters from filename
  const safeFilename = book.title.replace(/[/\\?%*:|"<>]/g, '-');
  doc.save(`${safeFilename || 'book'}.pdf`);
}
