/**
 * Google Books API service
 * This service provides book data from Google Books API
 * following DNB/German RDA cataloguing standards
 */

import axios from "axios";
import { Book } from "@shared/schema";

export interface GoogleBookSearchParams {
  query?: string;
  title?: string;
  author?: string;
  isbn?: string;
  maxResults?: number;
  apiKey?: string;
}

/**
 * Search for books matching the provided parameters
 * @param params - Search parameters (query, title, author, isbn)
 * @returns Array of book results
 */
export async function searchBooks(params: GoogleBookSearchParams): Promise<any[]> {
  try {
    // Build search query
    let query = params.query || "";
    
    if (params.title) {
      query += query ? ` intitle:${params.title}` : `intitle:${params.title}`;
    }
    
    if (params.author) {
      query += query ? ` inauthor:${params.author}` : `inauthor:${params.author}`;
    }
    
    if (params.isbn) {
      query += query ? ` isbn:${params.isbn}` : `isbn:${params.isbn}`;
    }
    
    // Use provided API key or fallback to environment variable
    const apiKey = params.apiKey || process.env.GOOGLE_BOOKS_API_KEY;
    
    if (!apiKey) {
      throw new Error("Google Books API key is required but not provided");
    }
    
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${params.maxResults || 10}&key=${apiKey}`;
    
    const response = await axios.get(url);
    const data = response.data;
    
    if (data.totalItems === 0) {
      console.log("Google Books API: No results found");
      return [];
    }
    
    const books = data.items.map((item: any) => {
      const volumeInfo = item.volumeInfo;
      const identifiers = volumeInfo.industryIdentifiers || [];
      
      // Extract ISBN-13 or ISBN-10
      const isbn13 = identifiers.find((id: any) => id.type === 'ISBN_13')?.identifier;
      const isbn10 = identifiers.find((id: any) => id.type === 'ISBN_10')?.identifier;
      
      // Extract and format book information according to DNB/German RDA standards
      return {
        id: item.id,
        isbn: isbn13 || isbn10 || null,
        title: volumeInfo.title,
        subtitle: volumeInfo.subtitle || null,
        author: volumeInfo.authors ? volumeInfo.authors[0] : null,
        mainAuthor: volumeInfo.authors ? volumeInfo.authors[0] : null,
        additionalAuthors: volumeInfo.authors ? volumeInfo.authors.slice(1) : [],
        authorStatement: volumeInfo.authors ? 
          `by ${volumeInfo.authors.join(', ')}` : null,
        publisher: volumeInfo.publisher || null,
        publicationYear: volumeInfo.publishedDate ? 
          parseInt(volumeInfo.publishedDate.substring(0, 4)) : null,
        publicationPlace: null, // Not provided by Google Books API
        pageCount: volumeInfo.pageCount || null,
        dimensions: null, // Not directly provided by Google Books
        binding: null, // Not directly provided by Google Books
        price: null, // Not provided by Google Books
        edition: volumeInfo.contentVersion || null,
        language: volumeInfo.language || "de",
        summary: volumeInfo.description || null,
        genres: volumeInfo.categories || [],
        coverImageUrl: volumeInfo.imageLinks?.thumbnail || null,
      };
    });
    
    console.log(`Google Books API found ${books.length} results`);
    return books;
  } catch (error: any) {
    console.error("Error in Google Books search:", error);
    throw new Error(`Google Books search failed: ${error.message}`);
  }
}

/**
 * Get detailed book information by ISBN
 * @param isbn The ISBN to look up
 * @returns Book data or null if not found
 */
export async function getCompleteBookByISBN(isbn: string, language: string = "de", apiKey?: string): Promise<Partial<Book> | null> {
  try {
    console.log(`[API] Searching Google Books API for ISBN: ${isbn}`);
    
    // Use provided API key or fallback to environment variable
    const key = apiKey || process.env.GOOGLE_BOOKS_API_KEY;
    
    if (!key) {
      throw new Error("Google Books API key is required but not provided");
    }
    
    // First, try to find exact ISBN match
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${key}`;
    const response = await axios.get(url);
    
    if (response.data.totalItems === 0) {
      console.log(`[API] No exact ISBN match found for ${isbn}`);
      return null;
    }
    
    // Process the first result (most relevant)
    const item = response.data.items[0];
    const volumeInfo = item.volumeInfo;
    const identifiers = volumeInfo.industryIdentifiers || [];
    
    // Format publication date
    let publicationDate = null;
    if (volumeInfo.publishedDate) {
      // Handle different date formats from Google Books API
      const dateStr = volumeInfo.publishedDate;
      if (dateStr.length === 4) {
        publicationDate = `${dateStr}-01-01`; // Year only
      } else if (dateStr.length === 7) {
        publicationDate = `${dateStr}-01`; // Year and month
      } else {
        publicationDate = dateStr; // Full date
      }
    }
    
    // Extract dimensions if available
    let dimensions = null;
    if (volumeInfo.dimensions) {
      const { height, width, thickness } = volumeInfo.dimensions;
      dimensions = [height, width, thickness].filter(Boolean).join(' x ');
    }
    
    // Format book information according to DNB/German RDA standards
    const bookData: Partial<Book> = {
      isbn: isbn,
      title: volumeInfo.title,
      subtitle: volumeInfo.subtitle || null,
      author: volumeInfo.authors ? volumeInfo.authors[0] : null,
      mainAuthor: volumeInfo.authors ? volumeInfo.authors[0] : null,
      additionalAuthors: volumeInfo.authors ? volumeInfo.authors.slice(1) : [],
      authorStatement: volumeInfo.authors ? 
        `by ${volumeInfo.authors.join(', ')}` : null,
      publisher: volumeInfo.publisher || null,
      publicationYear: volumeInfo.publishedDate ? 
        parseInt(volumeInfo.publishedDate.substring(0, 4)) : null,
      publicationDate: publicationDate,
      publicationPlace: null, // Not provided by Google Books API
      pageCount: volumeInfo.pageCount || null,
      dimensions: dimensions,
      binding: null, // Not directly provided by Google Books
      price: null, // Not provided by Google Books
      edition: null, // Not reliably provided
      language: volumeInfo.language || language,
      summary: volumeInfo.description || null,
      genres: volumeInfo.categories || [],
      coverImageUrl: volumeInfo.imageLinks?.thumbnail || 
                    volumeInfo.imageLinks?.smallThumbnail || null,
      preview: volumeInfo.previewLink || null,
      // Additional fields for library context
      verification: {
        status: "verified",
        confidence: 0.9,
        sources: ["Google Books API"],
        message: "Data verified through Google Books API"
      }
    };
    
    console.log(`[API] Successfully retrieved book data for ISBN: ${isbn}`);
    return bookData;
  } catch (error: any) {
    console.error(`[API] Error retrieving book data for ISBN ${isbn}:`, error);
    return {
      isbn: isbn,
      error: `Failed to retrieve book data: ${error.message}`,
      verification: {
        status: "failed",
        confidence: 0,
        sources: [],
        message: `API error: ${error.message}`
      }
    };
  }
}

