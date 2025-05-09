import { Book } from "@shared/schema";
import { apiLogger } from "../utils/logger";

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

    // Request specific fields to fetch all required data in one call
    // Full list: https://developers.google.com/books/docs/v1/reference/volumes#resource
    const fields = [
      "kind",
      "id",
      "etag",
      "selfLink",
      "volumeInfo/title",
      "volumeInfo/subtitle",
      "volumeInfo/authors",
      "volumeInfo/publisher",
      "volumeInfo/publishedDate",
      "volumeInfo/description",
      "volumeInfo/industryIdentifiers",
      "volumeInfo/pageCount",
      "volumeInfo/dimensions",
      "volumeInfo/printType",
      "volumeInfo/mainCategory",
      "volumeInfo/categories",
      "volumeInfo/averageRating",
      "volumeInfo/ratingsCount",
      "volumeInfo/contentVersion",
      "volumeInfo/imageLinks",
      "volumeInfo/language",
      "volumeInfo/previewLink",
      "volumeInfo/infoLink",
      "volumeInfo/canonicalVolumeLink",
      "saleInfo/listPrice",
      "saleInfo/retailPrice"
    ].join(",");

    // Build API URL
    const url = new URL(GOOGLE_BOOKS_API_URL);
    url.searchParams.append("q", query);
    url.searchParams.append("key", API_KEY);
    url.searchParams.append("fields", `items(${fields}),totalItems,kind`);
    if (params.maxResults) url.searchParams.append("maxResults", params.maxResults.toString());

    // Log the request
    apiLogger.logRequest("Google Books API", {
      endpoint: "volumes",
      url: url.toString().replace(API_KEY, "[REDACTED]"),
      method: "GET",
      params: {
        query,
        maxResults: params.maxResults,
        fields: 'items(...),totalItems,kind'  // Simplified for logging
      }
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
      endpoint: "volumes",
      query,
      status: response.status,
      totalItems: data.totalItems,
      itemCount: data.items?.length || 0
    });
    
    // Log the first item's details if available (for debugging)
    if (data.items && data.items.length > 0) {
      const firstItem = data.items[0];
      const volumeInfo = firstItem.volumeInfo || {};
      
      console.log("Google Books API response details:", {
        id: firstItem.id,
        title: volumeInfo.title,
        subtitle: volumeInfo.subtitle,
        authors: volumeInfo.authors,
        publisher: volumeInfo.publisher,
        publishedDate: volumeInfo.publishedDate,
        language: volumeInfo.language,
        printType: volumeInfo.printType,
        pageCount: volumeInfo.pageCount,
        categories: volumeInfo.categories,
        imageLinks: volumeInfo.imageLinks,
        contentVersion: volumeInfo.contentVersion,
        industryIdentifiers: volumeInfo.industryIdentifiers,
        dimensions: volumeInfo.dimensions,
        // Other relevant fields
        saleInfo: firstItem.saleInfo
      });
      
      // Missing fields for requirements
      const missingFields = [];
      if (!volumeInfo.subtitle) missingFields.push("subtitle");
      if (!volumeInfo.authors || volumeInfo.authors.length === 0) missingFields.push("authors");
      if (!volumeInfo.publisher) missingFields.push("publisher");
      if (!volumeInfo.publishedDate) missingFields.push("publishedDate");
      if (!volumeInfo.pageCount) missingFields.push("pageCount");
      if (!volumeInfo.dimensions) missingFields.push("dimensions");
      if (!volumeInfo.printType) missingFields.push("printType/binding");
      if (!firstItem.saleInfo || !firstItem.saleInfo.listPrice) missingFields.push("price");
      
      if (missingFields.length > 0) {
        console.log("Google Books API missing fields:", missingFields.join(", "));
      }
    }
    
    return data.items || [];
  } catch (error: any) {
    console.error("Error searching Google Books:", error);
    apiLogger.logError("Google Books API", error);
    throw new Error(`Failed to search Google Books: ${error.message || String(error)}`);
  }
}

