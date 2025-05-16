import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Book } from "@shared/schema";

// Font management and PDF styling constants
const PDFStyles = {
  fonts: {
    normal: "helvetica",
    bold: "helvetica-bold",
    italic: "helvetica-oblique",
  },
  fontSize: {
    title: 12,
    subtitle: 11,
    body: 10,
    small: 8,
    footer: 7,
  },
  spacing: {
    afterTitle: 10,
    afterAuthor: 8,
    betweenLines: 6,
    afterSection: 15,
    margin: {
      top: 40,
      bottom: 40,
      left: 40,
      right: 40,
    },
  },
  colors: {
    text: [0, 0, 0],
    heading: [0, 0, 0],
  },
};

// Helper function to set consistent font styling
function setFontStyle(
  doc: jsPDF,
  style: "normal" | "bold" | "italic",
  size: number,
) {
  doc.setFont(PDFStyles.fonts.normal, style);
  doc.setFontSize(size);
}

// Helper function to calculate text height with proper line spacing
function calculateTextHeight(
  doc: jsPDF,
  text: string,
  fontSize: number,
  lineSpacing: number,
): number {
  const lines = doc.splitTextToSize(
    text,
    doc.internal.pageSize.width -
      PDFStyles.spacing.margin.left -
      PDFStyles.spacing.margin.right,
  );
  return lines.length * (fontSize * lineSpacing);
}

// Helper function to check if text will overflow current page
function willTextOverflow(
  doc: jsPDF,
  text: string,
  currentY: number,
  fontSize: number,
  lineSpacing: number,
): boolean {
  const textHeight = calculateTextHeight(doc, text, fontSize, lineSpacing);
  const availableSpace =
    doc.internal.pageSize.height - currentY - PDFStyles.spacing.margin.bottom;
  return textHeight > availableSpace;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format date to readable string
export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
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
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
}

// Truncate text with ellipsis
export function truncateText(text: string, maxLength: number): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Generate a random ID
export function generateId(): string {
  return (
    Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15)
  );
}

// Parse error message from API response
export function parseErrorMessage(error: any): string {
  if (typeof error === "string") return error;
  if (error?.message) return error.message;
  return "An unknown error occurred";
}

// Extract file extension from filename
export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}

// Check if file is an image
export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

// Format bytes to readable string (KB, MB)
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

// Format ISBN with proper hyphens
export function formatISBN(isbn: string | null): string {
  if (!isbn) return "";

  // Remove all non-digit and non-X characters (ISBN-10 can end with X)
  const cleanISBN = isbn.replace(/[^\dX]/gi, "");

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

  if (cleanISBN.startsWith("978") || cleanISBN.startsWith("979")) {
    // Check for common language groups
    if (cleanISBN.startsWith("9780") || cleanISBN.startsWith("9781")) {
      // English language books (usually 978-0 or 978-1)
      formattedISBN = `${cleanISBN.substring(0, 3)}-${cleanISBN.substring(3, 4)}-${cleanISBN.substring(4, 8)}-${cleanISBN.substring(8, 12)}-${cleanISBN.substring(12, 13)}`;
    } else if (cleanISBN.startsWith("9783")) {
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
  if (!isbn) return "";
  return isbn.replace(/[^\dX]/gi, "");
}

// Generate a PDF export for a book
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Book } from "@shared/schema";

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
  reviewerName?: string; // Reviewer who created the critical review
  ageRecommendation?: string; // Age recommendation for the book
  dnbNumber?: string; // DNB catalog number
}

/**
 * Normalize book data to ensure consistent formatting in PDF exports
 * This helps prevent issues with missing or inconsistent data formats
 */
