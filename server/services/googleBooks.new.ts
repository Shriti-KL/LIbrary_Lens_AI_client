import { Book } from "@shared/schema";
import { apiLogger } from "../utils/logger";

// Google Books API endpoint
const GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes";
const API_KEY = process.env.GOOGLE_BOOKS_API_KEY || "";

// Constants for data validation (matching Python service)
const REFERENCE_YEAR = 2023;
const MAX_FUTURE_YEARS = 0;

export interface GoogleBookSearchParams {
  query: string;
  title?: string;
  author?: string;
  isbn?: string;
  maxResults?: number;
}

/**
 * Search books using Google Books API
 * Simplified to match Python service approach
 */
export async function searchBooks(params: GoogleBookSearchParams): Promise<any[]> {
  try {
    // Build query string
    let query = params.query;
    if (params.title) query += `+intitle:${encodeURIComponent(params.title)}`;
    if (params.author) query += `+inauthor:${encodeURIComponent(params.author)}`;
    if (params.isbn) query += `+isbn:${encodeURIComponent(params.isbn)}`;

    // Build API URL - simplified like Python service
    const url = new URL(GOOGLE_BOOKS_API_URL);
    url.searchParams.append("q", query);
    if (API_KEY) url.searchParams.append("key", API_KEY);
    if (params.maxResults) url.searchParams.append("maxResults", params.maxResults.toString());

    // Log the request
    apiLogger.logRequest("Google Books API", {
      operation: "searchBooks",
      params: { query }
    });

    // Make the request
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorMsg = `Google Books API error: ${response.status} ${response.statusText}`;
      apiLogger.logError("Google Books API", errorMsg);
      throw new Error(errorMsg);
    }

    const data = await response.json();
    
    // Log the response
    apiLogger.logResponse("Google Books API", {
      operation: "searchBooks",
      itemCount: data.items?.length || 0
    });
    
    return data.items || [];
  } catch (error: any) {
    console.error("Error searching Google Books:", error);
    apiLogger.logError("Google Books API", error);
    throw new Error(`Failed to search Google Books: ${error.message || String(error)}`);
  }
}

/**
 * Get complete book information from Google Books API by ISBN
 * This function is simplified to match the Python service approach
 */
