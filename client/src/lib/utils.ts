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

// Preprocessed book data for PDF generation with consistent fields
interface NormalizedBookData {
  id: number | null;
  isbn: string;
  title: string;
  subtitle: string;
  author: string;
  mainAuthor: string;
  statementOfResponsibility: string;
  contributors: { [role: string]: string[] } | any[];
  edition: string;
  publicationPlace: string;
  publisher: string;
  publicationYear: number | null;
  pageCount: number | null;
  illustrations: string;
  dimensions: string;
  binding: string;
  price: string;
  catalogNumber: string; // ASB number
  secondaryClassification: string;
  interestCategory: string;
  summary: string;
  review: string;
  genres: string[];
  themes: string[];
  language: string;
}

/**
 * Normalize book data to ensure consistent formatting in PDF exports
 * This helps prevent issues with missing or inconsistent data formats
 */
function normalizeBookData(book: Book): NormalizedBookData {
  return {
    id: book.id || null,
    isbn: book.isbn || '',
    title: book.title || '',
    subtitle: book.subtitle || '',
    author: book.author || '',
    mainAuthor: book.mainAuthor || book.author || '',
    statementOfResponsibility: book.statementOfResponsibility || '',
    contributors: book.contributors || [],
    edition: book.edition || '',
    publicationPlace: book.publicationPlace || book.location || '',
    publisher: book.publisher || '',
    publicationYear: book.publicationYear || book.publishedYear || null,
    pageCount: book.pageCount || null,
    illustrations: book.illustrations || '',
    dimensions: book.dimensions || '',
    binding: book.binding || '',
    price: book.price || '',
    catalogNumber: book.catalogNumber || book.classificationNumber || '',
    secondaryClassification: book.secondaryClassification || book.additionalClassifications || '',
    interestCategory: book.interestCategory || '',
    summary: book.summary || '',
    review: book.review || '',
    genres: Array.isArray(book.genres) ? book.genres : [],
    themes: Array.isArray(book.themes) 
      ? (book.themes as any[]).map(t => typeof t === 'string' ? t : (t && t.name) ? t.name : '')
      : [],
    language: book.language || 'de'
  };
}