export async function getBookByISBN(isbn: string): Promise<any | null> {
  try {
    // Store the original ISBN format
    const originalISBN = isbn;
    
    // Clean the ISBN for search by removing hyphens
    const cleanedISBN = isbn.replace(/[^\dX]/gi, '');
    
    // Log the ISBN lookup request
    apiLogger.logRequest("Google Books API", {
      endpoint: "volumes",
      method: "GET",
      operation: "getBookByISBN",
      params: {
        isbn: originalISBN,
        cleanedISBN
      }
    });
    
    // Search using the cleaned ISBN
    const books = await searchBooks({ query: `isbn:${cleanedISBN}` });
    
    if (books.length > 0) {
      // Use the original ISBN format in the result
      const result = books[0];
      if (result.volumeInfo && result.volumeInfo.industryIdentifiers) {
        const isbn13 = result.volumeInfo.industryIdentifiers.find((id: any) => id.type === "ISBN_13");
        const isbn10 = result.volumeInfo.industryIdentifiers.find((id: any) => id.type === "ISBN_10");
        
        if (isbn13 || isbn10) {
          // Check which ISBN type matches our input (regardless of format)
          if (cleanedISBN.length === 13 && isbn13) {
            // Use the original format instead of the API's format
            isbn13.originalFormat = originalISBN;
          } else if (cleanedISBN.length === 10 && isbn10) {
            // Use the original format instead of the API's format
            isbn10.originalFormat = originalISBN;
          }
        }
      }
      
      // Log the result
      apiLogger.logResponse("Google Books API", {
        operation: "getBookByISBN",
        isbn: originalISBN,
        found: true,
        title: result.volumeInfo?.title,
        author: result.volumeInfo?.authors?.[0]
      });
      
      return result;
    }
    
    // Log that no book was found
    apiLogger.logResponse("Google Books API", {
      operation: "getBookByISBN",
      isbn: originalISBN,
      found: false
    });
    
    return null;
  } catch (error: any) {
    console.error("Error fetching book by ISBN:", error);
    apiLogger.logError("Google Books API", {
      operation: "getBookByISBN",
      isbn,
      error: error.message || String(error)
    });
    throw new Error(`Failed to fetch book by ISBN: ${error.message || String(error)}`);
  }
}

/**
 * Get complete book information from Google Books API by ISBN
 * This function formats the response to match the Book schema
 */
