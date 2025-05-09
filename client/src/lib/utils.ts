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
  
  // Add title
  const title = book.title || 'Book Details';
  doc.setFontSize(20);
  doc.setTextColor(0, 51, 102); // Primary color
  doc.text(title, 14, 22);
  
  // Add author
  if (book.author) {
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`by ${book.author}`, 14, 32);
  }
  
  // Add horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 36, 196, 36);
  
  // Add metadata
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  
  const metadata = [
    ['ISBN', book.isbn ? formatISBN(book.isbn) : 'N/A'],
    ['Publisher', book.publisher || 'N/A'],
    ['Published Year', book.publishedYear?.toString() || 'N/A'],
    ['Page Count', book.pageCount?.toString() || 'N/A'],
    ['Reading Level', book.readingLevel?.toString() || 'N/A'],
    ['Dewey Decimal', book.deweyDecimal || 'N/A'],
  ];
  
  autoTable(doc, {
    startY: 40,
    head: [['Property', 'Value']],
    body: metadata,
    theme: 'grid',
    headStyles: { fillColor: [0, 51, 102], textColor: 255 },
    styles: { overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 40 } },
  });
  
  // Add summary if exists
  if (book.summary) {
    const currentY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.setTextColor(0, 51, 102);
    doc.text('Summary', 14, currentY);
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    
    const textLines = doc.splitTextToSize(book.summary, 180);
    doc.text(textLines, 14, currentY + 8);
  }
  
  // Add genres if exist
  if (Array.isArray(book.genres) && book.genres.length > 0) {
    let currentY = book.summary 
      ? (doc as any).lastAutoTable.finalY + doc.splitTextToSize(book.summary, 180).length * 7 + 15
      : (doc as any).lastAutoTable.finalY + 10;
    
    doc.setFontSize(14);
    doc.setTextColor(0, 51, 102);
    doc.text('Genres', 14, currentY);
    
    doc.setFontSize(11);
    doc.setTextColor(0, 0, 0);
    doc.text(book.genres.join(', '), 14, currentY + 8);
  }
  
  // Add catalog entry if exists
  if (book.catalogEntry) {
    // Check available space
    const currentY = (doc as any).lastAutoTable.finalY;
    const availableSpace = doc.internal.pageSize.getHeight() - currentY;
    
    if (availableSpace < 100) {
      doc.addPage();
      doc.setFontSize(14);
      doc.setTextColor(0, 51, 102);
      doc.text('Catalog Entry', 14, 20);
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const catalogLines = doc.splitTextToSize(book.catalogEntry, 180);
      doc.text(catalogLines, 14, 30);
    } else {
      doc.setFontSize(14);
      doc.setTextColor(0, 51, 102);
      doc.text('Catalog Entry', 14, currentY + 30);
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const catalogLines = doc.splitTextToSize(book.catalogEntry, 180);
      doc.text(catalogLines, 14, currentY + 38);
    }
  }
  
  // Save the PDF
  doc.save(`${book.title || 'book'}.pdf`);
}