/**
 * Get basic book information by ISBN (simpler version)
 * @param isbn The ISBN to look up
 * @returns Book data or null if not found
 */
export async function getBookByISBN(isbn: string, apiKey?: string): Promise<any | null> {
  try {
    // Use provided API key or fallback to environment variable
    const key = apiKey || process.env.GOOGLE_BOOKS_API_KEY;
    
    if (!key) {
      throw new Error("Google Books API key is required but not provided");
    }
    
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&key=${key}`;
    const response = await axios.get(url);
    
    if (response.data.totalItems === 0) {
      return null;
    }
    
    return response.data.items[0];
  } catch (error) {
    console.error("Error retrieving book by ISBN:", error);
    return null;
  }
}

/**
 * Search for similar books based on a reference book
 * @param book The reference book
 * @returns Array of similar books
 */
export async function searchSimilarBooks(book: Partial<Book>, apiKey?: string): Promise<any[]> {
  try {
    // Use provided API key or fallback to environment variable
    const key = apiKey || process.env.GOOGLE_BOOKS_API_KEY;
    
    if (!key) {
      throw new Error("Google Books API key is required but not provided");
    }
    
    // Strategy 1: Search by title and author
    if (book.title && book.author) {
      const query = `intitle:${book.title} inauthor:${book.author}`;
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&key=${key}`;
      
      const response = await axios.get(url);
      if (response.data.totalItems > 0) {
        // Filter out the original book by ISBN
        return response.data.items
          .filter((item: any) => {
            if (!book.isbn) return true;
            
            const identifiers = item.volumeInfo.industryIdentifiers || [];
            const bookIsbn = identifiers.find((id: any) => 
              id.type === 'ISBN_13' || id.type === 'ISBN_10'
            )?.identifier;
            
            return bookIsbn !== book.isbn;
          })
          .slice(0, 5);
      }
    }
    
    // Strategy 2: Search by genre/category if available
    if (book.genres && Array.isArray(book.genres) && book.genres.length > 0) {
      const query = `subject:${book.genres[0]}`;
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&key=${key}`;
      
      const response = await axios.get(url);
      if (response.data.totalItems > 0) {
        return response.data.items;
      }
    }
    
    // Strategy 3: Search by publisher if available
    if (book.publisher) {
      const query = `inpublisher:${book.publisher}`;
      const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=5&key=${key}`;
      
      const response = await axios.get(url);
      if (response.data.totalItems > 0) {
        return response.data.items;
      }
    }
    
    // No results found with any strategy
    return [];
  } catch (error) {
    console.error("Error searching for similar books:", error);
    return [];
  }
}