export async function getCompleteBookByISBN(isbn: string, language: string = "de"): Promise<Partial<Book> | null> {
  // Create a unique ID for this lookup for logging
  const lookupId = `googlebooks_isbn_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[${lookupId}] Looking up book with ISBN: ${isbn} using Google Books API`);
  
  try {
    // Get the raw book data from Google Books
    const bookData = await getBookByISBN(isbn);
    
    // Return null if no book was found
    if (!bookData || !bookData.volumeInfo) {
      console.log(`[${lookupId}] No book found for ISBN: ${isbn}`);
      return null;
    }
    
    const volumeInfo = bookData.volumeInfo;
    
    // Verify that we have the essential data (title and author)
    if (!volumeInfo.title || !volumeInfo.authors || volumeInfo.authors.length === 0) {
      console.log(`[${lookupId}] Google Books returned incomplete data (missing title or author) for ISBN: ${isbn}`);
      apiLogger.logError("Google Books API", {
        error: "Missing essential fields in Google Books response",
        isbn,
        lookupId,
      });
      return null;
    }
    
    // Extract ISBN identifiers
    let extractedISBN: string | null = isbn;
    if (volumeInfo.industryIdentifiers && volumeInfo.industryIdentifiers.length > 0) {
      // Prefer ISBN-13 if available
      const isbn13 = volumeInfo.industryIdentifiers.find((id: any) => id.type === "ISBN_13");
      const isbn10 = volumeInfo.industryIdentifiers.find((id: any) => id.type === "ISBN_10");
      
      if (isbn13) {
        extractedISBN = isbn13.identifier;
      } else if (isbn10) {
        extractedISBN = isbn10.identifier;
      }
    }
    
    // Extract the publication year from the publishedDate
    let publishedYear: number | null = null;
    if (volumeInfo.publishedDate) {
      const dateMatch = volumeInfo.publishedDate.match(/^(\d{4})/);
      if (dateMatch && dateMatch[1]) {
        publishedYear = parseInt(dateMatch[1], 10);
      }
    }
    
    // Extract categories/genres
    let genres: string[] = [];
    if (volumeInfo.categories && volumeInfo.categories.length > 0) {
      // Some categories might contain multiple genres separated by /
      genres = volumeInfo.categories
        .flatMap((category: string) => category.split(/\s*\/\s*/))
        .filter((genre: string) => genre.trim().length > 0)
        .slice(0, 5); // Limit to 5 genres
    }
    
    // Extract binding type from printType and maturityRating
    let binding = volumeInfo.printType || null;
    if (binding === "BOOK") {
      binding = "Buch"; // Default binding if we only know it's a book
    }
    
    // Format the book data to match our schema
    const formattedBook: Partial<Book> = {
      title: volumeInfo.title,
      subtitle: volumeInfo.subtitle || null,
      author: volumeInfo.authors.join(", "),
      publisher: volumeInfo.publisher || null,
      publishedYear: publishedYear,
      pageCount: volumeInfo.pageCount || null,
      isbn: extractedISBN,
      language: volumeInfo.language || language,
      summary: volumeInfo.description || null,
      genres: genres.length > 0 ? genres : null,
      binding: binding,
      coverImageUrl: volumeInfo.imageLinks?.thumbnail || volumeInfo.imageLinks?.smallThumbnail || null,
      
      // Set default values for other fields
      dimensions: null,
      edition: null,
      location: null,
      price: null,
      translator: null,
      illustrator: null,
      themes: null,
      readingLevel: null,
      catalogNumber: null,
      secondaryClassification: null,
      interestCategory: null,
      idBNumber: null,
    };
    
    // Log successful result
    console.log(`[${lookupId}] Successfully retrieved book data from Google Books: "${formattedBook.title}" by ${formattedBook.author}`);
    apiLogger.logResponse("Google Books API", {
      operation: "getCompleteBookByISBN",
      status: "success",
      title: formattedBook.title,
      author: formattedBook.author,
      isbn,
      lookupId,
    });
    
    // Log the bibliographic data for debugging
    console.log(`[${lookupId}] BIBLIOGRAPHIC DATA CHECK from Google Books:`);
    console.log(`- Title: "${formattedBook.title}"`);
    console.log(`- Author: "${formattedBook.author}"`);
    console.log(`- ISBN: ${formattedBook.isbn}`);
    console.log(`- Page Count: ${formattedBook.pageCount} (type: ${typeof formattedBook.pageCount})`);
    console.log(`- Binding: ${formattedBook.binding}`);
    console.log(`- Publisher: ${formattedBook.publisher}`);
    console.log(`- Published Year: ${formattedBook.publishedYear}`);
    console.log(`- Genres: ${formattedBook.genres && Array.isArray(formattedBook.genres) ? formattedBook.genres.join(", ") : "None"}`);
    
    return formattedBook;
  } catch (error: any) {
    // Handle API request errors
    console.log(`[${lookupId}] Google Books API request failed for ISBN: ${isbn}`);
    apiLogger.logError("Google Books API", {
      error: "Google Books API request failed",
      message: error?.message || String(error),
      lookupId,
    });
    return null;
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
      // Clean the ISBN for search by removing hyphens and other non-alphanumeric characters
      const cleanedISBN = bookInfo.isbn.replace(/[^\dX]/gi, '');
      
      // Store the original format to preserve it
      const originalISBN = bookInfo.isbn;
      
      // Search using the cleaned ISBN
      const isbnResults = await searchBooks({ query: `isbn:${cleanedISBN}` });
      
      if (isbnResults.length > 0) {
        console.log("Found results using ISBN search strategy");
        
        // Add the original ISBN format to the results for later use
        isbnResults.forEach(result => {
          if (result.volumeInfo && result.volumeInfo.industryIdentifiers) {
            result.originalISBNFormat = originalISBN;
          }
        });
        
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
    
    // Log the enrichment request
    apiLogger.logRequest("Google Books API", {
      operation: "enrichBookMetadata",
      bookInfo: {
        title: bookInfo.title,
        author: bookInfo.author,
        isbn: bookInfo.isbn,
        isUserSubmission
      }
    });
    
    // Search using multiple strategies
    const searchResults = await tryMultipleSearchStrategies(bookInfo);
    
    if (searchResults.length === 0) {
      console.log(`No Google Books results found for book: "${bookInfo.title}" by "${bookInfo.author}"`);
      
      // Log the empty result
      apiLogger.logResponse("Google Books API", {
        operation: "enrichBookMetadata",
        bookTitle: bookInfo.title,
        bookAuthor: bookInfo.author,
        resultsFound: 0,
        success: false
      });
      
      return bookInfo;
    }
    
    // Rank results based on similarity to the input and edition information
    let bestMatch = searchResults[0];
    let highestScore = 0;
    let firstEditionMatch = null;
    
    // First pass: identify if any results contain first edition information
    for (const result of searchResults) {
      const volumeInfo = result.volumeInfo || {};
      
      // Check for first edition indicators
      const isFirstEdition = 
        (volumeInfo.subtitle && /(?:1|erste|first|1st)(?:\.|\s+)?\s*(?:aufl(?:age)?|ed(?:ition)?|ausg(?:abe)?)/i.test(volumeInfo.subtitle)) ||
        (volumeInfo.description && /(?:1|erste|first|1st)(?:\.|\s+)?\s*(?:aufl(?:age)?|ed(?:ition)?|ausg(?:abe)?)/i.test(volumeInfo.description));
      
      if (isFirstEdition) {
        firstEditionMatch = result;
        // We might want to break here, but let's continue to log all scores for debugging
      }
    }
    
    // If we found a first edition match and this is a title-only search, prioritize it
    const isTitleOnlySearch = bookInfo.title && !bookInfo.isbn && (!bookInfo.author || bookInfo.author.trim() === '');
    if (firstEditionMatch && isTitleOnlySearch) {
      console.log("First edition match found and prioritized for title-only search");
      bestMatch = firstEditionMatch;
    } 
    // Otherwise use similarity scoring
    else {
      for (const result of searchResults) {
        const volumeInfo = result.volumeInfo || {};
        const resultTitle = volumeInfo.title || "";
        const resultAuthor = (volumeInfo.authors ? volumeInfo.authors[0] : "") || "";
        
        // Calculate similarity scores
        const titleScore = bookInfo.title ? stringSimilarity(bookInfo.title, resultTitle) : 0;
        const authorScore = bookInfo.author ? stringSimilarity(bookInfo.author, resultAuthor) : 0;
        
        // Weight the scores (title is slightly more important)
        const combinedScore = titleScore * 0.6 + authorScore * 0.4;
        
        // Bonus for first editions when present
        const editionBonus = 
          (volumeInfo.subtitle && /(?:1|erste|first|1st)(?:\.|\s+)?\s*(?:aufl(?:age)?|ed(?:ition)?|ausg(?:abe)?)/i.test(volumeInfo.subtitle)) ||
          (volumeInfo.description && /(?:1|erste|first|1st)(?:\.|\s+)?\s*(?:aufl(?:age)?|ed(?:ition)?|ausg(?:abe)?)/i.test(volumeInfo.description))
            ? 0.15  // Add 15% bonus for first editions
            : 0;
        
        const finalScore = combinedScore + editionBonus;
        
        // Log for debugging
        console.log(`Match score for "${resultTitle}" by "${resultAuthor}": ${finalScore.toFixed(2)}${editionBonus > 0 ? ' (first edition bonus applied)' : ''}`);
        
        if (finalScore > highestScore) {
          highestScore = finalScore;
          bestMatch = result;
        }
      }
    }
    
    // Get the best matching result
    const volumeInfo = bestMatch.volumeInfo || {};
    
    console.log(`Best Google Books match: "${volumeInfo.title}" by "${volumeInfo.authors?.[0] || 'Unknown'}" (score: ${highestScore.toFixed(2)})`);
    
    // Parse dimensions from physical description if available
    let extractedDimensions = null;
    let extractedBinding = null;
    let extractedSeries = null;
    let extractedLocation = null;
    
    // Extract dimensions and binding from description if available
    if (volumeInfo.description) {
      // Look for dimension patterns like "24 x 15 cm" or "15cm x 24cm" or similar
      const dimensionsRegex = /(\d+(?:[,.]\d+)?)\s*(?:x|×)\s*(\d+(?:[,.]\d+)?)\s*(?:cm|mm)/i;
      const dimensionsMatch = volumeInfo.description.match(dimensionsRegex);
      if (dimensionsMatch) {
        extractedDimensions = `${dimensionsMatch[1]} x ${dimensionsMatch[2]} cm`;
      }
      
      // Look for binding information
      const bindingRegex = /(hardcover|hardbound|hardback|paperback|taschenbuch|gebunden|broschiert|festeinband)/i;
      const bindingMatch = volumeInfo.description.match(bindingRegex);
      if (bindingMatch) {
        extractedBinding = bindingMatch[1];
        // Capitalize first letter
        extractedBinding = extractedBinding.charAt(0).toUpperCase() + extractedBinding.slice(1);
      }
      
      // Look for series information
      const seriesRegex = /(series|serie|reihe):\s*([^.,;:]+)/i;
      const seriesMatch = volumeInfo.description.match(seriesRegex);
      if (seriesMatch) {
        extractedSeries = seriesMatch[2].trim();
      }
    }
    
    // Parse location from publisher info
    if (volumeInfo.publisher) {
      // Some publishers include location like "Berlin: Springer" or "Springer, Berlin"
      const locationRegex = /^([A-Z][a-zA-Z\s]+):\s*|,\s*([A-Z][a-zA-Z\s]+)$/;
      const locationMatch = volumeInfo.publisher.match(locationRegex);
      if (locationMatch) {
        extractedLocation = (locationMatch[1] || locationMatch[2]).trim();
        // Remove the location from the publisher name
        const cleanedPublisher = volumeInfo.publisher.replace(locationRegex, '').trim();
        volumeInfo.publisher = cleanedPublisher;
      }
    }
    
    // Extract edition information from subtitle or volumeInfo
    let extractedEdition = null;
    if (volumeInfo.subtitle) {
      const editionRegex = /(\d+(?:st|nd|rd|th)|erste[rnms]?|zweite[rnms]?|dritte[rnms]?)\s*(?:aufl(?:age)?|ausg(?:abe)?|ed(?:ition)?)/i;
      const editionMatch = volumeInfo.subtitle.match(editionRegex);
      if (editionMatch) {
        extractedEdition = editionMatch[0];
      }
    }
    
    // Extract any contributors/illustrators from volumeInfo
    const extractedContributors = [];
    
    // First, check if we have the primary author
    if (volumeInfo.authors && volumeInfo.authors.length > 0) {
      // Add co-authors
      if (volumeInfo.authors.length > 1) {
        for (let i = 1; i < volumeInfo.authors.length; i++) {
          extractedContributors.push({
            role: "co-author",
            name: volumeInfo.authors[i]
          });
        }
      }
    }
    
    // Check for illustrators in contributors if provided by the API
    if (volumeInfo.contributors) {
      for (const contributor of volumeInfo.contributors) {
        if (contributor.role && contributor.name) {
          extractedContributors.push({
            role: contributor.role.toLowerCase(),
            name: contributor.name
          });
        }
      }
    }
    
    // Also check description for illustrator mentions
    if (volumeInfo.description) {
      const illustratorRegex = /illustr(?:ation(?:en)?|\.)\s+(?:von|by)\s+([^.,;:]+)/i;
      const illustratorMatch = volumeInfo.description.match(illustratorRegex);
      if (illustratorMatch) {
        const illustratorName = illustratorMatch[1].trim();
        // Check if this illustrator is already in the list
        const hasIllustrator = extractedContributors.some(c => 
          c.role === 'illustrator' && c.name === illustratorName
        );
        
        if (!hasIllustrator) {
          extractedContributors.push({
            role: 'illustrator',
            name: illustratorName
          });
        }
      }
    }
    
    // Create enriched book metadata
    const enrichedBook: Partial<Book> = {
      ...bookInfo,
      // Always prefer Google Books data for title and author if available
      title: volumeInfo.title || bookInfo.title, 
      author: (volumeInfo.authors ? volumeInfo.authors[0] : null) || bookInfo.author,
      publisher: volumeInfo.publisher || bookInfo.publisher,
      publishedYear: (volumeInfo.publishedDate ? parseInt(volumeInfo.publishedDate.substring(0, 4)) : null) || bookInfo.publishedYear,
      // Only use Google Books pageCount if it's actually present
      pageCount: volumeInfo.pageCount ? volumeInfo.pageCount : bookInfo.pageCount,
      coverImageUrl: (volumeInfo.imageLinks ? volumeInfo.imageLinks.thumbnail : null) || bookInfo.coverImageUrl,
      
      // Extract additional bibliographic details, including our newly extracted ones
      dimensions: bookInfo.dimensions || extractedDimensions || volumeInfo.dimensions,
      edition: bookInfo.edition || extractedEdition || (volumeInfo.contentVersion ? `${volumeInfo.contentVersion} Edition` : null),
      binding: bookInfo.binding || extractedBinding,
      series: bookInfo.series || extractedSeries,
      location: bookInfo.location || extractedLocation,
      language: volumeInfo.language || bookInfo.language || "de",
      
      // Add extracted contributors
      ...(extractedContributors.length > 0 ? {
        contributors: [...(Array.isArray(bookInfo.contributors) ? bookInfo.contributors : []), ...extractedContributors]
      } : bookInfo.contributors ? { contributors: bookInfo.contributors } : {}),
      
      // Merge the metadata object
      metadata: {
        ...(bookInfo.metadata || {}),
        ...(volumeInfo.categories ? { categories: volumeInfo.categories } : {}),
        ...(volumeInfo.averageRating ? { averageRating: volumeInfo.averageRating } : {}),
        ...(volumeInfo.ratingsCount ? { ratingsCount: volumeInfo.ratingsCount } : {}),
        ...(volumeInfo.printType ? { printType: volumeInfo.printType } : {}),
        ...(volumeInfo.maturityRating ? { maturityRating: volumeInfo.maturityRating } : {})
      }
    };
    
    // Special handling for ISBN to preserve user-entered format when possible
    if (bookInfo.isbn) {
      // Keep the original ISBN if it already exists and is valid
      enrichedBook.isbn = bookInfo.isbn;
    } else if (volumeInfo.industryIdentifiers) {
      // Otherwise, get the ISBN from Google Books
      const isbn13 = volumeInfo.industryIdentifiers.find((id: any) => id.type === "ISBN_13");
      const isbn10 = volumeInfo.industryIdentifiers.find((id: any) => id.type === "ISBN_10");
      
      // Prefer ISBN-13 over ISBN-10
      enrichedBook.isbn = (isbn13 ? isbn13.identifier : null) || 
                           (isbn10 ? isbn10.identifier : null);
    }
    
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
