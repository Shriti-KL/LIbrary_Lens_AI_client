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
  // Set consistent typography for headers
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  
  // Top-left ASB label
  doc.text("ASB:", 22, yPos);
  
  // Top-right classification number (ASB)
  const asbNumber = book.classificationNumber || book.ASB || "";
  doc.text(asbNumber, 190, yPos, { align: 'right' });
  
  // Second line - additional classifications under ASB
  yPos += 7;
  // Include DNB number as additional classification if available
  let addClassText = book.additionalClassifications || "";
  if (book.dnbNumber && !addClassText.includes(book.dnbNumber)) {
    addClassText = addClassText ? `${addClassText}, ${book.dnbNumber}` : book.dnbNumber;
  }
  doc.setFont("helvetica", "normal"); // Use normal font for additional classifications
  doc.text(addClassText, 22, yPos);
  
  // Add proper spacing after classifications section
  yPos += 18; // Increased spacing to create visual separation
  
  // --- 2. Author's name in bold ---
  // Format author's name to "LastName, FirstName:" as shown in the target format
  let authorFormatted = book.mainAuthor || book.author || "";
  if (authorFormatted && authorFormatted.includes(" ") && !authorFormatted.includes(",")) {
    const nameParts = authorFormatted.split(" ");
    const lastName = nameParts.pop();
    const firstName = nameParts.join(" ");
    authorFormatted = `${lastName}, ${firstName}`;
  }
  
  doc.setFontSize(12); // Slightly larger font for author
  doc.setFont("helvetica", "bold"); 
  doc.text(authorFormatted + ":", 22, yPos);
  
  yPos += 9; // Increased spacing after author name for better visual separation
  
  // --- 3. Book title and publication info ---
  // Set consistent typography for title
  doc.setFontSize(11.5); // Slightly larger for title than normal text
  doc.setFont("helvetica", "bold"); // Use bold for title line
  
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
  
  // Add statement of responsibility
  if (book.statementOfResponsibility) {
    titleText += ` / ${book.statementOfResponsibility}`;
  } else {
    // Use authors and contributors to construct statement of responsibility
    let authorName = book.mainAuthor || book.author || "";
    
    // Check for contributors
    let otherContributors = "";
    if (book.contributors && (typeof book.contributors === 'object')) {
      // If contributors is an object with role keys (new format)
      if (!Array.isArray(book.contributors)) {
        const contributorsList = [];
        for (const role in book.contributors) {
          if (Array.isArray(book.contributors[role]) && book.contributors[role].length > 0) {
            contributorsList.push(`${book.contributors[role].join(", ")} (${role})`);
          }
        }
        if (contributorsList.length > 0) {
          otherContributors = ` ; ${contributorsList.join(" ; ")}`;
        }
      } 
      // If contributors is an array of objects with name and role (old format)
      else if (book.contributors.length > 0) {
        const contributorsList = book.contributors
          .filter((c: any) => c.name && c.role)
          .map((c: any) => `${c.name} (${c.role})`)
          .join(" ; ");
        
        if (contributorsList) {
          otherContributors = ` ; ${contributorsList}`;
        }
      }
    }
    
    // Add author and contributors to title text
    if (authorName) {
      titleText += ` / ${authorName}${otherContributors}`;
    } else if (otherContributors) {
      titleText += ` /${otherContributors}`;
    }
  }
  
  // Split the title text for proper wrapping
  const titleLines = doc.splitTextToSize(titleText, 155);
  
  // Set the title lines (first line in bold, rest in normal weight)
  for (let i = 0; i < titleLines.length; i++) {
    if (i === 0) {
      // First line remains bold
      doc.setFont("helvetica", "bold");
    } else {
      // Subsequent lines in normal weight
      doc.setFont("helvetica", "normal");
    }
    doc.text(titleLines[i], 22, yPos);
    yPos += 6; // Slightly increased line spacing for better readability
  }
  
  // Reset to normal font after title
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  
  // --- 4. Publication Information ---
  yPos += 2; // Extra space before publication info
  
  // Build full publication string following the exact target format
  let publicationInfo = '';
  
  // Start with edition information
  if (book.edition) {
    publicationInfo += `${book.edition}`;
  }
  
  // Add location and publisher 
  const location = book.publicationPlace || book.location || '';
  const publisher = book.publisher || '';
  
  if (publicationInfo) {
    publicationInfo += `. – ${location}: ${publisher}`;
  } else {
    publicationInfo += `${location}: ${publisher}`;
  }
  
  // Add year
  const year = book.publicationYear || book.publishedYear;
  if (year) {
    publicationInfo += `, ${year}`;
  }
  
  // Add physical description - pages
  const pages = book.pageCount || '';
  if (pages) {
    publicationInfo += `. – ${pages} ${pages === 1 ? 'Seite' : 'Seiten'}`;
  } else {
    publicationInfo += `. – `;
  }
  
  // Add illustration information if available
  if (book.illustrations) {
    publicationInfo += `: ${book.illustrations}`;
  } else if (book.illustrator || (book.contributors && typeof book.contributors === 'object')) {
    // Check if there are illustrators in contributors
    let hasIllustrators = false;
    
    if (book.contributors) {
      // New format - object with roles as keys
      if (!Array.isArray(book.contributors) && book.contributors['Illustrator']) {
        hasIllustrators = true;
      }
      // Old format - array of objects with name and role
      else if (Array.isArray(book.contributors)) {
        hasIllustrators = book.contributors.some((c: any) => 
          c.role?.toLowerCase() === 'illustrator' || c.role?.toLowerCase().includes('illust'));
      }
    }
    
    if (book.illustrator || hasIllustrators) {
      publicationInfo += `: Illustrationen`;
    }
  } else {
    // Default to "keine Illustrationen" if specifically requested to show this info
    // Leave blank by default unless explicitly requested to show "keine Illustrationen"
    // publicationInfo += `: keine Illustrationen`;
  }
  
  // Add dimensions if available
  if (book.dimensions) {
    publicationInfo += ` ; ${book.dimensions}`;
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
    
    // Add binding type if available
    if (book.binding) {
      isbnLine += ` ${book.binding}`;
    }
    
    // Add price if available (with comma, not period, for decimal values in German format)
    if (book.price) {
      // Price is a string in the schema, so no need for complex type handling
      const priceText = String(book.price).replace('.', ',');
      isbnLine += `: EUR ${priceText}`;
    }
    
    doc.setFont("helvetica", "normal");
    doc.text(isbnLine, 22, yPos);
    yPos += 7;
  }
  
  // --- 6. Book summary/description and critical review ---
  if (book.summary || book.review) {
    yPos += 4; // Increase spacing before summary section
    
    // Set text style for summary text - slightly smaller than body text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10); // Standard size for summary text
    
    // Combine summary and review with the | separator exactly as in target format
    let summaryText = '';
    if (book.summary) {
      summaryText = book.summary;
    }
    if (book.summary && book.review) {
      // Add a visual separator for clarity
      summaryText += ' | ';
    }
    if (book.review) {
      summaryText += book.review;
    }
    
    // Clean up the text by removing any metadata patterns
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
    
    // Apply all patterns
    metadataPatterns.forEach(pattern => {
      summaryText = summaryText.replace(pattern, '');
    });
    
    // Remove any extra whitespace and multiple newlines
    summaryText = summaryText.replace(/\n\s*\n/g, '\n').trim();
    
    // Split the text for proper wrapping with a slightly narrower column
    // for better readability of summary text
    const summaryLines = doc.splitTextToSize(summaryText, 155);
    
    // Create content for each line with justified text
    for (let i = 0; i < summaryLines.length; i++) {
      doc.text(summaryLines[i], 22, yPos, { 
        align: 'justify',
        maxWidth: 155,
      });
      
      // Use proper line spacing - a bit tighter than normal text
      // but enough for good readability
      yPos += 4.2; // Slightly reduced line spacing for summary text
    }
    
    // Add proper spacing after the summary
    yPos += 3;
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
  
  // --- 10. Barcode and footer ---
  yPos += 10;
  
  // Generate a barcode and center it
  const barcodeHeight = 12;
  const barcodeWidth = 90;
  const startX = (doc.internal.pageSize.width - barcodeWidth) / 2;
  
  // Add the classification number above the barcode
  doc.setFontSize(7);
  doc.setFont("courier", "normal");
  doc.text(asbNumber, startX + barcodeWidth/2, yPos - 2, { align: 'center' });
  
  // Draw barcode lines
  doc.setDrawColor(0);
  doc.setFillColor(0, 0, 0);
  doc.setLineWidth(0.1);
  
  // Create a realistic barcode pattern
  let barX = startX;
  const numBars = 50;
  const spacing = barcodeWidth / numBars;
  
  for (let i = 0; i < numBars; i++) {
    const isThickBar = (i % 7 === 0 || i % 11 === 0 || i % 3 === 2);
    const barWidth = isThickBar ? spacing * 2 : spacing * 0.7;
    
    if (i % 4 !== 3 || i % 8 === 0) {
      doc.rect(barX, yPos, barWidth, barcodeHeight, 'F');
    }
    
    barX += spacing;
  }
  
  // Add ekz-Informationsdienst text below barcode
  yPos += barcodeHeight + 5;
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
  });
  
  // Configure language-specific text
  const bookLanguage = book.language || language;
  
  // Modify any labels or text based on the book's language
  // Note: The formatBookEntryForPDF function already handles German formatting
  // with commas for decimal points, "Seiten" instead of "pages", etc.
  
  // Format book entry
  formatBookEntryForPDF(doc, book);
  
  // Save the PDF with the book title as filename
  // Remove any forbidden characters from filename
  const safeFilename = (book.title || 'book').replace(/[/\\?%*:|"<>]/g, '-');
  
  // Set the correct filename prefix based on language
  const filenamePrefix = bookLanguage === 'de' ? 'Buch' : 'Book';
  doc.save(`${safeFilename || `${filenamePrefix}_${new Date().toISOString().substring(0, 10)}`}.pdf`);
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
  const originalFontSize = 11;
  const gridFontSize = 9; // Smaller font for grid layout
  const startY = y;
  let currentY = startY + 5;
  
  // Draw a thin border around the entire cell
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(x, y, width, height);
  
  // --- ASB Classification in top corners ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(gridFontSize);
  
  // ASB label left
  doc.text("ASB:", x + 5, currentY);
  
  // ASB number right
  const asbNumber = book.catalogNumber || "";
  if (asbNumber) {
    doc.text(asbNumber, x + width - 5, currentY, { align: 'right' });
  }
  
  // Secondary classification under ASB
  currentY += 5;
  const secondaryCode = book.secondaryClassification || "";
  if (secondaryCode) {
    doc.text(secondaryCode, x + 5, currentY);
  }
  
  currentY += 8;
  
  // --- Author's name in bold ---
  let authorFormatted = book.mainAuthor || book.author || "";
  if (authorFormatted && authorFormatted.includes(" ") && !authorFormatted.includes(",")) {
    const nameParts = authorFormatted.split(" ");
    const lastName = nameParts.pop();
    const firstName = nameParts.join(" ");
    authorFormatted = `${lastName}, ${firstName}`;
  }
  
  doc.setFont("helvetica", "bold");
  doc.text(authorFormatted + ":", x + 5, currentY);
  
  currentY += 5;
  
  // --- Book title ---
  doc.setFont("helvetica", "normal");
  
  // Truncate and format the title to fit
  let titleText = book.title;
  if (titleText.length > 60) {
    titleText = titleText.substring(0, 57) + "...";
  }
  
  // Add author after title
  titleText += ` / ${book.author}`;
  
  // Split for wrapping with reduced width
  const titleLines = doc.splitTextToSize(titleText, width - 10);
  for (let i = 0; i < Math.min(titleLines.length, 3); i++) { // Limit to 3 lines
    doc.text(titleLines[i], x + 5, currentY);
    currentY += 4;
  }
  
  currentY += 2;
  
  // --- Publication info - condensed ---
  let pubInfo = "";
  
  // Add components only if they exist, using the new field names with fallbacks
  if (book.edition) pubInfo += book.edition;
  
  // Use publicationPlace first, with location as fallback
  const location = book.publicationPlace || book.location;
  if (location) pubInfo += pubInfo.length > 0 ? ` – ${location}` : location;
  
  if (book.publisher) pubInfo += pubInfo.length > 0 ? `: ${book.publisher}` : book.publisher;
  
  // Use publicationYear first, with publishedYear as fallback
  const year = book.publicationYear || book.publishedYear;
  if (year) pubInfo += pubInfo.length > 0 ? `, ${year}` : `${year}`;
  
  if (book.pageCount) pubInfo += pubInfo.length > 0 ? ` – ${book.pageCount} S.` : `${book.pageCount} S.`;
  
  // Add illustrations info if available
  if (book.illustrations) pubInfo += pubInfo.length > 0 ? `: ${book.illustrations}` : book.illustrations;
  
  if (book.dimensions) pubInfo += pubInfo.length > 0 ? ` ; ${book.dimensions}` : book.dimensions;
  
  if (pubInfo.length > 0) {
    const pubLines = doc.splitTextToSize(pubInfo, width - 10);
    for (let i = 0; i < Math.min(pubLines.length, 2); i++) { // Limit to 2 lines
      doc.text(pubLines[i], x + 5, currentY);
      currentY += 4;
    }
  }
  
  // --- ISBN and price - condensed ---
  if (book.isbn) {
    currentY += 2;
    let isbnText = `ISBN ${formatISBN(book.isbn)}`;
    
    // Add binding type if available
    if (book.binding) {
      isbnText += ` - ${book.binding}`;
    }
    
    // Add price if available
    if (book.price) {
      isbnText += ` : EUR ${book.price.toString().replace('.', ',')}`;
    }
    
    doc.text(doc.splitTextToSize(isbnText, width - 10)[0], x + 5, currentY);
    currentY += 5;
  }
  
  // --- Summary and Review - ensure full content appears ---
  if (book.summary || book.review) {
    doc.setFontSize(gridFontSize - 1);
    
    // Combine summary and review with the | separator
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
    
    // Remove metadata-like patterns
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
    
    // Apply all patterns
    metadataPatterns.forEach(pattern => {
      summaryText = summaryText.replace(pattern, '');
    });
    
    // Remove any extra whitespace that might remain
    summaryText = summaryText.replace(/\n\s*\n/g, '\n').trim();
    
    // No longer limit by space - we will expand the cell height dynamically
    // This ensures all text is visible even if it's very long
    
    // Break into lines with proper wrapping
    const summaryLines = doc.splitTextToSize(summaryText, width - 10);
    
    // Calculate the height needed to display all text
    const lineHeight = 3;
    // We'll show all lines, not limiting them
    
    // Set font for summary text - normal weight
    doc.setFont("helvetica", "normal");
    
    // Show all lines of the summary and review
    const linesToShow = summaryLines.length;
    
    for (let i = 0; i < linesToShow; i++) {
      doc.text(summaryLines[i], x + 5, currentY, { align: 'justify' });
      currentY += lineHeight; // Reduced line spacing to fit more text
    }
    
    // No ellipsis needed since we're showing all lines
  }
  
  // --- IK category and ID-B number ---
  // Calculate where the remaining footer content should go
  // We need to leave space for barcode (approx 20mm) and other footer elements
  
  // Create a new page if we don't have enough space for the barcode/footer
  // Check if we're getting too close to the bottom of the cell
  const spaceNeededForFooter = 30; // Space needed for barcode and footer text
  
  // If the currentY position is too close to the bottom edge of the specified height,
  // increase the cell height dynamically
  if (currentY > y + height - spaceNeededForFooter) {
    // Instead of creating a new page, we'll put some space and continue
    // This is better than cutting off mid-sentence
    currentY += 5; // Add some space after the summary
  } else {
    // We have enough space in current page, position footer near bottom
    currentY = y + height - spaceNeededForFooter;
  }
  
  // Interest category if available
  if (book.interestCategory) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(gridFontSize - 1);
    doc.text(book.interestCategory, x + 5, currentY);
    currentY += 4;
  }
  
  // ID-B number if available
  if (book.idBNumber) {
    doc.setFont("helvetica", "normal");
    doc.text(book.idBNumber, x + 5, currentY);
  }
  
  // --- Barcode and footer ---
  // Draw simplified barcode
  currentY = y + height - 15;
  const barcodeWidth = width * 0.7;
  const barcodeHeight = 8;
  const barcodeX = x + (width - barcodeWidth) / 2;
  
  // Add ASB number above barcode
  doc.setFontSize(7);
  doc.setFont("courier", "normal");
  doc.text(asbNumber.toString(), barcodeX + barcodeWidth/2, currentY - 1, { align: 'center' });
  
  // Draw barcode
  doc.setDrawColor(0);
  doc.setFillColor(0, 0, 0); // RGB format expected by jsPDF
  
  for (let i = 0; i < 30; i++) {
    const barX = barcodeX + (i * (barcodeWidth / 30));
    const barWidth = 0.7 * (barcodeWidth / 30);
    
    if (i % 3 !== 1) { // Pattern for barcode
      doc.rect(barX, currentY, barWidth, barcodeHeight, 'F');
    }
  }
  
  // Add ekz footer text
  currentY += barcodeHeight + 3;
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("ekz-Informationsdienst", x + width/2, currentY, { align: 'center' });
  
  return height; // Return the fixed height we used
}