function normalizeBookData(book: Book): NormalizedBookData {
  return {
    id: book.id || null,
    isbn: book.isbn || "",
    title: book.title || "",
    subtitle: book.subtitle || "",
    author: book.author || "",
    mainAuthor: book.mainAuthor || book.author || "",
    statementOfResponsibility: book.statementOfResponsibility || "",
    contributors: book.contributors || [],
    edition: book.edition || "",
    publicationPlace: book.publicationPlace || book.location || "",
    publisher: book.publisher || "",
    publicationYear: book.publicationYear || book.publishedYear || null,
    pageCount: book.pageCount || null,
    illustrations: book.illustrations || "",
    dimensions: book.dimensions || "",
    binding: book.binding || "",
    price: book.price || "",
    catalogNumber: book.catalogNumber || book.classificationNumber || "",
    secondaryClassification:
      book.secondaryClassification || book.additionalClassifications || "",
    interestCategory: book.interestCategory || "",
    summary: book.summary || "",
    review: book.review || "",
    genres: Array.isArray(book.genres) ? book.genres : [],
    themes: Array.isArray(book.themes)
      ? (book.themes as any[]).map((t) =>
          typeof t === "string" ? t : t && t.name ? t.name : "",
        )
      : [],
    language: book.language || "de",
    reviewerName: book.reviewerName || book.reviewer_name || "",
    ageRecommendation: book.ageRecommendation || "",
    dnbNumber: book.dnbNumber || "",
  };
}

// Format a single book entry with improved spacing and font management
function formatBookEntryForPDF(
  doc: jsPDF,
  book: Book,
  startY: number = PDFStyles.spacing.margin.top,
): number {
  let currentY = startY;
  const pageWidth = doc.internal.pageSize.width;
  const contentWidth =
    pageWidth - PDFStyles.spacing.margin.left - PDFStyles.spacing.margin.right;

  // --- 1. ASB Classification ---
  setFontStyle(doc, "bold", PDFStyles.fontSize.subtitle);
  doc.text("ASB:", PDFStyles.spacing.margin.left, currentY);

  if (book.catalogNumber) {
    doc.text(
      book.catalogNumber,
      pageWidth - PDFStyles.spacing.margin.right,
      currentY,
      { align: "right" },
    );
  }
  currentY += PDFStyles.spacing.betweenLines;

  // --- 2. Author's Name ---
  let authorFormatted = book.mainAuthor || book.author;
  if (authorFormatted && !authorFormatted.includes(",")) {
    const nameParts = authorFormatted.split(" ");
    const lastName = nameParts.pop();
    const firstName = nameParts.join(" ");
    authorFormatted = `${lastName}, ${firstName}`;
  }

  if (authorFormatted) {
    setFontStyle(doc, "bold", PDFStyles.fontSize.body);
    doc.text(authorFormatted + ":", PDFStyles.spacing.margin.left, currentY);
    currentY += PDFStyles.spacing.afterAuthor;
  }

  // --- 3. Title and Subtitle ---
  setFontStyle(doc, "normal", PDFStyles.fontSize.body);
  let titleText = book.title || "";
  if (book.subtitle) {
    titleText += `: ${book.subtitle}`;
  }

  // Check for overflow and handle text wrapping
  const titleLines = doc.splitTextToSize(titleText, contentWidth);
  if (
    willTextOverflow(doc, titleText, currentY, PDFStyles.fontSize.body, 1.2)
  ) {
    doc.addPage();
    currentY = PDFStyles.spacing.margin.top;
  }

  titleLines.forEach((line) => {
    doc.text(line, PDFStyles.spacing.margin.left, currentY);
    currentY += PDFStyles.spacing.betweenLines;
  });
  currentY += PDFStyles.spacing.afterTitle;

  // --- 4. Publication Information ---
  const pubInfo = [
    book.edition,
    `${book.publicationPlace || ""}: ${book.publisher || ""}`,
    book.publicationYear,
    book.pageCount ? `${book.pageCount} S.` : null,
    book.dimensions,
  ]
    .filter(Boolean)
    .join(". ");

  if (pubInfo) {
    setFontStyle(doc, "normal", PDFStyles.fontSize.body);
    const pubLines = doc.splitTextToSize(pubInfo, contentWidth);
    pubLines.forEach((line) => {
      doc.text(line, PDFStyles.spacing.margin.left, currentY);
      currentY += PDFStyles.spacing.betweenLines;
    });
    currentY += PDFStyles.spacing.afterSection;
  }

  // --- 5. ISBN and Price ---
  if (book.isbn) {
    setFontStyle(doc, "normal", PDFStyles.fontSize.body);
    let isbnText = `ISBN ${book.isbn}`;
    if (book.price) {
      isbnText += ` : ${book.price}`;
    }
    doc.text(isbnText, PDFStyles.spacing.margin.left, currentY);
    currentY += PDFStyles.spacing.afterSection;
  }

  // --- 6. Summary and Review ---
  if (book.summary || book.review) {
    setFontStyle(doc, "normal", PDFStyles.fontSize.small);
    let summaryText = "";
    if (book.summary) summaryText = book.summary;
    if (book.summary && book.review) summaryText += " | ";
    if (book.review) summaryText += book.review;

    // Check for overflow before adding summary
    if (
      willTextOverflow(
        doc,
        summaryText,
        currentY,
        PDFStyles.fontSize.small,
        1.2,
      )
    ) {
      doc.addPage();
      currentY = PDFStyles.spacing.margin.top;
    }

    const summaryLines = doc.splitTextToSize(summaryText, contentWidth);
    summaryLines.forEach((line) => {
      doc.text(line, PDFStyles.spacing.margin.left, currentY);
      currentY += PDFStyles.spacing.betweenLines * 0.8; // Slightly reduced spacing for summary
    });
  }

  // --- 7. Footer ---
  const footerY =
    doc.internal.pageSize.height - PDFStyles.spacing.margin.bottom;
  setFontStyle(doc, "normal", PDFStyles.fontSize.footer);
  doc.text("ekz-Informationsdienst", pageWidth / 2, footerY, {
    align: "center",
  });

  return currentY;
}

