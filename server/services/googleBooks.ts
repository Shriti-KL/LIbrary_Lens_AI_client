/**
 * Google Books API service
 * This service provides book data from Google Books API
 */

import axios from 'axios';
import { Book } from '@shared/schema';
import { apiLogger } from '../utils/logger';

// Interface for Google Books API search parameters
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
    // Log the request
    apiLogger.logRequest("Google Books API", {
      operation: "searchBooks",
      ...params
    });

    // Build search query
    let searchQuery = '';
    
    if (params.query) {
      searchQuery = params.query;
    } else {
      if (params.title) searchQuery += `intitle:${params.title} `;
      if (params.author) searchQuery += `inauthor:${params.author} `;
      if (params.isbn) searchQuery += `isbn:${params.isbn} `;
    }
    
    searchQuery = searchQuery.trim();
    
    if (!searchQuery) {
      throw new Error('No search parameters provided');
    }
    
    // Set up request URL
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&printType=books`;
    
    // Add API key if available
    const googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY;
    const requestUrl = googleBooksApiKey 
      ? `${url}&key=${googleBooksApiKey}&maxResults=${params.maxResults || 10}`
      : `${url}&maxResults=${params.maxResults || 10}`;
    
    // Make the request
    const response = await axios.get(requestUrl);
    const data = response.data;
    
    // Check if we got any results
    if (!data.items || data.items.length === 0) {
      console.log(`No books found for query: ${searchQuery}`);
      return [];
    }
    
    // Process and map results to a standardized format
    const books = data.items.map((item: any) => {
      const volumeInfo = item.volumeInfo;
      
      // Format ISBN with hyphens if available
      let isbn = '';
      if (volumeInfo.industryIdentifiers) {
        const isbn13 = volumeInfo.industryIdentifiers.find((id: any) => id.type === "ISBN_13");
        const isbn10 = volumeInfo.industryIdentifiers.find((id: any) => id.type === "ISBN_10");
        
        if (isbn13) {
          isbn = isbn13.identifier;
          // Format for ISBN-13 (standard German format)
          isbn = isbn.replace(/^(\d{3})(\d{1})(\d{5})(\d{3})(\d{1})$/, '$1-$2-$3-$4-$5');
        } else if (isbn10) {
          isbn = isbn10.identifier;
          // Format for ISBN-10 (standard German format)
          isbn = isbn.replace(/^(\d{1})(\d{5})(\d{3})(\w{1})$/, '$1-$2-$3-$4');
        }
      }
      
      // Extract publication year without validation
      let publishedYear = null;
      if (volumeInfo.publishedDate) {
        const yearMatch = volumeInfo.publishedDate.match(/^(\d{4})/);
        if (yearMatch) {
          publishedYear = parseInt(yearMatch[1], 10);
        }
      }
      
      return {
        id: item.id,
        title: volumeInfo.title || '',
        subtitle: volumeInfo.subtitle || '',
        author: volumeInfo.authors ? volumeInfo.authors[0] : '',
        authors: volumeInfo.authors || [],
        statementOfResponsibility: volumeInfo.authors ? volumeInfo.authors.join(', ') : '',
        publisher: volumeInfo.publisher || '',
        publishedYear: publishedYear,
        pageCount: volumeInfo.pageCount || null,
        language: volumeInfo.language || '',
        isbn: isbn,
        summary: volumeInfo.description || '',
        genres: volumeInfo.categories || [],
        coverImageUrl: volumeInfo.imageLinks?.thumbnail || null
      };
    });
    
    // Log the response
    apiLogger.logResponse("Google Books API", {
      operation: "searchBooks",
      query: searchQuery,
      resultsCount: books.length,
      success: true
    });
    
    return books;
    
  } catch (error: any) {
    console.error(`Error searching Google Books API: ${error.message}`);
    apiLogger.logError("Google Books API", {
      operation: "searchBooks",
      error: error.message
    });
    return [];
  }
}

/**
 * Get detailed book information by ISBN
 * @param isbn The ISBN to look up
 * @returns Book data or null if not found
 */
export async function getCompleteBookByISBN(isbn: string, language: string = "de"): Promise<Partial<Book> | null> {
  try {
    // Log the request
    apiLogger.logRequest("Google Books API", {
      operation: "getBookByISBN",
      isbn
    });
    
    // Search for the book by ISBN
    const books = await searchBooks({ isbn });
    
    if (books.length === 0) {
      console.log(`No book found with ISBN ${isbn} in Google Books API`);
      return null;
    }
    
    // Use the first result
    const book = books[0];
    
    // Log the response
    apiLogger.logResponse("Google Books API", {
      operation: "getBookByISBN",
      isbn,
      success: true,
      bookTitle: book.title
    });
    
    return book;
  } catch (error: any) {
    console.error(`Error getting book from Google Books API: ${error.message}`);
    apiLogger.logError("Google Books API", {
      operation: "getBookByISBN",
      isbn,
      error: error.message
    });
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
  // Create search terms based on the book's metadata
  const searchTerms = [];
  
  // Use genres as primary search criteria
  if (book.genres && Array.isArray(book.genres) && book.genres.length > 0) {
    // Use up to 2 genres to avoid too narrow results
    const genresToUse = book.genres.slice(0, 2);
    searchTerms.push(...genresToUse);
  }
  
  // Add the author as secondary search criteria
  if (book.author) {
    searchTerms.push(`inauthor:${book.author}`);
  }
  
  // Combine search terms for the query
  const query = searchTerms.join(' ');
  
  if (!query) {
    console.log('Insufficient metadata for similar books search');
    return [];
  }
  
  console.log(`Searching for similar books with query: ${query}`);
  
  // Search for books with the combined query
  const results = await searchBooks({ query, maxResults: 5 });
  
  // Filter out the original book from results
  return results.filter(result => {
    if (book.isbn && result.isbn === book.isbn) return false;
    if (book.title && result.title === book.title && book.author && result.author === book.author) return false;
    return true;
  }).slice(0, 5); // Limit to top 5 results
}