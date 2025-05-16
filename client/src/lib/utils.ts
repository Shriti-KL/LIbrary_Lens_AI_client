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
export function formatBookEntryForPDF(doc: jsPDF, book: Book, startY: number = 20): number {
  let yPos = startY;
  
  // --- 1. ASB Classification at the top-left corner ---
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  
  // Format and display ASB classification as "ASB: [classificationNumber]"
  const asbNumber = book.classificationNumber || book.ASB || "";
  doc.text("ASB: " + asbNumber, 22, yPos);
  
  // Use proper property access for secondary classification
  // The issue is likely due to how data is sent to the PDF function
  // Log data structure for debugging without hardcoded values
  
  // Using a debugging log to check the actual structure
  console.log("PDF DEBUG - Book Object Structure:", JSON.stringify(book, null, 2));
  
  // Proper solution: Get secondary classification from the right property in book
  // Snake_case is used in DB but camelCase in frontend, handle both
  let secondaryClass = null;
  
  // First try direct access which should work for most objects
  if (book.secondaryClassification) {
    secondaryClass = book.secondaryClassification;
  } 
  // Then try accessing as any with bracket notation
  else if ((book as any).secondary_classification) {
    secondaryClass = (book as any).secondary_classification;
  }
  
  // Display secondary classification if available
  if (secondaryClass) {
    yPos += 5;
    doc.text(secondaryClass, 22, yPos);
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
  
  // Author name in bold with proper size
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold"); 
  doc.text(authorFormatted + ":", 22, yPos);
  
  yPos += 6; // Space after author name
  
  // --- 3. Book title and publication info ---
  // Use consistent smaller font size for all metadata (9pt is ekz standard)
  // Important: Using consistent font settings is critical for proper spacing
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  
  // Using PDF properties for consistent text rendering
  // This approach is more compatible with all versions of jsPDF
  try {
    (doc as any).setTextRenderingMode("fill");
  } catch (e) {
    // Fallback if the method is not supported
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
  
  // Add statement of responsibility to titleText for compatibility
  // but we'll display it separately below for better formatting
  if (book.statementOfResponsibility) {
    titleText += ` / ${book.statementOfResponsibility}`;
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
    
    // Add author and contributors to title text
    if (authorName) {
      titleText += ` / ${authorName}${otherContributors}`;
    } else if (otherContributors) {
      titleText += ` /${otherContributors}`;
    }
  }
  
  // Use same smaller font size for all metadata sections
  doc.setFontSize(9);
  
  // In German RDA formatting, title and statement of responsibility appear on separate lines
  // but Statement of Responsibility and Publication Info should each be on a single continuous line
  
  // First line: Title (and subtitle)
  let titleDisplay = titleFull;
  if (subtitle) {
    titleDisplay = `${titleFull} : ${subtitle}`; 
  }
  
  // Display title with proper font size
  doc.setFontSize(9);
  doc.text(titleDisplay, 22, yPos);
  yPos += 5;
  
  // Second line: Statement of Responsibility (without line breaks)
  // In German RDA format, this always starts with a slash
  let responsibilityStatement = "";
  if (book.statementOfResponsibility) {
    responsibilityStatement = `/ ${book.statementOfResponsibility}`;
  } else {
    const displayAuthor = book.mainAuthor || book.author || "";
    
    // Format contributors
    let displayContributors = "";
    if (book.contributors && (typeof book.contributors === 'object')) {
      if (!Array.isArray(book.contributors)) {
        // New format with role keys
        const contributorsList = [];
        for (const role in book.contributors) {
          if (Array.isArray(book.contributors[role]) && book.contributors[role].length > 0) {
            contributorsList.push(`${book.contributors[role].join(", ")} (${role})`);
          }
        }
        if (contributorsList.length > 0) {
          displayContributors = ` ; ${contributorsList.join(" ; ")}`;
        }
      } else if (book.contributors.length > 0) {
        // Old format with objects
        const contributorsList = book.contributors
          .filter((c: any) => c.name && c.role)
          .map((c: any) => `${c.name} (${c.role})`)
          .join(" ; ");
        
        if (contributorsList) {
          displayContributors = ` ; ${contributorsList}`;
        }
      }
    }
    
    // Format statement of responsibility
    if (displayAuthor) {
      responsibilityStatement = `/ ${displayAuthor}${displayContributors}`;
    } else if (displayContributors) {
      responsibilityStatement = `/ ${displayContributors}`;
    }
  }
  
  // Display statement of responsibility as a single continuous line
  if (responsibilityStatement) {
    // If it's too long for a single line, truncate with ellipsis
    const maxWidth = 170;
    if (doc.getTextWidth(responsibilityStatement) > maxWidth) {
      // Find a good cutting point
      const approximateLength = Math.floor(responsibilityStatement.length * (maxWidth / doc.getTextWidth(responsibilityStatement)));
      let cutPoint = approximateLength - 3; // Leave room for ellipsis
      // Back up to the nearest space
      while (cutPoint > 0 && responsibilityStatement[cutPoint] !== ' ') {
        cutPoint--;
      }
      responsibilityStatement = responsibilityStatement.substring(0, cutPoint) + '...';
    }
    doc.text(responsibilityStatement, 22, yPos);
    yPos += 5;
  }
  
  // --- 4. Publication Information ---
  yPos += 2; // Extra space before publication info
  
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
  
  // Add physical description - pages
  const pages = book.pageCount || '';
  if (pages) {
    publicationInfo += `. – ${pages} ${pages === 1 ? 'Seite' : 'Seiten'}`;
  } else if (publicationInfo) {
    // Only add this separator if we have content and will add more information after
    if (book.illustrations || book.illustrator || 
        (book.contributors && typeof book.contributors === 'object' && 
         ((Array.isArray(book.contributors) && book.contributors.length > 0) || 
          (!Array.isArray(book.contributors) && Object.keys(book.contributors).length > 0)))) {
      publicationInfo += `. – `;
    }
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
    // Clean up dimensions string if needed
    let dimensions = book.dimensions.trim();
    // Check if dimensions contains valid information before adding
    if (dimensions && dimensions !== '-' && dimensions.toLowerCase() !== 'keine angabe') {
      publicationInfo += ` ; ${dimensions}`;
    }
  }
  
  // Keep publication info styling consistent with statement of responsibility
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  
  // Normalize publication info formatting for German RDA standards
  publicationInfo = publicationInfo.replace(/\s+/g, " ").trim();
  
  // Keep the same formatting as the statement of responsibility
  // Display publication info as a single continuous line without line breaks
  
  // Prepare publication info with proper German RDA formatting
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  
  // Normalize spaces and remove extra whitespace
  publicationInfo = publicationInfo.replace(/\s+/g, " ").trim();
  
  // Check if it's too long for a single line and truncate if needed
  const maxWidth = 170;
  if (doc.getTextWidth(publicationInfo) > maxWidth) {
    // Find a good cutting point that preserves the most important information
    // (beginning is typically more important in publication info)
    const approximateLength = Math.floor(publicationInfo.length * (maxWidth / doc.getTextWidth(publicationInfo)));
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
  
  // Display the publication info as a single line
  doc.text(publicationInfo, 22, yPos);
  yPos += 5;
  
  // --- 5. ISBN and Price information ---
  if (book.isbn) {
    yPos += 2; // Extra small space before ISBN line
    
    // Ensure we follow exact German cataloging format
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    
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
      
      // Use proper German RDA format with dash
      isbnLine += ` : ${bindingGerman}`; // Space colon space format
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
      
      // Clean up any duplicate spaces or commas
      priceText = priceText.replace(/\s{2,}/g, " ").replace(/,,/g, ",").trim();
      
      // Add to the ISBN line with proper delimiter according to German RDA
      if (isbnLine.includes(" : ")) {
        // If we already have a binding, still use a colon (German RDA standard)
        isbnLine += ` : ${priceText}`;
      } else {
        // If no binding, use colon with spaces
        isbnLine += ` : ${priceText}`;
      }
    }
    
    doc.text(isbnLine, 22, yPos);
    yPos += 6; // Slightly less spacing
  }
  
  // --- 6. Book summary/description and critical review ---
  if (book.summary || book.review) {
    yPos += 2;
    
    // Set text style for summary text in exact ekz style
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9); // Smaller font size for more content
    
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
    // Normalize all spacing for consistent appearance
    summaryText = summaryText.replace(/\s+/g, " ").trim();
    
    // Split the text for proper wrapping with standard ekz width
    const summaryLines = doc.splitTextToSize(summaryText, 160);
    
    // Calculate available height to avoid overflow
    const maxYPos = doc.internal.pageSize.height - 40; // Safe margin
    const maxLines = Math.floor((maxYPos - yPos) / 4); // Using 4mm line height
    const linesToShow = Math.min(summaryLines.length, maxLines);
    
    // Create content for each line with justified text - ekz standard format
    for (let i = 0; i < linesToShow; i++) {
      doc.text(summaryLines[i], 22, yPos, { 
        align: 'justify', // Use justified text alignment
        maxWidth: 160,
      });
      yPos += 4; // Reduced line spacing for more content
    }
    
    // Add ellipsis if we had to truncate
    if (summaryLines.length > linesToShow) {
      doc.text("...", 22, yPos);
      yPos += 4;
    }
    
    // Reset font size to default
    doc.setFontSize(10);
    
    // Add a small space after the summary
    yPos += 2;
  }
  
  // --- 7. Reviewer name in bottom right (after the summary or review) ---
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
  
  // --- 8. Interest category (IK) on next line (left aligned) ---
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
  // This should appear on a new line after the Interest Category
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
  
  // --- 10. Footer (only ekz-Informationsdienst text, no barcode or redundant ASB) ---
  yPos += 10;
  
  // Add ekz-Informationsdienst text
  const startX = doc.internal.pageSize.width / 2;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("ekz-Informationsdienst", startX, yPos, { align: 'center' });
  
  return yPos + 10; // Return the final Y position with some extra space
}

// Export a single book to PDF
export function exportBookToPDF(book: Book, language: string = 'de'): void {
  // Create a new PDF with standard A4 size (German DIN A4)
  // Add settings to ensure consistent text rendering
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
    compress: true,
    putOnlyUsedFonts: true
    // Removed problematic hotfixes setting while keeping text formatting improvements
  });
  
  // Configure language-specific text
  const bookLanguage = book.language || language;
  
  // Reset any document formatting from previous uses
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  
  // Ensure we don't lose the secondary classification when generating PDFs
  // Removed the logic that would replace classificationNumber with secondaryClassification
  // This ensures both fields are displayed separately
  
  // Make sure reviewer name is available 
  if (!book.reviewerName && book.userId) {
    book.reviewerName = "Ref-" + book.userId;
  }
  
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
export function exportMultipleBooksToSinglePDF(books: Book[], language: string = 'de'): void {
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
