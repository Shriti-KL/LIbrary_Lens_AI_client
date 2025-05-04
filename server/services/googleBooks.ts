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

// Function to calculate similarity between two strings
function stringSimilarity(str1: string, str2: string): number {
  // Convert both strings to lowercase
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  // If the strings are identical, return 1
  if (s1 === s2) return 1.0;
  
  // If either string is empty, return 0
  if (s1.length === 0 || s2.length === 0) return 0.0;
  
  // Calculate the Levenshtein distance
  const matrix: number[][] = [];
  
  // Initialize the matrix
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill the matrix
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1.charAt(i - 1) === s2.charAt(j - 1) ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  // Calculate similarity from distance
  const distance = matrix[s1.length][s2.length];
  const maxLength = Math.max(s1.length, s2.length);
  
  // Return a similarity score between 0 and 1
  return 1 - distance / maxLength;
}

// Function to try various search strategies
async function tryMultipleSearchStrategies(bookInfo: Partial<Book>): Promise<any[]> {
  let allResults: any[] = [];
  
  // Strategy 1: If ISBN is available, use it for precise matching
  if (bookInfo.isbn) {
    try {
      const isbnResults = await searchBooks({ query: `isbn:${bookInfo.isbn}` });
      if (isbnResults.length > 0) {
        console.log("Found results using ISBN search strategy");
        return isbnResults; // ISBN match is very precise, return immediately
      }
    } catch (error) {
      console.error("Error in ISBN search strategy:", error);
    }
  }
  
  // Strategy 2: Use exact title and author in quotes
  if (bookInfo.title && bookInfo.author) {
    try {
      const exactQuery = `"${bookInfo.title}" "author:${bookInfo.author}"`;
      const exactResults = await searchBooks({ query: exactQuery });
      if (exactResults.length > 0) {
        console.log("Found results using exact title and author search strategy");
        allResults = [...allResults, ...exactResults];
        
        // If we found good results, return them
        if (exactResults.length >= 3) return exactResults;
      }
    } catch (error) {
      console.error("Error in exact title and author search strategy:", error);
    }
  }
  
  // Strategy 3: Try standard intitle + inauthor combination
  if (bookInfo.title && bookInfo.author) {
    try {
      const standardQuery = `intitle:${bookInfo.title} inauthor:${bookInfo.author}`;
      const standardResults = await searchBooks({ query: standardQuery });
      if (standardResults.length > 0) {
        console.log("Found results using standard title and author search strategy");
        allResults = [...allResults, ...standardResults];
        
        // If we found good results, return them
        if (standardResults.length >= 3) return standardResults;
      }
    } catch (error) {
      console.error("Error in standard title and author search strategy:", error);
    }
  }
  
  // Strategy 4: Title only search
  if (bookInfo.title) {
    try {
      const titleQuery = `intitle:${bookInfo.title}`;
      const titleResults = await searchBooks({ query: titleQuery, maxResults: 5 });
      if (titleResults.length > 0) {
        console.log("Found results using title-only search strategy");
        allResults = [...allResults, ...titleResults];
      }
    } catch (error) {
      console.error("Error in title-only search strategy:", error);
    }
  }
  
  // Strategy 5: Author only search (if we still don't have results)
  if (bookInfo.author && allResults.length < 2) {
    try {
      const authorQuery = `inauthor:${bookInfo.author}`;
      const authorResults = await searchBooks({ query: authorQuery, maxResults: 3 });
      if (authorResults.length > 0) {
        console.log("Found results using author-only search strategy");
        allResults = [...allResults, ...authorResults];
      }
    } catch (error) {
      console.error("Error in author-only search strategy:", error);
    }
  }
  
  // Remove duplicates (based on id)
  const uniqueResults = allResults.filter((book, index, self) => 
    index === self.findIndex(b => b.id === book.id)
  );
  
  return uniqueResults;
}

export async function enrichBookMetadata(bookInfo: Partial<Book>): Promise<Partial<Book>> {
  try {
    // Flag to indicate if this was a user submission (should use Google data)
    const isUserSubmission = (bookInfo as any).isUserEntry === true;
    
    console.log(`Enriching book metadata for "${bookInfo.title}" by "${bookInfo.author}". User submission: ${isUserSubmission}`);
    
    // Search using multiple strategies
    const searchResults = await tryMultipleSearchStrategies(bookInfo);
    
    if (searchResults.length === 0) {
      console.log(`No Google Books results found for book: "${bookInfo.title}" by "${bookInfo.author}"`);
      return bookInfo;
    }
    
    // Rank results based on similarity to the input
    let bestMatch = searchResults[0];
    let highestScore = 0;
    
    for (const result of searchResults) {
      const volumeInfo = result.volumeInfo || {};
      const resultTitle = volumeInfo.title || "";
      const resultAuthor = (volumeInfo.authors ? volumeInfo.authors[0] : "") || "";
      
      // Calculate similarity scores
      const titleScore = bookInfo.title ? stringSimilarity(bookInfo.title, resultTitle) : 0;
      const authorScore = bookInfo.author ? stringSimilarity(bookInfo.author, resultAuthor) : 0;
      
      // Weight the scores (title is slightly more important)
      const combinedScore = titleScore * 0.6 + authorScore * 0.4;
      
      // Log for debugging
      console.log(`Match score for "${resultTitle}" by "${resultAuthor}": ${combinedScore.toFixed(2)}`);
      
      if (combinedScore > highestScore) {
        highestScore = combinedScore;
        bestMatch = result;
      }
    }
    
    // Get the best matching result
    const volumeInfo = bestMatch.volumeInfo || {};
    
    console.log(`Best Google Books match: "${volumeInfo.title}" by "${volumeInfo.authors?.[0] || 'Unknown'}" (score: ${highestScore.toFixed(2)})`);
    
    // Create enriched book metadata
    const enrichedBook: Partial<Book> = {
      ...bookInfo,
      // Always prefer Google Books data for title and author if available
      title: volumeInfo.title || bookInfo.title, 
      author: (volumeInfo.authors ? volumeInfo.authors[0] : null) || bookInfo.author,
      publisher: volumeInfo.publisher || bookInfo.publisher,
      publishedYear: (volumeInfo.publishedDate ? parseInt(volumeInfo.publishedDate.substring(0, 4)) : null) || bookInfo.publishedYear,
      pageCount: volumeInfo.pageCount || bookInfo.pageCount,
      isbn: (volumeInfo.industryIdentifiers ? 
        volumeInfo.industryIdentifiers.find((id: any) => id.type === "ISBN_13" || id.type === "ISBN_10")?.identifier : null) || bookInfo.isbn,
      coverImageUrl: (volumeInfo.imageLinks ? volumeInfo.imageLinks.thumbnail : null) || bookInfo.coverImageUrl,
    };
    
    // Log what data was corrected
    if (enrichedBook.title !== bookInfo.title) {
      console.log(`Corrected title from "${bookInfo.title}" to "${enrichedBook.title}"`);
    }
    
    if (enrichedBook.author !== bookInfo.author) {
      console.log(`Corrected author from "${bookInfo.author}" to "${enrichedBook.author}"`);
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