export async function getCompleteBookByISBN(isbn: string, language: string = "de"): Promise<Partial<Book> | null> {
  const lookupId = `googlebooks_isbn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[${lookupId}] Looking up book with ISBN: ${isbn} using Google Books API`);
  
  try {
    // Clean the ISBN for search by removing hyphens
    const cleanedISBN = isbn.replace(/[^\dX]/gi, '');
    
    // Log the ISBN lookup request
    apiLogger.logRequest("Google Books API", {
      operation: "getCompleteBookByISBN",
      isbn
    });
    
    // Search using the cleaned ISBN
    const books = await searchBooks({ query: `isbn:${cleanedISBN}` });
    
    // Return null if no books were found
    if (!books || books.length === 0) {
      console.log(`[${lookupId}] No book found for ISBN: ${isbn}`);
      return null;
    }
    
    const bookData = books[0];
    
    // Return null if no book was found or it has no volumeInfo
    if (!bookData || !bookData.volumeInfo) {
      console.log(`[${lookupId}] No valid book data found for ISBN: ${isbn}`);
      return null;
    }
    
    const volumeInfo = bookData.volumeInfo;
    
    // Verify essential data
    if (!volumeInfo.title) {
      console.log(`[${lookupId}] Google Books returned incomplete data (missing title) for ISBN: ${isbn}`);
      return null;
    }
    
    // Extract ISBN identifiers
    let extractedISBN: string | null = isbn;
    if (volumeInfo.industryIdentifiers?.length > 0) {
      const isbn13 = volumeInfo.industryIdentifiers.find((id: any) => id.type === "ISBN_13");
      if (isbn13) extractedISBN = isbn13.identifier;
    }
    
    // Extract the publication year from the publishedDate
    let publishedYear: number | null = null;
    if (volumeInfo.publishedDate) {
      const dateMatch = volumeInfo.publishedDate.match(/^(\d{4})/);
      if (dateMatch && dateMatch[1]) {
        const year = parseInt(dateMatch[1], 10);
        
        // Apply same year validation logic as Python service
        const currentYear = new Date().getFullYear();
        const maxYear = REFERENCE_YEAR + MAX_FUTURE_YEARS;
        
        if (year <= maxYear) {
          publishedYear = year;
        } else {
          console.log(`[${lookupId}] Ignoring future publication year: ${year} (max allowed: ${maxYear})`);
        }
      }
    }
    
    // Extract categories/genres
    const genres = volumeInfo.categories?.flatMap((category: string) => 
      category.split(/\s*\/\s*/).filter((genre: string) => genre.trim().length > 0)
    ).slice(0, 5) || [];
    
    // Extract statement of responsibility
    const statementOfResponsibility = volumeInfo.authors?.join("; ") || null;
    
    // Format the book data to match our standardized schema
    const formattedBook: Partial<Book> = {
      isbn: extractedISBN,
      title: volumeInfo.title,
      subtitle: volumeInfo.subtitle || null,
      author: volumeInfo.authors?.[0] || (volumeInfo.authors?.join(", ") || "Unknown"),
      statementOfResponsibility: statementOfResponsibility,
      publisher: volumeInfo.publisher || null,
      publishedYear: publishedYear,
      pageCount: volumeInfo.pageCount || null,
      language: volumeInfo.language || language,
      edition: volumeInfo.contentVersion ? `${volumeInfo.contentVersion.split('.')[0] || '1'}. Auflage` : null,
      location: null,
      dimensions: volumeInfo.dimensions?.height ? `${volumeInfo.dimensions.height} cm` : null,
      binding: volumeInfo.printType === "BOOK" ? "Buch" : volumeInfo.printType || null,
      price: bookData.saleInfo?.listPrice ? `${bookData.saleInfo.listPrice.amount} ${bookData.saleInfo.listPrice.currencyCode}` : null,
      summary: volumeInfo.description || null,
      genres: genres.length > 0 ? genres : null,
      coverImageUrl: volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || null
    };
    
    // Log successful result
    console.log(`[${lookupId}] Successfully retrieved book data from Google Books: "${formattedBook.title}" by ${formattedBook.author}`);
    
    // Log the standardized bibliographic data
    console.log(`[${lookupId}] BIBLIOGRAPHIC DATA CHECK from Google Books:`);
    console.log(`- Title: "${formattedBook.title}"`);
    console.log(`- Subtitle: "${formattedBook.subtitle || 'N/A'}"`);
    console.log(`- Main Author: "${formattedBook.author}"`);
    console.log(`- Statement of Responsibility: ${formattedBook.statementOfResponsibility || 'N/A'}`);
    console.log(`- Edition: ${formattedBook.edition || 'N/A'}`);
    console.log(`- Location: ${formattedBook.location || 'N/A'}`);
    console.log(`- Publisher: ${formattedBook.publisher || 'N/A'}`);
    console.log(`- Published Year: ${formattedBook.publishedYear || 'N/A'}`);
    console.log(`- Page Count: ${formattedBook.pageCount || 'N/A'}`);
    console.log(`- Dimensions: ${formattedBook.dimensions || 'N/A'}`);
    console.log(`- ISBN: ${formattedBook.isbn || 'N/A'}`);
    console.log(`- Binding: ${formattedBook.binding || 'N/A'}`);
    console.log(`- Price: ${formattedBook.price || 'N/A'}`);
    console.log(`- Language: ${formattedBook.language || 'N/A'}`);
    console.log(`- Genres: ${formattedBook.genres ? JSON.stringify(formattedBook.genres) : 'None'}`);
    console.log(`- Summary: ${formattedBook.summary ? (formattedBook.summary.substring(0, 50) + '...') : 'N/A'}`);
    
    return formattedBook;
  } catch (error: any) {
    console.error(`Error fetching book for ISBN ${isbn}:`, error);
    apiLogger.logError("Google Books API", {
      error: error.message || String(error),
      operation: "getCompleteBookByISBN",
      isbn
    });
    return null;
  }
}

/**
 * Search for books similar to the provided book
 * Simplified to match Python service approach
 */
export async function searchSimilarBooks(book: Partial<Book>): Promise<any[]> {
  try {
    if (!book.title || !book.author) {
      return [];
    }

    // Create search query based on author and genres
    let query = `inauthor:"${book.author}"`;
    
    // Add genre if available
    if (book.genres && book.genres.length > 0) {
      // Pick the most specific genre (longer genres tend to be more specific)
      const bestGenre = book.genres.sort((a, b) => b.length - a.length)[0];
      query += ` subject:"${bestGenre}"`;
    }
    
    // Execute search
    const books = await searchBooks({ query, maxResults: 10 });
    
    // Filter out the original book and deduplicate
    const filteredBooks = books
      .filter(item => item.volumeInfo?.title.toLowerCase() !== book.title?.toLowerCase())
      .slice(0, 5);
    
    return filteredBooks;
  } catch (error) {
    console.error("Error searching for similar books:", error);
    return [];
  }
}