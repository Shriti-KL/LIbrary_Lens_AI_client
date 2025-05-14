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
    
    const maxResults = params.maxResults || 10;
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}`;
    
    // Log the request
    console.log(`Google Books API request: ${url}`);
    
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
        title: volumeInfo.title || null,
        subtitle: volumeInfo.subtitle || null,
        mainAuthor: volumeInfo.authors ? volumeInfo.authors[0] : null,
        statementOfResponsibility: volumeInfo.authors ? 
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
export async function getCompleteBookByISBN(isbn: string, language: string = "de"): Promise<Partial<Book> | null> {
  try {
    // Clean the ISBN
    const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');
    
    // Log the request
    console.log(`Google Books API ISBN lookup: ${cleanIsbn}`);
    
    const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`;
    const response = await axios.get(url);
    const data = response.data;
    
    if (data.totalItems === 0) {
      console.log(`Google Books API: No book found with ISBN ${cleanIsbn}`);
      return null;
    }
    
    const item = data.items[0];
    const volumeInfo = item.volumeInfo;
    const saleInfo = item.saleInfo || {};
    
    // Extract ISBN-13 or ISBN-10
    const identifiers = volumeInfo.industryIdentifiers || [];
    const isbn13 = identifiers.find((id: any) => id.type === 'ISBN_13')?.identifier;
    const isbn10 = identifiers.find((id: any) => id.type === 'ISBN_10')?.identifier;
    
    // Extract authors
    const authors = volumeInfo.authors || [];
    const mainAuthor = authors.length > 0 ? authors[0] : null;
    
    // Format statement of responsibility
    const statementOfResponsibility = authors.length > 0 ? 
      `by ${authors.join(', ')}` : null;
    
    // Parse publication year from date
    const publicationYear = volumeInfo.publishedDate ? 
      parseInt(volumeInfo.publishedDate.substring(0, 4)) : null;
    
    // Format according to DNB/German RDA cataloguing standards
    const book: Partial<Book> = {
      id: item.id,
      isbn: isbn13 || isbn10 || cleanIsbn,
      title: volumeInfo.title || null,
      subtitle: volumeInfo.subtitle || null,
      mainAuthor: mainAuthor,
      statementOfResponsibility: statementOfResponsibility,
      publisher: volumeInfo.publisher || null,
      publicationYear: publicationYear,
      publicationPlace: null, // Not provided by Google Books API
      pageCount: volumeInfo.pageCount || null,
      dimensions: null, // Not directly provided
      binding: null, // Not directly provided
      price: saleInfo.listPrice ? 
        `${saleInfo.listPrice.amount} ${saleInfo.listPrice.currencyCode}` : null,
      edition: volumeInfo.contentVersion || null,
      language: volumeInfo.language || language,
      summary: volumeInfo.description || null,
      genres: volumeInfo.categories || [],
      coverImageUrl: volumeInfo.imageLinks?.thumbnail || null,
    };
    
    // Log success
    console.log(`Google Books API response: ${JSON.stringify({
      operation: "getBookByISBN",
      isbn: cleanIsbn,
      success: true,
      bookTitle: book.title
    })}`);
    
    return book;
  } catch (error) {
    console.error("Error in Google Books ISBN lookup:", error);
    return null;
  }
}

/**
 * Get basic book information by ISBN (for direct lookup)
 * @param isbn The ISBN to look up
 * @returns Basic book data or null if not found
 */
export async function getBookByISBN(isbn: string): Promise<any | null> {
  return getCompleteBookByISBN(isbn);
}

/**
 * Search for similar books based on a reference book
 * @param book The reference book
 * @returns Array of similar books
 */
export async function searchSimilarBooks(book: Partial<Book>): Promise<any[]> {
  // Build search query from book data
  const params: GoogleBookSearchParams = {
    maxResults: 5
  };
  
  // Add search terms if available
  if (book.title) {
    params.title = book.title;
  }
  
  if (book.mainAuthor) {
    params.author = book.mainAuthor;
  } else if (book.author) {
    params.author = book.author;
  }
  
  // Perform search
  return searchBooks(params);
}