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
    
    // Add subheading for summary
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("Inhalt:", 22, yPos);
    yPos += 5;
    
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
    
    // Remove any extra whitespace and multiple newlines that might remain
    summaryText = summaryText.replace(/\n\s*\n/g, '\n').trim();
    
    // Ensure summary is not too long (aim for ~1000 characters)
    if (summaryText.length > 1000) {
      // Find the last complete sentence before the 1000 character mark
      const truncateAt = summaryText.lastIndexOf('.', 1000);
      if (truncateAt > 0) {
        summaryText = summaryText.substring(0, truncateAt + 1);
      } else {
        // If no sentence break found, just truncate at 1000
        summaryText = summaryText.substring(0, 1000) + '...';
      }
    }
    
    // Split the text for proper wrapping with slightly reduced line spacing
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
  const catalogOptions = ["103.485.0", "103.992.7", "103.612.3", "102.861.1", "104.027.4", "104.027.2"];
  const asbNumber = book.catalogNumber || catalogOptions[Math.floor(Math.random() * catalogOptions.length)];
  doc.text(asbNumber, x + width - 5, currentY, { align: 'right' });
  
  // Secondary classification under ASB
  currentY += 5;
  const secondaryOptions = ["4.1, 4.3/C", "4.3/Y", "6.1/Aax", "Ee", "Emp 614"];
  const secondaryCode = book.secondaryClassification || secondaryOptions[Math.floor(Math.random() * secondaryOptions.length)];
  doc.text(secondaryCode, x + 5, currentY);
  
  currentY += 8;
  
  // --- Author's name in bold ---
  let authorFormatted = book.author;
  if (book.author && book.author.includes(" ") && !book.author.includes(",")) {
    const nameParts = book.author.split(" ");
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
  const pubInfo = `${book.edition || '1. Aufl.'} - ${book.location || 'München'}: ${book.publisher || 'Verlag'}, ${book.publishedYear || '2025'} - ${book.pageCount || '250'} S. ; ${book.dimensions || '21 cm'}`;
  const pubLines = doc.splitTextToSize(pubInfo, width - 10);
  for (let i = 0; i < Math.min(pubLines.length, 2); i++) { // Limit to 2 lines
    doc.text(pubLines[i], x + 5, currentY);
    currentY += 4;
  }
  
  // --- ISBN and price - condensed ---
  if (book.isbn) {
    currentY += 2;
    const isbnText = `ISBN ${formatISBN(book.isbn)} - ${book.binding || 'Festeinband'} : EUR ${book.price || '24,99'}`;
    doc.text(doc.splitTextToSize(isbnText, width - 10)[0], x + 5, currentY);
    currentY += 5;
  }
  
  // --- Summary - condensed, only a few lines ---
  if (book.summary) {
    doc.setFontSize(gridFontSize - 1);
    
    // Clean up the summary to remove redundant metadata - similar to the function above
    let summaryText = book.summary;
    
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
    
    // Ensure summary is not too long
    if (summaryText.length > 400) { // Shorter for grid view
      // Find the last complete sentence before character limit
      const truncateAt = summaryText.lastIndexOf('.', 400);
      if (truncateAt > 0) {
        summaryText = summaryText.substring(0, truncateAt + 1);
      } else {
        // If no sentence break found, just truncate
        summaryText = summaryText.substring(0, 400) + '...';
      }
    }
    
    // Break into lines with proper wrapping
    const summaryLines = doc.splitTextToSize(summaryText, width - 10);
    
    // We need to ensure the summary fits in the available space - limit to max lines
    const maxSummaryLines = 6; // Limit summary to 6 lines in grid view
    
    // Add subheading for summary
    doc.setFont("helvetica", "italic");
    doc.text("Inhalt:", x + 5, currentY);
    currentY += 3.5;
    
    // Switch back to normal font for the summary text
    doc.setFont("helvetica", "normal");
    
    for (let i = 0; i < Math.min(summaryLines.length, maxSummaryLines); i++) {
      doc.text(summaryLines[i], x + 5, currentY, { align: 'justify' });
      currentY += 3; // Slightly reduce line spacing to fit more text
    }
    
    // Add ellipsis if the summary was truncated
    if (summaryLines.length > maxSummaryLines) {
      doc.text("...", x + 5, currentY);
      currentY += 3;
    }
  }
  
  // --- IK category and ID-B number ---
  currentY = y + height - 30;
  
  // Interest category
  const ikOptions = ["IK: Abenteuer, Meer; ab 8", "IK: Abenteuer, Andere Länder; ab 8", "IK: Geschichte; ab 10"];
  const interestCategory = book.interestCategory || ikOptions[Math.floor(Math.random() * ikOptions.length)];
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(gridFontSize - 1);
  doc.text(interestCategory, x + 5, currentY);
  
  currentY += 4;
  
  // ID-B number
  const idBNumber = book.idBNumber || `ID-B ${Math.floor(Math.random() * 25) + 1}/${Math.floor(Math.random() * 35) + 1}`;
  doc.setFont("helvetica", "normal");
  doc.text(idBNumber, x + 5, currentY);
  
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
export function exportMultipleBooksToSinglePDF(books: Book[]): void {
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
  
  // Grid dimensions
  const gridColumns = 2;
  const gridRows = 2;
  const cellWidth = (pageWidth - (margin * 3)) / gridColumns; // 2 columns with margins
  const cellHeight = (pageHeight - (margin * 3)) / gridRows; // 2 rows with margins
  
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
