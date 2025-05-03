import { Book } from "@shared/schema";

// Google Books API endpoint
const GOOGLE_BOOKS_API_URL = "https://www.googleapis.com/books/v1/volumes";
const API_KEY = process.env.GOOGLE_BOOKS_API_KEY || "";

export interface GoogleBookSearchParams {
  query: string;
  title?: string;
  author?: string;
  isbn?: string;
  maxResults?: number;
}

export async function searchBooks(params: GoogleBookSearchParams): Promise<any[]> {
  try {
    // Build query string
    let query = params.query;
    if (params.title) query += `+intitle:${encodeURIComponent(params.title)}`;
    if (params.author) query += `+inauthor:${encodeURIComponent(params.author)}`;
    if (params.isbn) query += `+isbn:${encodeURIComponent(params.isbn)}`;

    // Build API URL
    const url = new URL(GOOGLE_BOOKS_API_URL);
    url.searchParams.append("q", query);
    url.searchParams.append("key", API_KEY);
    if (params.maxResults) url.searchParams.append("maxResults", params.maxResults.toString());

    // Make the request
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error("Error searching Google Books:", error);
    throw new Error(`Failed to search Google Books: ${error.message}`);
  }
}

export async function getBookByISBN(isbn: string): Promise<any | null> {
  try {
    const books = await searchBooks({ query: `isbn:${isbn}` });
    return books.length > 0 ? books[0] : null;
  } catch (error) {
    console.error("Error fetching book by ISBN:", error);
    throw new Error(`Failed to fetch book by ISBN: ${error.message}`);
  }
}

export async function searchSimilarBooks(book: Partial<Book>): Promise<any[]> {
  try {
    // Start with author search if available
    if (book.author) {
      const authorBooks = await searchBooks({
        query: `inauthor:${book.author}`,
        author: book.author,
        maxResults: 4
      });
      
      // If we have enough books by the same author, return them
      if (authorBooks.length >= 3) {
        return authorBooks
          .filter(b => b.volumeInfo?.title !== book.title) // Filter out the original book
          .slice(0, 4); // Limit to 4 results
      }
    }
    
    // If no author or not enough author books, search by genres/categories
    if (book.genres && Array.isArray(book.genres) && book.genres.length > 0) {
      const genreQuery = (book.genres as string[]).slice(0, 2).join(" ");
      const genreBooks = await searchBooks({
        query: genreQuery,
        maxResults: 4
      });
      
      return genreBooks.slice(0, 4);
    }
    
    // If all else fails, just search by title
    if (book.title) {
      const titleBooks = await searchBooks({
        query: book.title,
        maxResults: 4
      });
      
      return titleBooks
        .filter(b => b.volumeInfo?.title !== book.title) // Filter out the original book
        .slice(0, 4); 
    }
    
    return [];
  } catch (error) {
    console.error("Error searching similar books:", error);
    return []; // Return empty array on error rather than failing
  }
}

export async function enrichBookMetadata(bookInfo: Partial<Book>): Promise<Partial<Book>> {
  try {
    let query = "";
    
    if (bookInfo.isbn) {
      // If ISBN is available, use it for precise matching
      query = `isbn:${bookInfo.isbn}`;
    } else if (bookInfo.title && bookInfo.author) {
      // Otherwise use title and author
      query = `intitle:${bookInfo.title} inauthor:${bookInfo.author}`;
    } else if (bookInfo.title) {
      // Fall back to just title
      query = `intitle:${bookInfo.title}`;
    } else {
      // Not enough information to search
      return bookInfo;
    }
    
    const searchResults = await searchBooks({ query });
    
    if (searchResults.length === 0) {
      return bookInfo;
    }
    
    // Get the first result
    const googleBook = searchResults[0];
    const volumeInfo = googleBook.volumeInfo || {};
    
    // Determine if we should trust the Google API data over user-entered data
    // We'll check for a good match by comparing the title similarity
    const isTitleMatch = !bookInfo.title || !volumeInfo.title 
      ? false
      : (
        // Simple similarity check - if titles share core words or are close enough
        volumeInfo.title.toLowerCase().includes(bookInfo.title.toLowerCase()) ||
        bookInfo.title.toLowerCase().includes(volumeInfo.title.toLowerCase()) ||
        // Similar enough titles (at least half the words match)
        bookInfo.title.toLowerCase().split(/\s+/)
          .filter(word => volumeInfo.title.toLowerCase().includes(word)).length >= 
            bookInfo.title.toLowerCase().split(/\s+/).length / 2
      );
    
    // If we have a title match and this isn't a manual correction, prefer Google's data
    const isUserManualEntered = bookInfo.isUserEntry === true;
    const shouldUseGoogleData = isTitleMatch && !isUserManualEntered;
    
    console.log(`Title match: ${isTitleMatch}, Using Google data: ${shouldUseGoogleData}`);
    
    // Create enriched book metadata
    const enrichedBook: Partial<Book> = {
      ...bookInfo,
      // Always prefer Google data for proper capitalization/spelling if it's a match
      title: shouldUseGoogleData && volumeInfo.title ? volumeInfo.title : bookInfo.title,
      author: shouldUseGoogleData && volumeInfo.authors ? volumeInfo.authors[0] : bookInfo.author,
      // For the rest of the fields, prefer Google data if missing from user data
      publisher: bookInfo.publisher || volumeInfo.publisher,
      publishedYear: bookInfo.publishedYear || (volumeInfo.publishedDate ? parseInt(volumeInfo.publishedDate.substring(0, 4)) : null),
      pageCount: bookInfo.pageCount || volumeInfo.pageCount,
      isbn: bookInfo.isbn || (volumeInfo.industryIdentifiers ? 
        volumeInfo.industryIdentifiers.find((id: any) => id.type === "ISBN_13" || id.type === "ISBN_10")?.identifier : null),
      coverImageUrl: bookInfo.coverImageUrl || (volumeInfo.imageLinks ? volumeInfo.imageLinks.thumbnail : null),
    };
    
    // Find similar books
    const similarBooks = await searchSimilarBooks(enrichedBook);
    if (similarBooks.length > 0) {
      enrichedBook.similarBooks = similarBooks.map((book: any) => ({
        title: book.volumeInfo?.title,
        author: book.volumeInfo?.authors ? book.volumeInfo.authors[0] : "Unknown",
        coverImageUrl: book.volumeInfo?.imageLinks?.thumbnail || "",
      }));
    }
    
    return enrichedBook;
  } catch (error) {
    console.error("Error enriching book metadata:", error);
    return bookInfo; // Return original book info on error
  }
}
