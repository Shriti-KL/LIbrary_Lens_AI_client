/**
 * Verification Service
 * 
 * This service implements the verification logic for book data across multiple sources.
 * Follows the DNB/German RDA cataloguing standards and Python implementation
 */

import { Book, BookAnalysisRequest } from "@shared/schema";
import { getCompleteBookByISBN } from "./googleBooks";
import { lookupBookByIsbn } from "./pythonIsbnService";
import { searchGoodreads, searchGoogleBooks } from "./googleCustomSearch";
import { processBookAnalysis } from "./openai";

// Interface for API keys passed from session
export interface ApiKeys {
  openai_api_key?: string;
  google_books_api_key?: string;
  google_cse_key?: string;
  google_cse_id?: string;
}

/**
 * Merge metadata from different sources, prioritizing Google Books data
 * but filling in missing fields from DNB and other sources
 */
function mergeMetadata(googleData: Partial<Book>, dnbData: Partial<Book>): Partial<Book> {
  console.log("=== GOOGLE BOOKS DATA ===");
  console.log(JSON.stringify(googleData, null, 2));
  
  // Create a new object to avoid modifying the original
  const merged = { ...googleData };
  
  // Map standard fields for consistency
  if (googleData.author && !googleData.mainAuthor) {
    merged.mainAuthor = googleData.author;
  }
  
  if (googleData.location && !googleData.publicationPlace) {
    merged.publicationPlace = googleData.location;
  }
  
  // Only merge DNB data if it exists
  if (!dnbData || Object.keys(dnbData).length === 0) {
    return merged;
  }
  
  console.log("=== DNB DATA ===");
  console.log(JSON.stringify(dnbData, null, 2));
  
  // Loop through DNB data and fill in missing fields or override Google Books data
  // According to the priority rules established (DNB trumps for bibliographic data)
  for (const key in dnbData) {
    if (Object.prototype.hasOwnProperty.call(dnbData, key)) {
      // Skip if DNB data for this field is null, undefined, or empty
      const dnbValue = dnbData[key as keyof typeof dnbData];
      if (dnbValue === null || dnbValue === undefined) {
        continue;
      }
      
      // Skip empty arrays and strings
      if (
        (Array.isArray(dnbValue) && dnbValue.length === 0) ||
        (typeof dnbValue === 'string' && dnbValue.trim() === '')
      ) {
        continue;
      }
      
      // Special handling for genres - merge them instead of replacing if both exist
      if (key === 'genres') {
        if (Array.isArray(dnbData.genres) && dnbData.genres.length > 0) {
          if (!Array.isArray(merged.genres) || merged.genres.length === 0) {
            merged.genres = dnbData.genres;
          } else {
            // Merge genres without duplicates
            const existingGenres = new Set(merged.genres);
            dnbData.genres.forEach(genre => existingGenres.add(genre));
            merged.genres = Array.from(existingGenres);
          }
        }
        continue;
      }
      
      // Handle nested objects (like statement of responsibility or verification)
      if (typeof dnbData[key as keyof typeof dnbData] === 'object' && 
          !Array.isArray(dnbData[key as keyof typeof dnbData])) {
        merged[key as keyof typeof merged] = {
          ...(merged[key as keyof typeof merged] as object || {}),
          ...(dnbData[key as keyof typeof dnbData] as object)
        };
      } else {
        // DNB data takes precedence for bibliographic fields if available
        // This is because DNB follows the DNB/German RDA cataloguing standards
        const dnbPriorityFields = [
          'title', 'subtitle', 'edition', 'editionStatement',
          'authorStatement', 'publicationYear', 'publicationPlace',
          'pageCount', 'dimensions', 'binding', 'price'
        ];
        
        if (dnbPriorityFields.includes(key) || !merged[key as keyof typeof merged]) {
          merged[key as keyof typeof merged] = dnbData[key as keyof typeof dnbData];
        }
      }
    }
  }
  
  // Apply additional mapping for consistency
  if (merged.author && !merged.mainAuthor) {
    merged.mainAuthor = merged.author;
  }
  
  return merged;
}

/**
 * Verify a book using ISBN
 */
export async function verifyBookByIsbn(isbn: string, apiKeys?: ApiKeys): Promise<Partial<Book>> {
  // Clean and normalize ISBN
  const cleanIsbn = isbn.replace(/[^0-9X]/gi, '');
  return verifyBookData(cleanIsbn, apiKeys);
}