// Export multiple books to a single PDF with the specified format from the image
export function exportMultipleBooksToSinglePDF(books: Book[], language: string = 'de'): void {
  if (!books || books.length === 0) return;
  
  // Create a new PDF with standard A4 size (German DIN A4)
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
  });
  
  // Page dimensions
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 10;
  
  // Grid dimensions - Adjust to provide more space for content
  const gridColumns = 2;
  // Reduce to 1 row per page after the first page to allow more space for content
  const gridRows = 1;
  const cellWidth = (pageWidth - (margin * 3)) / gridColumns; // 2 columns with margins
  // Increase the cell height to accommodate more text, especially for summaries
  // Use 140mm height per cell for even more space
  const cellHeight = 140; // Fixed height in mm to ensure enough space for summary
  
  // First page layout - two correction boxes at the top
  const boxWidth = 80;
  const boxHeight = 70;
  const boxY = 20;
  
  // Draw the two correction boxes
  drawCorrectionBox(doc, (pageWidth - 2 * boxWidth - 20) / 2, boxY, boxWidth, boxHeight);
  drawCorrectionBox(doc, (pageWidth - 2 * boxWidth - 20) / 2 + boxWidth + 20, boxY, boxWidth, boxHeight);
  
  let currentBook = 0;
  
  // First page - two books in the bottom half
  if (currentBook < books.length) {
    // First book - bottom left
    formatBookEntryForGrid(doc, books[currentBook], margin, boxY + boxHeight + 20, cellWidth, cellHeight);
    currentBook++;
    
    if (currentBook < books.length) {
      // Second book - bottom right
      formatBookEntryForGrid(doc, books[currentBook], margin + cellWidth + margin/2, boxY + boxHeight + 20, cellWidth, cellHeight);
      currentBook++;
    }
  }
  
  // Process remaining books in 2x2 grid on subsequent pages
  while (currentBook < books.length) {
    // Add a new page
    doc.addPage();
    
    for (let row = 0; row < gridRows && currentBook < books.length; row++) {
      for (let col = 0; col < gridColumns && currentBook < books.length; col++) {
        const x = margin + (col * (cellWidth + margin/2));
        const y = margin + (row * (cellHeight + margin/2));
        
        formatBookEntryForGrid(doc, books[currentBook], x, y, cellWidth, cellHeight);
        currentBook++;
      }
    }
  }
  
  // Add page numbers with localized text depending on language
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    
    // Use proper language for page numbers
    const pageText = language === 'de' ? `Seite ${i} von ${pageCount}` : `Page ${i} of ${pageCount}`;
    doc.text(pageText, pageWidth - margin, pageHeight - 5, { align: 'right' });
  }
  
  // Generate a timestamped filename with language-appropriate naming
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const filename = language === 'de' ? `Buchkatalog_${timestamp}.pdf` : `BookCatalog_${timestamp}.pdf`;
  doc.save(filename);
}
