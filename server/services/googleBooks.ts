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
  } catch (error: any) {
    console.error("Error searching Google Books:", error);
    throw new Error(`Failed to search Google Books: ${error.message || String(error)}`);
  }
}

export async function getBookByISBN(isbn: string): Promise<any | null> {
  try {
    // Store the original ISBN format
    const originalISBN = isbn;
    
    // Clean the ISBN for search by removing hyphens
    const cleanedISBN = isbn.replace(/[^\dX]/gi, '');
    
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
      return result;
    }
    
    return null;
  } catch (error: any) {
    console.error("Error fetching book by ISBN:", error);
    throw new Error(`Failed to fetch book by ISBN: ${error.message || String(error)}`);
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
    
    // Search using multiple strategies
    const searchResults = await tryMultipleSearchStrategies(bookInfo);
    
    if (searchResults.length === 0) {
      console.log(`No Google Books results found for book: "${bookInfo.title}" by "${bookInfo.author}"`);
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
