import { Book, BookWithAnalysisControl } from "@shared/schema";

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

export async function enrichBookMetadata(bookInfo: BookWithAnalysisControl): Promise<BookWithAnalysisControl> {
  try {
    let query = "";
    let searchResults = [];
    
    // Check if this is an ISBN priority search (from manual entry with ISBN)
    const isISBNPriority = ((bookInfo.isbnPriority === true) || (String(bookInfo.isbnPriority) === 'true')) && !!bookInfo.isbn;
    const isISBNOnlySearch = (bookInfo.isISBNOnlySearch === 'true' || bookInfo.isISBNOnlySearch === true) && !!bookInfo.isbn;
    const forceNewResults = !!bookInfo.forceNewAnalysis;
    
    // Log search strategy for debugging
    console.log(`Google Books search strategy:`, {
      strategy: isISBNOnlySearch ? 'ISBN-Only Search' : isISBNPriority ? 'ISBN Priority' : 'Standard Search',
      isbn: bookInfo.isbn || "none", 
      title: bookInfo.title || "none", 
      author: bookInfo.author || "none",
      forceNewResults: forceNewResults,
      isManualSubmission: bookInfo.isManualSubmission,
      timestamp: bookInfo.requestTimestamp || "none"
    });
    
    // Handle ISBN-only or ISBN-priority search
    if (bookInfo.isbn && (isISBNOnlySearch || isISBNPriority || (!bookInfo.title && !bookInfo.author))) {
      console.log(`Performing ISBN search with: ${bookInfo.isbn}`);
      
      // Try to get exact match by ISBN
      const isbnResults = await getBookByISBN(bookInfo.isbn as string);
      
      if (isbnResults) {
        console.log(`ISBN search successful - found book: "${isbnResults.volumeInfo?.title}"`);
        searchResults = [isbnResults];
        
        // For ISBN-only searches, we want to populate all fields from Google Books
        if (isISBNOnlySearch) {
          console.log(`ISBN-only search - prioritizing all Google Books data over any existing data`);
        }
      } else {
        console.log(`No results found for ISBN: ${bookInfo.isbn}`);
      }
    }
    
    // If no ISBN results or not an ISBN-priority search, use standard approach
    if (searchResults.length === 0 && !isISBNPriority) {
      if (bookInfo.isbn) {
        query = `isbn:${bookInfo.isbn}`;
      } else if (bookInfo.title && bookInfo.author) {
        query = `intitle:${bookInfo.title} inauthor:${bookInfo.author}`;
      } else if (bookInfo.title) {
        query = `intitle:${bookInfo.title}`;
      } else {
        // Not enough information to search
        console.log("Not enough information for Google Books search");
        return bookInfo;
      }
      
      console.log(`Performing standard search with query: "${query}"`);
      searchResults = await searchBooks({ query });
      console.log(`Standard search returned ${searchResults.length} results`);
    }
    
    if (searchResults.length === 0) {
      console.log("No Google Books results found with any search method");
      return bookInfo;
    }
    
    // Get the first result
    const googleBook = searchResults[0];
    const volumeInfo = googleBook.volumeInfo || {};
    
    // Create enriched book metadata based on search type
    let enrichedBook: BookWithAnalysisControl;
    
    // For ISBN-only searches, always prioritize Google Books data over existing data
    if (isISBNOnlySearch) {
      enrichedBook = {
        ...bookInfo,
        // Prioritize Google Books data
        title: volumeInfo.title || bookInfo.title || "",
        author: (volumeInfo.authors ? volumeInfo.authors[0] : "") || bookInfo.author || "",
        publisher: volumeInfo.publisher || bookInfo.publisher,
        publishedYear: (volumeInfo.publishedDate ? parseInt(volumeInfo.publishedDate.substring(0, 4)) : null) || bookInfo.publishedYear,
        pageCount: volumeInfo.pageCount || bookInfo.pageCount,
        isbn: bookInfo.isbn, // Always keep the ISBN that was searched
        coverImageUrl: (volumeInfo.imageLinks ? volumeInfo.imageLinks.thumbnail : null) || bookInfo.coverImageUrl,
        
        // Additional metadata might be available but not in our schema
        // We'll extract what we can to help with analysis
        genres: volumeInfo.categories || bookInfo.genres || [],
        
        // Preserve analysis control flags
        isbnPriority: bookInfo.isbnPriority,
        isManualSubmission: bookInfo.isManualSubmission,
        isISBNOnlySearch: bookInfo.isISBNOnlySearch,
        forceNewAnalysis: bookInfo.forceNewAnalysis,
        requestTimestamp: bookInfo.requestTimestamp,
      };
      
      console.log("ISBN-only search result:", {
        title: enrichedBook.title,
        author: enrichedBook.author,
        publisher: enrichedBook.publisher,
        hasCoverImage: !!enrichedBook.coverImageUrl
      });
    } else {
      // Normal approach - preserve user entered data, supplement with Google Books
      enrichedBook = {
        ...bookInfo,
        title: bookInfo.title || volumeInfo.title,
        author: bookInfo.author || (volumeInfo.authors ? volumeInfo.authors[0] : ""),
        publisher: bookInfo.publisher || volumeInfo.publisher,
        publishedYear: bookInfo.publishedYear || (volumeInfo.publishedDate ? parseInt(volumeInfo.publishedDate.substring(0, 4)) : null),
        pageCount: bookInfo.pageCount || volumeInfo.pageCount,
        isbn: bookInfo.isbn || (volumeInfo.industryIdentifiers ? 
          volumeInfo.industryIdentifiers.find((id: any) => id.type === "ISBN_13" || id.type === "ISBN_10")?.identifier : null),
        coverImageUrl: bookInfo.coverImageUrl || (volumeInfo.imageLinks ? volumeInfo.imageLinks.thumbnail : null),
        
        // Preserve analysis control flags
        isbnPriority: bookInfo.isbnPriority,
        isManualSubmission: bookInfo.isManualSubmission,
        isISBNOnlySearch: bookInfo.isISBNOnlySearch,
        forceNewAnalysis: bookInfo.forceNewAnalysis,
        requestTimestamp: bookInfo.requestTimestamp,
      };
    }
    
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