// Export a single book to PDF
export function exportBookToPDF(book: Book, language: string = "de"): void {
  // Create a new PDF with standard A4 size (German DIN A4)
  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
    compress: true, // Use compression for smaller file size
  });

  // Normalize book data to ensure consistent formatting
  const normalizedBook = normalizeBookData(book);

  // Configure language-specific text
  const bookLanguage = normalizedBook.language || language;

  // Format book entry with normalized data
  formatBookEntryForPDF(doc, book);

  // Save the PDF with the book title as filename
  // Remove any forbidden characters from filename
  const safeFilename = (normalizedBook.title || "book")
    .replace(/[/\\?%*:|"<>]/g, "-")
    .trim();

  // Set the correct filename prefix based on language
  const filenamePrefix = bookLanguage === "de" ? "Buch" : "Book";
  const timestamp = new Date().toISOString().substring(0, 10);

  // Limit filename length to prevent excessively long filenames
  const maxLength = 50;
  const truncatedFilename =
    safeFilename.length > maxLength
      ? safeFilename.substring(0, maxLength) + "..."
      : safeFilename;

  // Use simplified filename with timestamp for better organization
  doc.save(`${truncatedFilename || `${filenamePrefix}_${timestamp}`}.pdf`);
}

// Draw a single box with correction info - used on the first page
function drawCorrectionBox(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  // Format the date exactly as in the sample image: YYYY-MM-DD HH:MM Uhr
  const date = new Date();
  const formattedDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")} Uhr`;

  // Draw box border - use thicker border as shown in sample
  doc.setDrawColor(0);
  doc.setLineWidth(0.7);
  doc.rect(x, y, width, height);

  // Add correction title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Korrektur:", x + width / 2, y + 15, { align: "center" });

  // Add edition info - exactly as in the sample
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Basis-Ausgabe (Edition 10.000)", x + width / 2, y + 25, {
    align: "center",
  });

  // Add number of books - exactly as in the sample
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("24 Titel", x + width / 2, y + 40, { align: "center" });

  // Add date and time - exactly as in the sample
  doc.text(formattedDate, x + width / 2, y + 50, { align: "center" });
}

