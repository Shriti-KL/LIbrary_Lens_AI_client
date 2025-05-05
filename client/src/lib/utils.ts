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
  const primaryColor = [0, 51, 102]; // Dark blue
  const textColor = [0, 0, 0]; // Black
  
  // ---- Header section with library name ----
  doc.setFontSize(12);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFont("helvetica", "bold");
  doc.text("LibraryLens AI - Library Catalog", 14, 15);
  
  // Add a horizontal line
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 18, 196, 18);
  
  // ---- Catalog Entry Format ----
  // This is the primary section showing the catalog entry in library format
  
  let yPos = 25; // Start position for catalog
  
  // If catalog entry exists, use it as the primary content
  if (book.catalogEntry) {
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text("Catalog Entry", 14, yPos);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    
    // Format the catalog entry text
    const catalogLines = doc.splitTextToSize(book.catalogEntry, 180);
    doc.text(catalogLines, 14, yPos + 8);
    
    // Update position
    yPos = yPos + 8 + (catalogLines.length * 5) + 10;
  } 
  // If no catalog entry exists, create a formatted citation style header
  else {
    // Create bibliography-style citation format
    // Format: Author: Title / Additional info. - Edition. - Location: Publisher, Year. Pages: Details; Size. (Series)
    
    // First line: Author: Title
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    
    const authorTitleLine = `${book.author}: ${book.title}`;
    doc.text(authorTitleLine, 14, yPos);
    
    // Second line: Publication details
    let pubDetails = '';
    if (book.publisher) {
      pubDetails += book.publisher;
      if (book.publishedYear) pubDetails += `, ${book.publishedYear}`;
    } else if (book.publishedYear) {
      pubDetails += book.publishedYear;
    }
    
    // Add page details if available
    if (book.pageCount) {
      if (pubDetails) pubDetails += '. ';
      pubDetails += `${book.pageCount} pages`;
    }
    
    // Add details like illustrations if available (assuming from catalog entry)
    if (book.catalogEntry && book.catalogEntry.includes('Illustrations')) {
      const illustrationsMatch = book.catalogEntry.match(/illustrations[^.;]*/i);
      if (illustrationsMatch) {
        if (pubDetails) pubDetails += ': ';
        pubDetails += illustrationsMatch[0].trim();
      }
    }
    
    // Format and display publication details
    if (pubDetails) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(pubDetails, 30, yPos + 6);
      yPos += 6;
    }
    
    // Third line: ISBN
    if (book.isbn) {
      yPos += 6;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const isbnLine = `ISBN ${formatISBN(book.isbn)}`;
      
      if (book.deweyDecimal) {
        doc.text(`${isbnLine} - Dewey: ${book.deweyDecimal}`, 30, yPos);
      } else {
        doc.text(isbnLine, 30, yPos);
      }
    }
    
    yPos += 12;
  }
  
  // ---- Summary Section ----
  if (book.summary) {
    // Check if we need a new page
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text("Summary", 14, yPos);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(textColor[0], textColor[1], textColor[2]);
    
    const summaryLines = doc.splitTextToSize(book.summary, 180);
    doc.text(summaryLines, 14, yPos + 5);
    
    yPos += (summaryLines.length * 5) + 15;
  }
  
  // ---- Bibliographic Details Table ----
  // Check if we need a new page
  if (yPos > 200) {
    doc.addPage();
    yPos = 20;
  }
  
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text("Bibliographic Details", 14, yPos);
  
  // Create metadata array for table
  const metadata = [
    ['Title', book.title],
    ['Author', book.author],
    ['ISBN', book.isbn ? formatISBN(book.isbn) : 'N/A'],
    ['Publisher', book.publisher || 'N/A'],
    ['Year', book.publishedYear?.toString() || 'N/A'],
    ['Pages', book.pageCount?.toString() || 'N/A']
  ];
  
  // Add dewey decimal if available
  if (book.deweyDecimal) {
    metadata.push(['Dewey Decimal', book.deweyDecimal]);
  }
  
  // Create a clean table for bibliographic data
  autoTable(doc, {
    startY: yPos + 5,
    head: [],
    body: metadata,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 3
    },
    columnStyles: {
      0: {
        fontStyle: 'bold',
        cellWidth: 40
      }
    }
  });
  
  // Get new Y position after the table
  yPos = (doc as any).lastAutoTable.finalY + 10;
  
  // ---- Genres Section ----
  if (Array.isArray(book.genres) && book.genres.length > 0) {
    // Check if we need a new page
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }
    
    // Create a table for genres
    autoTable(doc, {
      startY: yPos,
      head: [['Genres']],
      body: book.genres.map(genre => [genre]),
      theme: 'plain',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      styles: {
        fontSize: 9
      }
    });
    
    // Update Y position
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }
  
  // ---- Reading Level Section (if available) ----
  if (book.readingLevel) {
    // Check if we need a new page
    if (yPos > 220) {
      doc.addPage();
      yPos = 20;
    }
    
    let readingLevelData = [];
    
    if (typeof book.readingLevel === 'object') {
      const readingLevel = book.readingLevel as any;
      if (readingLevel.ageRange) readingLevelData.push(['Age Range', readingLevel.ageRange]);
      if (readingLevel.gradeLevel) readingLevelData.push(['Grade Level', readingLevel.gradeLevel]);
      if (readingLevel.complexity) readingLevelData.push(['Complexity', readingLevel.complexity]);
      if (readingLevel.lexileMeasure) readingLevelData.push(['Lexile Measure', readingLevel.lexileMeasure]);
    } else {
      readingLevelData.push(['Reading Level', String(book.readingLevel)]);
    }
    
    if (readingLevelData.length > 0) {
      autoTable(doc, {
        startY: yPos,
        head: [['Reading Level', '']],
        body: readingLevelData,
        theme: 'plain',
        headStyles: {
          fillColor: primaryColor,
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        styles: {
          fontSize: 9
        },
        columnStyles: {
          0: {
            fontStyle: 'bold',
            cellWidth: 40
          }
        }
      });
    }
  }
  
  // ---- Add Footer with Page Numbers ----
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.height - 10);
    doc.text('Generated by LibraryLens AI', 196 - 50, doc.internal.pageSize.height - 10, { align: 'right' });
  }
  
  // Save the PDF with the book title as filename
  doc.save(`${book.title || 'book'}.pdf`);
}
