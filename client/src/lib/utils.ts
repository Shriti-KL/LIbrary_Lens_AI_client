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

/**
 * Clean and format price text to only keep EUR (DE) value
 * This function extracts the main German price from complex price strings
 * Example: "Broschur : circa EUR 27.95 (DE), circa EUR 28.80 (AT)" -> "EUR 27.95"
 */
export function formatPriceForDb(priceText: string | null | undefined): string | null {
  if (!priceText) return null;
  
  // Standardize price text
  priceText = priceText.trim();
  
  // Check if it's already a clean price
  if (/^EUR \d+([,.]\d+)?$/.test(priceText)) {
    return priceText;
  }
  
  // Try to extract the German price with country code (DE)
  const deMatch = priceText.match(/EUR\s+\d+([,.]\d+)?\s*\(DE\)/i);
  if (deMatch) {
    // Extract just the EUR value from the match
    const euroValue = deMatch[0].match(/EUR\s+\d+([,.]\d+)?/i);
    if (euroValue) {
      return euroValue[0].trim();
    }
  }
  
  // If no (DE) specific price, look for the first EUR price
  const eurMatch = priceText.match(/EUR\s+\d+([,.]\d+)?/i);
  if (eurMatch) {
    return eurMatch[0].trim();
  }
  
  // If no EUR price found, return the original text
  return priceText;
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
// Helper function to consistently render text with maxWidth to prevent overflow
function renderText(doc: jsPDF, text: string, x: number, y: number, options: any = {}): number {
  // Always apply maxWidth unless explicitly disabled
  const defaultOptions = { maxWidth: 170, ...options };
  doc.text(text, x, y, defaultOptions);
  // Return the y position for potential increment
  return y;
}

// Function that updates doc.text in the existing PDF generation code to use maxWidth
function patchPdfTextRendering(formatBookEntryForPDF: Function): Function {
  return function(this: any, ...args: any[]) {
    // Store the original text function
    const originalText = args[0].text;
    
    // Replace it with our own implementation that always uses maxWidth
    args[0].text = function(text: string, x: number, y: number, options?: any) {
      // If options is not an object (might be a legacy 'align' string), convert it
      if (typeof options !== 'object' || options === null) {
        options = options ? { align: options } : {};
      }
      // Always add maxWidth if not already specified
      if (!options.maxWidth) {
        options.maxWidth = 170; // Prevent text overflow
      }
      // Call the original function with our enhanced options
      return originalText.call(this, text, x, y, options);
    };
    
    // Call the original function with our modified doc
    const result = formatBookEntryForPDF.apply(this, args);
    
    // Restore the original function
    args[0].text = originalText;
    
    return result;
  };
}

// Define the actual formatting function
export function formatBookEntryForPDF(doc: jsPDF, book: Book, startY: number = 20): number {
  let yPos = startY;
  
  // --- 1. ASB Classification at the top-left corner ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  
  // Debug classification fields
  console.log("PDF Debug - Classification fields:", {
    classificationNumber: book.classificationNumber,
    secondaryClassification: book.secondaryClassification,
    rawBook: book
  });

  // Format and display ASB classification as "ASB: [classificationNumber]"
  const asbNumber = book.classificationNumber || book.ASB || "";
  doc.text("ASB: " + asbNumber, 22, yPos);
  
  // Add the secondary classification on the next line if available
  // Need to check both camelCase (for frontend objects) and snake_case (for direct database fields)
  const secondaryClass = book.secondaryClassification || book.secondary_classification;
  console.log("Secondary classification check:", { 
    camelCase: book.secondaryClassification,
    snakeCase: book.secondary_classification,
    secondaryClass
  });
  
  if (secondaryClass) {
    yPos += 5;
    doc.text(secondaryClass, 22, yPos);
    console.log("Adding secondary classification to PDF:", secondaryClass);
  }
  
  // Second line - additional classifications under ASB
  yPos += 7;
  // Include DNB number as additional classification if available
  let addClassText = book.additionalClassifications || "";
  if (book.dnbNumber && !addClassText.includes(book.dnbNumber)) {
    addClassText = addClassText ? `${addClassText}, ${book.dnbNumber}` : book.dnbNumber;
  }
  doc.text(addClassText, 22, yPos);
  
  yPos += 15; // Space after classifications
  
  // --- 2. Author's name in bold ---
  // Format author's name to "LastName, FirstName:" as shown in the target format
  let authorFormatted = book.mainAuthor || book.author || "";
  if (authorFormatted && authorFormatted.includes(" ") && !authorFormatted.includes(",")) {
    const nameParts = authorFormatted.split(" ");
    const lastName = nameParts.pop();
    const firstName = nameParts.join(" ");
    authorFormatted = `${lastName}, ${firstName}`;
  }
  
  // Use consistent font size for author name
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  
  // Calculate width to make sure text stays within boundaries
  const authorWidth = doc.getTextWidth(authorFormatted + ":");
  const maxWidth = 170;
  
  if (authorWidth > maxWidth) {
    // Split if needed to ensure text stays within boundaries
    const authorLines = doc.splitTextToSize(authorFormatted + ":", maxWidth);
    doc.text(authorLines[0], 22, yPos);
    yPos += 4;
    if (authorLines.length > 1) {
      doc.text(authorLines[1], 22, yPos);
      yPos += 4;
    }
  } else {
    // Otherwise, render on a single line
    doc.text(authorFormatted + ":", 22, yPos);
    yPos += 5;
  }
  
  // --- 3. Book title and publication info ---
  // Reset font settings for title section
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  
  // Apply consistent character spacing settings for all text elements
  try {
    // These settings help maintain consistent letter spacing
    (doc as any).setTextRenderingMode("fill");
    
    // Use character spacing control if available (newer jsPDF versions)
    if ((doc as any).setCharSpace) {
      (doc as any).setCharSpace(0); // Prevent letter-spacing expansion
    }
  } catch (e) {
    console.log("Advanced text rendering not supported, using standard rendering");
  }
  
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
  
  // Format the title line with subtitle if present following the exact ekz format
  let titleText = titleFull;
  if (subtitle) {
    titleText = `${titleFull} : ${subtitle}`;  // Use space colon space format exactly as per German standards
  }
  
  // Prepare statement of responsibility
  let statementOfResp = "";
  if (book.statementOfResponsibility) {
    statementOfResp = book.statementOfResponsibility;
  } else {
    // Use authors and contributors to construct statement of responsibility
    const authorName = book.mainAuthor || book.author || "";
    
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
    
    // For illustrators specifically
    if (book.illustrator && !otherContributors.includes(book.illustrator)) {
      otherContributors = otherContributors 
        ? `${otherContributors} ; ${book.illustrator} (Illustrator)` 
        : ` ; ${book.illustrator} (Illustrator)`;
    }
    
    // Add additional authors
    let additionalAuthors = "";
    if (book.additionalAuthors && Array.isArray(book.additionalAuthors) && book.additionalAuthors.length > 0) {
      additionalAuthors = `, ${book.additionalAuthors.join(", ")}`;
    }
    
    // Construct statement
    if (authorName) {
      statementOfResp = authorName;
      if (additionalAuthors) {
        statementOfResp += additionalAuthors;
      }
      if (otherContributors) {
        statementOfResp += otherContributors;
      }
    } else if (otherContributors) {
      statementOfResp = otherContributors.trimStart();
    }
  }
  
  // Use consistent smaller font size for all metadata sections
  doc.setFontSize(8);
  
  // Format title with subtitle using consistent spacing for PDF output
  let displayTitle = titleFull;
  if (subtitle) {
    // Format with proper spacing for German RDA standards
    displayTitle += ` : ${subtitle.trim()}`;
  }
  
  // Normalize spacing in title for consistent letter spacing in PDF
  displayTitle = displayTitle.replace(/\s+/g, ' ').trim();
  
  // Control line width precisely to prevent overflow
  const titleMaxWidth = 160;  // Max width allowed for text content
  
  // Add debugging for title processing
  console.log("PDF Debug - Title processing:", {
    titleFull,
    subtitle,
    displayTitle,
    originalWidth: doc.getTextWidth(displayTitle)
  });
  
  // Fix for letter spacing in PDFs - remove completely to prevent errors
  // and rely on the overridden text function below
  
  // Split lines with consistent spacing
  const titleLines = doc.splitTextToSize(displayTitle, titleMaxWidth);
  
  // Render title lines with controlled spacing
  for (let i = 0; i < titleLines.length; i++) {
    renderText(doc, titleLines[i], 22, yPos);
    yPos += 4;  // Consistent line height for title
  }
  
  // Add small space after title before statement of responsibility
  yPos += 1;
  
  // Render statement of responsibility if available
  if (statementOfResp) {
    // Reset font settings to ensure consistency
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    // Normalize spacing in statement of responsibility
    statementOfResp = statementOfResp.replace(/\s+/g, ' ').trim();
    
    // Format according to German RDA standards
    const statementLine = `/ ${statementOfResp}`;
    
    // Apply character spacing fixes before rendering
    try {
      // Set character spacing to 0 (normal)
      (doc as any).internal.out("0 Tc");
      // Set word spacing to 0 (normal)
      (doc as any).internal.out("0 Tw");
    } catch (e) {
      // Silently continue if this fails
    }
    
    // Split statement text if it's too long
    const statementLines = doc.splitTextToSize(statementLine, titleMaxWidth);
    
    // Render each line with consistent spacing
    for (let i = 0; i < statementLines.length; i++) {
      renderText(doc, statementLines[i], 22, yPos);
      yPos += 4;  // Consistent line height
    }
  }
  
  // Debug output - additional author information
  console.log("PDF Metadata - Author information:", {
    mainAuthor: book.mainAuthor || book.author,
    additionalAuthors: book.additionalAuthors,
    statementOfResponsibility: book.statementOfResponsibility
  });
  
  // Add more space after title/author section
  yPos += 3;
  
  // --- 4. Publication Information ---
  
  // Build full publication string following the exact target format
  let publicationInfo = '';
  
  // Start with edition information
  if (book.edition) {
    // Make sure edition is properly formatted as "Auflage" instead of just numbers
    let editionText = book.edition;
    
    // If the edition doesn't include the word "Auflage", add it appropriately
    if (!editionText.toLowerCase().includes("auflage")) {
      // Check if it starts with a number
      const match = editionText.match(/^(\d+)(?:\.)?/);
      if (match) {
        const num = match[1];
        editionText = `${num}. Auflage`;
      }
    }
    
    publicationInfo += `${editionText}`;
  }
  
  // Add location and publisher 
  const location = book.publicationPlace || book.location || '';
  const publisher = book.publisher || '';
  
  if (publicationInfo) {
    // Only add location and publisher if they exist
    if (location || publisher) {
      publicationInfo += `. – `;
      
      if (location) {
        publicationInfo += `${location}`;
      }
      
      if (location && publisher) {
        publicationInfo += `: `;
      }
      
      if (publisher) {
        publicationInfo += `${publisher}`;
      }
    }
  } else {
    // Starting with location/publisher
    if (location) {
      publicationInfo += `${location}`;
      if (publisher) {
        publicationInfo += `: ${publisher}`;
      }
    } else if (publisher) {
      publicationInfo += `${publisher}`;
    }
  }
  
  // Add year
  const year = book.publicationYear || book.publishedYear;
  if (year) {
    // Only add comma if we have content already
    if (publicationInfo && (location || publisher)) {
      publicationInfo += `, ${year}`;
    } else {
      publicationInfo += `${year}`;
    }
  }
  
  // ===== Physical description section =====
  // Format: [Number of Pages] Seiten : [Illustrations] ; [Format in cm]
  
  // Add physical description separator if we have publication info
  if (publicationInfo) {
    publicationInfo += `. – `;
  }
  
  // Debug physical metadata fields
  console.log("PDF Debug - Physical metadata:", {
    pageCount: book.pageCount,
    illustrations: book.illustrations,
    dimensions: book.dimensions
  });
  
  // Add page count with consistent formatting
  const pages = book.pageCount || '';
  if (pages) {
    publicationInfo += `${pages} ${pages === 1 ? 'Seite' : 'Seiten'}`;
  } else {
    // If no page count, still add a placeholder to maintain format
    publicationInfo += `Seiten`;
  }
  
  // Add illustration information if available - with proper spacing
  if (book.illustrations) {
    publicationInfo += ` : ${book.illustrations}`;
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
      publicationInfo += ` : Illustrationen`;
    }
  }
  
  // Add dimensions with clean formatting
  if (book.dimensions) {
    // Clean up dimensions string if needed
    let dimensions = book.dimensions.trim();
    // Check if dimensions contains valid information before adding
    if (dimensions && dimensions !== '-' && dimensions.toLowerCase() !== 'keine angabe') {
      publicationInfo += ` ; ${dimensions}`;
    }
  }
  
  // Prepare publication info with proper formatting and consistent letter spacing
  try {
    // Reset font settings to ensure uniform rendering
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    
    // Apply direct character spacing control for consistent rendering
    // This low-level approach ensures better letter spacing across PDF renderers
    (doc as any).internal.out("0 Tc"); // Set character spacing to 0 (normal)
    (doc as any).internal.out("0 Tw"); // Set word spacing to 0 (normal)
  } catch (e) {
    console.log("Character spacing adjustment not supported");
  }
  
  // Normalize publication info with a single, consistent approach
  // This prevents double-normalization that could cause issues
  publicationInfo = publicationInfo.replace(/\s+/g, " ").trim();
  
  // Fix spacing around punctuation to follow German RDA standards
  // Ensure no space before punctuation and one space after
  publicationInfo = publicationInfo
    .replace(/ ([.:;,])/g, "$1")
    .replace(/([.:;,])(?=\S)/g, "$1 ");
    
  // Fix spacing around em dashes for publishing standards
  publicationInfo = publicationInfo.replace(/\s*–\s*/g, " – ");
  
  // Check if it's too long for a single line and truncate if needed
  const pubInfoMaxWidth = 170;
  if (doc.getTextWidth(publicationInfo) > pubInfoMaxWidth) {
    // Find a good cutting point that preserves the most important information
    // (beginning is typically more important in publication info)
    const approximateLength = Math.floor(publicationInfo.length * (pubInfoMaxWidth / doc.getTextWidth(publicationInfo)));
    let cutPoint = approximateLength - 3; // Leave room for ellipsis
    
    // Try to cut at a natural break point if possible
    const naturalBreakPoints = ['. – ', ' – ', ': ', ' ; '];
    let foundNaturalBreak = false;
    
    // Look for natural break points near the approximate length
    for (const breakPoint of naturalBreakPoints) {
      const lastOccurrence = publicationInfo.lastIndexOf(breakPoint, approximateLength);
      if (lastOccurrence > 0 && lastOccurrence < approximateLength) {
        cutPoint = lastOccurrence;
        foundNaturalBreak = true;
        break;
      }
    }
    
    // If no natural break was found, back up to the nearest space
    if (!foundNaturalBreak) {
      while (cutPoint > 0 && publicationInfo[cutPoint] !== ' ') {
        cutPoint--;
      }
    }
    
    // Truncate and add ellipsis
    publicationInfo = publicationInfo.substring(0, cutPoint) + '...';
  }
  
  // Display the publication info as a single line with consistent spacing
  try {
    // Apply direct character spacing control before rendering
    (doc as any).internal.out("0 Tc"); // Set character spacing to 0 (normal)
  } catch (e) {
    // Silently continue if this fails
  }
  
  doc.text(publicationInfo, 22, yPos);
  yPos += 5;
  
  // --- 5. ISBN and Price information ---
  if (book.isbn) {
    yPos += 2; // Extra small space before ISBN line
    
    // Ensure we follow exact German cataloging format with consistent spacing
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    
    // Format ISBN with consistent spacing
    let isbnLine = `ISBN ${formatISBN(book.isbn)}`;
    
    // Apply consistent letter spacing for ISBN line
    try {
      (doc as any).internal.out("0 Tc"); // Reset character spacing
    } catch (e) {
      // Silently continue if this fails
    }
    
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
      
      // Use proper German RDA format with consistent spacing
      isbnLine += ` : ${bindingGerman.trim()}`; // Space colon space format
    }
    
    // Process price information if available
    if (book.price) {
      // The price field might contain a complete price string already
      let priceText = book.price;
      
      // Try to extract just the EUR (DE) price from complex price strings
      const deMatch = priceText.match(/EUR\s+\d+([,.]\d+)?\s*\(DE\)/i);
      if (deMatch) {
        // Extract just the EUR value from the DE match
        const euroValue = deMatch[0].match(/EUR\s+\d+([,.]\d+)?/i);
        if (euroValue) {
          priceText = euroValue[0].trim();
        }
      } 
      // If no DE-specific price, look for the first EUR price
      else if (priceText.includes("EUR")) {
        const eurMatch = priceText.match(/EUR\s+\d+([,.]\d+)?/i);
        if (eurMatch) {
          priceText = eurMatch[0].trim();
        }
      }
      // If the price is just a number, format it properly
      else if (/^\d+(\.\d+)?$/.test(priceText)) {
        // Format as German price with comma
        priceText = priceText.replace('.', ',');
        priceText = `EUR ${priceText}`;
      } else if (!priceText.includes("EUR") && !priceText.includes("€")) {
        // If it doesn't contain currency info, add EUR
        priceText = `EUR ${priceText}`;
      }
      
      // Remove "paperback" or other English terms that might be incorrectly included
      priceText = priceText.replace(/paperback|hardcover|softcover/gi, "").trim();
      
      // Normalize spaces in price text for consistent rendering
      priceText = priceText.replace(/\s{2,}/g, " ").replace(/,,/g, ",").trim();
      
      // Ensure consistent spacing between EUR and the amount
      priceText = priceText.replace(/EUR\s*/i, "EUR ");
      
      // Add to the ISBN line with proper delimiter according to German RDA
      if (isbnLine.includes(" : ")) {
        // If we already have a binding, append price with consistent spacing
        isbnLine += ` : ${priceText.trim()}`;
      } else {
        // If no binding, use colon with consistent spacing
        isbnLine += ` : ${priceText.trim()}`;
      }
    }
    
    // Apply character spacing control before rendering
    try {
      (doc as any).internal.out("0 Tc"); // Normal character spacing
    } catch (e) {
      // Silently continue if this fails
    }
    
    // Normalize spaces in the final ISBN line
    isbnLine = isbnLine.replace(/\s+/g, ' ').trim();
    
    renderText(doc, isbnLine, 22, yPos);
    yPos += 6; // Slightly less spacing
  }
  
  // --- 6. Book summary/description and critical review ---
  if (book.summary || book.review) {
    yPos += 4; // Add more spacing before summary section
    
    // Set text style for summary text in exact ekz style - use smaller font for better fit
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8); // Even smaller font size to prevent overflow issues
    
    // Combine summary and review with the | separator exactly as in target format
    let summaryText = '';
    
    if (book.summary) {
      // Additional cleaning to avoid duplicate title/author info in summary
      let cleanSummary = book.summary;
      
      // Remove title mentions at the beginning of summary
      if (book.title && book.title.length > 3) {
        const titleEscaped = book.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const titlePattern = new RegExp(`^["']?${titleEscaped}["']?\\s*(:|von|by|is|ist|-|–)\\s*`, 'i');
        cleanSummary = cleanSummary.replace(titlePattern, '');
      }
      
      // Remove author mentions at the beginning
      if (book.author || book.mainAuthor) {
        const authorName = (book.author || book.mainAuthor || '');
        if (authorName.length > 3) {
          const authorEscaped = authorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const authorPattern = new RegExp(`^(by|von)\\s+${authorEscaped}\\s*(:|is|ist|-|–)\\s*`, 'i');
          cleanSummary = cleanSummary.replace(authorPattern, '');
        }
      }
      
      summaryText = cleanSummary;
    }
    
    // Add separator between summary and review if both exist
    if (book.summary && book.review) {
      summaryText += ' | ';
    }
    
    // Add review if available
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
    
    // Process text for consistent letter spacing in PDF output
    // First, normalize newlines to standard format
    summaryText = summaryText.replace(/\r\n|\r/g, '\n');
    
    // Replace multiple newlines with a single newline
    summaryText = summaryText.replace(/\n\s*\n/g, '\n').trim();
    
    // Carefully normalize spacing without over-compressing
    // This ensures consistent spacing for PDF rendering
    summaryText = summaryText.replace(/[ \t]+/g, " ").trim();
    
    // Handle bullet points and formatting characters consistently
    summaryText = summaryText.replace(/^[•\-*]\s+/g, ''); // Remove bullets at beginning
    summaryText = summaryText.replace(/([•\-*])\s+/g, '$1 '); // Consistent spacing after bullets
    
    // Fix common spacing issues around punctuation
    summaryText = summaryText.replace(/ ([.,:;!?])/g, '$1');  // Remove space before punctuation
    summaryText = summaryText.replace(/([.,:;!?])(?=\S)/g, '$1 '); // Add space after punctuation
    
    // Normalize spacing around pipes (separator between summary and review)
    summaryText = summaryText.replace(/\s*\|\s*/g, ' | ');
    
    // Apply direct character spacing control for consistent text rendering
    try {
      (doc as any).internal.out("0 Tc"); // Set character spacing to 0 (normal)
      (doc as any).internal.out("0 Tw"); // Set word spacing to 0 (normal)
    } catch (e) {
      // Silently continue if this fails
    }
    
    // Debug the summary processing
    console.log("PDF Summary - Processing:", {
      originalLength: book.summary?.length || 0,
      processedLength: summaryText.length
    });
    
    // Split the text for proper wrapping with narrower width for better appearance
    const summaryLines = doc.splitTextToSize(summaryText, 155);
    
    // Calculate available height with fixed line count to ensure consistency
    const lineHeight = 3.5; // Reduced line height for smaller font
    const maxLines = 28; // Allow slightly more lines with smaller font
    const linesToShow = Math.min(summaryLines.length, maxLines);
    
    // Create content for each line with consistent spacing - exact ekz standard format
    for (let i = 0; i < linesToShow; i++) {
      // Use left-aligned text instead of justify to prevent inconsistent spacing issues
      renderText(doc, summaryLines[i], 22, yPos);
      yPos += lineHeight; // Use the consistent line height defined above
    }
    
    // Add ellipsis if text was truncated
    if (summaryLines.length > linesToShow) {
      doc.setFont("helvetica", "italic");
      doc.text("...", 22, yPos);
      yPos += lineHeight;
    }
    
    // Reset font size to default for remaining content
    doc.setFontSize(9);
    
    // Add a small space after the summary
    yPos += 2;
  }
  
  // --- 7. Reviewer name in bottom right (after the summary or review) ---
  yPos += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  
  // Apply character spacing control for consistent text rendering
  try {
    (doc as any).internal.out("0 Tc"); // Set character spacing to 0 (normal)
  } catch (e) {
    // Silently continue if this fails
  }
  
  // Prepare reviewer name with normalized spacing
  let reviewerName = '';
  if (book.reviewerName) {
    reviewerName = book.reviewerName;
  } else if (book.reviewer_name) {
    // Alternative field name
    reviewerName = book.reviewer_name;
  } else if (book.user && typeof book.user === 'object' && book.user.fullName) {
    // Fallback to user's full name if available
    reviewerName = book.user.fullName;
  } else if (book.userId) {
    // If only user ID is available, use ID as fallback
    reviewerName = `ID: ${book.userId}`;
  }
  
  // Normalize spacing and render with consistent character spacing
  if (reviewerName) {
    reviewerName = reviewerName.replace(/\s+/g, ' ').trim();
    doc.text(reviewerName, 190, yPos, { align: 'right', maxWidth: 80 });
  }
  
  // --- 8. Interest category (IK) on next line (left aligned) ---
  yPos += 10;
  
  // Apply character spacing control for consistent text rendering
  try {
    (doc as any).internal.out("0 Tc"); // Set character spacing to 0 (normal)
  } catch (e) {
    // Silently continue if this fails
  }
  
  // Interest category and age recommendation in target format: IK: [Categories]; suitable from age [Age]
  let ikLine = '';
  
  if (book.interestCategory) {
    ikLine = `IK: ${book.interestCategory.trim()}`;
    
    // Add age recommendation if available
    if (book.ageRecommendation) {
      ikLine += `; geeignet ab ${book.ageRecommendation.toString().trim()} Jahren`;
    }
    
    // Normalize spacing in the final IK line
    ikLine = ikLine.replace(/\s+/g, ' ').trim();
    
    doc.setFont("helvetica", "bold");
    doc.text(ikLine, 22, yPos);
    yPos += 5;
  } else if (book.ageRecommendation) {
    ikLine = `Geeignet ab ${book.ageRecommendation.toString().trim()} Jahren`;
    
    // Normalize spacing in the age recommendation
    ikLine = ikLine.replace(/\s+/g, ' ').trim();
    
    doc.setFont("helvetica", "bold");
    doc.text(ikLine, 22, yPos);
    yPos += 5;
  }
  
  // --- 9. ID-B information in format: ID-[Initials] [Number]/[Year] ---
  // This should appear on a new line after the Interest Category
  let idBLine = '';
  
  // Apply character spacing control for consistent text rendering
  try {
    (doc as any).internal.out("0 Tc"); // Set character spacing to 0 (normal)
  } catch (e) {
    // Silently continue if this fails
  }
  
  // Support multiple field naming conventions for these fields
  const initials = book.idbInitials || book.idb_initials || '';
  const sequenceNumber = book.idbSequenceNumber || book.idb_sequence_number || '';
  const idbYear = book.idbYear || book.idb_year || '';
  
  // If we have at least initials and one other field, show the ID-B line
  if (initials && (sequenceNumber || idbYear)) {
    idBLine = `ID-${initials.trim()} ${sequenceNumber.trim()}/${idbYear.trim()}`;
    
    // Normalize spacing in the ID-B line
    idBLine = idBLine.replace(/\s+/g, ' ').trim();
    
    doc.setFont("helvetica", "normal");
    doc.text(idBLine, 22, yPos, { maxWidth: 170 });
    yPos += 5;
  }
  // Legacy format support - if an ID-B number is provided directly
  else if (book.idBNumber) {
    // Normalize spacing in the ID-B number
    const cleanIdB = String(book.idBNumber).replace(/\s+/g, ' ').trim();
    
    doc.setFont("helvetica", "normal");
    doc.text(cleanIdB, 22, yPos);
    yPos += 5;
  }
  
  // --- 10. Footer (only ekz-Informationsdienst text, no barcode or redundant ASB) ---
  yPos += 10;
  
  // Reset character spacing for footer text
  try {
    (doc as any).internal.out("0 Tc"); // Normal character spacing
  } catch (e) {
    // Silently continue if this fails
  }
  
  // Add ekz-Informationsdienst text
  const startX = doc.internal.pageSize.width / 2;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("ekz-Informationsdienst", startX, yPos, { align: 'center' });
  
  return yPos + 10; // Return the final Y position with some extra space
}