// Format a book entry for grid layout with improved spacing and consistency
function formatBookEntryForGrid(
  doc: jsPDF,
  book: Book,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const cellPadding = {
    left: 8,
    right: 8,
    top: 8,
    bottom: 8,
  };

  const contentWidth = width - cellPadding.left - cellPadding.right;
  let currentY = y + cellPadding.top;

  // Draw cell border
  doc.setDrawColor(0);
  doc.setLineWidth(0.3);
  doc.rect(x, y, width, height);

  // --- 1. ASB Classification ---
  setFontStyle(doc, "bold", PDFStyles.fontSize.small);
  doc.text("ASB:", x + cellPadding.left, currentY);

  if (book.catalogNumber) {
    doc.text(book.catalogNumber, x + width - cellPadding.right, currentY, {
      align: "right",
    });
  }
  currentY += PDFStyles.spacing.betweenLines;

  // --- 2. Author ---
  let authorFormatted = book.mainAuthor || book.author;
  if (authorFormatted && !authorFormatted.includes(",")) {
    const nameParts = authorFormatted.split(" ");
    const lastName = nameParts.pop();
    const firstName = nameParts.join(" ");
    authorFormatted = `${lastName}, ${firstName}`;
  }

  if (authorFormatted) {
    setFontStyle(doc, "bold", PDFStyles.fontSize.small);
    doc.text(authorFormatted + ":", x + cellPadding.left, currentY);
    currentY += PDFStyles.spacing.betweenLines;
  }

  // --- 3. Title ---
  setFontStyle(doc, "normal", PDFStyles.fontSize.small);
  let titleText = book.title || "";
  if (book.subtitle) {
    titleText += `: ${book.subtitle}`;
  }

  const titleLines = doc.splitTextToSize(titleText, contentWidth);
  titleLines.slice(0, 2).forEach((line) => {
    // Limit to 2 lines
    doc.text(line, x + cellPadding.left, currentY);
    currentY += PDFStyles.spacing.betweenLines;
  });

  // --- 4. Publication Info ---
  const pubInfo = [
    book.edition,
    `${book.publicationPlace || ""}: ${book.publisher || ""}`,
    book.publicationYear,
    book.pageCount ? `${book.pageCount} S.` : null,
    book.dimensions,
  ]
    .filter(Boolean)
    .join(". ");

  if (pubInfo) {
    setFontStyle(doc, "normal", PDFStyles.fontSize.small);
    const pubLines = doc.splitTextToSize(pubInfo, contentWidth);
    pubLines.slice(0, 2).forEach((line) => {
      // Limit to 2 lines
      doc.text(line, x + cellPadding.left, currentY);
      currentY += PDFStyles.spacing.betweenLines * 0.8;
    });
  }

  // --- 5. ISBN ---
  if (book.isbn) {
    currentY += PDFStyles.spacing.betweenLines * 0.5;
    setFontStyle(doc, "normal", PDFStyles.fontSize.small);
    let isbnText = `ISBN ${book.isbn}`;
    if (book.price) {
      isbnText += ` : ${book.price}`;
    }
    const isbnLine = doc.splitTextToSize(isbnText, contentWidth)[0];
    doc.text(isbnLine, x + cellPadding.left, currentY);
    currentY += PDFStyles.spacing.betweenLines;
  }

  // --- 6. Summary ---
  if (book.summary || book.review) {
    currentY += PDFStyles.spacing.betweenLines * 0.5;
    setFontStyle(doc, "normal", PDFStyles.fontSize.small);

    let summaryText = "";
    if (book.summary) summaryText = book.summary;
    if (book.summary && book.review) summaryText += " | ";
    if (book.review) summaryText += book.review;

    // Calculate available height for summary
    const availableHeight = y + height - cellPadding.bottom - currentY;
    const maxLines = Math.floor(
      availableHeight / (PDFStyles.spacing.betweenLines * 0.8),
    );

    const summaryLines = doc.splitTextToSize(summaryText, contentWidth);
    summaryLines.slice(0, maxLines - 1).forEach((line) => {
      doc.text(line, x + cellPadding.left, currentY);
      currentY += PDFStyles.spacing.betweenLines * 0.8;
    });

    // Add ellipsis if text was truncated
    if (summaryLines.length > maxLines - 1) {
      doc.text("...", x + cellPadding.left, currentY);
    }
  }

  // --- 7. Footer ---
  const footerY = y + height - cellPadding.bottom;
  setFontStyle(doc, "normal", PDFStyles.fontSize.footer);
  doc.text("ekz-Informationsdienst", x + width / 2, footerY, {
    align: "center",
  });
}

