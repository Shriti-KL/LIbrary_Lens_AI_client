import { jsPDF } from "jspdf";
import { Book } from "@shared/schema";
import { formatISBN } from "./utils";

// Format a single book for PDF export - returns the ending Y position
export function formatBookEntryForPDF(doc: jsPDF, book: Book, startY: number = 20): number {
  let yPos = startY;
  
  // --- 1. ASB Classification header ---
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("ASB:", 22, yPos);
  
  // Classification number (right-aligned)
  const asbNumber = book.classificationNumber || book.classification_number || book.ASB || "";
  if (asbNumber) {
    doc.text(asbNumber, 190, yPos, { align: 'right' });
  }
  
  // Additional classification numbers (second line)
  yPos += 7;
  let additionalClass = book.additionalClassifications || "";
  if (book.dnbNumber && !additionalClass.includes(book.dnbNumber)) {
    additionalClass = additionalClass ? `${additionalClass}, ${book.dnbNumber}` : book.dnbNumber;
  }
  if (additionalClass) {
    doc.setFont("helvetica", "normal");
    doc.text(additionalClass, 22, yPos);
  }
  
  // --- 2. Author name ---
  yPos += 15;
  doc.setFont("helvetica", "bold");
  let authorName = book.mainAuthor || book.author || "";
  if (authorName && authorName.includes(" ") && !authorName.includes(",")) {
    const parts = authorName.split(" ");
    const lastName = parts.pop() || "";
    const firstName = parts.join(" ");
    authorName = `${lastName}, ${firstName}`;
  }
  
  if (authorName) {
    doc.text(authorName + ":", 22, yPos);
  }
  
  // --- 3. Title line ---
  yPos += 6;
  doc.setFont("helvetica", "normal");
  
  // Build title and subtitle
  let title = book.title || "";
  let subtitle = book.subtitle || "";
  
  // Extract subtitle from title if not provided separately
  if (!subtitle && title.includes(":")) {
    const parts = title.split(":");
    title = parts[0].trim();
    subtitle = parts.slice(1).join(":").trim();
  }
  
  // Format complete bibliographic line according to the template:
  // [Title]: [Subtitle] / [Author] ; [Other Contributors]. – [Edition]. –[Place]: [Publisher], [Year]. – [Pages] : [Illustrations] ; [Format]
  
  // Part 1: Title and subtitle
  let bibliographicLine = title;
  if (subtitle) {
    bibliographicLine += `: ${subtitle}`;
  }
  
  // Part 2: Statement of responsibility (author and contributors)
  let responsibilityStatement = "";
  if (book.statementOfResponsibility) {
    responsibilityStatement = book.statementOfResponsibility;
  } else if (authorName) {
    responsibilityStatement = authorName;
    
    // Add contributors if available
    if (book.contributors && typeof book.contributors === 'object') {
      const contributorTexts = [];
      
      if (!Array.isArray(book.contributors)) {
        // Handle object format
        for (const role in book.contributors) {
          if (Array.isArray(book.contributors[role]) && book.contributors[role].length > 0) {
            contributorTexts.push(`${book.contributors[role].join(", ")} (${role})`);
          }
        }
      } else if (book.contributors.length > 0) {
        // Handle array format
        book.contributors
          .filter((c: any) => c.name && c.role)
          .forEach((c: any) => {
            contributorTexts.push(`${c.name} (${c.role})`);
          });
      }
      
      if (contributorTexts.length > 0) {
        responsibilityStatement += ` ; ${contributorTexts.join(" ; ")}`;
      }
    }
  }
  
  if (responsibilityStatement) {
    bibliographicLine += ` / ${responsibilityStatement}`;
  }
  
  // Part 3: Edition information
  const edition = book.edition ? book.edition.trim() : '';
  if (edition) {
    bibliographicLine += `. – ${edition}`;
  }
  
  // Part 4: Publication information
  const place = (book.publicationPlace || book.location || '').trim();
  const publisher = (book.publisher || '').trim();
  const year = book.publicationYear || book.publishedYear || '';
  
  let publicationInfo = '';
  if (place && publisher) {
    publicationInfo = `${place}: ${publisher}`;
  } else if (place) {
    publicationInfo = place;
  } else if (publisher) {
    publicationInfo = publisher;
  }
  
  if (year && publicationInfo) {
    publicationInfo += `, ${year}`;
  } else if (year) {
    publicationInfo = String(year);
  }
  
  if (publicationInfo) {
    bibliographicLine += `. – ${publicationInfo}`;
  }
  
  // Part 5: Physical description
  let physicalDesc = '';
  
  // Format page count
  if (book.pageCount) {
    const pages = parseInt(String(book.pageCount), 10);
    physicalDesc = `${pages} ${pages === 1 ? 'Seite' : 'Seiten'}`;
  }
  
  // Add illustrations
  const illustrations = book.illustrations ? book.illustrations.trim() : '';
  if (illustrations) {
    physicalDesc += `: ${illustrations}`;
  } else if (physicalDesc && 
            (book.illustrator || 
             (book.contributors && typeof book.contributors === 'object' && 
             ((Array.isArray(book.contributors) && book.contributors.some((c: any) => c.role?.toLowerCase().includes('illust'))) ||
              (!Array.isArray(book.contributors) && book.contributors['Illustrator']))))) {
    physicalDesc += `: Illustrationen`;
  }
  
  // Add dimensions
  const dimensions = book.dimensions ? book.dimensions.trim() : '';
  if (dimensions) {
    physicalDesc += ` ; ${dimensions}`;
  }
  
  if (physicalDesc) {
    bibliographicLine += `. – ${physicalDesc}`;
  }
  
  // Render the complete bibliographic information
  doc.setFontSize(10);
  const lineWidth = 145;
  const lines = doc.splitTextToSize(bibliographicLine, lineWidth);
  
  for (let i = 0; i < lines.length; i++) {
    doc.text(lines[i], 22, yPos);
    yPos += 4; // Tight line spacing for paragraph appearance
  }
  
  // --- 4. ISBN and price ---
  yPos += 7;
  if (book.isbn) {
    let isbnText = `ISBN ${formatISBN(book.isbn)}`;
    
    if (book.binding) {
      isbnText += ` ${book.binding}`;
    }
    
    if (book.price) {
      // Format price correctly for German display (comma for decimal)
      let priceText = typeof book.price === 'string' ? book.price : String(book.price);
      
      // Only add EUR prefix if not already present
      if (!priceText.includes('EUR')) {
        // Format decimal properly
        if (priceText.includes('.')) {
          priceText = priceText.replace('.', ',');
        }
        if (!priceText.includes(',')) {
          priceText += ',00';
        }
        priceText = `EUR ${priceText}`;
      }
      
      isbnText += ` : ${priceText}`;
    }
    
    doc.text(isbnText, 22, yPos);
    yPos += 8;
  }
  
  // --- 5. Summary and critical review ---
  yPos += 2;
  if (book.summary || book.review) {
    let contentText = '';
    
    if (book.summary) {
      contentText = book.summary.trim();
    }
    
    if (book.summary && book.review) {
      contentText += ' | '; // The exact separator format requested
    }
    
    if (book.review) {
      contentText += book.review.trim();
    }
    
    // Clean unnecessary metadata/formatting
    contentText = contentText
      .replace(/\*\*.*?\*\*/g, '')
      .replace(/^\s*[-•]\s*/gm, '')
      .replace(/\n\s*\n/g, '\n')
      .trim();
    
    doc.setFontSize(10);
    const summaryLines = doc.splitTextToSize(contentText, 145);
    for (let i = 0; i < summaryLines.length; i++) {
      doc.text(summaryLines[i], 22, yPos, { align: 'justify' });
      yPos += 4.5;
    }
  }
  
  // --- 6. Reviewer name ---
  yPos += 8;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  
  const reviewerName = book.reviewerName || book.reviewer_name || '';
  if (reviewerName) {
    doc.text(reviewerName, 190, yPos, { align: 'right' });
  }
  
  // --- 7. IK categories and age recommendation ---
  yPos += 8;
  doc.setFont("helvetica", "normal");
  
  let ikText = '';
  if (book.interestCategory) {
    ikText = `IK: ${book.interestCategory}`;
    if (book.ageRecommendation) {
      ikText += `; suitable from age ${book.ageRecommendation}`;
    }
    
    doc.text(ikText, 22, yPos);
    yPos += 5;
  }
  
  // --- 8. ID code ---
  let idCode = '';
  const initials = book.idbInitials || '';
  const sequenceNumber = book.idbSequenceNumber || '';
  const year = book.idbYear || '';
  
  if (initials) {
    idCode = `ID-${initials}`;
    if (sequenceNumber) {
      idCode += ` ${sequenceNumber}`;
      if (year) {
        idCode += `/${year}`;
      }
    }
    
    if (idCode) {
      doc.text(idCode, 22, yPos);
      yPos += 5;
    }
  }
  
  return yPos + 10; // Return the final Y position with some extra space
}