// Export a single book to PDF - using fixed layout format
export function exportBookToPDF(book: Partial<Book>, language: string = 'de'): void {
  // Create a new PDF with standard A4 size
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    compress: true,
    putOnlyUsedFonts: true,
    hotfixes: ['px_scaling']
  });
  
  // Set up the document with Times Roman font
  doc.setFont("times", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);
  
  // Define page dimensions and layout based on example
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20; // mm
  const boxWidth = 170; // mm
  const boxHeight = 120; // mm
  const boxX = margin; 
  const boxY = margin;
  
  // Calculate maximum content height inside the box to prevent overflow
  const maxContentHeight = boxHeight - 10; // 5mm margin at top and bottom
  
  // Draw border around the book entry
  doc.rect(boxX, boxY, boxWidth, boxHeight).stroke();
  
  // Helper function to render text with proper spacing and formatting
  function renderText(text: string, x: number, y: number, options: any = {}): number {
    const fontSize = options.fontSize || 9;
    const font = options.font || "times";
    const style = options.style || "normal";
    const maxWidth = options.maxWidth || boxWidth - 10;
    const lineHeight = options.lineHeight || 4;
    
    doc.setFont(font, style);
    doc.setFontSize(fontSize);
    
    // Fix word spacing problems by normalizing whitespace
    // This removes excessive spaces that can cause text to overflow
    text = text.replace(/\s+/g, ' ').trim();
    
    // Apply consistent character and word spacing
    try {
      // Reset any previous spacing settings
      (doc as any).internal.out("0 Tc"); // Character spacing
      (doc as any).internal.out("0 Tw"); // Word spacing
    } catch (e) {
      // Fallback if advanced text features aren't available
      console.log("Advanced text rendering not supported, using standard rendering");
    }
    
    // Split text into lines that fit within maxWidth
    // This ensures no text will overflow horizontally
    const lines = doc.splitTextToSize(text, maxWidth);
    
    // Check if we would exceed the box boundary
    const remainingHeight = boxY + boxHeight - y - 10; // Stay 10mm from bottom of box
    const maxPossibleLines = Math.floor(remainingHeight / lineHeight);
    const linesToRender = Math.min(lines.length, maxPossibleLines);
    
    // Render each line individually to control spacing
    for (let i = 0; i < linesToRender; i++) {
      // Normalize line text again just to be sure
      const lineText = lines[i].replace(/\s+/g, ' ').trim();
      
      // Use align: 'left' to prevent expanded letter-spacing and set fixed width
      doc.text(lineText, x, y + (i * lineHeight), { 
        align: 'left',
        maxWidth: maxWidth
      });
    }
    
    // Return the Y position after the text
    return y + (linesToRender * lineHeight);
  }
  
  // Starting position for the content
  let currentY = boxY + 10;
  const startX = boxX + 5;
  
  // Format the book data according to the example format
  
  // 1. Author name in bold
  const author = book.author || book.mainAuthor || '';
  if (author) {
    currentY = renderText(`${author}:`, startX, currentY, { 
      style: "bold",
      lineHeight: 5
    });
  }
  
  // 2. Title information
  let titleInfo = "";
  if (book.title) {
    titleInfo += book.title;
    
    if (book.subtitle) {
      titleInfo += ` : ${book.subtitle}`;
    }
    
    if (author) {
      titleInfo += ` / ${author}`;
    }
    
    // Add illustrator if available
    if (book.illustrator) {
      titleInfo += ` ; Illustrationen von ${book.illustrator}`;
    } else if (book.additionalAuthors && book.additionalAuthors.length > 0) {
      titleInfo += ` ; ${book.additionalAuthors.join(', ')}`;
    }
    titleInfo += ".";
    
    currentY = renderText(titleInfo, startX, currentY + 2, {
      lineHeight: 4
    });
  }
  
  // 3. Edition, publisher and year
  let editionInfo = "";
  if (book.edition) {
    editionInfo += `- ${book.edition}. - `;
  } else {
    editionInfo += "- ";
  }
  
  if (book.publisher) {
    editionInfo += `${book.publisher}`;
  }
  
  if (book.publicationYear) {
    editionInfo += `, ${book.publicationYear}`;
  }
  editionInfo += ".";
  
  currentY = renderText(editionInfo, startX, currentY + 2, {
    lineHeight: 4
  });
  
  // 4. Pages, illustrations, dimensions
  let physicalInfo = "";
  if (book.pageCount) {
    physicalInfo += `${book.pageCount} Seiten`;
  }
  
  // Add illustrations info if available
  if (book.illustrations) {
    physicalInfo += ` : ${book.illustrations}`;
  } else {
    physicalInfo += " : Illustrationen";
  }
  
  if (book.dimensions) {
    physicalInfo += ` ; ${book.dimensions}`;
  }
  
  currentY = renderText(physicalInfo, startX, currentY + 2, {
    lineHeight: 4
  });
  
  // 5. ISBN, binding, price
  let isbnInfo = "";
  if (book.isbn) {
    isbnInfo += `ISBN ${book.isbn}`;
  }
  
  if (book.binding) {
    isbnInfo += ` : ${book.binding}`;
  }
  
  if (book.price) {
    isbnInfo += ` : ${book.price}`;
  }
  
  currentY = renderText(isbnInfo, startX, currentY + 2, {
    lineHeight: 4
  });
  
  // 6. Interest category (IK), ASB, ID-B
  let classificationLine = "";
  
  // Interest Category (IK)
  if (book.interestCategory) {
    classificationLine += `IK: ${book.interestCategory}`;
  }
  
  // Add spacing before ASB if IK exists
  if (book.interestCategory && book.classificationNumber) {
    classificationLine += "   ";
  }
  
  // ASB Classification Number
  if (book.classificationNumber) {
    classificationLine += `ASB: ${book.classificationNumber}`;
  }
  
  // Add spacing before ID-B if either IK or ASB exists
  if ((book.interestCategory || book.classificationNumber) && book.idb) {
    classificationLine += "   ";
  }
  
  // ID-B Number
  if (book.idb) {
    classificationLine += `ID-B: ${book.idb}`;
  }
  
  if (classificationLine) {
    currentY = renderText(classificationLine, startX, currentY + 3, {
      lineHeight: 4
    });
  }
  
  // 7. Reviewer name
  if (book.reviewerName) {
    currentY = renderText(`${book.reviewerName}`, startX, currentY + 3, {
      lineHeight: 4
    });
  }
  
  // 8. Process and clean up summary for better formatting
  if (book.summary) {
    // Clean the summary to remove any metadata
    let cleanSummary = book.summary.trim();
    
    // Remove instances where title appears at the beginning of summary
    if (book.title) {
      const escapedTitle = book.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const titlePattern = new RegExp(`^(["']?${escapedTitle}["']?\\s*(:|-|by|von|—|,|\\.|is|ist)\\s*)`, 'i');
      cleanSummary = cleanSummary.replace(titlePattern, '');
    }
    
    // Remove instances where "by [Author]" or "von [Author]" appears at the beginning
    if (author && author.length > 0) {
      const escapedAuthor = author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const authorPattern = new RegExp(`^(by|von)\\s+${escapedAuthor}\\s*(:|-|—|,|\\.|is|ist)\\s*`, 'i');
      cleanSummary = cleanSummary.replace(authorPattern, '');
    }
    
    // Normalize whitespace
    cleanSummary = cleanSummary.replace(/\s+/g, ' ').trim();
    
      // Split review and summary if they're in the same field (separated by |)
    const summaryParts = cleanSummary.split('|');
    cleanSummary = summaryParts[0].trim();
    
    // Render the summary with explicit spacing control to prevent word-spacing issues
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    
    // Apply a more restrictive max width to ensure proper text wrapping
    const textMaxWidth = boxWidth - 15; // Use a slightly smaller width for safety
    
    // Fix any spacing issues in the text before rendering
    const normalizedSummary = cleanSummary.replace(/\s+/g, ' ').trim();
    
    // Set precise character and word spacing for consistent rendering
    try {
      // Reset any previous spacing settings
      (doc as any).internal.out("0 Tc"); // Character spacing
      (doc as any).internal.out("0 Tw"); // Word spacing
    } catch (e) {
      console.log("Advanced text rendering not supported, using standard rendering");
    }
    
    // Use the advanced rendering method
    currentY = renderText(normalizedSummary, startX, currentY + 5, {
      lineHeight: 4,
      maxWidth: textMaxWidth // Use the more restricted width
    });
    
    // 9. Review (if present)
    // Check if we have room for the review
    const remainingHeight = boxY + boxHeight - currentY - 15;
    
    if (remainingHeight > 20) { // Only add review if we have at least 20mm of space left
      if (summaryParts.length > 1 && summaryParts[1].trim()) {
        // Get the review and normalize spacing
        const review = summaryParts[1].trim().replace(/\s+/g, ' ');
        
        // Reset font and spacing for review
        doc.setFont("times", "normal");
        doc.setFontSize(9);
        
        // Apply spacing control for review
        try {
          (doc as any).internal.out("0 Tc"); // Character spacing reset
          (doc as any).internal.out("0 Tw"); // Word spacing reset
        } catch (e) {
          console.log("Advanced text rendering not supported, using standard rendering");
        }
        
        // Use smaller max width for review to ensure proper wrapping
        currentY = renderText(review, startX, currentY + 5, {
          lineHeight: 4,
          maxWidth: boxWidth - 15 // More restricted width for safety
        });
      } else if (book.review) {
        // Use separate review field if available
        const normalizedReview = book.review.replace(/\s+/g, ' ').trim();
        
        // Reset font and spacing for review
        doc.setFont("times", "normal");
        doc.setFontSize(9);
        
        // Apply spacing control for review
        try {
          (doc as any).internal.out("0 Tc"); // Character spacing reset
          (doc as any).internal.out("0 Tw"); // Word spacing reset
        } catch (e) {
          console.log("Advanced text rendering not supported, using standard rendering");
        }
        
        // Use smaller max width for review to ensure proper wrapping
        currentY = renderText(normalizedReview, startX, currentY + 5, {
          lineHeight: 4,
          maxWidth: boxWidth - 15 // More restricted width for safety
        });
      }
    }
  }
  
  // Footer with ekz attribution
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("ekz-Informationsdienst", pageWidth / 2, pageHeight - 20, { align: 'center' });
  
  // Save PDF with filename based on book details
  const fileName = `${book.title ? book.title.slice(0, 30).replace(/[/\\?%*:|"<>]/g, '-') : 'book'}_${book.isbn || 'unknown'}.pdf`;
  doc.save(fileName);
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
function formatBookEntryForGrid(doc: jsPDF, book: Partial<Book>, x: number, y: number, width: number, height: number): number {
  const gridFontSize = 9; // Consistent font size for better spacing
  const startY = y;
  let currentY = startY + 5;
  const spaceNeededForFooter = 15; // Space needed for footer text
  
  // Draw a thin border around the entire cell
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(x, y, width, height);
  
  // --- ASB Classification in top corners ---
  // Important: We'll keep font settings consistent throughout to avoid spacing issues
  doc.setFont("helvetica", "bold");
  doc.setFontSize(gridFontSize);
  
  // Format ASB as "ASB: [number]"
  const asbNumber = book.classificationNumber || book.ASB || book.catalogNumber || "";
  doc.text("ASB: " + asbNumber, x + 5, currentY);
  
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
  
  // Keep font size consistent, only change style
  doc.setFont("helvetica", "bold");
  // Normalize text to avoid spacing issues
  const authorNormalized = (authorFormatted + ":").replace(/\s+/g, " ").trim();
  doc.text(authorNormalized, x + 5, currentY);
  
  currentY += 5;
  
  // --- Book title ---
  doc.setFont("helvetica", "normal");
  
  // Truncate and format the title to fit
  let titleText = book.title || "";
  if (titleText.length > 40) { // Reasonable length limit
    titleText = titleText.substring(0, 37) + "...";
  }
  
  // Add author after title (only if not already shown above)
  const authorToShow = book.author || "";
  if (authorToShow && authorToShow !== authorFormatted) {
    titleText += ` / ${authorToShow}`;
  }
  
  // Normalize the text for consistent spacing
  const titleNormalized = titleText.replace(/\s+/g, " ").trim();
  
  // Split for wrapping with reduced width
  const titleLines = doc.splitTextToSize(titleNormalized, width - 10);
  for (let i = 0; i < Math.min(titleLines.length, 2); i++) { // Limit to 2 lines to save space
    doc.text(titleLines[i], x + 5, currentY);
    currentY += 4;
  }
  
  currentY += 2;
  
  // --- Publication info - condensed ---
  // Use consistent font settings to prevent spacing issues
  doc.setFontSize(gridFontSize - 1);
  doc.setFont("helvetica", "normal");
  
  // Using PDF properties for consistent text rendering
  // This approach is more compatible with all versions of jsPDF
  try {
    (doc as any).setTextRenderingMode("fill");
  } catch (e) {
    // Fallback if the method is not supported
    console.log("Advanced text rendering not supported, using standard rendering");
  }
  
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
  
  // Add dimensions directly after page count
  if (book.dimensions) {
    // Clean up dimensions string
    let dimensions = book.dimensions.trim();
    if (dimensions && dimensions !== '-' && dimensions.toLowerCase() !== 'keine angabe') {
      pubInfo += pubInfo.length > 0 ? ` ; ${dimensions}` : dimensions;
    }
  }
  
  // Add illustrations info if available - keep it very short
  if (book.illustrations) {
    // Truncate illustrations text if too long
    const illText = book.illustrations.length > 20 ? book.illustrations.substring(0, 17) + "..." : book.illustrations;
    pubInfo += pubInfo.length > 0 ? `: ${illText}` : illText;
  }
  
  if (pubInfo.length > 0) {
    // Normalize and standardize spaces to ensure consistent rendering
    const pubInfoNormalized = pubInfo.replace(/\s+/g, " ").trim();
    
    // Use a rendering approach that maintains consistent character spacing
    const pubLines = doc.splitTextToSize(pubInfoNormalized, width - 10);
    for (let i = 0; i < Math.min(pubLines.length, 2); i++) { // Limit to 2 lines
      doc.text(pubLines[i], x + 5, currentY);
      currentY += 3.5; // Slightly reduced line spacing
    }
  }
  
  // Reset font size
  doc.setFontSize(gridFontSize);
  
  // --- ISBN and price - condensed ---
  if (book.isbn) {
    currentY += 2;
    // Use smaller font for ISBN info
    doc.setFontSize(gridFontSize - 1);
    
    let isbnText = `ISBN ${formatISBN(book.isbn)}`;
    
    // Add binding type if available (keep it short)
    if (book.binding) {
      const bindingText = book.binding.length > 20 ? book.binding.substring(0, 17) + "..." : book.binding;
      isbnText += ` - ${bindingText}`;
    }
    
    // Add price if available (simplified)
    if (book.price) {
      // Simplify price display
      let priceText = book.price.toString();
      if (priceText.length > 25) {
        priceText = priceText.substring(0, 22) + "...";
      }
      isbnText += ` : ${priceText}`;
    }
    
    // Format the ISBN text properly without extra spacing
    const isbnFormatted = isbnText.replace(/\s+/g, " ").trim();
    
    doc.text(doc.splitTextToSize(isbnFormatted, width - 10)[0], x + 5, currentY);
    currentY += 4;
    
    // Reset font size
    doc.setFontSize(gridFontSize);
  }
  
  // --- Summary and Review - ensure full content appears ---
  if (book.summary || book.review) {
    // Use even smaller font for summary to maximize content display
    doc.setFontSize(gridFontSize - 2);
    
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
    
    // Remove metadata-like patterns to save space
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
    // Normalize spacing
    summaryText = summaryText.replace(/\s+/g, " ").trim();
    
    // For multiple book PDF, limit text to fit in the cell
    
    // Calculate available space for summary text
    const availableHeight = (y + height - spaceNeededForFooter) - currentY;
    // Use smaller line height to fit more text
    const lineHeight = 2.5;
    
    // Break into lines with proper wrapping
    const summaryLines = doc.splitTextToSize(summaryText, width - 10);
    
    // Calculate how many lines we can fit in the available space
    const maxLinesToShow = Math.floor(availableHeight / lineHeight);
    
    // Set font for summary text - normal weight
    doc.setFont("helvetica", "normal");
    
    // Show only the lines that will fit
    const linesToShow = Math.min(summaryLines.length, maxLinesToShow);
    
    for (let i = 0; i < linesToShow; i++) {
      doc.text(summaryLines[i], x + 5, currentY, { align: 'justify' });
      currentY += lineHeight; // Reduced line spacing to fit more text
    }
    
    // Add ellipsis if we couldn't show all lines
    if (summaryLines.length > linesToShow) {
      doc.text("...", x + 5, currentY);
      currentY += lineHeight;
    }
    
    // Reset font size to normal
    doc.setFontSize(gridFontSize);
  }
  
  // --- IK category and ID-B number ---
  // Calculate where the remaining footer content should go
  // We need to leave space for barcode (approx 20mm) and other footer elements
  
  // For multiple book PDF, we need to be strict about fixed cell height
  // Ensure we don't overflow by adjusting current position if needed
  if (currentY > y + height - spaceNeededForFooter) {
    // We've gone too far - adjust position
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
  
  // --- Footer (no barcode) ---
  // Position the footer at the bottom
  currentY = y + height - 4; // Adjusted to leave space just for ekz footer
  
  // Add ekz footer text
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("ekz-Informationsdienst", x + width/2, currentY, { align: 'center' });
  
  return height; // Return the fixed height we used
}

// Export multiple books to a single PDF with the specified format from the image
export function exportMultipleBooksToSinglePDF(books: Partial<Book>[], language: string = 'de'): void {
  if (!books || books.length === 0) return;
  
  // Create a new PDF with standard A4 size (German DIN A4)
  // Use specific settings to ensure consistent text rendering
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    compress: true,
    putOnlyUsedFonts: true
    // Removed problematic hotfixes setting while keeping text formatting improvements
  });
  
  // Set font baseline - keeping this consistent throughout the document
  // is critical for consistent letter spacing
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9); // Base font size
  
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