// Export multiple books to a single PDF with the specified format from the image
export function exportMultipleBooksToSinglePDF(
  books: Book[],
  language: string = "de",
): void {
  if (!books || books.length === 0) return;

  // Create a new PDF with standard A4 size (German DIN A4)
  const doc = new jsPDF({
    unit: "mm",
    format: "a4",
    compress: true, // Use compression for smaller file size
  });

  // Page dimensions (standard A4)
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 10; // Margin around the page edges

  // Grid layout configuration - consistent across all pages
  const gridColumns = 2; // Two columns per page
  const gridRows = 1; // One row per page after the first page

  // Calculate cell dimensions with precise margins
  const horizontalGap = 10; // Space between columns
  const cellWidth = (pageWidth - 2 * margin - horizontalGap) / gridColumns;
  const cellHeight = 140; // Fixed height for all book entries

  // First page layout - two correction boxes at the top
  const boxWidth = 80;
  const boxHeight = 70;
  const boxY = 20;
  const boxGap = 20;

  // Calculate precise positions for correction boxes
  const firstBoxX = (pageWidth - 2 * boxWidth - boxGap) / 2;
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
    formatBookEntryForGrid(
      doc,
      books[currentBook],
      margin,
      firstPageBookY,
      cellWidth,
      cellHeight,
    );
    currentBook++;

    if (currentBook < books.length) {
      // Second book - bottom right with precise positioning
      const secondBookX = margin + cellWidth + horizontalGap;
      formatBookEntryForGrid(
        doc,
        books[currentBook],
        secondBookX,
        firstPageBookY,
        cellWidth,
        cellHeight,
      );
      currentBook++;
    }
  }

  // Process remaining books on subsequent pages with consistent layout
  while (currentBook < books.length) {
    // Create a new page for next set of books
    doc.addPage();

    // Process books in grid layout with precise positioning
    for (let row = 0; row < gridRows && currentBook < books.length; row++) {
      for (
        let col = 0;
        col < gridColumns && currentBook < books.length;
        col++
      ) {
        // Calculate exact position for each cell
        const x = margin + col * (cellWidth + horizontalGap);
        const y = margin + row * (cellHeight + margin);

        // Add book to grid with consistent dimensions
        formatBookEntryForGrid(
          doc,
          books[currentBook],
          x,
          y,
          cellWidth,
          cellHeight,
        );
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
    const pageText =
      language === "de"
        ? `Seite ${i} von ${pageCount}`
        : `Page ${i} of ${pageCount}`;

    // Position consistently at bottom right
    doc.text(pageText, pageWidth - margin, pageHeight - 5, { align: "right" });
  }

  // Generate timestamped filename with book count
  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .substring(0, 10);
  const bookCount = books.length;

  // Create language-specific, informative filenames
  let filename = "";
  if (language === "de") {
    filename = `Buchkatalog_${bookCount}_Einträge_${timestamp}.pdf`;
  } else {
    filename = `BookCatalog_${bookCount}_entries_${timestamp}.pdf`;
  }

  // Save file with compression enabled
  doc.save(filename);
}
