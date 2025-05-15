import { jsPDF } from "jspdf";
import { Book } from "@shared/schema";

// Format ISBN for display with hyphens for better readability
export function formatISBN(isbn: string): string {
  // Remove any non-alphanumeric characters
  const cleanISBN = isbn.replace(/[^0-9X]/gi, '');
  
  // Return as is if not a 10 or 13 digit ISBN
  if (cleanISBN.length !== 10 && cleanISBN.length !== 13) {
    return isbn;
  }
  
  // Format 10-digit ISBN
  if (cleanISBN.length === 10) {
    return `${cleanISBN.substring(0, 1)}-${cleanISBN.substring(1, 6)}-${cleanISBN.substring(6, 9)}-${cleanISBN.substring(9)}`;
  }
  
  // Format 13-digit ISBN (standard modern ISBN)
  return `${cleanISBN.substring(0, 3)}-${cleanISBN.substring(3, 4)}-${cleanISBN.substring(4, 9)}-${cleanISBN.substring(9, 12)}-${cleanISBN.substring(12)}`;
}

// Format a single book for PDF export using the specified template format
export function formatBookEntryForPDF(doc: jsPDF, book: Book, startY: number = 20): number {
  let yPos = startY;
  
  // --- 1. ASB Classification ---
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("ASB:", 22, yPos);
  
  // Classification number (right-aligned)
  const asbNumber = book.classificationNumber || book.classification_number || book.ASB || "";
  if (asbNumber) {
    doc.text(asbNumber, 190, yPos, { align: 'right' });
  }
  
  // Additional classification numbers
  yPos += 7;
  let additionalClass = book.additionalClassifications || "";
  if (book.dnbNumber && !additionalClass.includes(book.dnbNumber)) {
    additionalClass = additionalClass ? `${additionalClass}, ${book.dnbNumber}` : book.dnbNumber;
  }
  if (additionalClass) {
    doc.setFont("helvetica", "normal");
    doc.text(additionalClass, 22, yPos);
  }
  
  // --- 2. Author (LastName, FirstName) ---
  yPos += 15;
  let authorFormatted = book.mainAuthor || book.author || "";
  if (authorFormatted && authorFormatted.includes(" ") && !authorFormatted.includes(",")) {
    const nameParts = authorFormatted.split(" ");
    const lastName = nameParts.pop();
    const firstName = nameParts.join(" ");
    authorFormatted = `${lastName}, ${firstName}`;
  }
  
  doc.setFont("helvetica", "bold");
  if (authorFormatted) {
    doc.text(authorFormatted + ":", 22, yPos);
  }
  
  // --- 3. Bibliographic Information (as single continuous block) ---
  yPos += 6;
  doc.setFont("helvetica", "normal");
  
  // Build complete bibliographic line according to the template:
  // [Title]: [Subtitle] / [Author] ; [Other Contributors]. – [Edition]. –[Place]: [Publisher], [Year]. – [Pages] pages: [Illustrations] ; [Format in cm]
  
  // Start with the title and subtitle
  let titleFull = book.title || "";
  let subtitle = book.subtitle || '';
  
  // Extract subtitle from title if not provided separately
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
  
  // Format complete bibliographic line
  let bibliographicLine = titleFull;
  if (subtitle) {
    bibliographicLine += `: ${subtitle}`;
  }
  
  // Add statement of responsibility
  if (book.statementOfResponsibility) {
    // Use the statement provided
    bibliographicLine += ` / ${book.statementOfResponsibility.trim()}`;
  } else {
    // Construct from author and contributors
    let authorName = book.mainAuthor || book.author || "";
    if (authorName) authorName = authorName.trim();
    
    // Collect contributors
    let contributorsText = "";
    if (book.contributors && typeof book.contributors === 'object') {
      if (!Array.isArray(book.contributors)) {
        // New format with roles as keys
        const contributorsList = [];
        for (const role in book.contributors) {
          if (Array.isArray(book.contributors[role]) && book.contributors[role].length > 0) {
            contributorsList.push(`${book.contributors[role].map(s => s.trim()).join(", ")} (${role})`);
          }
        }
        if (contributorsList.length > 0) {
          contributorsText = ` ; ${contributorsList.join(" ; ")}`;
        }
      } else if (book.contributors.length > 0) {
        // Old format with array of objects
        const contributorsList = book.contributors
          .filter((c: any) => c.name && c.role)
          .map((c: any) => `${c.name.trim()} (${c.role.trim()})`)
          .join(" ; ");
        
        if (contributorsList) {
          contributorsText = ` ; ${contributorsList}`;
        }
      }
    }
    
    // Add author and contributors to the line
    if (authorName) {
      bibliographicLine += ` / ${authorName}${contributorsText}`;
    } else if (contributorsText) {
      bibliographicLine += ` / ${contributorsText.trim()}`;
    }
  }
  
  // Add edition
  const edition = book.edition ? book.edition.trim() : '';
  if (edition) {
    bibliographicLine += `. – ${edition}`;
  }
  
  // Add publication place, publisher and year
  const place = (book.publicationPlace || book.location || '').trim();
  const publisher = (book.publisher || '').trim();
  let yearText = '';
  if (book.publicationYear || book.publishedYear) {
    const year = book.publicationYear || book.publishedYear;
    yearText = String(year).trim();
    if (yearText.includes('.')) {
      yearText = yearText.split('.')[0]; // Integer part only
    }
  }
  
  let pubInfo = '';
  if (place && publisher) {
    pubInfo = `${place}: ${publisher}`;
  } else if (place) {
    pubInfo = place;
  } else if (publisher) {
    pubInfo = publisher;
  }
  
  if (yearText && pubInfo) {
    pubInfo += `, ${yearText}`;
  } else if (yearText) {
    pubInfo = yearText;
  }
  
  if (pubInfo) {
    bibliographicLine += `. – ${pubInfo}`;
  }
  
  // Add physical description (pages, illustrations, dimensions)
  let pagesText = '';
  if (book.pageCount) {
    let pagesValue = String(book.pageCount).trim();
    if (pagesValue.includes('.')) {
      pagesValue = pagesValue.split('.')[0];
    }
    
    const pagesNum = parseInt(pagesValue, 10);
    if (!isNaN(pagesNum)) {
      pagesText = `${pagesNum} ${pagesNum === 1 ? 'Seite' : 'Seiten'}`;
    } else if (!pagesValue.toLowerCase().includes('seite')) {
      pagesText = `${pagesValue} Seiten`;
    } else {
      pagesText = pagesValue;
    }
  }
  
  const illustrations = book.illustrations ? book.illustrations.trim() : '';
  const dimensions = book.dimensions ? book.dimensions.trim() : '';
  
  let physicalDesc = '';
  if (pagesText) {
    physicalDesc = pagesText;
    
    if (illustrations) {
      physicalDesc += `: ${illustrations}`;
    } else if (book.illustrator || 
              (book.contributors && typeof book.contributors === 'object' && 
               ((Array.isArray(book.contributors) && 
                 book.contributors.some((c: any) => c.role?.toLowerCase().includes('illust'))) ||
                (!Array.isArray(book.contributors) && book.contributors['Illustrator'])))) {
      physicalDesc += `: Illustrationen`;
    }
    
    if (dimensions) {
      physicalDesc += ` ; ${dimensions}`;
    }
  } else if (dimensions) {
    physicalDesc = dimensions;
  }
  
  if (physicalDesc) {
    bibliographicLine += `. – ${physicalDesc}`;
  }
  
  // Render the complete bibliographic information as a continuous paragraph
  doc.setFontSize(10);
  const lineWidth = 145;
  const lines = doc.splitTextToSize(bibliographicLine, lineWidth);
  
  for (let i = 0; i < lines.length; i++) {
    doc.text(lines[i], 22, yPos);
    yPos += 4; // Tight line spacing for paragraph appearance
  }
  
  // --- 4. ISBN and price information ---
  yPos += 7;
  if (book.isbn) {
    let isbnLine = `ISBN ${formatISBN(book.isbn)}`;
    
    if (book.binding) {
      isbnLine += ` ${book.binding}`;
    }
    
    // Format price with German conventions (comma for decimal)
    if (book.price) {
      let priceText = '';
      if (typeof book.price === 'string' && book.price.includes('EUR')) {
        priceText = book.price.trim();
      } else {
        // Format price with German conventions
        priceText = String(book.price).replace('.', ',');
        if (!priceText.includes(',')) {
          priceText += ',00';
        }
        priceText = `EUR ${priceText}`;
      }
      
      isbnLine += ` : ${priceText}`;
    }
    
    doc.text(isbnLine, 22, yPos);
    yPos += 7;
  }
  
  // --- 5. Summary and critical review (with | separator) ---
  yPos += 3;
  if (book.summary || book.review) {
    doc.setFontSize(10);
    
    // Format according to template with | separator
    let contentText = '';
    if (book.summary) {
      contentText = book.summary.trim();
    }
    
    if (book.summary && book.review) {
      contentText += ' | '; // Explicit separator as requested
    }
    
    if (book.review) {
      contentText += book.review.trim();
    }
    
    // Clean up text by removing metadata patterns and extra whitespace
    contentText = contentText
      .replace(/\*\*.*?\*\*.*?(?:\n|$)/g, '') // Remove markdown headers
      .replace(/^\s*[-•]\s*/gm, '')          // Remove bullet points
      .replace(/\n\s*\n/g, '\n')             // Remove extra line breaks
      .trim();
    
    const summaryLines = doc.splitTextToSize(contentText, 145);
    for (let i = 0; i < summaryLines.length; i++) {
      doc.text(summaryLines[i], 22, yPos, { align: 'justify' });
      yPos += 4.5;
    }
  }
  
  // --- 6. Reviewer name ---
  yPos += 7;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  
  const reviewerName = book.reviewerName || book.reviewer_name || '';
  if (reviewerName) {
    doc.text(reviewerName, 190, yPos, { align: 'right' });
  }
  
  // --- 7. IK categories and age recommendation ---
  yPos += 8;
  doc.setFont("helvetica", "normal");
  
  const interestCategory = book.interestCategory || book.interest_category || '';
  const ageRecommendation = book.ageRecommendation || book.age_recommendation || '';
  
  if (interestCategory) {
    let ikText = `IK: ${interestCategory}`;
    if (ageRecommendation) {
      ikText += `; suitable from age ${ageRecommendation}`;
    }
    doc.text(ikText, 22, yPos);
    yPos += 5;
  }
  
  // --- 8. ID code ---
  const initials = book.idbInitials || book.idb_initials || '';
  const sequenceNumber = book.idbSequenceNumber || book.idb_sequence_number || '';
  const idYear = book.idbYear || book.idb_year || '';
  
  if (initials) {
    let idCode = `ID-${initials}`;
    if (sequenceNumber) {
      idCode += ` ${sequenceNumber}`;
      if (idYear) {
        idCode += `/${idYear}`;
      }
    }
    
    doc.text(idCode, 22, yPos);
    yPos += 5;
  }
  
  // Add barcode-like effect at the bottom
  yPos += 10;
  const barcodeWidth = 120;
  const barcodeHeight = 15;
  const startX = (doc.internal.pageSize.width - barcodeWidth) / 2;
  
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(0, 0, 0);
  
  const numBars = 30;
  const barWidth = barcodeWidth / numBars;
  for (let i = 0; i < numBars; i++) {
    if (i % 3 !== 0) {
      doc.rect(startX + i * barWidth, yPos, barWidth - 0.5, barcodeHeight, 'F');
    }
  }
  
  // Add footer text
  yPos += barcodeHeight + 5;
  doc.setFontSize(8);
  doc.text("ekz-Informationsdienst", doc.internal.pageSize.width / 2, yPos, { align: 'center' });
  
  return yPos + 10; // Return final Y position with some extra space
}

// Export a book to PDF
export function exportBookToPDF(book: Book, language: string = 'de'): void {
  // Create a new PDF with standard A4 size
  const doc = new jsPDF({
    unit: 'mm',
    format: 'a4',
  });
  
  // Format the book entry
  formatBookEntryForPDF(doc, book);
  
  // Save the PDF with a safe filename
  const safeFilename = (book.title || 'book').replace(/[/\\?%*:|"<>]/g, '-');
  const filenamePrefix = language === 'de' ? 'Buch' : 'Book';
  doc.save(`${safeFilename || `${filenamePrefix}_${new Date().toISOString().substring(0, 10)}`}.pdf`);
}