/**
 * Verify book data across multiple sources following Python implementation
 * and DNB/German RDA cataloguing standards
 */
export async function verifyBookData(isbn: string, apiKeys?: ApiKeys): Promise<Partial<Book>> {
  const requestId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[verify_${requestId}] Starting verification for ISBN: ${isbn}`);
  
  try {
    // Step 1: Get data from Google Books
    console.log(`[verify_${requestId}] Step 1: Getting data from Google Books API`);
    const googleBooksData = await getCompleteBookByISBN(isbn, 'de', apiKeys?.google_books_api_key);
    
    if (!googleBooksData || !googleBooksData.title) {
      console.log(`[verify_${requestId}] Error: No data found in Google Books`);
      return {
        verification: {
          status: "error",
          confidence: 0,
          message: "No data found in Google Books",
          sources: []
        }
      };
    }
    
    // Step 2: Get DNB metadata
    console.log(`[verify_${requestId}] Step 2: Getting metadata from DNB`);
    const dnbData = await lookupBookByIsbn(isbn);
    
    // Step 3: Merge Google Books and DNB data
    console.log(`[verify_${requestId}] Step 3: Merging Google Books and DNB data`);
    const mergedData = mergeMetadata(googleBooksData, dnbData || {});
    
    // Add sources information
    const sources = [];
    if (googleBooksData) sources.push("Google Books");
    if (dnbData) sources.push("DNB");
    
    // Format the data to match DNB/German RDA cataloguing standards
    // Map old fields to new ones if they exist
    if (mergedData.location && !mergedData.publicationPlace) {
      mergedData.publicationPlace = mergedData.location;
      delete mergedData.location;
    }
    
    if (mergedData.publishedYear && !mergedData.publicationYear) {
      mergedData.publicationYear = mergedData.publishedYear;
      delete mergedData.publishedYear;
    }
    
    if (mergedData.author && !mergedData.mainAuthor) {
      mergedData.mainAuthor = mergedData.author;
    }
    
    // Step 4: Validate with Google Custom Search and fill missing data
    console.log(`[verify_${requestId}] Step 4: Getting additional data from Google Custom Search`);
    const searchQuery = `${mergedData.title} ${mergedData.mainAuthor || mergedData.author || ""}`;
    let googleSearchResults = [];
    
    try {
      googleSearchResults = await searchGoogleBooks(
        searchQuery, 
        apiKeys?.google_cse_key, 
        apiKeys?.google_cse_id
      );
      
      if (googleSearchResults && googleSearchResults.length > 0) {
        console.log(`[verify_${requestId}] Google Search found ${googleSearchResults.length} results`);
        console.log("=== GOOGLE CUSTOM SEARCH RESULTS ===");
        console.log(JSON.stringify(googleSearchResults.slice(0, 2), null, 2)); // Log just the first two for brevity
        
        sources.push("Google Search");
        
        // Use Google Custom Search data to fill in missing fields
        // Since this is a lower quality source, only use it if fields are missing
        if (googleSearchResults[0]) {
          const gcsResult = googleSearchResults[0];
          
          // Extract information from snippet or title if needed
          // This is a simple implementation - we're just checking a few key fields as examples
          if (!mergedData.subtitle && gcsResult.title && gcsResult.title.includes(':')) {
            const parts = gcsResult.title.split(':');
            if (parts.length > 1 && parts[0].trim().toLowerCase() === mergedData.title?.toLowerCase()) {
              mergedData.subtitle = parts[1].trim();
              console.log(`[verify_${requestId}] Added subtitle from Google CSE: ${mergedData.subtitle}`);
            }
          }
          
          // More fields could be added here based on your needs
        }
      } else {
        console.log(`[verify_${requestId}] Google Search found no results`);
      }
    } catch (error: any) {
      console.log(`[verify_${requestId}] Error in Google Search: ${error.message || error}`);
      // Skip this step if Google CSE fails
    }
    
    // Step 5: Get Goodreads data for additional validation and missing fields
    console.log(`[verify_${requestId}] Step 5: Getting Goodreads data for validation and missing fields`);
    let goodreadsData: any = null;
    let dataMatches = true;
    
    try {
      goodreadsData = await searchGoodreads(
        mergedData.title || "", 
        mergedData.mainAuthor || mergedData.author || "",
        apiKeys?.google_cse_key,
        apiKeys?.google_cse_id
      );
      
      // Check if Goodreads data has an error field
      if (goodreadsData && !goodreadsData.error) {
        console.log(`[verify_${requestId}] Goodreads search successful`);
        console.log("=== GOODREADS DATA ===");
        console.log(JSON.stringify(goodreadsData, null, 2));
        
        sources.push("Goodreads");
        
        // Compare basic metadata for verification
        // This helps detect if we've got the right book across sources
        if (goodreadsData.title && mergedData.title) {
          // Use edit distance or another method to fuzzy match titles
          // For simplicity, we're doing a basic check here
          const cleanTitle1 = goodreadsData.title.toLowerCase().replace(/[^\w\s]/g, '');
          const cleanTitle2 = mergedData.title.toLowerCase().replace(/[^\w\s]/g, '');
          
          // If the titles aren't similar, we might have the wrong book
          if (!cleanTitle2.includes(cleanTitle1) && !cleanTitle1.includes(cleanTitle2)) {
            console.log(`[verify_${requestId}] Warning: Goodreads title doesn't match: "${goodreadsData.title}" vs "${mergedData.title}"`);
            dataMatches = false;
          }
        }
        
        // If data matches, use Goodreads to fill in missing fields
        if (dataMatches) {
          // Use Goodreads rating if available
          if (goodreadsData.rating && !mergedData.rating) {
            mergedData.rating = goodreadsData.rating;
          }
          
          // Add Goodreads link for reference
          if (goodreadsData.url) {
            mergedData.goodreadsUrl = goodreadsData.url;
          }
        }
      } else {
        console.log(`[verify_${requestId}] Goodreads search error: ${goodreadsData?.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.log(`[verify_${requestId}] Error in Goodreads search: ${error.message || error}`);
      // Skip this step if Goodreads search fails
    }
    
    // Step 6: Get additional book details from OpenAI
    console.log(`[verify_${requestId}] Step 6: Getting additional details from OpenAI if needed`);
    
    try {
      // Only use OpenAI for analysis if we have sufficient authentic metadata
      if (sources.length >= 2) {
        // Create a request that contains the verified data
        const openAiRequest = {
          language: mergedData.language || "de",
          isbn: isbn,
          title: mergedData.title,
          subtitle: mergedData.subtitle,
          mainAuthor: mergedData.mainAuthor,
          description: mergedData.description,
          // Ensure genres is properly typed
          genres: Array.isArray(mergedData.genres) ? mergedData.genres : []
        } as BookAnalysisRequest;
        
        // Process with OpenAI (only for summary and review, not metadata)
        // OpenAI will use the authentic metadata we've already gathered
        const openAiResult = await processBookAnalysis(openAiRequest, apiKeys?.openai_api_key);
        
        // Merge in the OpenAI-generated fields (summary, review)
        mergedData.summary = openAiResult.summary;
        mergedData.review = openAiResult.review;
        
        sources.push("OpenAI");
        
        // Set verification status based on number of authentic data sources
        mergedData.verification = {
          status: "verified",
          confidence: sources.length > 2 ? 0.9 : 0.7,
          message: "Book information verified across authentic sources",
          sources
        };
      } else {
        mergedData.verification = {
          status: "unverified",
          confidence: 0.5,
          message: "Insufficient authentic data sources for verification",
          sources
        };
      }
    } catch (error: any) {
      console.log(`[verify_${requestId}] Error getting additional details from OpenAI: ${error.message || error}`);
      
      // If OpenAI fails, still verify if we have reliable data sources
      if (sources.includes("Google Books") || sources.includes("DNB")) {
        mergedData.verification = {
          status: "verified",
          confidence: 0.7,
          message: "Book information verified with authentic data sources",
          sources
        };
      } else {
        mergedData.verification = {
          status: "unverified",
          confidence: 0.5,
          message: "Insufficient authentic data sources for verification",
          sources
        };
      }
    }
    
    console.log(`[verify_${requestId}] Verification complete with sources: ${sources.join(", ")}`);
    return mergedData;
  } catch (error: any) {
    console.error(`[verify_${requestId}] Error in book verification:`, error);
    
    return {
      isbn: isbn,
      error: `Verification failed: ${error.message || error}`,
      verification: {
        status: "failed",
        confidence: 0,
        message: `Failed to verify book: ${error.message || error}`,
        sources: []
      }
    };
  }
}

/**
 * Advanced book verification specifically using title and author
 * Returns verified book information or null if not found
 */
export async function verifyBookByTitleAndAuthor(
  title: string, 
  author: string, 
  apiKeys?: ApiKeys
): Promise<Partial<Book> | null> {
  if (!title) {
    return {
      error: "Title is required for verification",
      verification: {
        status: "failed",
        confidence: 0,
        message: "Title is required for verification",
        sources: []
      }
    };
  }
  
  const requestId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  console.log(`[verify_title_${requestId}] Starting verification for title: "${title}" by ${author || "unknown author"}`);
  
  try {
    // Step 1: Try to find book via Google Custom Search
    console.log(`[verify_title_${requestId}] Step 1: Searching with Google Custom Search`);
    const searchQuery = `${title} ${author || ""} book isbn`;
    
    const googleSearchResults = await searchGoogleBooks(
      searchQuery,
      apiKeys?.google_cse_key,
      apiKeys?.google_cse_id
    );
    
    let isbn = null;
    
    // Look for ISBN in search results
    if (googleSearchResults && googleSearchResults.length > 0) {
      for (const result of googleSearchResults) {
        // Try to extract ISBN from snippet or title using regex
        const isbnPattern = /(?:ISBN[- ]?1[03]?[: ]?)?(?=[0-9X]{10}|(?=(?:[0-9]+[- ]){3})[- 0-9X]{13}|97[89][- ]?[0-9]{10}|(?=(?:[0-9]+[- ]){4})[- 0-9]{17})[0-9]{1,5}[- ]?[0-9]+[- ]?[0-9]+[- ]?[0-9X]/i;
        
        const isbnMatch = result.snippet?.match(isbnPattern) || result.title?.match(isbnPattern);
        
        if (isbnMatch) {
          // Clean up the ISBN
          isbn = isbnMatch[0].replace(/[^0-9X]/gi, '');
          console.log(`[verify_title_${requestId}] Found ISBN: ${isbn} in search results`);
          break;
        }
      }
    }
    
    // If we found an ISBN, use the ISBN verification flow
    if (isbn) {
      console.log(`[verify_title_${requestId}] Using ISBN verification flow with ISBN: ${isbn}`);
      return verifyBookData(isbn, apiKeys);
    }
    
    // If no ISBN found, use Google Books direct search
    console.log(`[verify_title_${requestId}] Step 2: Searching with Google Books API`);
    const searchParams = {
      title: title,
      author: author,
      maxResults: 5,
      apiKey: apiKeys?.google_books_api_key
    };
    
    const books = await searchBooks(searchParams);
    
    if (!books || books.length === 0) {
      console.log(`[verify_title_${requestId}] No books found via Google Books API`);
      return {
        error: "No books found matching title and author",
        verification: {
          status: "failed",
          confidence: 0,
          message: "No books found matching title and author",
          sources: []
        }
      };
    }
    
    // Find the best match from search results
    let bestMatch = books[0]; // Default to first result
    
    // If we have multiple results, try to find the best one
    if (books.length > 1 && author) {
      // Find the one with matching author
      const authorMatch = books.find(book => 
        book.author && author && 
        book.author.toLowerCase().includes(author.toLowerCase()));
      
      if (authorMatch) {
        bestMatch = authorMatch;
      }
    }
    
    // If the best match has an ISBN, use the ISBN flow for better verification
    if (bestMatch.isbn) {
      console.log(`[verify_title_${requestId}] Using ISBN verification flow with ISBN from best match: ${bestMatch.isbn}`);
      return verifyBookData(bestMatch.isbn, apiKeys);
    }
    
    // Otherwise, proceed with limited verification using just Google Books data
    console.log(`[verify_title_${requestId}] Proceeding with limited verification (no ISBN found)`);
    
    // Add verification information
    bestMatch.verification = {
      status: "limited",
      confidence: 0.6,
      message: "Limited verification - no ISBN found",
      sources: ["Google Books"]
    };
    
    return bestMatch;
  } catch (error: any) {
    console.error(`[verify_title_${requestId}] Error in title/author verification:`, error);
    
    return {
      error: `Verification failed: ${error.message || error}`,
      verification: {
        status: "failed",
        confidence: 0,
        message: `Failed to verify book: ${error.message || error}`,
        sources: []
      }
    };
  }
}

// Add import for searchBooks from googleBooks
import { searchBooks } from "./googleBooks";