// Format a single book for PDF export - returns the ending Y position
export function formatBookEntryForPDF(doc: jsPDF, book: Book, startY: number = 20): number {
  // Normalize book data to ensure consistent formatting
  const normalizedBook = normalizeBookData(book);
  let yPos = startY;
  
  // --- 1. ASB Classification in top-right and top-left corner ---
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  
  // Top-left ASB label
  doc.text("ASB:", 22, yPos);
  
  // Top-right classification number (ASB)
  const asbNumber = normalizedBook.catalogNumber;
  doc.text(asbNumber, 190, yPos, { align: 'right' });
  
  // Second line - additional classifications under ASB
  yPos += 7;
  // Include DNB number as additional classification if available
  let addClassText = normalizedBook.secondaryClassification;
  if (book.dnbNumber && !addClassText.includes(book.dnbNumber)) {
    addClassText = addClassText ? `${addClassText}, ${book.dnbNumber}` : book.dnbNumber;
  }
  doc.text(addClassText, 22, yPos);
  
  yPos += 15; // Space after classifications
  
  // --- 2. Author's name in bold ---
  // Format author's name to "LastName, FirstName:" as shown in the target format
  let authorFormatted = normalizedBook.mainAuthor;
  if (authorFormatted && authorFormatted.includes(" ") && !authorFormatted.includes(",")) {
    const nameParts = authorFormatted.split(" ");
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
  let titleFull = book.title || "";
  let subtitle = book.subtitle || '';
  
  // If subtitle is not available but title contains a separator, extract it
  if (!subtitle) {
    if (titleFull.includes(" - ")) {
      const titleParts = titleFull.split(" - ");
      titleFull = titleParts[0].trim();
      subtitle = titleParts.slice(1).join(" - ").trim();
    } else if (titleFull.includes(":")) {
      const titleParts = titleFull.split(":");
      titleFull = titleParts[0].trim();
      subtitle = titleParts.slice(1).join(":").trim();
    }
  }
  
  // Format the title line with subtitle if present
  let titleText = titleFull;
  if (subtitle) {
    titleText = `${titleFull}: ${subtitle}`;
  }
  
  // Process author and contributors information
  let authorText = "";
  let otherContributors = "";
  
  // Use statement of responsibility if available, otherwise build from author/contributors
  if (book.statementOfResponsibility) {
    authorText = book.statementOfResponsibility;
  } else {
    authorText = book.mainAuthor || book.author || "";
    
    // Process contributors if available
    if (book.contributors && (typeof book.contributors === 'object')) {
      const contributorsList = [];
      
      // Handle new format (object with role keys)
      if (!Array.isArray(book.contributors)) {
        for (const role in book.contributors) {
          if (Array.isArray(book.contributors[role]) && book.contributors[role].length > 0) {
            contributorsList.push(`${book.contributors[role].join(", ")} (${role})`);
          }
        }
      } 
      // Handle old format (array of objects)
      else if (book.contributors.length > 0) {
        book.contributors
          .filter((c: any) => c.name && c.role)
          .forEach((c: any) => {
            contributorsList.push(`${c.name} (${c.role})`);
          });
      }
      
      if (contributorsList.length > 0) {
        otherContributors = contributorsList.join(" ; ");
      }
    }
  }
  
  // Add author and contributors to title text
  if (authorText) {
    titleText += ` / ${authorText}`;
    if (otherContributors && !book.statementOfResponsibility) {
      titleText += ` ; ${otherContributors}`;
    }
  } else if (otherContributors) {
    titleText += ` / ${otherContributors}`;
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
  
  // Simplified publication info construction following German cataloging standards
  const edition = book.edition || '';
  const location = book.publicationPlace || book.location || '';
  const publisher = book.publisher || '';
  const year = book.publicationYear || book.publishedYear || '';
  const pages = book.pageCount || '';
  const illustrations = book.illustrations || '';
  const dimensions = book.dimensions || '';
  
  // Format edition properly if needed
  let editionText = edition;
  if (edition && !edition.toLowerCase().includes("auflage") && /^\d+/.test(edition)) {
    const match = edition.match(/^(\d+)(?:\.)?/);
    if (match) {
      editionText = `${match[1]}. Auflage`;
    }
  }
  
  // Build the publication info string in the required format
  let publicationInfo = '';
  
  // Edition
  if (editionText) {
    publicationInfo += editionText;
  }
  
  // Location and publisher
  if (location || publisher) {
    if (publicationInfo) {
      publicationInfo += `. – ${location}: ${publisher}`;
    } else {
      publicationInfo += `${location}: ${publisher}`;
    }
  }
  
  // Year
  if (year) {
    publicationInfo += `, ${year}`;
  }
  
  // Pages
  if (pages) {
    publicationInfo += `. – ${pages} ${pages === 1 ? 'Seite' : 'Seiten'}`;
  } else if (publicationInfo) {
    publicationInfo += `. – `;
  }
  
  // Illustrations
  let hasIllustrations = illustrations;
  
  // Check for illustrators in contributors if illustrations field is empty
  if (!hasIllustrations && book.contributors) {
    if (!Array.isArray(book.contributors) && book.contributors['Illustrator']) {
      hasIllustrations = 'Illustrationen';
    } else if (Array.isArray(book.contributors)) {
      const hasIllustrator = book.contributors.some((c: any) => 
        c.role?.toLowerCase() === 'illustrator' || c.role?.toLowerCase().includes('illust'));
      if (hasIllustrator) {
        hasIllustrations = 'Illustrationen';
      }
    }
  }
  
  if (hasIllustrations) {
    publicationInfo += `: ${hasIllustrations}`;
  }
  
  // Dimensions
  if (dimensions) {
    publicationInfo += ` ; ${dimensions}`;
  }
  
  // Split the publication info text for proper wrapping
  const pubLines = doc.splitTextToSize(publicationInfo, 165);
  
  // Set the publication info lines
  doc.setFont("helvetica", "normal");
  for (let i = 0; i < pubLines.length; i++) {
    doc.text(pubLines[i], 22, yPos);
    yPos += 5;
  }
  
  // --- 5. ISBN and Price information ---
  if (book.isbn) {
    yPos += 2; // Extra small space before ISBN line
    
    let isbnLine = `ISBN ${formatISBN(book.isbn)}`;
    
    // Add binding type if available (ensure it's in German)
    if (book.binding) {
      // Map common English binding types to German
      let bindingGerman = book.binding;
      
      // Only do the mapping if the binding doesn't already appear to be in German
      if (!bindingGerman.toLowerCase().includes("einband") && 
          !bindingGerman.toLowerCase().includes("gebunden") && 
          !bindingGerman.toLowerCase().includes("broschiert") &&
          !bindingGerman.toLowerCase().includes("taschenbuch")) {
        
        // Mapping of English binding types to German
        const bindingMap: Record<string, string> = {
          "hardcover": "Festeinband",
          "hardback": "Festeinband", 
          "paperback": "Broschiert",
          "softcover": "Broschiert",
          "ebook": "E-Book",
          "audio": "Hörbuch",
          "spiral": "Spiralbindung",
          "leather": "Ledereinband",
          "boardbook": "Pappband"
        };
        
        // Check if we have a mapping for this binding type (case insensitive)
        for (const [eng, ger] of Object.entries(bindingMap)) {
          if (bindingGerman.toLowerCase().includes(eng.toLowerCase())) {
            bindingGerman = ger;
            break;
          }
        }
      }
      
      isbnLine += ` ${bindingGerman}`;
    }
    
    // Process price information if available
    if (book.price) {
      // The price field might contain a complete price string already
      let priceText = book.price;
      
      // If the price is just a number, format it properly
      if (/^\d+(\.\d+)?$/.test(priceText)) {
        // Format as German price with comma
        priceText = priceText.replace('.', ',');
        priceText = `EUR ${priceText}`;
      } else if (!priceText.includes("EUR") && !priceText.includes("€")) {
        // If it doesn't contain currency info, add EUR
        priceText = `EUR ${priceText}`;
      }
      
      // Remove "paperback" or other English terms that might be incorrectly included
      priceText = priceText.replace(/paperback|hardcover|softcover/gi, "").trim();
      
      // Clean up any duplicate spaces or commas
      priceText = priceText.replace(/\s{2,}/g, " ").replace(/,,/g, ",").trim();
      
      // Add to the ISBN line with proper delimiter
      isbnLine += `: ${priceText}`;
    }
    
    doc.setFont("helvetica", "normal");
    doc.text(isbnLine, 22, yPos);
    yPos += 7;
  }
  
  // --- 6. Book summary/description and critical review ---
  if (book.summary || book.review) {
    yPos += 2;
    
    // Set text style for summary text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    // Combine summary and review with the | separator exactly as in target format
    let summaryText = '';
    if (book.summary) {
      summaryText = book.summary;
    }
    if (book.summary && book.review) {
      summaryText += ' | ';
    }
    if (book.review) {
      summaryText += book.review;
    }
    
    // Clean up the text by removing any metadata patterns
    const metadataPatterns = [
      // Markdown style metadata
      /\*\*Titel:\*\*.*\n?/i,
      /\*\*Autor(?:in)?:\*\*.*\n?/i,
      /\*\*Erscheinungsjahr:\*\*.*\n?/i,
      /\*\*ISBN:\*\*.*\n?/i,
      /\*\*Verlag:\*\*.*\n?/i,
      
      // Plain text style metadata
      /Titel:.*\n?/i,
      /Autor(?:in)?:.*\n?/i,
      /Erscheinungsjahr:.*\n?/i,
      /ISBN:.*\n?/i,
      /Verlag:.*\n?/i,
      
      // Preview and version texts
      /preview.*?[\d\.]+.*?\n?/i,
      /version.*?[\d\.]+.*?\n?/i,
      /^\s*v[\d\.]+\s*$/im,
      
      // Other metadata that shouldn't be in the final text
      /^generated by:.*$/im,
      /^powered by:.*$/im,
      /^AI generated.*$/im
    ];
    
    // Apply all patterns
    metadataPatterns.forEach(pattern => {
      summaryText = summaryText.replace(pattern, '');
    });
    
    // Remove any extra whitespace and multiple newlines
    summaryText = summaryText.replace(/\n\s*\n/g, '\n').trim();
    
    // Split the text for proper wrapping 
    const summaryLines = doc.splitTextToSize(summaryText, 160);
    
    // Create content for each line with justified text
    for (let i = 0; i < summaryLines.length; i++) {
      doc.text(summaryLines[i], 22, yPos, { 
        align: 'justify',
        maxWidth: 160,
      });
      yPos += 4.5; // Slightly reduce line spacing to fit more text
    }
    
    // Add a small space after the summary
    yPos += 2;
  }
  
  // --- 7. Reviewer name in bottom right ---
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  // Use reviewer name if available, with multiple fallbacks
  if (book.reviewerName) {
    doc.text(book.reviewerName, 190, yPos, { align: 'right' });
  } else if (book.reviewer_name) {
    // Alternative field name
    doc.text(book.reviewer_name, 190, yPos, { align: 'right' });
  } else if (book.user && typeof book.user === 'object' && book.user.fullName) {
    // Fallback to user's full name if available
    doc.text(book.user.fullName, 190, yPos, { align: 'right' });
  } else if (book.userId) {
    // If only user ID is available, we show a placeholder
    // In a real implementation, we would fetch user details from the database
    doc.text(`ID: ${book.userId}`, 190, yPos, { align: 'right' });
  }
  
  // --- 8. Interest category (IK) and Age recommendation on bottom left ---
  yPos += 10;
  
  // Interest category and age recommendation in target format: IK: [Categories]; suitable from age [Age]
  let ikLine = '';
  
  if (book.interestCategory) {
    ikLine = `IK: ${book.interestCategory}`;
    
    // Add age recommendation if available
    if (book.ageRecommendation) {
      ikLine += `; geeignet ab ${book.ageRecommendation} Jahren`;
    }
    
    doc.setFont("helvetica", "bold");
    doc.text(ikLine, 22, yPos);
    yPos += 5;
  } else if (book.ageRecommendation) {
    ikLine = `Geeignet ab ${book.ageRecommendation} Jahren`;
    doc.setFont("helvetica", "bold");
    doc.text(ikLine, 22, yPos);
    yPos += 5;
  }
  
  // --- 9. ID-B information in format: ID-[Initials] [Number]/[Year] ---
  let idBLine = '';
  
  // Support multiple field naming conventions for these fields
  const initials = book.idbInitials || book.idb_initials || '';
  const sequenceNumber = book.idbSequenceNumber || book.idb_sequence_number || '';
  const idbYear = book.idbYear || book.idb_year || '';
  
  // If we have at least initials and one other field, show the ID-B line
  if (initials && (sequenceNumber || idbYear)) {
    idBLine = `ID-${initials} ${sequenceNumber}/${idbYear}`;
    doc.setFont("helvetica", "normal");
    doc.text(idBLine, 22, yPos);
    yPos += 5;
  }
  
  // Legacy format support - if an ID-B number is provided directly
  else if (book.idBNumber) {
    doc.setFont("helvetica", "normal");
    doc.text(book.idBNumber, 22, yPos);
    yPos += 5;
  }
  
  // --- 10. Footer (no barcode) ---
  yPos += 10;
  
  // Add the classification number (no barcode)
  const startX = doc.internal.pageSize.width / 2;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  
  // Add ASB number if available
  if (asbNumber && asbNumber.trim() !== "") {
    doc.text(asbNumber, startX, yPos, { align: 'center' });
    yPos += 5;
  }
  
  // Add ekz-Informationsdienst text
  yPos += 3;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("ekz-Informationsdienst", doc.internal.pageSize.width / 2, yPos, { align: 'center' });
  
  return yPos + 10; // Return the final Y position with some extra space
}

// Export a single book to PDF
export function exportBookToPDF(book: Book, language: string = 'de'): void {
  // Create a new PDF with standard A4 size (German DIN A4)
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    compress: true // Use compression for smaller file size
  });
  
  // Normalize book data to ensure consistent formatting
  const normalizedBook = normalizeBookData(book);
  
  // Configure language-specific text
  const bookLanguage = normalizedBook.language || language;
  
  // Format book entry with normalized data
  formatBookEntryForPDF(doc, book);
  
  // Save the PDF with the book title as filename
  // Remove any forbidden characters from filename
  const safeFilename = (normalizedBook.title || 'book').replace(/[/\\?%*:|"<>]/g, '-');
  
  // Set the correct filename prefix based on language
  const filenamePrefix = bookLanguage === 'de' ? 'Buch' : 'Book';
  const timestamp = new Date().toISOString().substring(0, 10);
  doc.save(`${safeFilename || `${filenamePrefix}_${timestamp}`}.pdf`);
}

// Draw a single box with correction info - used on the first page
function drawCorrectionBox(doc: jsPDF, x: number, y: number, width: number, height: number): void {
  // Format the date exactly as in the sample image: YYYY-MM-DD HH:MM Uhr
  const date = new Date();
  const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} Uhr`;
  
  // Draw box border - use thicker border as shown in sample
  doc.setDrawColor(0);
  doc.setLineWidth(0.7);
  doc.rect(x, y, width, height);
  
  // Add correction title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Korrektur:", x + width/2, y + 15, { align: "center" });
  
  // Add edition info - exactly as in the sample
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Basis-Ausgabe (Edition 10.000)", x + width/2, y + 25, { align: "center" });
  
  // Add number of books - exactly as in the sample
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("24 Titel", x + width/2, y + 40, { align: "center" });
  
  // Add date and time - exactly as in the sample
  doc.text(formattedDate, x + width/2, y + 50, { align: "center" });
}

// Format a book entry for a grid layout with smaller dimensions
function formatBookEntryForGrid(doc: jsPDF, book: Book, x: number, y: number, width: number, height: number): number {
  // Normalize book data to ensure consistent formatting
  const normalizedBook = normalizeBookData(book);
  
  // Define font sizes with fewer variations for consistency
  const titleFontSize = 9;      // For titles and author names
  const contentFontSize = 8;    // For publication info and ISBN
  const summaryFontSize = 7;    // For summary and review text
  const footerFontSize = 7;     // For footer elements
  
  // Spacing constants - fixed values for consistent layout
  const margins = {
    left: 5,           // Left margin inside each cell
    right: 5,          // Right margin inside each cell
    top: 5,            // Top margin inside each cell
    bottom: 8          // Bottom margin for footer
  };
  
  // Fixed line heights for consistent spacing
  const lineHeight = {
    title: 4,          // For title and author text
    content: 3.5,      // For publication info
    summary: 2.5,      // For summary and review text
    footer: 3          // For footer elements
  };
  
  // Calculate available content width
  const contentWidth = width - margins.left - margins.right;
  
  // Reserve space for footer
  const spaceNeededForFooter = 10;
  
  // Initialize cursor position
  let currentY = y + margins.top;
  
  // Draw cell border
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(x, y, width, height);
  
  // --- 1. ASB Classification ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleFontSize);
  
  // ASB label left
  doc.text("ASB:", x + margins.left, currentY);
  
  // ASB number right
  if (normalizedBook.catalogNumber) {
    doc.text(normalizedBook.catalogNumber, x + width - margins.right, currentY, { align: 'right' });
  }
  
  // Secondary classification under ASB
  currentY += lineHeight.title;
  if (normalizedBook.secondaryClassification) {
    doc.text(normalizedBook.secondaryClassification, x + margins.left, currentY);
  }
  
  currentY += lineHeight.title + 1; // Add 1mm extra space between classifications and author
  
  // --- 2. Author's Name ---
  let authorFormatted = normalizedBook.mainAuthor;
  if (authorFormatted && authorFormatted.includes(" ") && !authorFormatted.includes(",")) {
    const nameParts = authorFormatted.split(" ");
    const lastName = nameParts.pop();
    const firstName = nameParts.join(" ");
    authorFormatted = `${lastName}, ${firstName}`;
  }
  
  doc.setFont("helvetica", "bold");
  if (authorFormatted) {
    doc.text(authorFormatted + ":", x + margins.left, currentY);
    currentY += lineHeight.title;
  }
  
  // --- 3. Book Title ---
  doc.setFont("helvetica", "normal");
  
  // Format title with limited length
  let titleText = normalizedBook.title;
  if (titleText.length > 40) {
    titleText = titleText.substring(0, 37) + "...";
  }
  
  // Split title text for wrapping with precise width
  const titleLines = doc.splitTextToSize(titleText, contentWidth);
  for (let i = 0; i < Math.min(titleLines.length, 2); i++) {
    doc.text(titleLines[i], x + margins.left, currentY);
    currentY += lineHeight.title;
  }
  
  // --- 4. Publication Info ---
  doc.setFontSize(contentFontSize);
  
  // Build publication info string following German cataloging format
  let pubInfo = "";
  
  // Edition
  if (normalizedBook.edition) {
    pubInfo += normalizedBook.edition;
  }
  
  // Location and publisher
  const location = normalizedBook.publicationPlace;
  const publisher = normalizedBook.publisher;
  
  if (location || publisher) {
    if (pubInfo) {
      pubInfo += `. – ${location}: ${publisher}`;
    } else {
      pubInfo += `${location}: ${publisher}`;
    }
  }
  
  // Year
  const year = normalizedBook.publicationYear;
  if (year) {
    pubInfo += pubInfo ? `, ${year}` : `${year}`;
  }
  
  // Pages
  const pages = normalizedBook.pageCount;
  if (pages) {
    pubInfo += pubInfo ? `. – ${pages} S.` : `${pages} S.`;
  }
  
  // Illustrations
  if (normalizedBook.illustrations) {
    pubInfo += `: ${normalizedBook.illustrations}`;
  }
  
  // Dimensions
  if (normalizedBook.dimensions) {
    pubInfo += ` ; ${normalizedBook.dimensions}`;
  }
  
  // Format publication info for display
  if (pubInfo) {
    const pubInfoFormatted = pubInfo.trim().replace(/\s+/g, " ");
    const pubLines = doc.splitTextToSize(pubInfoFormatted, contentWidth);
    
    for (let i = 0; i < Math.min(pubLines.length, 2); i++) {
      doc.text(pubLines[i], x + margins.left, currentY);
      currentY += lineHeight.content;
    }
  }
  
  // --- 5. ISBN and Price ---
  if (normalizedBook.isbn) {
    currentY += 1; // Small gap before ISBN
    
    let isbnText = `ISBN ${formatISBN(normalizedBook.isbn)}`;
    
    // Add price if available 
    if (normalizedBook.price) {
      let priceText = normalizedBook.price.toString();
      if (priceText.length > 25) {
        priceText = priceText.substring(0, 22) + "...";
      }
      isbnText += ` : ${priceText}`;
    }
    
    // Use splitTextToSize to ensure it fits
    const isbnLine = doc.splitTextToSize(isbnText, contentWidth)[0];
    doc.text(isbnLine, x + margins.left, currentY);
    currentY += lineHeight.content;
  }
  
  // --- 6. Summary and Review ---
  if (normalizedBook.summary || normalizedBook.review) {
    currentY += 1; // Small gap before summary
    doc.setFontSize(summaryFontSize);
    doc.setFont("helvetica", "normal");
    
    // Process summary and review text
    let summaryText = '';
    if (normalizedBook.summary) summaryText = normalizedBook.summary;
    if (normalizedBook.summary && normalizedBook.review) summaryText += ' | ';
    if (normalizedBook.review) summaryText += normalizedBook.review;
    
    // Clean up metadata patterns
    const metadataPatterns = [
      /\*\*Titel:\*\*.*\n?/i,
      /\*\*Autor(?:in)?:\*\*.*\n?/i,
      /\*\*Erscheinungsjahr:\*\*.*\n?/i,
      /\*\*ISBN:\*\*.*\n?/i,
      /\*\*Verlag:\*\*.*\n?/i,
      /Titel:.*\n?/i,
      /Autor(?:in)?:.*\n?/i,
      /Erscheinungsjahr:.*\n?/i,
      /ISBN:.*\n?/i,
      /Verlag:.*\n?/i
    ];
    
    metadataPatterns.forEach(pattern => {
      summaryText = summaryText.replace(pattern, '');
    });
    
    // Normalize text
    summaryText = summaryText.replace(/\n\s*\n/g, '\n').trim().replace(/\s+/g, " ");
    
    // Calculate available space for summary
    const maxY = y + height - spaceNeededForFooter;
    const availableHeight = maxY - currentY;
    const maxLinesToShow = Math.floor(availableHeight / lineHeight.summary);
    
    // Wrap text to fit width
    const summaryLines = doc.splitTextToSize(summaryText, contentWidth);
    const linesToShow = Math.min(summaryLines.length, maxLinesToShow);
    
    // Display summary text with consistent spacing
    for (let i = 0; i < linesToShow; i++) {
      doc.text(summaryLines[i], x + margins.left, currentY);
      currentY += lineHeight.summary;
    }
    
    // Add ellipsis if text was truncated
    if (summaryLines.length > linesToShow) {
      doc.text("...", x + margins.left, currentY);
    }
  }
  
  // --- 7. Footer Elements ---
  // Position at fixed distance from bottom
  currentY = y + height - margins.bottom;
  
  // Display ASB number in footer
  doc.setFontSize(footerFontSize);
  doc.setFont("helvetica", "normal");
  
  if (normalizedBook.catalogNumber) {
    doc.text(normalizedBook.catalogNumber, x + width/2, currentY, { align: 'center' });
    currentY += lineHeight.footer;
  }
  
  // Display ekz text at bottom
  doc.text("ekz-Informationsdienst", x + width/2, currentY, { align: 'center' });
  
  return height; // Return fixed cell height
}

// Export multiple books to a single PDF with the specified format from the image
export function exportMultipleBooksToSinglePDF(books: Book[], language: string = 'de'): void {
  if (!books || books.length === 0) return;
  
  // Create a new PDF with standard A4 size (German DIN A4)
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    compress: true // Use compression for smaller file size
  });
  
  // Page dimensions (standard A4)
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 10; // Margin around the page edges
  
  // Grid layout configuration - consistent across all pages
  const gridColumns = 2; // Two columns per page
  const gridRows = 1;    // One row per page after the first page
  
  // Calculate cell dimensions with precise margins
  const horizontalGap = 10;  // Space between columns
  const cellWidth = (pageWidth - (2 * margin) - horizontalGap) / gridColumns;
  const cellHeight = 140;    // Fixed height for all book entries
  
  // First page layout - two correction boxes at the top
  const boxWidth = 80;
  const boxHeight = 70;
  const boxY = 20;
  const boxGap = 20;
  
  // Calculate precise positions for correction boxes
  const firstBoxX = (pageWidth - (2 * boxWidth) - boxGap) / 2;
  const secondBoxX = firstBoxX + boxWidth + boxGap;
  
  // Draw the two correction boxes with consistent positioning
  drawCorrectionBox(doc, firstBoxX, boxY, boxWidth, boxHeight);
  drawCorrectionBox(doc, secondBoxX, boxY, boxWidth, boxHeight);
  
  // Track books processed
  let currentBook = 0;
  
  // First page layout - two books in the bottom half with precise positioning
  const firstPageBookY = boxY + boxHeight + 20; // Position books below correction boxes
  
  if (currentBook < books.length) {
    // First book - bottom left
    formatBookEntryForGrid(doc, books[currentBook], margin, firstPageBookY, cellWidth, cellHeight);
    currentBook++;
    
    if (currentBook < books.length) {
      // Second book - bottom right with precise positioning
      const secondBookX = margin + cellWidth + horizontalGap;
      formatBookEntryForGrid(doc, books[currentBook], secondBookX, firstPageBookY, cellWidth, cellHeight);
      currentBook++;
    }
  }
  
  // Process remaining books on subsequent pages with consistent layout
  while (currentBook < books.length) {
    // Create a new page for next set of books
    doc.addPage();
    
    // Process books in grid layout with precise positioning
    for (let row = 0; row < gridRows && currentBook < books.length; row++) {
      for (let col = 0; col < gridColumns && currentBook < books.length; col++) {
        // Calculate exact position for each cell
        const x = margin + (col * (cellWidth + horizontalGap));
        const y = margin + (row * (cellHeight + margin));
        
        // Add book to grid with consistent dimensions
        formatBookEntryForGrid(doc, books[currentBook], x, y, cellWidth, cellHeight);
        currentBook++;
      }
    }
  }
  
  // Add page numbers with consistent positioning and formatting
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    
    // Localized page number text
    const pageText = language === 'de' ? `Seite ${i} von ${pageCount}` : `Page ${i} of ${pageCount}`;
    
    // Position consistently at bottom right
    doc.text(pageText, pageWidth - margin, pageHeight - 5, { align: 'right' });
  }
  
  // Generate timestamped filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = language === 'de' ? `Buchkatalog_${timestamp}.pdf` : `BookCatalog_${timestamp}.pdf`;
  
  // Save file
  doc.save(filename);
}
